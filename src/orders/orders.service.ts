import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  Logger 
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateOrderDto, OrderResponseDto } from './dto/create-order.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 주문번호 생성
   * 형식: O + YYYYMMDDHHMISS + 3자리 랜덤
   */
  private generateOrderNumber(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `O${year}${month}${day}${hour}${minute}${second}${random}`;
  }

  /**
   * 배송비 계산
   */
  private async calculateShippingFee(
    totalAmount: number, 
    postalCode: string
  ): Promise<number> {
    // 기본 배송비 정책 조회
    const policy = await this.prisma.shippingPolicy.findFirst({
      where: {
        isActive: true,
        isDefault: true,
      },
    });

    if (!policy) {
      // 기본값 사용
      const BASE_FEE = 3000;
      const FREE_SHIPPING_AMOUNT = 50000;
      const JEJU_EXTRA = 3000;
      
      // 제주도 체크 (우편번호 63으로 시작)
      const isJeju = postalCode.startsWith('63');
      
      if (totalAmount >= FREE_SHIPPING_AMOUNT) {
        return isJeju ? JEJU_EXTRA : 0;
      }
      
      return BASE_FEE + (isJeju ? JEJU_EXTRA : 0);
    }

    // 정책 적용
    const isJeju = postalCode.startsWith('63');
    const extraFee = isJeju ? Number(policy.jejuExtraFee) : 0;
    
    if (policy.freeShippingAmount && totalAmount >= Number(policy.freeShippingAmount)) {
      return extraFee;
    }
    
    return Number(policy.baseFee) + extraFee;
  }

  /**
   * 주문 생성
   */
  async createOrder(userId: number, dto: CreateOrderDto): Promise<OrderResponseDto> {
    // 트랜잭션으로 처리
    return await this.prisma.$transaction(async (tx) => {
      // 1. 장바구니 아이템 조회
      const cartItems = await tx.cartItem.findMany({
        where: {
          id: { in: dto.cartItemIds },
          cart: { userId },
        },
        include: {
          product: true,
          productOption: true,
        },
      });

      if (cartItems.length === 0) {
        throw new BadRequestException('장바구니 아이템을 찾을 수 없습니다');
      }

      if (cartItems.length !== dto.cartItemIds.length) {
        throw new BadRequestException('일부 장바구니 아이템을 찾을 수 없습니다');
      }

      // 2. 상품 상태 검증
      for (const item of cartItems) {
        if (item.product.status !== 'ACTIVE') {
          throw new BadRequestException(`${item.product.name}은(는) 판매 중인 상품이 아닙니다`);
        }
        if (!item.productOption.isActive) {
          throw new BadRequestException(`${item.product.name}의 선택한 옵션은 판매 중지되었습니다`);
        }
      }

      // 3. 금액 계산
      const totalProductPrice = cartItems.reduce((sum, item) => {
        return sum + (Number(item.productOption.price) * item.quantity);
      }, 0);

      // 4. 포인트 검증
      const pointUsed = dto.pointUsed || 0;
      if (pointUsed > 0) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { points: true },
        });

        if (!user || user.points < pointUsed) {
          throw new BadRequestException('보유 포인트가 부족합니다');
        }
      }

      // 5. 배송비 계산
      const shippingFee = await this.calculateShippingFee(
        totalProductPrice,
        dto.shippingAddress.postalCode
      );

      // 6. 최종 결제액 계산
      const totalAmount = totalProductPrice + shippingFee - pointUsed;

      if (totalAmount < 0) {
        throw new BadRequestException('결제 금액이 0원 미만일 수 없습니다');
      }

      // 7. 주문 생성
      const orderNumber = this.generateOrderNumber();
      
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          status: 'PENDING_PAYMENT',
          inventoryStatus: 'NOT_PROCESSED',
          totalProductPrice,
          totalDiscount: 0,
          shippingFee,
          pointUsed,
          totalAmount,
          recipientName: dto.shippingAddress.recipientName,
          recipientPhone: dto.shippingAddress.recipientPhone,
          postalCode: dto.shippingAddress.postalCode,
          address: dto.shippingAddress.address,
          addressDetail: dto.shippingAddress.addressDetail || null,
          deliveryMessage: dto.shippingAddress.deliveryMessage || null,
          orderedAt: new Date(),
        },
      });

      // 8. 주문 아이템 생성
      const orderItems = await Promise.all(
        cartItems.map(item => 
          tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              productOptionId: item.productOptionId,
              productName: item.product.name,
              optionName: item.productOption.optionName,
              productPrice: item.productOption.price,
              quantity: item.quantity,
              subtotal: new Prisma.Decimal(Number(item.productOption.price) * item.quantity),
            },
          })
        )
      );

      // 9. 배송 정보 생성
      await tx.shipping.create({
        data: {
          orderId: order.id,
          status: 'PREPARING',
          shippingFee,
        },
      });

      // 10. 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: null,
          toStatus: 'PENDING_PAYMENT',
          changeReason: '주문 생성',
        },
      });

      // 11. 재고 차감 큐 등록 (실제 차감은 결제 완료 후)
      await Promise.all(
        cartItems.map(item =>
          tx.inventorySyncQueue.create({
            data: {
              orderId: order.id,
              sku: item.productOption.sku,
              quantity: item.quantity,
              action: 'DEDUCT',
              status: 'PENDING',
            },
          })
        )
      );

      // 12. 포인트 사용 처리
      if (pointUsed > 0) {
        // 포인트 차감
        await tx.user.update({
          where: { id: userId },
          data: {
            points: { decrement: pointUsed },
          },
        });

        // 포인트 이력
        await tx.pointHistory.create({
          data: {
            userId,
            type: 'USE',
            amount: -pointUsed,
            balance: 0, // 추후 계산 필요
            description: `주문 사용 (${orderNumber})`,
            relatedType: 'ORDER',
            relatedId: order.id,
          },
        });
      }

      // 13. 장바구니 아이템 삭제
      await tx.cartItem.deleteMany({
        where: {
          id: { in: dto.cartItemIds },
        },
      });

      this.logger.log(`주문 생성 완료: ${orderNumber}`);

      return {
        ...order,
        totalProductPrice: Number(order.totalProductPrice),
        totalDiscount: Number(order.totalDiscount),
        shippingFee: Number(order.shippingFee),
        pointUsed: Number(order.pointUsed),
        totalAmount: Number(order.totalAmount),
        items: orderItems.map(item => ({
          ...item,
          productPrice: Number(item.productPrice),
          subtotal: Number(item.subtotal),
        })),
      };
    });
  }

  /**
   * 주문 목록 조회
   */
  async findAll(
    userId: number,
    status?: string,
    page = 1,
    limit = 10
  ): Promise<{ items: OrderResponseDto[]; total: number }> {
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      userId,
    };

    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { orderedAt: 'desc' },
        include: {
          items: true,
          payment: true,
          shipping: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: orders.map(order => ({
        ...order,
        totalProductPrice: Number(order.totalProductPrice),
        totalDiscount: Number(order.totalDiscount),
        shippingFee: Number(order.shippingFee),
        pointUsed: Number(order.pointUsed),
        totalAmount: Number(order.totalAmount),
        items: order.items?.map(item => ({
          ...item,
          productPrice: Number(item.productPrice),
          subtotal: Number(item.subtotal),
        })),
      })),
      total,
    };
  }

  /**
   * 주문 취소
   */
  async cancelOrder(userId: number, orderNumber: string, reason: string): Promise<OrderResponseDto> {
    return await this.prisma.$transaction(async (tx) => {
      // 주문 조회
      const order = await tx.order.findFirst({
        where: {
          orderNumber,
          userId,
        },
        include: {
          items: {
            include: {
              productOption: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('주문을 찾을 수 없습니다');
      }

      // 취소 가능 상태 확인
      if (!['PENDING_PAYMENT', 'PAID', 'PREPARING'].includes(order.status)) {
        throw new BadRequestException('취소 가능한 상태가 아닙니다');
      }

      // 주문 상태 업데이트
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      });

      // 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'CANCELLED',
          changeReason: reason,
        },
      });

      // 재고 복구 (결제 완료 상태였던 경우만)
      if (['PAID', 'PREPARING'].includes(order.status)) {
        for (const item of order.items) {
          // 재고 캐시 업데이트
          await tx.inventoryCache.upsert({
            where: { sku: item.productOption.sku },
            create: {
              sku: item.productOption.sku,
              availableQty: item.quantity,
              lastUpdated: new Date(),
            },
            update: {
              availableQty: {
                increment: item.quantity,
              },
              lastUpdated: new Date(),
            },
          });

          // 재고 동기화 큐
          await tx.inventorySyncQueue.create({
            data: {
              orderId: order.id,
              sku: item.productOption.sku,
              quantity: item.quantity,
              action: 'RESTORE',
              status: 'PENDING',
            },
          });
        }
      }

      // 포인트 복구
      if (order.pointUsed > 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            points: { increment: Number(order.pointUsed) },
          },
        });

        await tx.pointHistory.create({
          data: {
            userId,
            type: 'REFUND',
            amount: Number(order.pointUsed),
            balance: 0, // 추후 계산
            description: `주문 취소 환불 (${order.orderNumber})`,
            relatedType: 'ORDER',
            relatedId: order.id,
          },
        });
      }

      this.logger.log(`주문 취소 완료: ${orderNumber}`);

      return {
        ...updatedOrder,
        totalProductPrice: Number(updatedOrder.totalProductPrice),
        totalDiscount: Number(updatedOrder.totalDiscount),
        shippingFee: Number(updatedOrder.shippingFee),
        pointUsed: Number(updatedOrder.pointUsed),
        totalAmount: Number(updatedOrder.totalAmount),
        items: order.items.map(item => ({
          ...item,
          productPrice: Number(item.productPrice),
          subtotal: Number(item.subtotal),
        })),
      };
    });
  }

  /**
   * 주문 확정 (구매 확정)
   */
  async confirmOrder(userId: number, orderNumber: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber,
        userId,
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    // 배송완료 상태인 경우만 구매확정 가능
    if (order.status !== 'DELIVERED') {
      throw new BadRequestException('배송이 완료된 주문만 구매확정 가능합니다');
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // 주문 상태 업데이트
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'COMPLETED',
          changeReason: '구매 확정',
        },
      });

      // 구매 확정 포인트 지급 (예: 구매금액의 1%)
      const pointAmount = Math.floor(Number(order.totalAmount) * 0.01);
      if (pointAmount > 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            points: { increment: pointAmount },
          },
        });

        await tx.pointHistory.create({
          data: {
            userId,
            type: 'EARN',
            amount: pointAmount,
            balance: 0, // 추후 계산
            description: `구매 확정 포인트 (${order.orderNumber})`,
            relatedType: 'ORDER',
            relatedId: order.id,
          },
        });
      }

      return updated;
    });

    this.logger.log(`주문 구매확정 완료: ${orderNumber}`);

    return {
      ...updatedOrder,
      totalProductPrice: Number(updatedOrder.totalProductPrice),
      totalDiscount: Number(updatedOrder.totalDiscount),
      shippingFee: Number(updatedOrder.shippingFee),
      pointUsed: Number(updatedOrder.pointUsed),
      totalAmount: Number(updatedOrder.totalAmount),
      items: order.items.map(item => ({
        ...item,
        productPrice: Number(item.productPrice),
        subtotal: Number(item.subtotal),
      })),
    };
  }

  /**
   * 주문 상태 변경 (관리자용)
   */
  async updateOrderStatus(
    orderNumber: string, 
    newStatus: string,
    reason: string
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // 주문 상태 업데이트
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: newStatus,
          ...(newStatus === 'SHIPPED' && { shippedAt: new Date() }),
          ...(newStatus === 'DELIVERED' && { deliveredAt: new Date() }),
        },
      });

      // 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: newStatus,
          changeReason: reason,
        },
      });

      // 배송 상태도 업데이트
      if (['SHIPPED', 'DELIVERED'].includes(newStatus)) {
        await tx.shipping.updateMany({
          where: { orderId: order.id },
          data: {
            status: newStatus === 'SHIPPED' ? 'IN_TRANSIT' : 'DELIVERED',
            ...(newStatus === 'SHIPPED' && { shippedAt: new Date() }),
            ...(newStatus === 'DELIVERED' && { deliveredAt: new Date() }),
          },
        });
      }

      return updated;
    });

    this.logger.log(`주문 상태 변경: ${orderNumber} -> ${newStatus}`);

    return {
      ...updatedOrder,
      totalProductPrice: Number(updatedOrder.totalProductPrice),
      totalDiscount: Number(updatedOrder.totalDiscount),
      shippingFee: Number(updatedOrder.shippingFee),
      pointUsed: Number(updatedOrder.pointUsed),
      totalAmount: Number(updatedOrder.totalAmount),
      items: order.items.map(item => ({
        ...item,
        productPrice: Number(item.productPrice),
        subtotal: Number(item.subtotal),
      })),
    };
  }

  /**
   * 주문 상세 조회
   */
  async findOne(userId: number, orderNumber: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber,
        userId,
      },
      include: {
        items: {
          include: {
            product: true,
            productOption: true,
          },
        },
        payment: true,
        shipping: true,
      },
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    return {
      ...order,
      totalProductPrice: Number(order.totalProductPrice),
      totalDiscount: Number(order.totalDiscount),
      shippingFee: Number(order.shippingFee),
      pointUsed: Number(order.pointUsed),
      totalAmount: Number(order.totalAmount),
      items: order.items.map(item => ({
        ...item,
        productPrice: Number(item.productPrice),
        subtotal: Number(item.subtotal),
      })),
    };
  }
}