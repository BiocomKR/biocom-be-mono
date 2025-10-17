import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { Prisma } from '@prisma/client';
import { getNowKST } from '../../common/utils/kst-date.util';

@Injectable()
export class ManagementShippingService {
  private readonly logger = new Logger(ManagementShippingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 전체 배송 목록 조회
   */
  async findAll(params: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page: number;
    limit: number;
  }) {
    const { status, startDate, endDate, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: any = {}; // TODO: Shipping 테이블 생성 후 Prisma.ShippingWhereInput로 변경
    
    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [items, total] = await Promise.all([
      this.prisma.shipping.findMany({
        where,
        skip,
        take: limit,
        include: {
          order: {
            select: {
              orderNumber: true,
              userId: true,
              status: true,
              totalAmount: true,
              recipientName: true,
              recipientPhone: true,
              user: {
                select: {
                  name: true,
                  email: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.shipping.count({ where })
    ]);

    return {
      items: items.map(item => ({
        id: item.id,
        orderNumber: item.order.orderNumber,
        customerName: item.order.user.name,
        customerEmail: item.order.user.email,
        recipientName: item.order.recipientName,
        recipientPhone: item.order.recipientPhone,
        courierCode: item.courierCode,
        courierName: item.courierName,
        trackingNumber: item.trackingNumber,
        status: item.status,
        shippingFee: Number(item.shippingFee),
        shippedAt: item.shippedAt,
        deliveredAt: item.deliveredAt,
        createdAt: item.createdAt
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 운송장 번호 등록
   * 택배사에서 발행받은 운송장 번호를 시스템에 등록
   */
  async registerTracking(orderNumber: string, dto: {
    courierCode: string;
    courierName: string;
    trackingNumber: string;
  }) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber },
      include: { shipping: true }
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    if (!order.shipping) {
      throw new NotFoundException('배송 정보를 찾을 수 없습니다');
    }

    // 배송 가능 상태 확인
    if (!['PAID', 'PREPARING'].includes(order.status)) {
      throw new BadRequestException('운송장을 등록할 수 없는 주문 상태입니다');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 배송 정보 업데이트
      const shipping = await tx.shipping.update({
        where: { id: order.shipping!.id },
        data: {
          courierCode: dto.courierCode,
          courierName: dto.courierName,
          trackingNumber: dto.trackingNumber,
          status: 'READY_FOR_SHIPMENT',
          readyAt: getNowKST()
        }
      });

      // 주문 상태 업데이트
      if (order.status === 'PAID') {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'PREPARING' }
        });

        await tx.orderStateLog.create({
          data: {
            orderId: order.id,
            fromStatus: 'PAID',
            toStatus: 'PREPARING',
            changeReason: '운송장 등록 - 배송 준비'
          }
        });
      }

      return shipping;
    });

    this.logger.log(`운송장 등록 완료: ${orderNumber} / ${dto.trackingNumber}`);

    return {
      success: true,
      message: '운송장이 등록되었습니다',
      trackingNumber: dto.trackingNumber
    };
  }

  /**
   * 배송 시작 처리
   * 택배사가 물건을 수거한 후 호출
   */
  async startShipping(orderNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber },
      include: { shipping: true }
    });

    if (!order || !order.shipping) {
      throw new NotFoundException('배송 정보를 찾을 수 없습니다');
    }

    if (order.status !== 'PREPARING') {
      throw new BadRequestException('배송 준비 중인 주문만 발송 처리 가능합니다');
    }

    if (!order.shipping.trackingNumber) {
      throw new BadRequestException('운송장 번호가 등록되지 않았습니다');
    }

    await this.prisma.$transaction(async (tx) => {
      // 배송 상태 업데이트
      await tx.shipping.update({
        where: { id: order.shipping!.id },
        data: {
          status: 'IN_TRANSIT',
          shippedAt: getNowKST()
        }
      });

      // 주문 상태 업데이트
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'SHIPPED',
          shippedAt: getNowKST()
        }
      });

      // 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: 'PREPARING',
          toStatus: 'SHIPPED',
          changeReason: '배송 시작'
        }
      });
    });

    this.logger.log(`배송 시작: ${orderNumber}`);

    return {
      success: true,
      message: '배송이 시작되었습니다'
    };
  }

  /**
   * 배송 완료 처리
   * 고객이 물건을 수령한 후 호출
   */
  async completeShipping(orderNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber },
      include: { shipping: true }
    });

    if (!order || !order.shipping) {
      throw new NotFoundException('배송 정보를 찾을 수 없습니다');
    }

    if (order.status !== 'SHIPPED') {
      throw new BadRequestException('배송 중인 주문만 배송완료 처리 가능합니다');
    }

    await this.prisma.$transaction(async (tx) => {
      // 배송 상태 업데이트
      await tx.shipping.update({
        where: { id: order.shipping!.id },
        data: {
          status: 'DELIVERED',
          deliveredAt: getNowKST()
        }
      });

      // 주문 상태 업데이트
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'DELIVERED',
          deliveredAt: getNowKST()
        }
      });

      // 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: 'SHIPPED',
          toStatus: 'DELIVERED',
          changeReason: '배송 완료'
        }
      });
    });

    this.logger.log(`배송 완료: ${orderNumber}`);

    return {
      success: true,
      message: '배송이 완료되었습니다'
    };
  }

  /**
   * 배송 상태 일괄 변경
   */
  async batchUpdateStatus(orderNumbers: string[], status: string) {
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const orderNumber of orderNumbers) {
      try {
        switch (status) {
          case 'IN_TRANSIT':
            await this.startShipping(orderNumber);
            break;
          case 'DELIVERED':
            await this.completeShipping(orderNumber);
            break;
          default:
            throw new BadRequestException(`지원하지 않는 상태: ${status}`);
        }
        results.push({ orderNumber, success: true });
        successCount++;
      } catch (error: any) {
        results.push({ 
          orderNumber, 
          success: false, 
          error: error.message 
        });
        failCount++;
      }
    }

    return {
      total: orderNumbers.length,
      success: successCount,
      failed: failCount,
      results
    };
  }

  /**
   * 배송 통계
   */
  async getStatistics(params: {
    startDate?: Date;
    endDate?: Date;
  }) {
    const { startDate, endDate } = params;
    
    const where: any = {}; // TODO: Shipping 테이블 생성 후 Prisma.ShippingWhereInput로 변경
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // 상태별 통계
    const statusStats = await this.prisma.shipping.groupBy({
      by: ['status'],
      where,
      _count: true
    });

    // 택배사별 통계
    const courierStats = await this.prisma.shipping.groupBy({
      by: ['courierName'],
      where: {
        ...where,
        courierName: { not: null }
      },
      _count: true
    });

    // 평균 배송 시간 (배송 시작 ~ 완료)
    const completedShippings = await this.prisma.shipping.findMany({
      where: {
        ...where,
        status: 'DELIVERED',
        shippedAt: { not: null },
        deliveredAt: { not: null }
      },
      select: {
        shippedAt: true,
        deliveredAt: true
      }
    });

    const deliveryTimes = completedShippings
      .filter(s => s.shippedAt && s.deliveredAt)
      .map(s => {
        const shipped = new Date(s.shippedAt!).getTime();
        const delivered = new Date(s.deliveredAt!).getTime();
        return (delivered - shipped) / (1000 * 60 * 60); // 시간 단위
      });

    const avgDeliveryTime = deliveryTimes.length > 0
      ? deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length
      : 0;

    // 오늘 배송 현황
    const today = getNowKST();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStats = await this.prisma.shipping.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      },
      _count: true
    });

    return {
      statusDistribution: statusStats.map(item => ({
        status: item.status,
        count: item._count
      })),
      courierDistribution: courierStats.map(item => ({
        courier: item.courierName,
        count: item._count
      })),
      averageDeliveryHours: avgDeliveryTime.toFixed(1),
      todayStatistics: todayStats.map(item => ({
        status: item.status,
        count: item._count
      }))
    };
  }
}