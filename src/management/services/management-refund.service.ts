import { 
  Injectable, 
  Logger,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ManagementRefundService {
  private readonly logger = new Logger(ManagementRefundService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 전체 환불 목록 조회
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

    const where: Prisma.RefundWhereInput = {};
    
    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.requestedAt = {};
      if (startDate) where.requestedAt.gte = startDate;
      if (endDate) where.requestedAt.lte = endDate;
    }

    const [items, total] = await Promise.all([
      this.prisma.refund.findMany({
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
              user: {
                select: {
                  name: true,
                  email: true,
                  mobile: true
                }
              }
            }
          },
          payment: {
            select: {
              pgProvider: true,
              pgTransactionId: true
            }
          }
        },
        orderBy: { requestedAt: 'desc' }
      }),
      this.prisma.refund.count({ where })
    ]);

    return {
      items: items.map(item => ({
        id: item.id,
        orderNumber: item.order.orderNumber,
        customerName: item.order.user.name,
        customerEmail: item.order.user.email,
        customerMobile: item.order.user.mobile,
        refundType: item.refundType,
        status: item.status,
        refundAmount: Number(item.refundAmount),
        reason: item.reason,
        reasonDetail: item.reasonDetail,
        paymentMethod: null, // method 필드가 없음
        pgProvider: item.payment.pgProvider,
        requestedAt: item.requestedAt,
        completedAt: item.completedAt,
        rejectedAt: item.rejectedAt
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 환불 상세 조회
   */
  async findOne(id: number) {
    const refund = await this.prisma.refund.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            user: true,
            items: {
              include: {
                product: true,
                productOption: true
              }
            }
          }
        },
        payment: true
      }
    });

    if (!refund) {
      throw new NotFoundException('환불 요청을 찾을 수 없습니다');
    }

    return {
      id: refund.id,
      order: {
        orderNumber: refund.order.orderNumber,
        status: refund.order.status,
        totalAmount: Number(refund.order.totalAmount),
        items: refund.order.items.map(item => ({
          productName: item.productName,
          optionName: item.optionName,
          quantity: item.quantity,
          price: Number(item.productPrice),
          subtotal: Number(item.subtotal)
        }))
      },
      customer: {
        id: refund.order.user.id,
        name: refund.order.user.name,
        email: refund.order.user.email,
        mobile: refund.order.user.mobile
      },
      payment: {
        method: null, // method 필드가 없음
        pgProvider: refund.payment.pgProvider,
        pgTransactionId: refund.payment.pgTransactionId,
        amount: Number(refund.payment.amount)
      },
      refund: {
        type: refund.refundType,
        status: refund.status,
        amount: Number(refund.refundAmount),
        pointRefund: Number(refund.pointRefund),
        reason: refund.reason,
        reasonDetail: refund.reasonDetail,
        adminMemo: refund.adminMemo,
        requestedAt: refund.requestedAt,
        completedAt: refund.completedAt,
        rejectedAt: refund.rejectedAt,
        tossCancelId: refund.tossCancelId
      }
    };
  }

  /**
   * 환불 승인
   */
  async approveRefund(id: number, adminMemo?: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id },
      include: { order: true }
    });

    if (!refund) {
      throw new NotFoundException('환불 요청을 찾을 수 없습니다');
    }

    if (refund.status !== 'REQUESTED') {
      throw new BadRequestException('대기 중인 환불 요청만 승인 가능합니다');
    }

    const updated = await this.prisma.refund.update({
      where: { id },
      data: {
        status: 'APPROVED',
        adminMemo: adminMemo || refund.adminMemo
      }
    });

    // TODO: 실제 환불 처리 큐에 추가
    // 토스페이먼츠 API 호출하여 환불 처리

    this.logger.log(`환불 승인: ${refund.order.orderNumber} / ${refund.refundAmount}원`);

    return {
      success: true,
      message: '환불이 승인되었습니다',
      refundId: id
    };
  }

  /**
   * 환불 거절
   */
  async rejectRefund(id: number, reason: string, adminMemo?: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id },
      include: { order: true }
    });

    if (!refund) {
      throw new NotFoundException('환불 요청을 찾을 수 없습니다');
    }

    if (refund.status !== 'REQUESTED') {
      throw new BadRequestException('대기 중인 환불 요청만 거절 가능합니다');
    }

    const updated = await this.prisma.refund.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        reasonDetail: reason,
        adminMemo: adminMemo || refund.adminMemo
      }
    });

    this.logger.log(`환불 거절: ${refund.order.orderNumber} / 사유: ${reason}`);

    return {
      success: true,
      message: '환불이 거절되었습니다',
      refundId: id,
      reason
    };
  }

  /**
   * 환불 완료 처리
   */
  async completeRefund(id: number, transactionId: string, adminMemo?: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: {
              include: {
                productOption: true
              }
            }
          }
        }
      }
    });

    if (!refund) {
      throw new NotFoundException('환불 요청을 찾을 수 없습니다');
    }

    if (!['APPROVED', 'PROCESSING'].includes(refund.status)) {
      throw new BadRequestException('승인된 환불 요청만 완료 처리 가능합니다');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 환불 완료 처리
      const updatedRefund = await tx.refund.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          tossCancelId: transactionId,
          adminMemo: adminMemo || refund.adminMemo
        }
      });

      // 주문 상태 변경 (전체 환불인 경우)
      await tx.order.update({
        where: { id: refund.orderId },
        data: {
          status: 'REFUNDED'
        }
      });

      // 재고 복구
      for (const item of refund.order.items) {
        await tx.inventoryCache.upsert({
          where: { sku: item.productOption.sku },
          create: {
            sku: item.productOption.sku,
            availableQty: item.quantity,
            lastUpdated: new Date()
          },
          update: {
            availableQty: {
              increment: item.quantity
            },
            lastUpdated: new Date()
          }
        });

        // 재고 동기화 큐에 추가
        await tx.inventorySyncQueue.create({
          data: {
            orderId: refund.orderId,
            sku: item.productOption.sku,
            quantity: item.quantity,
            action: 'RESTORE',
            status: 'PENDING'
          }
        });
      }

      // 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: refund.orderId,
          fromStatus: refund.order.status,
          toStatus: 'REFUNDED',
          changeReason: `환불 완료 (${refund.refundAmount}원)`
        }
      });

      return updatedRefund;
    });

    this.logger.log(`환불 완료: ${refund.order.orderNumber} / ${refund.refundAmount}원`);

    return {
      success: true,
      message: '환불이 완료되었습니다',
      refundId: id,
      transactionId
    };
  }

  /**
   * 환불 상태 일괄 변경
   */
  async batchUpdate(dto: {
    refundIds: number[];
    action: 'approve' | 'reject';
    reason?: string;
  }) {
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const refundId of dto.refundIds) {
      try {
        if (dto.action === 'approve') {
          await this.approveRefund(refundId);
        } else if (dto.action === 'reject') {
          if (!dto.reason) {
            throw new BadRequestException('거절 사유가 필요합니다');
          }
          await this.rejectRefund(refundId, dto.reason);
        }
        results.push({ refundId, success: true });
        successCount++;
      } catch (error: any) {
        results.push({ 
          refundId, 
          success: false, 
          error: error.message 
        });
        failCount++;
      }
    }

    return {
      total: dto.refundIds.length,
      success: successCount,
      failed: failCount,
      results
    };
  }

  /**
   * 환불 통계
   */
  async getStatistics(params: {
    startDate?: Date;
    endDate?: Date;
  }) {
    const { startDate, endDate } = params;
    
    const where: Prisma.RefundWhereInput = {};
    if (startDate || endDate) {
      where.requestedAt = {};
      if (startDate) where.requestedAt.gte = startDate;
      if (endDate) where.requestedAt.lte = endDate;
    }

    // 상태별 통계
    const statusStats = await this.prisma.refund.groupBy({
      by: ['status'],
      where,
      _count: true,
      _sum: {
        refundAmount: true
      }
    });

    // 환불 사유별 통계
    const reasonStats = await this.prisma.refund.groupBy({
      by: ['reason'],
      where: {
        ...where,
        status: 'COMPLETED'
      },
      _count: true,
      _sum: {
        refundAmount: true
      }
    });

    // 평균 처리 시간 (요청 ~ 완료)
    const completedRefunds = await this.prisma.refund.findMany({
      where: {
        ...where,
        status: 'COMPLETED',
        completedAt: { not: null }
      },
      select: {
        requestedAt: true,
        completedAt: true
      }
    });

    const processingTimes = completedRefunds
      .filter(r => r.completedAt)
      .map(r => {
        const requested = new Date(r.requestedAt).getTime();
        const completed = new Date(r.completedAt!).getTime();
        return (completed - requested) / (1000 * 60 * 60); // 시간 단위
      });

    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    return {
      statusDistribution: statusStats.map(item => ({
        status: item.status,
        count: item._count,
        amount: Number(item._sum.refundAmount || 0)
      })),
      reasonDistribution: reasonStats.map(item => ({
        reason: item.reason,
        count: item._count,
        amount: Number(item._sum.refundAmount || 0)
      })),
      averageProcessingHours: avgProcessingTime.toFixed(1),
      totalRefunds: statusStats.reduce((sum, item) => sum + item._count, 0),
      totalRefundAmount: statusStats.reduce((sum, item) => 
        sum + Number(item._sum.refundAmount || 0), 0
      )
    };
  }

  /**
   * 대기 중인 환불 목록
   */
  async getPendingRefunds() {
    const refunds = await this.prisma.refund.findMany({
      where: {
        status: 'REQUESTED'
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { requestedAt: 'asc' }
    });

    return {
      total: refunds.length,
      items: refunds.map(item => ({
        id: item.id,
        orderNumber: item.order.orderNumber,
        customerName: item.order.user.name,
        customerEmail: item.order.user.email,
        refundAmount: Number(item.refundAmount),
        reason: item.reason,
        requestedAt: item.requestedAt,
        waitingHours: Math.floor(
          (new Date().getTime() - new Date(item.requestedAt).getTime()) / (1000 * 60 * 60)
        )
      }))
    };
  }
}