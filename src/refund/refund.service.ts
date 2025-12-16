import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { TossPaymentsService } from '../toss/toss-payments.service';
import { Prisma } from '@prisma/client';
import { getNowKST } from '../common/utils/kst-date.util';
import { RefundStatus, ExchangeReturnStatus, OrderStatus } from '../common/enums';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tossPaymentsService: TossPaymentsService,
  ) {}

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
                product: true
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
        pgCancelId: refund.pgCancelId
      }
    };
  }

  /**
   * 환불 승인 및 PG 취소 처리 (관리자용)
   *
   * CANCEL_REQUESTED 상태 주문의 취소 요청을 승인하고 실제 PG 취소를 진행합니다.
   * - 토스페이먼츠 결제 취소 API 호출
   * - 포인트 환불
   * - 쿠폰 복구
   * - 티켓 취소
   * - 주문 상태 → CANCELLED
   */
  async approveRefund(id: number, adminMemo?: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: true,
            shipping: true,
          }
        },
        payment: true,
      }
    });

    if (!refund) {
      throw new NotFoundException('환불 요청을 찾을 수 없습니다');
    }

    if (refund.status !== RefundStatus.REQUESTED) {
      throw new BadRequestException('대기 중인 환불 요청만 승인 가능합니다');
    }

    const order = refund.order;
    const payment = refund.payment;

    // 결제 정보 확인
    if (!payment?.pgTransactionId) {
      throw new BadRequestException('결제 정보를 찾을 수 없습니다');
    }

    return await this.prisma.$transaction(async (tx) => {
      const now = getNowKST();

      // 1. PG사 결제 취소 API 호출
      let pgResponse: any = null;
      try {
        pgResponse = await this.tossPaymentsService.cancelPayment(
          payment.pgTransactionId,
          `주문 취소 승인 - ${refund.reason || '관리자 승인'}`,
          undefined // 전액 취소
        );
        this.logger.log(`PG 결제 취소 완료: ${payment.pgTransactionId}`);
      } catch (error: any) {
        this.logger.error(`토스페이먼츠 취소 실패: ${error.message}`);

        // 환불 상태를 FAILED로 업데이트
        await tx.refund.update({
          where: { id },
          data: {
            status: RefundStatus.FAILED,
            rejectedAt: now,
            reasonDetail: `토스페이먼츠 API 오류: ${error.message}`,
            adminMemo: adminMemo || refund.adminMemo,
          }
        });

        throw new BadRequestException(`결제 취소 처리 중 오류가 발생했습니다: ${error.message}`);
      }

      // 2. 환불 레코드 업데이트
      await tx.refund.update({
        where: { id },
        data: {
          status: RefundStatus.COMPLETED,
          completedAt: now,
          pgResponse: pgResponse as any,
          pgCancelId: pgResponse.cancels?.[0]?.transactionKey || null,
          adminMemo: adminMemo || refund.adminMemo,
        }
      });

      // 3. 결제 상태 업데이트
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
        }
      });

      // 4. 주문 상태 업데이트 → CANCELLED
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: now,
        }
      });

      // 5. 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          changeReason: `취소 승인 - ${refund.reason || '관리자 승인'}`,
          createdAt: now,
        }
      });

      // 6. 포인트 환불
      if (Number(order.pointUsed) > 0) {
        const updatedUser = await tx.user.update({
          where: { id: order.userId },
          data: {
            points: { increment: Number(order.pointUsed) }
          }
        });

        await tx.pointHistory.create({
          data: {
            userId: order.userId,
            type: 'REFUND',
            amount: Number(order.pointUsed),
            balance: updatedUser.points,
            description: `주문 취소 환불 (${order.orderNumber})`,
            relatedType: 'ORDER',
            relatedId: order.id,
            createdAt: now,
          }
        });

        this.logger.log(`포인트 환불: userId=${order.userId}, amount=${order.pointUsed}`);
      }

      // 7. 쿠폰 복구
      const usedCoupon = await tx.userCoupon.findFirst({
        where: {
          usedOrderId: order.id,
          status: 'USED'
        }
      });

      if (usedCoupon) {
        const newStatus = usedCoupon.expiresAt > now ? 'ACTIVE' : 'EXPIRED';
        await tx.userCoupon.update({
          where: { id: usedCoupon.id },
          data: {
            status: newStatus,
            usedAt: null,
            usedOrderId: null
          }
        });
        this.logger.log(`쿠폰 복구: couponId=${usedCoupon.id}, status=${newStatus}`);
      }

      // 8. 챌린지/구독 티켓 취소
      const cancelledTickets = await tx.challengeTicket.updateMany({
        where: {
          orderItemId: { in: order.items.map(item => item.id) },
          status: 'PURCHASED', // 구매만 된 상태만 취소 가능
        },
        data: {
          status: 'CANCELLED',
        }
      });

      if (cancelledTickets.count > 0) {
        this.logger.log(`티켓 취소: ${cancelledTickets.count}개`);
      }

      this.logger.log(`환불 승인 완료: ${order.orderNumber} / ${refund.refundAmount}원`);

      return {
        success: true,
        message: '환불이 승인되었습니다. PG 취소 및 포인트/쿠폰 복구가 완료되었습니다.',
        refundId: id,
        orderNumber: order.orderNumber,
        refundAmount: Number(refund.refundAmount),
        pointRefunded: Number(order.pointUsed),
        couponRestored: usedCoupon ? true : false,
        ticketsCancelled: cancelledTickets.count,
      };
    });
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

    if (refund.status !== RefundStatus.REQUESTED) {
      throw new BadRequestException('대기 중인 환불 요청만 거절 가능합니다');
    }

    const updated = await this.prisma.refund.update({
      where: { id },
      data: {
        status: RefundStatus.REJECTED,
        rejectedAt: getNowKST(),
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
                product: true
              }
            }
          }
        }
      }
    });

    if (!refund) {
      throw new NotFoundException('환불 요청을 찾을 수 없습니다');
    }

    if (![RefundStatus.APPROVED, RefundStatus.PROCESSING].includes(refund.status as RefundStatus)) {
      throw new BadRequestException('승인된 환불 요청만 완료 처리 가능합니다');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 환불 완료 처리
      const updatedRefund = await tx.refund.update({
        where: { id },
        data: {
          status: RefundStatus.COMPLETED,
          completedAt: getNowKST(),
          pgCancelId: transactionId,
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
          where: { sku: item.product.sku },
          create: {
            sku: item.product.sku,
            availableQty: item.quantity,
            lastUpdated: getNowKST()
          },
          update: {
            availableQty: {
              increment: item.quantity
            },
            lastUpdated: getNowKST()
          }
        });

        // 재고 동기화 큐에 추가
        await tx.inventorySyncQueue.create({
          data: {
            orderId: refund.orderId,
            sku: item.product.sku,
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
        status: RefundStatus.COMPLETED
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
        status: RefundStatus.COMPLETED,
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
        status: RefundStatus.REQUESTED
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
          (getNowKST().getTime() - new Date(item.requestedAt).getTime()) / (1000 * 60 * 60)
        )
      }))
    };
  }

  /**
   * 반품/교환 승인 (관리자용)
   */
  async approveReturn(orderNumber: string, returnId: number) {
    return await this.prisma.$transaction(async (tx) => {
      // 반품/교환 조회
      const exchangeReturn = await tx.exchangeReturn.findFirst({
        where: {
          id: returnId,
          order: { orderNumber }
        },
        include: {
          order: true
        }
      });

      if (!exchangeReturn) {
        throw new NotFoundException('반품/교환 요청을 찾을 수 없습니다');
      }

      // 승인 가능 상태 확인
      if (exchangeReturn.status !== ExchangeReturnStatus.REQUESTED) {
        throw new BadRequestException('이미 처리된 요청입니다');
      }

      // 반품/교환 상태 업데이트
      const updated = await tx.exchangeReturn.update({
        where: { id: returnId },
        data: {
          status: ExchangeReturnStatus.APPROVED,
          approvedAt: getNowKST(),
        }
      });

      this.logger.log(`반품/교환 승인 완료: 주문번호 ${orderNumber}, ${exchangeReturn.type} ID ${returnId}`);

      return {
        success: true,
        message: `${exchangeReturn.type === 'RETURN' ? '반품' : '교환'}이 승인되었습니다. 고객에게 회수 안내가 발송됩니다.`,
        data: {
          returnId: updated.id,
          type: updated.type,
          status: updated.status,
          approvedAt: updated.approvedAt
        }
      };
    });
  }

  /**
   * 반품 완료 및 환불 처리 (관리자용)
   * 반품 상품을 수령한 후 호출
   */
  async completeReturn(orderNumber: string, returnId: number, returnTrackingNumber?: string) {
    return await this.prisma.$transaction(async (tx) => {
      // 반품 조회
      const exchangeReturn = await tx.exchangeReturn.findFirst({
        where: {
          id: returnId,
          order: { orderNumber },
          type: 'RETURN' // 반품만 환불 처리
        },
        include: {
          order: {
            include: {
              payment: true
            }
          }
        }
      });

      if (!exchangeReturn) {
        throw new NotFoundException('반품 요청을 찾을 수 없습니다');
      }

      // 승인 상태 확인
      if (exchangeReturn.status !== ExchangeReturnStatus.APPROVED) {
        throw new BadRequestException('승인된 반품만 완료 처리 가능합니다');
      }

      const order = exchangeReturn.order;

      // 결제 정보 확인
      if (!order.payment) {
        throw new BadRequestException('결제 정보를 찾을 수 없습니다');
      }

      // 1. 반품 상태 업데이트
      await tx.exchangeReturn.update({
        where: { id: returnId },
        data: {
          status: ExchangeReturnStatus.COMPLETED,
          completedAt: getNowKST(),
          returnTrackingNumber: returnTrackingNumber || null
        }
      });

      // 2. Refund 레코드 생성
      const refund = await tx.refund.create({
        data: {
          orderId: order.id,
          paymentId: order.payment.id,
          refundType: 'RETURN',
          status: RefundStatus.REQUESTED,
          refundAmount: order.totalAmount, // 전액 환불
          pointRefund: order.pointUsed,
          reason: exchangeReturn.reason,
          reasonDetail: exchangeReturn.reasonDetail,
          requestedAt: getNowKST(),
          createdAt: getNowKST(),
        }
      });

      // 3. PG사 결제 취소 API 호출
      try {
        const pgResponse = await this.tossPaymentsService.cancelPayment(
          order.payment.pgTransactionId, // paymentKey
          `반품 환불 - ${exchangeReturn.reason}`,
          undefined // 전액 취소
        );

        // PG 응답 저장
        await tx.refund.update({
          where: { id: refund.id },
          data: {
            pgResponse: pgResponse as any,
            pgCancelId: pgResponse.cancels?.[0]?.transactionKey || null,
            status: RefundStatus.COMPLETED,
            completedAt: getNowKST(),
          }
        });

        this.logger.log(`PG 결제 취소 완료: ${order.payment.pgTransactionId}`);
      } catch (error: any) {
        this.logger.error(`토스페이먼츠 취소 실패: ${error.message}`);

        // 환불 상태를 FAILED로 업데이트
        await tx.refund.update({
          where: { id: refund.id },
          data: {
            status: RefundStatus.FAILED,
            rejectedAt: getNowKST(),
            reasonDetail: `토스페이먼츠 API 오류: ${error.message}`
          }
        });

        throw new BadRequestException(`결제 취소 처리 중 오류가 발생했습니다: ${error.message}`);
      }

      // 4. 주문 상태 업데이트
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.COMPLETED, // 반품 완료는 COMPLETED로
          completedAt: getNowKST(),
        }
      });

      // 5. 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.COMPLETED,
          changeReason: `반품 완료 - ${exchangeReturn.reason}`,
          createdAt: getNowKST(),
        }
      });

      // 6. 포인트 복구
      if (Number(order.pointUsed) > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: {
            points: { increment: Number(order.pointUsed) }
          }
        });

        await tx.pointHistory.create({
          data: {
            userId: order.userId,
            type: 'REFUND',
            amount: Number(order.pointUsed),
            balance: 0, // 추후 계산
            description: `반품 환불 (${order.orderNumber})`,
            relatedType: 'ORDER',
            relatedId: order.id,
            createdAt: getNowKST(),
          }
        });
      }

      this.logger.log(`반품 완료 및 환불 처리 완료: ${orderNumber}, 환불ID: ${refund.id}`);

      return {
        success: true,
        message: '반품이 완료되었습니다. 환불이 진행됩니다.',
        data: {
          returnId: returnId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          refund: {
            id: refund.id,
            refundAmount: Number(refund.refundAmount),
            pointRefund: Number(refund.pointRefund),
            pgCancelId: refund.pgCancelId
          },
          completedAt: getNowKST()
        }
      };
    });
  }

  /**
   * 교환 승인 (관리자용)
   */
  async approveExchange(orderNumber: string, exchangeId: number) {
    return await this.prisma.$transaction(async (tx) => {
      // 교환 조회
      const exchangeReturn = await tx.exchangeReturn.findFirst({
        where: {
          id: exchangeId,
          order: { orderNumber },
          type: 'EXCHANGE' // 교환만
        },
        include: {
          order: true
        }
      });

      if (!exchangeReturn) {
        throw new NotFoundException('교환 요청을 찾을 수 없습니다');
      }

      // 승인 가능 상태 확인
      if (exchangeReturn.status !== ExchangeReturnStatus.REQUESTED) {
        throw new BadRequestException('이미 처리된 요청입니다');
      }

      // 교환 상태 업데이트
      const updated = await tx.exchangeReturn.update({
        where: { id: exchangeId },
        data: {
          status: ExchangeReturnStatus.APPROVED,
          approvedAt: getNowKST(),
        }
      });

      this.logger.log(`교환 승인 완료: 주문번호 ${orderNumber}, 교환 ID ${exchangeId}`);

      return {
        success: true,
        message: '교환이 승인되었습니다. 고객에게 회수 안내가 발송됩니다.',
        data: {
          exchangeId: updated.id,
          type: updated.type,
          status: updated.status,
          approvedAt: updated.approvedAt
        }
      };
    });
  }

  /**
   * 교환 완료 처리 (관리자용)
   * 교환 상품을 수령한 후 호출
   */
  async completeExchange(orderNumber: string, exchangeId: number, exchangeTrackingNumber?: string) {
    return await this.prisma.$transaction(async (tx) => {
      // 교환 조회
      const exchangeReturn = await tx.exchangeReturn.findFirst({
        where: {
          id: exchangeId,
          order: { orderNumber },
          type: 'EXCHANGE' // 교환만
        },
        include: {
          order: true
        }
      });

      if (!exchangeReturn) {
        throw new NotFoundException('교환 요청을 찾을 수 없습니다');
      }

      // 승인 상태 확인
      if (exchangeReturn.status !== ExchangeReturnStatus.APPROVED) {
        throw new BadRequestException('승인된 교환만 완료 처리 가능합니다');
      }

      const order = exchangeReturn.order;

      // 1. 교환 상태 업데이트
      await tx.exchangeReturn.update({
        where: { id: exchangeId },
        data: {
          status: ExchangeReturnStatus.COMPLETED,
          completedAt: getNowKST(),
          returnTrackingNumber: exchangeTrackingNumber || null
        }
      });

      // 2. 주문 상태 로그 (교환 완료는 별도 로그만 남김)
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status, // 교환은 주문 상태 변경 없음
          changeReason: `교환 완료 - ${exchangeReturn.reason}`,
          createdAt: getNowKST(),
        }
      });

      this.logger.log(`교환 완료 처리 완료: ${orderNumber}, 교환ID: ${exchangeId}`);

      return {
        success: true,
        message: '교환이 완료되었습니다. 새 상품을 발송해 주세요.',
        data: {
          exchangeId: exchangeId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          completedAt: getNowKST()
        }
      };
    });
  }
}