import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { PointService } from '../../point/point.service';
import { CouponService } from '../../coupons/services/coupon.service';
import { CreateOrderDto, OrderResponseDto } from '../dto/orders/create-order.dto';
import { Prisma } from '@prisma/client';
import { convertDecimalToNumber } from '../../common/utils/decimal.util';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { getNowKST } from '../../common/utils/kst-date.util';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pointService: PointService,
    private readonly couponService: CouponService,
  ) {}

  /**
   * 주문번호 생성
   * 형식: O + YYYYMMDDHHMISS + 3자리 랜덤
   */
  private generateOrderNumber(): string {
    const now = getNowKST();
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
    const jejuAreaFee = convertDecimalToNumber(policy.jejuAreaFee) || 0;
    const extraFee = isJeju ? jejuAreaFee : 0;

    const freeShippingThreshold = convertDecimalToNumber(policy.freeShippingThreshold) || 0;
    if (freeShippingThreshold > 0 && totalAmount >= freeShippingThreshold) {
      return extraFee;
    }

    const baseShippingFee = convertDecimalToNumber(policy.baseShippingFee) || 0;
    return baseShippingFee + extraFee;
  }

  /**
   * 주문 생성
   */
  async createOrder(userId: number, dto: CreateOrderDto): Promise<OrderResponseDto> {
    // 트랜잭션으로 처리
    return await this.prisma.$transaction(async (tx) => {
      // 1. 상품 정보 조회
      const orderItemsData = await Promise.all(
        dto.items.map(async (item) => {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });

          if (!product) {
            throw new BadRequestException(`상품 ID ${item.productId}를 찾을 수 없습니다`);
          }

          return {
            product,
            productId: item.productId,
            quantity: item.quantity,
          };
        })
      );

      // 2. 챌린지/구독 상품 중복 구매 체크
      for (const item of orderItemsData) {
        if (['CHALLENGE', 'SUBSCRIPTION'].includes(item.product.categoryCode || '')) {
          const existingTicket = await tx.challengeTicket.findFirst({
            where: {
              userId,
              productId: item.productId,
              status: { in: ['PURCHASED', 'ACTIVATED'] }
            }
          });

          if (existingTicket) {
            throw new BadRequestException(`${item.product.name}은(는) 이미 사용 가능한 이용권이 있어 추가 구매할 수 없습니다`);
          }
        }
      }

      // 3. 상품 상태 검증
      for (const item of orderItemsData) {
        if (item.product.status !== 'ACTIVE') {
          throw new BadRequestException(`${item.product.name}은(는) 판매 중인 상품이 아닙니다`);
        }
        if (item.quantity > item.product.maxOrderQty) {
          throw new BadRequestException(`${item.product.name}의 최대 주문 수량은 ${item.product.maxOrderQty}개입니다`);
        }
      }

      // 4. 금액 계산
      const totalProductPrice = orderItemsData.reduce((sum, item) => {
        const price = convertDecimalToNumber(item.product.price) || 0;
        return sum + (price * item.quantity);
      }, 0);

      // 5. 포인트 검증
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

      // 5-1. 쿠폰 검증 및 할인 금액 계산
      let couponDiscount = 0;
      let appliedCoupon = null;

      if (dto.userCouponId) {
        // 쿠폰 정보 조회
        const userCoupon = await tx.userCoupon.findFirst({
          where: {
            id: dto.userCouponId,
            userId,
            status: 'ACTIVE'
          },
          include: {
            coupon: {
              include: {
                product: true
              }
            }
          }
        });

        if (!userCoupon) {
          throw new BadRequestException('유효하지 않은 쿠폰입니다');
        }

        // 만료 확인
        const now = getNowKST();
        if (userCoupon.expiresAt <= now) {
          throw new BadRequestException('만료된 쿠폰입니다');
        }

        // 쿠폰 적용 가능한 상품이 주문에 포함되어 있는지 확인
        const applicableItem = orderItemsData.find(
          item => item.product.id === userCoupon.coupon.productId
        );

        if (!applicableItem) {
          throw new BadRequestException(
            `이 쿠폰은 ${userCoupon.coupon.product.name}에만 사용할 수 있습니다`
          );
        }

        // 할인 금액 계산
        const productPrice = convertDecimalToNumber(applicableItem.product.price) || 0;
        const itemTotal = productPrice * applicableItem.quantity;

        if (userCoupon.coupon.discountType === 'PERCENTAGE') {
          couponDiscount = Math.floor(itemTotal * userCoupon.coupon.discountValue / 100);
          if (userCoupon.coupon.maxDiscountAmount) {
            couponDiscount = Math.min(couponDiscount, userCoupon.coupon.maxDiscountAmount);
          }
        } else {
          // AMOUNT 타입
          couponDiscount = Math.min(userCoupon.coupon.discountValue, itemTotal);
        }

        appliedCoupon = userCoupon;
        this.logger.log(`쿠폰 적용: ${userCoupon.coupon.name}, 할인액: ${couponDiscount}원`);
      }

      // 6. 배송비 계산
      const shippingFee = await this.calculateShippingFee(
        totalProductPrice,
        dto.shippingAddress.postalCode
      );

      // 7. 최종 결제액 계산
      const totalAmount = totalProductPrice + shippingFee - couponDiscount - pointUsed;

      if (totalAmount < 0) {
        throw new BadRequestException('결제 금액이 0원 미만일 수 없습니다');
      }

      // 8. 주문 생성
      const orderNumber = this.generateOrderNumber();
      
      const order = await tx.order.create({
        data: {
          orderNumber,
          status: 'PENDING_PAYMENT',
          inventoryStatus: 'NOT_PROCESSED',
          totalProductPrice,
          totalDiscount: couponDiscount,
          shippingFee,
          pointUsed,
          totalAmount,
          recipientName: CryptoUtil.encrypt(dto.shippingAddress.recipientName),
          recipientMobile: CryptoUtil.encrypt(dto.shippingAddress.recipientPhone),
          postalCode: dto.shippingAddress.postalCode,
          address: CryptoUtil.encrypt(dto.shippingAddress.address),
          addressDetail: dto.shippingAddress.addressDetail ? CryptoUtil.encrypt(dto.shippingAddress.addressDetail) : null,
          deliveryMessage: dto.shippingAddress.deliveryMessage || null,
          orderedAt: getNowKST(),
          createdAt: getNowKST(),
          user: {
            connect: { id: userId }
          }
        },
      });

      // 9. 주문 아이템 생성
      const orderItems = await Promise.all(
        orderItemsData.map(item => {
          const price = convertDecimalToNumber(item.product.price) || 0;
          return tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              productName: item.product.name,
              productPrice: new Prisma.Decimal(price),
              quantity: item.quantity,
              subtotal: new Prisma.Decimal(price * item.quantity),
              createdAt: getNowKST(),
            },
          });
        })
      );

      // 10. 챌린지/구독 상품인 경우 티켓 자동 생성
      const challengeTickets = await Promise.all(
        orderItems
          .filter((orderItem, idx) => {
            const originalItem = orderItemsData[idx];
            return ['CHALLENGE', 'SUBSCRIPTION'].includes(originalItem.product.categoryCode || '');
          })
          .map((orderItem, idx) => {
            const originalItem = orderItemsData[idx];
            const ticketType = originalItem.product.categoryCode === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'CHALLENGE';
            this.logger.log(`챌린지 티켓 생성: 상품 ${orderItem.productId}, 타입 ${ticketType}, orderItemId ${orderItem.id}`);

            return tx.challengeTicket.create({
              data: {
                userId,
                productId: orderItem.productId,
                orderItemId: orderItem.id,
                status: 'PURCHASED',
                ticketType,
                purchaseDate: getNowKST(),
                createdAt: getNowKST(),
              },
            });
          })
      );

      if (challengeTickets.length > 0) {
        this.logger.log(`챌린지 티켓 ${challengeTickets.length}개 생성 완료`);
      }

      // 11. 배송 정보 생성
      await tx.shipping.create({
        data: {
          orderId: order.id,
          status: 'PREPARING',
          shippingFee,
          createdAt: getNowKST(),
        },
      });

      // 12. 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: null,
          toStatus: 'PENDING_PAYMENT',
          changeReason: '주문 생성',
          createdAt: getNowKST(),
        },
      });

      // 13. 재고 차감 큐 등록 (실제 차감은 결제 완료 후)
      // TODO: InventorySyncQueue 테이블이 없어서 주석 처리
      // await Promise.all(
      //   orderItemsData.map(item =>
      //     tx.inventorySyncQueue.create({
      //       data: {
      //         orderId: order.id,
      //         sku: item.product.sku,
      //         quantity: item.quantity,
      //         action: 'DEDUCT',
      //         status: 'PENDING',
      //       },
      //     })
      //   )
      // );

      // 14. 쿠폰 사용 처리
      if (appliedCoupon) {
        await tx.userCoupon.update({
          where: { id: appliedCoupon.id },
          data: {
            status: 'USED',
            usedAt: getNowKST(),
            usedOrderId: order.id
          }
        });
        this.logger.log(`쿠폰 ${appliedCoupon.id} 사용 완료`);
      }

      // 15. 포인트 사용 처리
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
            createdAt: getNowKST(),
          },
        });
      }

      // 16. 장바구니 아이템 삭제 (cartItemIds가 제공된 경우에만)
      if (dto.cartItemIds && dto.cartItemIds.length > 0) {
        await tx.cartItem.deleteMany({
          where: {
            id: { in: dto.cartItemIds },
          },
        });
      }

      this.logger.log(`주문 생성 완료: ${orderNumber}, 쿠폰 할인: ${couponDiscount}원`);

      return {
        ...order,
        // 개인정보 복호화
        recipientName: CryptoUtil.decrypt(order.recipientName),
        recipientMobile: CryptoUtil.decrypt(order.recipientMobile),
        address: CryptoUtil.decrypt(order.address),
        addressDetail: order.addressDetail ? CryptoUtil.decrypt(order.addressDetail) : null,
        // 금액 변환
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
        // 개인정보 복호화
        recipientName: CryptoUtil.decrypt(order.recipientName),
        recipientMobile: CryptoUtil.decrypt(order.recipientMobile),
        address: CryptoUtil.decrypt(order.address),
        addressDetail: order.addressDetail ? CryptoUtil.decrypt(order.addressDetail) : null,
        // 금액 변환
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
              product: true,
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
          cancelledAt: getNowKST(),
        },
      });

      // 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'CANCELLED',
          changeReason: reason,
          createdAt: getNowKST(),
        },
      });

      // TODO: 재고 복구 처리 필요
      // 재고 관련 테이블(inventoryCache, inventorySyncQueue)이 삭제되어 주석 처리
      // 추후 재고 시스템 재구축 시 다음 로직 적용:
      // 1. 주문 취소 시 차감했던 재고를 복구
      // 2. inventoryCache 테이블의 availableQty 증가
      // 3. inventorySyncQueue에 RESTORE 액션 등록
      // if (['PAID', 'PREPARING'].includes(order.status)) {
      //   for (const item of order.items) {
      //     await tx.inventoryCache.upsert({
      //       where: { sku: item.product.sku },
      //       create: {
      //         sku: item.product.sku,
      //         availableQty: item.quantity,
      //         lastUpdated: getNowKST(),
      //       },
      //       update: {
      //         availableQty: { increment: item.quantity },
      //         lastUpdated: getNowKST(),
      //       },
      //     });
      //     await tx.inventorySyncQueue.create({
      //       data: {
      //         orderId: order.id,
      //         sku: item.product.sku,
      //         quantity: item.quantity,
      //         action: 'RESTORE',
      //         status: 'PENDING',
      //       },
      //     });
      //   }
      // }

      // 챌린지/구독 티켓 취소 처리
      const cancelledTickets = await tx.challengeTicket.updateMany({
        where: {
          orderItemId: { in: order.items.map(item => item.id) },
          status: 'PURCHASED', // 구매만 된 상태만 취소 가능
        },
        data: {
          status: 'CANCELLED',
        },
      });

      if (cancelledTickets.count > 0) {
        this.logger.log(`챌린지 티켓 ${cancelledTickets.count}개 취소 완료`);
      }

      // 이미 활성화된 티켓 확인 (환불 불가 경고)
      const activatedTickets = await tx.challengeTicket.findMany({
        where: {
          orderItemId: { in: order.items.map(item => item.id) },
          status: { in: ['ACTIVATED', 'USED'] },
        },
      });

      if (activatedTickets.length > 0) {
        this.logger.warn(`이미 활성화된 티켓 ${activatedTickets.length}개 존재 - 특별 처리 필요`);
        // TODO: 이미 사용 중인 챌린지가 있는 경우 환불 정책에 따라 처리
      }

      // 쿠폰 복구
      const usedCoupon = await tx.userCoupon.findFirst({
        where: {
          usedOrderId: order.id,
          status: 'USED'
        }
      });

      if (usedCoupon) {
        // 만료되지 않았으면 ACTIVE로 복구, 만료되었으면 EXPIRED로
        const now = getNowKST();
        const newStatus = usedCoupon.expiresAt > now ? 'ACTIVE' : 'EXPIRED';

        await tx.userCoupon.update({
          where: { id: usedCoupon.id },
          data: {
            status: newStatus,
            usedAt: null,
            usedOrderId: null
          }
        });

        this.logger.log(`쿠폰 ${usedCoupon.id} 복구 완료 (상태: ${newStatus})`);
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
            createdAt: getNowKST(),
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
          completedAt: getNowKST(),
        },
      });

      // 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'COMPLETED',
          changeReason: '구매 확정',
          createdAt: getNowKST(),
        },
      });

      // 구매 확정 포인트 지급 (예: 구매금액의 1%)
      const pointAmount = Math.floor(Number(order.totalAmount) * 0.01);
      if (pointAmount > 0) {
        // 공통 포인트 지급 서비스 사용
        await this.pointService.awardPointsInTransaction(
          tx,
          userId,
          pointAmount,
          `구매 확정 포인트 (${order.orderNumber})`,
          'ORDER',
          order.id
        );
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
          ...(newStatus === 'SHIPPED' && { shippedAt: getNowKST() }),
          ...(newStatus === 'DELIVERED' && { deliveredAt: getNowKST() }),
        },
      });

      // 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: newStatus,
          changeReason: reason,
          createdAt: getNowKST(),
        },
      });

      // 배송 상태도 업데이트
      if (['SHIPPED', 'DELIVERED'].includes(newStatus)) {
        await tx.shipping.updateMany({
          where: { orderId: order.id },
          data: {
            status: newStatus === 'SHIPPED' ? 'IN_TRANSIT' : 'DELIVERED',
            ...(newStatus === 'SHIPPED' && { shippedAt: getNowKST() }),
            ...(newStatus === 'DELIVERED' && { deliveredAt: getNowKST() }),
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
      // 개인정보 복호화
      recipientName: CryptoUtil.decrypt(order.recipientName),
      recipientMobile: CryptoUtil.decrypt(order.recipientMobile),
      address: CryptoUtil.decrypt(order.address),
      addressDetail: order.addressDetail ? CryptoUtil.decrypt(order.addressDetail) : null,
      // 금액 변환
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