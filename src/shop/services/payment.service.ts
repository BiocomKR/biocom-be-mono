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
  PaymentWebhookDto
} from '../dto/payment/payment.dto';
import { Prisma } from '@prisma/client';
import { convertDecimalToNumber } from '../../common/utils/decimal.util';
import { getNowKST } from '../../common/utils/kst-date.util';
import { ChallengeTicketStatus, OrderStatus, PaymentStatus } from '../../common/enums';
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
          pgProvider: 'TOSS_PAYMENTS',
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
  async confirmPayment(dto: ConfirmPaymentDto): Promise<PaymentResponseDto> {
    // 1. 주문 및 결제 정보 조회 (트랜잭션 밖)
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
      tossResult = await this.tossPayments.confirmPayment(
        dto.paymentKey,
        dto.orderId,
        dto.amount
      );
    } catch (error) {
      // 결제 실패 처리
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failedAt: getNowKST(),
          failReason: error.message?.substring(0, 500) || 'Unknown error'
        }
      });

      await this.prisma.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          changeReason: `결제 실패: ${error.message}`,
          createdAt: getNowKST(),
        }
      });

      throw error;
    }

    // 3. DB 업데이트 (트랜잭션 안)
    return await this.prisma.$transaction(async (tx) => {
      // 결제 정보 업데이트
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          pgTransactionId: tossResult.paymentKey,
          paymentMethod: this.mapPaymentMethod(tossResult.method),
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(tossResult.approvedAt),
          paymentDetails: tossResult as any
        }
      });

      // 주문 상태 업데이트
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(tossResult.approvedAt)
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

      // 챌린지 상품 티켓 발급
      for (const item of order.items) {
        if (item.product.categoryCode === 'CHALLENGE') {
          for (let i = 0; i < item.quantity; i++) {
            await tx.challengeTicket.create({
              data: {
                userId: order.userId,
                productId: item.productId,
                orderItemId: item.id,
                purchaseDate: getNowKST(),
                status: ChallengeTicketStatus.PURCHASED,
                ticketType: 'CHALLENGE',
                createdAt: getNowKST(),
              }
            });
          }
          this.logger.log(`챌린지 티켓 발급 완료: productId=${item.productId}, quantity=${item.quantity}`);
        }
      }

      this.logger.log(`결제 승인 완료: ${dto.orderId} / ${dto.paymentKey}`);

      // 플레이오토 주문 생성 (비동기)
      this.createPlayautoOrder(order.id).catch((error) => {
        this.logger.error(`플레이오토 주문 생성 비동기 실패: 주문ID=${order.id}`, error);
      });

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
            tossCancelId: tossResult.cancels[0].transactionKey,
            tossResponse: tossResult as any,
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
          if (convertDecimalToNumber(order.pointUsed) || 0 > 0) {
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
          amount: convertDecimalToNumber(refund.amount) || 0,
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
   * 웹훅 처리
   * 토스페이먼츠에서 전송하는 결제 상태 변경 웹훅 처리
   */
  async handleWebhook(dto: PaymentWebhookDto): Promise<void> {
    this.logger.log(`웹훅 수신: ${dto.eventType} / ${dto.data.paymentKey}`);

    // 결제 정보 조회
    const payment = await this.prisma.payment.findFirst({
      where: {
        pgTransactionId: dto.data.paymentKey
      },
      include: {
        order: true
      }
    });

    if (!payment) {
      this.logger.warn(`결제 정보를 찾을 수 없음: ${dto.data.paymentKey}`);
      return;
    }

    switch (dto.eventType) {
      case 'PAYMENT.DONE':
        // 결제 완료 처리 (이미 confirmPayment에서 처리됨)
        break;

      case 'PAYMENT.CANCELED':
        // 결제 취소 처리
        if (payment.status === PaymentStatus.COMPLETED) {
          await this.prisma.$transaction(async (tx) => {
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: OrderStatus.CANCELLED,
                cancelledAt: getNowKST()
              }
            });

            await tx.order.update({
              where: { id: payment.orderId },
              data: {
                status: OrderStatus.CANCELLED,
                cancelledAt: getNowKST()
              }
            });

            await tx.orderStateLog.create({
              data: {
                orderId: payment.orderId,
                fromStatus: 'PAID',
                toStatus: 'CANCELLED',
                changeReason: '토스페이먼츠 웹훅 취소',
                createdAt: getNowKST(),
              }
            });
          });
        }
        break;

      case 'PAYMENT.FAILED':
        // 결제 실패 처리
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            failedAt: getNowKST(),
            failReason: dto.data.failure?.message
          }
        });
        break;

      default:
        this.logger.warn(`처리되지 않은 웹훅 타입: ${dto.eventType}`);
    }
  }

  /**
   * 플레이오토 주문 생성 (비동기)
   * - 결제 승인 후 자동 호출
   * - DB에서 주문 정보 조회 (복호화 포함)
   * - 플레이오토 API 호출 (3회 재시도)
   * - 성공 시 uniq, bundle_no를 Order 테이블에 저장
   */
  private async createPlayautoOrder(orderId: number): Promise<void> {
    try {
      this.logger.log(`플레이오토 주문 생성 시작: 주문ID=${orderId}`);

      // 주문 정보 조회 (OrderItems 포함)
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          OrderItems: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!order) {
        throw new Error(`주문을 찾을 수 없습니다: orderId=${orderId}`);
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

      // 물류 서비스 주문 생성
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
      this.logger.error(`플레이오토 주문 생성 실패: 주문ID=${orderId}`, error.message);
      // 에러를 throw하지 않고 로그만 남김 (비동기 처리이므로)
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