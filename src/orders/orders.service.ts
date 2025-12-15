import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';
import { CryptoUtil } from '../common/utils/crypto.util';
import { OrderQueryDto, ClaimQueryDto } from './dto/order-query.dto';
import {
  UpdateOrderStatusDto,
  UpdateTrackingDto,
  ProcessRefundDto,
  ProcessExchangeReturnDto,
} from './dto/order-action.dto';

/**
 * 주문 관리 서비스
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 주문 목록 조회
   */
  async findAll(query: OrderQueryDto) {
    const { page = 1, limit = 20, search, status, startDate, endDate } = query;

    const where: any = {};

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { recipientName: { contains: search } },
        { recipientMobile: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.orderedAt = {};
      if (startDate) {
        where.orderedAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.orderedAt.lte = end;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { orderedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              mobile: true,
              email: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: {
                    where: { imageType: 'MAIN' },
                    take: 1,
                    select: { imageUrl: true },
                  },
                },
              },
            },
          },
          shipping: true,
          payment: {
            select: {
              paymentMethod: true,
              status: true,
              pgTransactionId: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((order) => this.formatOrderListItem(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 주문 상세 조회
   */
  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
            status: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                sku: true,
                images: {
                  where: { imageType: 'MAIN' },
                  take: 1,
                  select: { imageUrl: true },
                },
              },
            },
          },
        },
        shipping: true,
        payment: true,
        refund: true,
        exchangeReturns: {
          orderBy: { requestedAt: 'desc' },
        },
        stateLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    return this.formatOrderDetail(order);
  }

  /**
   * 주문 상태 변경
   */
  async updateStatus(id: number, dto: UpdateOrderStatusDto, operatorId?: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    const now = getNowKST();
    const updates: any = {
      status: dto.status,
      updatedAt: now,
    };

    // 상태별 타임스탬프 업데이트
    if (dto.status === 'SHIPPING' && !order.shippedAt) {
      updates.shippedAt = now;
    }
    if (dto.status === 'DELIVERED' && !order.deliveredAt) {
      updates.deliveredAt = now;
    }
    if (dto.status === 'COMPLETED' && !order.completedAt) {
      updates.completedAt = now;
    }
    if (dto.status === 'CANCELLED' && !order.cancelledAt) {
      updates.cancelledAt = now;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: updates,
      });

      await tx.orderStateLog.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: dto.status,
          changedBy: operatorId,
          changeReason: dto.reason || '관리자 상태 변경',
          createdAt: now,
        },
      });
    });

    this.logger.log(`주문 상태 변경: orderId=${id}, ${order.status} -> ${dto.status}`);

    return { success: true };
  }

  /**
   * 송장 정보 입력/수정
   */
  async updateTracking(orderId: number, dto: UpdateTrackingDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { shipping: true },
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다.');
    }

    const now = getNowKST();

    if (order.shipping) {
      await this.prisma.shipping.update({
        where: { id: order.shipping.id },
        data: {
          courierCode: dto.courierCode,
          courierName: dto.courierName,
          trackingNumber: dto.trackingNumber,
          status: 'READY_FOR_SHIPMENT',
          readyAt: now,
          updatedAt: now,
        },
      });
    } else {
      await this.prisma.shipping.create({
        data: {
          orderId,
          courierCode: dto.courierCode,
          courierName: dto.courierName,
          trackingNumber: dto.trackingNumber,
          status: 'READY_FOR_SHIPMENT',
          readyAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    this.logger.log(`송장 입력: orderId=${orderId}, tracking=${dto.trackingNumber}`);

    return { success: true };
  }

  /**
   * 취소/교환/환불 목록 조회
   */
  async findClaims(query: ClaimQueryDto) {
    const { page = 1, limit = 20, search, type, status, startDate, endDate } = query;

    // 환불(취소) 목록
    const refundWhere: any = {};
    // 교환/반품 목록
    const exchangeReturnWhere: any = {};

    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      refundWhere.requestedAt = dateFilter;
      exchangeReturnWhere.requestedAt = dateFilter;
    }

    if (status) {
      refundWhere.status = status;
      exchangeReturnWhere.status = status;
    }

    // 검색어가 있으면 주문번호로 필터링
    if (search) {
      const orders = await this.prisma.order.findMany({
        where: {
          OR: [
            { orderNumber: { contains: search } },
            { recipientName: { contains: search } },
          ],
        },
        select: { id: true },
      });
      const orderIds = orders.map((o) => o.id);
      refundWhere.orderId = { in: orderIds };
      exchangeReturnWhere.orderId = { in: orderIds };
    }

    const claims: any[] = [];

    // 타입 필터에 따라 조회
    if (!type || type === 'CANCEL' || type === 'RETURN_REFUND') {
      const refunds = await this.prisma.refund.findMany({
        where: refundWhere,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              recipientName: true,
              recipientMobile: true,
              totalAmount: true,
              items: {
                select: {
                  productName: true,
                },
                take: 1,
              },
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
      });

      for (const refund of refunds) {
        if (type && type !== refund.refundType && type !== 'CANCEL') continue;

        // 상품명 생성 (첫 번째 상품명)
        const productName = refund.order.items?.[0]?.productName || '-';

        claims.push({
          id: refund.id,
          claimType: refund.refundType === 'CANCEL' ? 'CANCEL' : 'RETURN_REFUND',
          // 프론트엔드 호환용 type 필드 추가
          type: refund.refundType === 'CANCEL' ? 'CANCEL' : 'RETURN_REFUND',
          source: 'refund',
          orderId: refund.orderId,
          orderNumber: refund.order.orderNumber,
          // 프론트엔드 호환용 필드명
          userName: CryptoUtil.decrypt(refund.order.recipientName),
          userMobile: CryptoUtil.decryptDeterministic(refund.order.recipientMobile),
          productName,
          amount: Number(refund.order.totalAmount),
          status: refund.status,
          reason: refund.reason,
          reasonDetail: refund.reasonDetail,
          refundAmount: Number(refund.refundAmount),
          requestedAt: refund.requestedAt,
          completedAt: refund.completedAt,
          adminMemo: refund.adminMemo,
        });
      }
    }

    if (!type || type === 'EXCHANGE' || type === 'RETURN') {
      const exchangeReturns = await this.prisma.exchangeReturn.findMany({
        where: exchangeReturnWhere,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              recipientName: true,
              recipientMobile: true,
              totalAmount: true,
              items: {
                select: {
                  productName: true,
                },
                take: 1,
              },
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
      });

      for (const er of exchangeReturns) {
        if (type && type !== er.type) continue;

        // 상품명 생성 (첫 번째 상품명)
        const productName = er.order.items?.[0]?.productName || '-';

        claims.push({
          id: er.id,
          claimType: er.type,
          // 프론트엔드 호환용 type 필드 추가
          type: er.type,
          source: 'exchangeReturn',
          orderId: er.orderId,
          orderNumber: er.order.orderNumber,
          // 프론트엔드 호환용 필드명
          userName: CryptoUtil.decrypt(er.order.recipientName),
          userMobile: CryptoUtil.decryptDeterministic(er.order.recipientMobile),
          productName,
          amount: Number(er.order.totalAmount),
          status: er.status,
          reason: er.reason,
          reasonDetail: er.reasonDetail,
          refundAmount: Number(er.shippingFee) || 0,
          shippingFee: Number(er.shippingFee),
          trackingNumber: er.trackingNumber,
          requestedAt: er.requestedAt,
          completedAt: er.completedAt,
          adminMemo: er.adminMemo,
        });
      }
    }

    // 날짜순 정렬
    claims.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

    // 페이징
    const total = claims.length;
    const startIdx = (page - 1) * limit;
    const pagedItems = claims.slice(startIdx, startIdx + limit);

    return {
      items: pagedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 환불 처리 (승인/거절)
   */
  async processRefund(refundId: number, dto: ProcessRefundDto) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { order: true },
    });

    if (!refund) {
      throw new NotFoundException('환불 요청을 찾을 수 없습니다.');
    }

    if (refund.status !== 'REQUESTED') {
      throw new BadRequestException('이미 처리된 환불 요청입니다.');
    }

    const now = getNowKST();
    const updates: any = {
      status: dto.status,
      adminMemo: dto.adminMemo,
    };

    if (dto.status === 'APPROVED' || dto.status === 'COMPLETED') {
      updates.completedAt = now;
      if (dto.refundAmount) {
        updates.refundAmount = dto.refundAmount;
      }
    } else if (dto.status === 'REJECTED') {
      updates.rejectedAt = now;
    }

    await this.prisma.refund.update({
      where: { id: refundId },
      data: updates,
    });

    this.logger.log(`환불 처리: refundId=${refundId}, status=${dto.status}`);

    return { success: true };
  }

  /**
   * 교환/반품 처리 (승인/거절/완료)
   */
  async processExchangeReturn(id: number, dto: ProcessExchangeReturnDto) {
    const er = await this.prisma.exchangeReturn.findUnique({
      where: { id },
    });

    if (!er) {
      throw new NotFoundException('교환/반품 요청을 찾을 수 없습니다.');
    }

    const now = getNowKST();
    const updates: any = {
      status: dto.status,
      adminMemo: dto.adminMemo,
    };

    if (dto.trackingNumber) {
      updates.trackingNumber = dto.trackingNumber;
      updates.courierCode = dto.courierCode;
      updates.courierName = dto.courierName;
    }

    if (dto.status === 'APPROVED') {
      updates.approvedAt = now;
    } else if (dto.status === 'REJECTED') {
      updates.rejectedAt = now;
    } else if (dto.status === 'COMPLETED') {
      updates.completedAt = now;
    }

    await this.prisma.exchangeReturn.update({
      where: { id },
      data: updates,
    });

    this.logger.log(`교환/반품 처리: id=${id}, status=${dto.status}`);

    return { success: true };
  }

  /**
   * 주문 통계 조회
   */
  async getStats() {
    const now = getNowKST();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalOrders,
      todayOrders,
      monthOrders,
      pendingOrders,
      shippingOrders,
      pendingClaims,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({
        where: { orderedAt: { gte: today } },
      }),
      this.prisma.order.count({
        where: { orderedAt: { gte: thisMonth } },
      }),
      this.prisma.order.count({
        where: { status: 'PAID' },
      }),
      this.prisma.order.count({
        where: { status: 'SHIPPING' },
      }),
      this.prisma.refund.count({
        where: { status: 'REQUESTED' },
      }) + await this.prisma.exchangeReturn.count({
        where: { status: 'REQUESTED' },
      }),
    ]);

    return {
      totalOrders,
      todayOrders,
      monthOrders,
      pendingOrders,
      shippingOrders,
      pendingClaims,
    };
  }

  /**
   * 주문 목록 아이템 포맷
   */
  private formatOrderListItem(order: any) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      itemCount: order.items?.length || 0,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      totalDiscount: Number(order.totalDiscount || 0),
      orderedAt: order.orderedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      items: order.items?.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        product: item.product
          ? {
              id: item.product.id,
              name: item.product.name,
              imageUrl: item.product.images?.[0]?.imageUrl || null,
            }
          : null,
      })),
      shipping: order.shipping
        ? {
            recipientName: CryptoUtil.decrypt(order.shipping.recipientName || order.recipientName),
            recipientMobile: CryptoUtil.decryptDeterministic(order.shipping.recipientMobile || order.recipientMobile),
            address: CryptoUtil.decrypt(order.shipping.address || order.address),
            status: order.shipping.status,
            courierName: order.shipping.courierName,
            trackingNumber: order.shipping.trackingNumber,
          }
        : {
            recipientName: CryptoUtil.decrypt(order.recipientName),
            recipientMobile: CryptoUtil.decryptDeterministic(order.recipientMobile),
            address: CryptoUtil.decrypt(order.address),
          },
      payment: order.payment
        ? {
            method: order.payment.paymentMethod,
            status: order.payment.status,
          }
        : null,
      user: order.user,
    };
  }

  /**
   * 주문 상세 포맷
   */
  private formatOrderDetail(order: any) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      inventoryStatus: order.inventoryStatus,

      // 금액 정보
      totalProductPrice: Number(order.totalProductPrice),
      totalDiscount: Number(order.totalDiscount),
      shippingFee: Number(order.shippingFee),
      pointUsed: Number(order.pointUsed),
      totalAmount: Number(order.totalAmount),

      // 배송 정보
      recipientName: CryptoUtil.decrypt(order.recipientName),
      recipientMobile: CryptoUtil.decrypt(order.recipientMobile),
      postalCode: order.postalCode,
      address: CryptoUtil.decrypt(order.address),
      addressDetail: CryptoUtil.decrypt(order.addressDetail),
      deliveryMessage: order.deliveryMessage,

      // 물류 정보
      logisticsProvider: order.logisticsProvider,
      logisticsUniq: order.logisticsUniq,

      // 일시 정보
      orderedAt: order.orderedAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,

      // 주문 상품
      items: order.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        unitPrice: Number(item.productPrice),
        quantity: item.quantity,
        subtotal: Number(item.subtotal),
        product: item.product,
      })),

      // 배송 정보
      shipping: order.shipping
        ? {
            id: order.shipping.id,
            status: order.shipping.status,
            courierCode: order.shipping.courierCode,
            courierName: order.shipping.courierName,
            trackingNumber: order.shipping.trackingNumber,
            readyAt: order.shipping.readyAt,
            shippedAt: order.shipping.shippedAt,
            deliveredAt: order.shipping.deliveredAt,
          }
        : null,

      // 결제 정보
      payment: order.payment
        ? {
            id: order.payment.id,
            pgProvider: order.payment.pgProvider,
            pgTransactionId: order.payment.pgTransactionId,
            method: order.payment.paymentMethod,
            status: order.payment.status,
            amount: Number(order.payment.amount),
            pointAmount: Number(order.payment.pointAmount),
            paidAt: order.payment.paidAt,
          }
        : null,

      // 환불 정보
      refund: order.refund
        ? {
            id: order.refund.id,
            refundType: order.refund.refundType,
            status: order.refund.status,
            refundAmount: Number(order.refund.refundAmount),
            reason: order.refund.reason,
            requestedAt: order.refund.requestedAt,
            completedAt: order.refund.completedAt,
          }
        : null,

      // 교환/반품 내역
      exchangeReturns: order.exchangeReturns.map((er: any) => ({
        id: er.id,
        type: er.type,
        status: er.status,
        reason: er.reason,
        shippingFee: Number(er.shippingFee),
        trackingNumber: er.trackingNumber,
        requestedAt: er.requestedAt,
        completedAt: er.completedAt,
      })),

      // 상태 변경 로그
      stateLogs: order.stateLogs.map((log: any) => ({
        id: log.id,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        changeReason: log.changeReason,
        createdAt: log.createdAt,
      })),

      // 주문자 정보
      user: order.user,
    };
  }
}
