import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { IPaymentGateway, PAYMENT_GATEWAY_TOKEN } from '../toss/interfaces/payment-gateway.interface';
import { getNowKST } from '../common/utils/kst-date.util';
import { RefundStatus, OrderStatus, PgProvider, PointRelatedType } from '../common/enums';
import { getPointDescription } from '../common/utils/point-description.util';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY_TOKEN) private readonly paymentGateway: IPaymentGateway,
  ) {}

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
        pgResponse = await this.paymentGateway.cancelPayment(
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
          pgProvider: PgProvider.TOSS,
          pgResponse: pgResponse as any,
          pgCancelId: pgResponse.transactionKey || null,
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
            description: getPointDescription(PointRelatedType.ORDER, undefined, 'REFUND'),
            relatedType: PointRelatedType.ORDER,
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

      // 8. 적립 포인트 회수 (구매 적립금 취소)
      const purchaseReward = await tx.pointHistory.findFirst({
        where: {
          relatedType: 'ORDER',
          relatedId: order.id,
          type: 'PURCHASE_REWARD',
        },
      });

      if (purchaseReward) {
        const rewardAmount = purchaseReward.amount;
        const updatedUserForReward = await tx.user.update({
          where: { id: order.userId },
          data: {
            points: { decrement: rewardAmount },
          },
        });

        await tx.pointHistory.create({
          data: {
            userId: order.userId,
            type: 'PURCHASE_REWARD_CANCEL',
            amount: -rewardAmount,
            balance: updatedUserForReward.points,
            description: getPointDescription(PointRelatedType.ORDER, undefined, 'PURCHASE_REWARD_CANCEL'),
            relatedType: PointRelatedType.ORDER,
            relatedId: order.id,
            createdAt: now,
          },
        });

        this.logger.log(`적립 포인트 회수: userId=${order.userId}, amount=${rewardAmount}`);
      }

      // 9. 챌린지/구독 티켓 취소
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
        rewardPointCancelled: purchaseReward ? purchaseReward.amount : 0,
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

    await this.prisma.refund.update({
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
   * 관리자 주문 취소 (고객 대신 취소)
   * Refund 레코드를 생성하고 즉시 취소 처리
   */
  async adminCancelOrder(orderId: number, reason: string, adminMemo?: string) {
    // 주문 조회
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payment: true,
      }
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    // 취소 가능 상태 확인
    const cancellableStatuses = [
      OrderStatus.PENDING_PAYMENT,
      OrderStatus.PAID,
      OrderStatus.PREPARING,
    ];

    if (!cancellableStatuses.includes(order.status as OrderStatus)) {
      throw new BadRequestException(
        `현재 주문 상태(${order.status})에서는 취소할 수 없습니다. 결제대기/결제완료/상품준비중 상태만 취소 가능합니다.`
      );
    }

    // 결제 정보 확인
    if (!order.payment?.pgTransactionId) {
      // 결제대기 상태인 경우 PG 취소 없이 취소 처리
      if (order.status === OrderStatus.PENDING_PAYMENT) {
        return await this.prisma.$transaction(async (tx) => {
          const now = getNowKST();

          await tx.order.update({
            where: { id: orderId },
            data: {
              status: OrderStatus.CANCELLED,
              cancelledAt: now,
            }
          });

          await tx.orderStateLog.create({
            data: {
              orderId: orderId,
              fromStatus: order.status,
              toStatus: OrderStatus.CANCELLED,
              changeReason: `관리자 취소 - ${reason}`,
              createdAt: now,
            }
          });

          // 포인트 환급 (결제 전이라도 주문 생성 시 포인트 차감됨)
          let pointRefunded = 0;
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
                description: getPointDescription(PointRelatedType.ORDER, undefined, 'REFUND'),
                relatedType: PointRelatedType.ORDER,
                relatedId: order.id,
                createdAt: now,
              }
            });

            pointRefunded = Number(order.pointUsed);
            this.logger.log(`포인트 환급 (결제 전 취소): userId=${order.userId}, amount=${order.pointUsed}`);
          }

          // 쿠폰 복구
          let couponRestored = false;
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
            couponRestored = true;
            this.logger.log(`쿠폰 복구 (결제 전 취소): couponId=${usedCoupon.id}, status=${newStatus}`);
          }

          this.logger.log(`관리자 주문 취소 완료 (결제 전): ${order.orderNumber}`);

          return {
            success: true,
            message: '주문이 취소되었습니다 (결제 전 취소)',
            orderNumber: order.orderNumber,
            refundAmount: 0,
            pointRefunded,
            couponRestored,
            ticketsCancelled: 0,
          };
        });
      }
      throw new BadRequestException('결제 정보를 찾을 수 없습니다');
    }

    // 트랜잭션 시작
    return await this.prisma.$transaction(async (tx) => {
      const now = getNowKST();

      // 1. Refund 레코드 생성
      const refund = await tx.refund.create({
        data: {
          orderId: order.id,
          paymentId: order.payment!.id,
          refundType: 'ADMIN_CANCEL',
          status: RefundStatus.REQUESTED,
          refundAmount: order.totalAmount,
          pointRefund: order.pointUsed,
          reason: reason,
          reasonDetail: adminMemo || '관리자가 고객 요청으로 취소 처리',
          adminMemo: adminMemo,
          requestedAt: now,
          createdAt: now,
        }
      });

      this.logger.log(`Refund 레코드 생성: ${refund.id}`);

      // 2. PG사 결제 취소 API 호출
      let pgResponse: any = null;
      try {
        pgResponse = await this.paymentGateway.cancelPayment(
          order.payment!.pgTransactionId,
          `관리자 취소 - ${reason}`,
          undefined // 전액 취소
        );
        this.logger.log(`PG 결제 취소 완료: ${order.payment!.pgTransactionId}`);
      } catch (error: any) {
        this.logger.error(`토스페이먼츠 취소 실패: ${error.message}`);

        // 환불 상태를 FAILED로 업데이트
        await tx.refund.update({
          where: { id: refund.id },
          data: {
            status: RefundStatus.FAILED,
            rejectedAt: now,
            reasonDetail: `토스페이먼츠 API 오류: ${error.message}`,
          }
        });

        throw new BadRequestException(`결제 취소 처리 중 오류가 발생했습니다: ${error.message}`);
      }

      // 3. 환불 레코드 업데이트
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: RefundStatus.COMPLETED,
          completedAt: now,
          pgProvider: PgProvider.TOSS,
          pgResponse: pgResponse as any,
          pgCancelId: pgResponse.transactionKey || null,
        }
      });

      // 4. 결제 상태 업데이트
      await tx.payment.update({
        where: { id: order.payment!.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
        }
      });

      // 5. 주문 상태 업데이트 → CANCELLED
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: now,
        }
      });

      // 6. 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          changeReason: `관리자 취소 - ${reason}`,
          createdAt: now,
        }
      });

      // 7. 포인트 환불
      let pointRefunded = 0;
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
            description: getPointDescription(PointRelatedType.ORDER, undefined, 'REFUND'),
            relatedType: PointRelatedType.ORDER,
            relatedId: order.id,
            createdAt: now,
          }
        });

        pointRefunded = Number(order.pointUsed);
        this.logger.log(`포인트 환불: userId=${order.userId}, amount=${order.pointUsed}`);
      }

      // 8. 쿠폰 복구
      let couponRestored = false;
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
        couponRestored = true;
        this.logger.log(`쿠폰 복구: couponId=${usedCoupon.id}, status=${newStatus}`);
      }

      // 9. 적립 포인트 회수 (구매 적립금 취소)
      const purchaseReward = await tx.pointHistory.findFirst({
        where: {
          relatedType: 'ORDER',
          relatedId: order.id,
          type: 'PURCHASE_REWARD',
        },
      });

      if (purchaseReward) {
        const rewardAmount = purchaseReward.amount;
        const updatedUserForReward = await tx.user.update({
          where: { id: order.userId },
          data: {
            points: { decrement: rewardAmount },
          },
        });

        await tx.pointHistory.create({
          data: {
            userId: order.userId,
            type: 'PURCHASE_REWARD_CANCEL',
            amount: -rewardAmount,
            balance: updatedUserForReward.points,
            description: getPointDescription(PointRelatedType.ORDER, undefined, 'PURCHASE_REWARD_CANCEL'),
            relatedType: PointRelatedType.ORDER,
            relatedId: order.id,
            createdAt: now,
          },
        });

        this.logger.log(`적립 포인트 회수: userId=${order.userId}, amount=${rewardAmount}`);
      }

      // 10. 챌린지/구독 티켓 취소
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

      this.logger.log(`관리자 주문 취소 완료: ${order.orderNumber} / ${order.totalAmount}원`);

      return {
        success: true,
        message: '주문이 취소되었습니다. PG 취소 및 포인트/쿠폰 복구가 완료되었습니다.',
        orderNumber: order.orderNumber,
        refundId: refund.id,
        refundAmount: Number(order.totalAmount),
        pointRefunded,
        rewardPointCancelled: purchaseReward ? purchaseReward.amount : 0,
        couponRestored,
        ticketsCancelled: cancelledTickets.count,
      };
    });
  }
}
