import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { TossPaymentsService } from './toss-payments.service';
import {
  ILogisticsProvider,
  LOGISTICS_PROVIDER_TOKEN,
} from '../../playauto/interfaces/logistics-provider.interface';
import {
  ConfirmPaymentDto,
  CancelPaymentDto,
  PaymentResponseDto,
} from '../dto/payment/payment.dto';
import { Prisma } from '@prisma/client';
import { convertDecimalToNumber } from '../../common/utils/decimal.util';
import { getNowKST, parseISO8601ToKST } from '../../common/utils/kst-date.util';
import { ChallengeTicketStatus, OrderStatus, PaymentStatus, PgProvider } from '../../common/enums';
import { CryptoUtil } from '../../common/utils/crypto.util';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tossPayments: TossPaymentsService,
    @Inject(LOGISTICS_PROVIDER_TOKEN) private readonly logistics: ILogisticsProvider
  ) {}

  /**
   * 결제 준비
   * 주문 정보를 기반으로 결제 준비 데이터 생성
   */
  async preparePayment(userId: number, orderNumber: string): Promise<PaymentResponseDto> {
    // 주문 조회
    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber,
        userId
      }
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('결제 대기 중인 주문이 아닙니다');
    }

    // 기존 결제 정보 확인
    let payment = await this.prisma.payment.findFirst({
      where: {
        orderId: order.id,
        status: PaymentStatus.PENDING
      }
    });

    // 결제 정보가 없으면 생성
    if (!payment) {
      payment = await this.prisma.payment.create({
        data: {
          orderId: order.id,
          paymentMethod: 'CARD', // 기본값, 실제 결제 시 업데이트
          amount: convertDecimalToNumber(order.totalAmount) || 0,
          status: PaymentStatus.PENDING,
          pgProvider: PgProvider.TOSS,
          requestedAt: getNowKST(),
          createdAt: getNowKST(),
        }
      });

      this.logger.log(`결제 준비 생성: ${orderNumber}`);
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: convertDecimalToNumber(order.totalAmount) || 0,
      orderName: `주문번호: ${order.orderNumber}`,
      customerName: order.recipientName,
      customerEmail: '', // 사용자 이메일 추가 필요
      paymentKey: null,
      status: payment.status
    };
  }

  /**
   * 결제 승인
   * 토스페이먼츠 결제 승인 API 호출 및 주문 상태 업데이트
   */
  async confirmPayment(userId: number, dto: ConfirmPaymentDto): Promise<PaymentResponseDto> {
    // 1. 주문 및 결제 정보 조회 (트랜잭션 밖)
    // dto.orderId는 앱에서 보내는 주문번호 (O2025... 형식)
    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber: dto.orderId
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    // 주문 소유자 검증
    if (order.userId !== userId) {
      throw new BadRequestException('본인의 주문만 결제할 수 있습니다');
    }

    // 이미 결제 완료된 주문인지 확인 (멱등성 보장)
    if (order.status === OrderStatus.PAID) {
      this.logger.warn(`이미 결제 완료된 주문입니다: ${dto.orderId}`);
      const completedPayment = await this.prisma.payment.findFirst({
        where: { orderId: order.id, status: PaymentStatus.COMPLETED }
      });
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: dto.amount,
        orderName: `주문번호: ${order.orderNumber}`,
        customerName: order.recipientName,
        customerEmail: '',
        paymentKey: completedPayment?.pgTransactionId || dto.paymentKey,
        status: PaymentStatus.COMPLETED
      };
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId: order.id,
        status: PaymentStatus.PENDING
      }
    });

    if (!payment) {
      throw new NotFoundException('결제 정보를 찾을 수 없습니다');
    }

    // 금액 검증
    if (convertDecimalToNumber(order.totalAmount) !== dto.amount) {
      throw new BadRequestException('결제 금액이 일치하지 않습니다');
    }

    // 2. 토스페이먼츠 결제 승인 (외부 API 호출 - 트랜잭션 밖)
    let tossResult: any;
    try {
      // 토스 API에 orderId 필드로 주문번호를 전달
      tossResult = await this.tossPayments.confirmPayment(
        dto.paymentKey,
        dto.orderId,
        dto.amount
      );
    } catch (error: any) {
      // 토스 에러 정보 추출
      const errorResponse = error.response;
      const tossCode = errorResponse?.tossErrorCode || 'UNKNOWN_ERROR';
      const tossMessage = errorResponse?.message || error.message || '알 수 없는 오류';
      const failReason = `[${tossCode}] ${tossMessage}`;

      // 결제 실패 처리
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failedAt: getNowKST(),
          failReason: failReason.substring(0, 500)
        }
      });

      await this.prisma.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          changeReason: `결제 실패: ${failReason}`,
          createdAt: getNowKST(),
        }
      });

      throw error;
    }

    // 3. DB 업데이트 (트랜잭션 안)
    const result = await this.prisma.$transaction(async (tx) => {
      // 토스 approvedAt을 KST Date로 변환 (예: "2025-12-12T05:44:24+09:00" → KST Date)
      // 타임존 정보를 보존하여 환경에 무관하게 정확한 KST 시간 추출
      const approvedAtKST = parseISO8601ToKST(tossResult.approvedAt);

      // 결제 정보 업데이트
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          pgTransactionId: tossResult.paymentKey,
          paymentMethod: this.mapPaymentMethod(tossResult.method),
          status: PaymentStatus.COMPLETED,
          paidAt: approvedAtKST,
          updatedAt: approvedAtKST, // @updatedAt이 UTC로 설정되는 것 방지
          paymentDetails: tossResult as any
        }
      });

      // 주문 상태 업데이트
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          paidAt: approvedAtKST
        }
      });

      // 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: 'PENDING_PAYMENT',
          toStatus: 'PAID',
          changeReason: '결제 완료',
          createdAt: getNowKST(),
        }
      });

      // 챌린지/구독 상품 티켓 발급 (동시성 방어: seq 기반 deterministic 생성 + DB unique 제약)
      // DB unique 제약: @@unique([orderItemId, seq])로 레이스 컨디션 완전 방어
      for (const item of order.items) {
        if (['CHALLENGE', 'SUBSCRIPTION'].includes(item.product.categoryCode || '')) {
          const ticketType = item.product.categoryCode === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'CHALLENGE';
          // seq 기반으로 deterministic하게 티켓 생성 (1부터 quantity까지)
          for (let seq = 1; seq <= item.quantity; seq++) {
            try {
              await tx.challengeTicket.create({
                data: {
                  userId: order.userId,
                  productId: item.productId,
                  orderItemId: item.id,
                  seq, // 동일 orderItem 내 순번 (unique 제약으로 중복 방지)
                  purchaseDate: getNowKST(),
                  status: ChallengeTicketStatus.PURCHASED,
                  ticketType,
                  createdAt: getNowKST(),
                },
              });
            } catch (error: any) {
              // P2002: Unique constraint violation → 이미 존재하는 티켓 (정상 케이스)
              if (error.code === 'P2002') {
                this.logger.log(`${ticketType} 티켓 이미 존재: orderItemId=${item.id}, seq=${seq}`);
                continue;
              }
              throw error; // 그 외 에러는 재throw
            }
          }
          this.logger.log(`${ticketType} 티켓 발급 완료: orderItemId=${item.id}, quantity=${item.quantity}`);
        }
      }

      this.logger.log(`결제 승인 완료: ${dto.orderId} / ${dto.paymentKey}`);

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: dto.amount,
        orderName: `주문번호: ${order.orderNumber}`,
        customerName: order.recipientName,
        customerEmail: '',
        paymentKey: tossResult.paymentKey,
        status: PaymentStatus.COMPLETED
      };
    });

    // 플레이오토 주문 생성 (비동기 - 트랜잭션 커밋 후 실행)
    this.createPlayautoOrder(order.id).catch((error) => {
      this.logger.error(`플레이오토 주문 생성 비동기 실패: 주문ID=${order.id}`, error);
    });

    return result;
  }

  /**
   * 결제 취소
   */
  async cancelPayment(userId: number, dto: CancelPaymentDto): Promise<PaymentResponseDto> {
    return await this.prisma.$transaction(async (tx) => {
      // 주문 조회
      const order = await tx.order.findFirst({
        where: {
          orderNumber: dto.orderNumber,
          userId
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      if (!order) {
        throw new NotFoundException('주문을 찾을 수 없습니다');
      }

      // 결제 정보 조회
      const payment = await tx.payment.findFirst({
        where: {
          orderId: order.id,
          status: PaymentStatus.COMPLETED
        }
      });

      if (!payment || !payment.pgTransactionId) {
        throw new NotFoundException('취소 가능한 결제 정보가 없습니다');
      }

      // 취소 가능 상태 확인
      if (!['PAID', 'PREPARING'].includes(order.status)) {
        throw new BadRequestException('취소 가능한 상태가 아닙니다');
      }

      // 부분 취소 금액 검증
      if (dto.cancelAmount && dto.cancelAmount > (convertDecimalToNumber(payment.amount) || 0)) {
        throw new BadRequestException('취소 금액이 결제 금액보다 큽니다');
      }

      try {
        // 토스페이먼츠 결제 취소
        const tossResult = await this.tossPayments.cancelPayment(
          payment.pgTransactionId,
          dto.cancelReason,
          dto.cancelAmount,
          dto.refundAccount
        );

        // 환불 정보 생성
        const refund = await tx.refund.create({
          data: {
            orderId: order.id,
            paymentId: payment.id,
            refundType: 'CANCEL',
            refundAmount: new Prisma.Decimal(dto.cancelAmount || convertDecimalToNumber(payment.amount) || 0),
            reason: dto.cancelReason,
            status: PaymentStatus.COMPLETED,
            pgProvider: PgProvider.TOSS,
            pgCancelId: tossResult.cancels[0].transactionKey,
            pgResponse: tossResult as any,
            requestedAt: getNowKST(),
            completedAt: getNowKST(),
            createdAt: getNowKST(),
          }
        });

        // 결제 상태 업데이트
        const isPartialCancel = dto.cancelAmount && dto.cancelAmount < (convertDecimalToNumber(payment.amount) || 0);
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: isPartialCancel ? 'PARTIAL_CANCELLED' : 'CANCELLED',
            cancelledAt: getNowKST()
          }
        });

        // 주문 상태 업데이트
        if (!isPartialCancel) {
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.CANCELLED,
              cancelledAt: getNowKST()
            }
          });

          // 주문 상태 로그
          await tx.orderStateLog.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: 'CANCELLED',
              changeReason: dto.cancelReason,
              createdAt: getNowKST(),
            }
          });

          // 재고 복구 (재고 테이블 제거됨 - 추후 구현 예정)
          // for (const item of order.items) {
          //   // 재고 캐시 업데이트
          //   await tx.inventoryCache.upsert({
          //     where: { sku: item.product.sku },
          //     create: {
          //       sku: item.product.sku,
          //       quantity: item.quantity,
          //       lastUpdated: getNowKST()
          //     },
          //     update: {
          //       quantity: {
          //         increment: item.quantity
          //       },
          //       lastUpdated: getNowKST()
          //     }
          //   });
          //
          //   // 재고 동기화 큐
          //   await tx.inventorySyncQueue.create({
          //     data: {
          //       orderId: order.id,
          //       sku: item.product.sku,
          //       quantity: item.quantity,
          //       action: 'RESTORE',
          //       status: PaymentStatus.PENDING
          //     }
          //   });
          // }

          // 포인트 복구
          if ((convertDecimalToNumber(order.pointUsed) || 0) > 0) {
            const updatedUser = await tx.user.update({
              where: { id: userId },
              data: {
                points: { increment: convertDecimalToNumber(order.pointUsed) || 0 }
              }
            });

            await tx.pointHistory.create({
              data: {
                userId,
                type: 'REFUND',
                amount: convertDecimalToNumber(order.pointUsed) || 0,
                balance: updatedUser.points,
                description: `주문 취소 환불 (${order.orderNumber})`,
                relatedType: 'ORDER',
                relatedId: order.id,
                createdAt: getNowKST(),
              }
            });
          }
        }

        this.logger.log(`결제 취소 완료: ${dto.orderNumber} / ${payment.pgTransactionId}`);

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: convertDecimalToNumber(refund.refundAmount) || 0,
          orderName: `주문번호: ${order.orderNumber}`,
          customerName: order.recipientName,
          customerEmail: '',
          paymentKey: payment.pgTransactionId,
          status: isPartialCancel ? 'PARTIAL_CANCELLED' : 'CANCELLED'
        };
      } catch (error) {
        // 환불 실패 처리
        await tx.refund.create({
          data: {
            orderId: order.id,
            paymentId: payment.id,
            refundType: 'CANCEL',
            refundAmount: new Prisma.Decimal(dto.cancelAmount || convertDecimalToNumber(payment.amount) || 0),
            reason: dto.cancelReason,
            status: PaymentStatus.FAILED,
            reasonDetail: error.message,
            requestedAt: getNowKST(),
            createdAt: getNowKST(),
          }
        });

        throw error;
      }
    });
  }

  /**
   * 플레이오토 주문 생성 (비동기)
   *
   * 동작 방식:
   * - 결제 승인 후 자동 호출 (트랜잭션 커밋 후 실행)
   * - DB에서 주문 정보 조회 (복호화 포함)
   * - 플레이오토 API 호출 (Provider 내부에서 3회 재시도)
   * - 성공 시 uniq, bundle_no를 Order 테이블에 저장
   *
   * 원자성 보장 전략:
   * 1. 결제 트랜잭션과 분리 - 결제 실패 시 물류 등록 안 함
   * 2. 물류 등록 실패해도 결제는 유지 (비즈니스 요구사항)
   * 3. 실패 시 logisticsApiLog에 FAILURE 기록 → 배치로 재시도 가능
   * 4. logisticsUniq가 null인 PAID 주문 = 물류 등록 필요
   */
  private async createPlayautoOrder(orderId: number): Promise<void> {
    try {
      this.logger.log(`플레이오토 주문 생성 시작: 주문ID=${orderId}`);

      // 주문 정보 조회 (items 포함)
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!order) {
        throw new Error(`주문을 찾을 수 없습니다: orderId=${orderId}`);
      }

      // 이미 물류 등록된 주문인지 확인 (멱등성 보장)
      if (order.logisticsUniq) {
        this.logger.warn(`이미 물류 등록된 주문입니다: orderId=${orderId}, uniq=${order.logisticsUniq}`);
        return;
      }

      // 결제 완료된 주문만 물류 등록
      if (order.status !== OrderStatus.PAID) {
        this.logger.warn(`결제 완료되지 않은 주문입니다: orderId=${orderId}, status=${order.status}`);
        return;
      }

      // 개인정보 복호화
      const decryptedOrder = {
        ...order,
        recipientName: CryptoUtil.decrypt(order.recipientName),
        recipientMobile: CryptoUtil.decrypt(order.recipientMobile),
        address: CryptoUtil.decrypt(order.address),
        addressDetail: order.addressDetail ? CryptoUtil.decrypt(order.addressDetail) : null,
        deliveryMessage: order.deliveryMessage ? CryptoUtil.decrypt(order.deliveryMessage) : null,
      };

      // 물류 서비스 주문 생성 (Provider 내부에서 3회 재시도 + 로그 기록)
      const { uniq, bundleNo } = await this.logistics.createOrder(decryptedOrder);

      // DB에 provider, uniq, bundleNo 저장
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          logisticsProvider: this.logistics.name,
          logisticsUniq: uniq,
          logisticsBundleNo: bundleNo,
        },
      });

      this.logger.log(`물류 주문 생성 완료: 주문ID=${orderId}, provider=${this.logistics.name}, uniq=${uniq}, bundleNo=${bundleNo}`);
    } catch (error: any) {
      // 실패해도 결제는 유지됨 (의도된 동작)
      // logisticsApiLog에 FAILURE로 기록됨 → 배치 재시도 가능
      this.logger.error(`플레이오토 주문 생성 실패: 주문ID=${orderId}, error=${error.message}`);
    }
  }

  /**
   * 결제 방법 매핑
   */
  private mapPaymentMethod(method: string): string {
    const methodMap: Record<string, string> = {
      '카드': 'CARD',
      '가상계좌': 'VIRTUAL_ACCOUNT',
      '계좌이체': 'BANK_TRANSFER',
      '휴대폰': 'MOBILE',
      '간편결제': 'EASY_PAY'
    };

    return methodMap[method] || 'CARD';
  }
}