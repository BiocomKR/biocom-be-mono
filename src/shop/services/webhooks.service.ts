import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { OrderStatus, PaymentStatus, SubscriptionStatus } from '../../common/enums';
import { getNowKST, parseISO8601ToKST } from '../../common/utils/kst-date.util';
import {
  ILogisticsProvider,
  LOGISTICS_PROVIDER_TOKEN,
} from '../../playauto/interfaces/logistics-provider.interface';
import { CryptoUtil } from '../../common/utils/crypto.util';

/**
 * 토스페이먼츠 웹훅 처리 서비스
 *
 * 역할:
 * - 토스페이먼츠 웹훅 이벤트 파싱 및 처리
 * - 가상계좌 입금 완료 시 주문 상태 업데이트
 * - 결제 취소/실패 시 주문 상태 업데이트
 *
 * 중요 원칙:
 * - 멱등성 보장 (같은 웹훅이 여러 번 와도 중복 처리 방지)
 * - 30초 이내 처리 완료 (토스 타임아웃 방지)
 * - 트랜잭션 처리로 데이터 일관성 보장
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LOGISTICS_PROVIDER_TOKEN) private readonly logistics: ILogisticsProvider,
  ) {}

  /**
   * 결제 로그 기록
   */
  private async createPaymentLog(
    tx: any,
    paymentId: number,
    previousStatus: string | null,
    newStatus: string,
    data: {
      amount?: number;
      reason?: string;
      rawData?: any;
    } = {},
  ) {
    await tx.paymentLog.create({
      data: {
        paymentId,
        previousStatus,
        newStatus,
        amount: data.amount,
        reason: data.reason,
        rawData: data.rawData,
      },
    });
  }

  /**
   * 토스페이먼츠 웹훅 처리 메인 함수
   *
   * @param webhookData - 토스가 보내는 웹훅 페이로드
   */
  async handleTossWebhook(webhookData: any) {
    const { eventType, data } = webhookData;

    this.logger.log(`📌 웹훅 이벤트 타입: ${eventType}`);

    // 이벤트 타입별 처리
    switch (eventType) {
      case 'PAYMENT_STATUS_CHANGED':
        // 토스 status 값에 따라 분기 처리
        await this.handlePaymentStatusChanged(data);
        break;

      case 'Payment.Approved':
        await this.handlePaymentApproved(data);
        break;

      case 'DEPOSIT_CALLBACK':
        await this.handleDepositCallback(data);
        break;

      case 'CANCEL_STATUS_CHANGED':
      case 'Payment.Canceled':
        await this.handlePaymentCanceled(data);
        break;

      case 'Payment.Failed':
        await this.handlePaymentFailed(data);
        break;

      case 'BILLING_DELETED':
        await this.handleBillingDeleted(data);
        break;

      default:
        this.logger.warn(`⚠️  알 수 없는 웹훅 이벤트: ${eventType}`);
    }
  }

  /**
   * PAYMENT_STATUS_CHANGED 이벤트 처리
   * 토스의 status 값에 따라 적절한 핸들러로 분기
   *
   * @param data - 결제 상태 변경 데이터
   */
  private async handlePaymentStatusChanged(data: any) {
    const { status, orderId } = data;

    this.logger.log(`🔀 결제 상태 변경: 주문번호=${orderId}, status=${status}`);

    switch (status) {
      case 'DONE':
        // 결제 승인 완료
        await this.handlePaymentApproved(data);
        break;

      case 'CANCELED':
        // 결제 취소
        await this.handlePaymentCanceled(data);
        break;

      case 'PARTIAL_CANCELED':
        // 부분 취소
        await this.handlePaymentPartialCanceled(data);
        break;

      case 'ABORTED':
        // 결제 실패 (사용자 취소 등)
        await this.handlePaymentFailed({ ...data, failReason: `결제 ${status}` });
        break;

      case 'EXPIRED':
        // 결제 만료 (정상적인 타임아웃, 로그만 기록)
        this.logger.log(`⏰ 결제 만료: 주문번호=${orderId} (결제창 유효시간 초과)`);
        await this.handlePaymentExpired(data);
        break;

      case 'WAITING_FOR_DEPOSIT':
        // 가상계좌 입금 대기 (처리 불필요)
        this.logger.log(`⏳ 가상계좌 입금 대기 중: ${orderId}`);
        break;

      default:
        this.logger.warn(`⚠️ 알 수 없는 결제 상태: ${status}`);
    }
  }

  /**
   * 결제 승인 완료 처리
   *
   * 사용 시나리오:
   * - 가상계좌 입금 완료
   * - 계좌이체 완료
   * - 휴대폰 결제 완료
   *
   * 처리 내용:
   * 1. 주문/결제 상태 업데이트 (PAID, COMPLETED)
   * 2. 챌린지 티켓 발급
   * 3. 플레이오토 물류 주문 생성 (비동기)
   *
   * @param data - 결제 승인 데이터
   */
  private async handlePaymentApproved(data: any) {
    // PAYMENT_STATUS_CHANGED 웹훅에는 paymentKey, status, orderId, approvedAt 포함
    // amount는 포함되지 않음 (토스 공식 문서 참고)
    const { paymentKey, orderId, status, approvedAt } = data;

    // 토스 approvedAt을 KST Date로 변환 (예: "2025-12-12T05:44:24+09:00")
    // approvedAt이 없으면 현재 시간 사용 (하위 호환성)
    const paidAtKST = approvedAt ? parseISO8601ToKST(approvedAt) : getNowKST();

    this.logger.log(
      `💰 결제 승인 웹훅 수신: 주문번호=${orderId}, paymentKey=${paymentKey}, status=${status}`,
    );

    // 1. 트랜잭션 시작 전 상태 확인 (데드락 방지)
    // 카드 결제는 confirmPayment에서 이미 처리되므로 웹훅이 늦게 도착할 수 있음
    const existingOrder = await this.prisma.order.findFirst({
      where: { orderNumber: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!existingOrder) {
      this.logger.error(`❌ 주문을 찾을 수 없음: ${orderId}`);
      return; // throw 대신 return (웹훅 재시도 방지)
    }

    // PAID 상태면 후처리 누락 여부 확인 후 보정 실행
    if (existingOrder.status === OrderStatus.PAID) {
      this.logger.log(`✅ 이미 PAID 상태인 주문, 후처리 누락 확인: ${orderId}`);
      await this.ensurePostPaymentProcessing(existingOrder);
      return;
    }

    // 2. 트랜잭션으로 DB 업데이트 (가상계좌/계좌이체 등 비동기 결제용)
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // FOR UPDATE로 행 락 획득 (동시 처리 방지)
      const order = await tx.order.findFirst({
        where: { orderNumber: orderId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!order) {
        this.logger.error(`❌ 주문을 찾을 수 없음: ${orderId}`);
        return null;
      }

      // 다시 한번 상태 확인 (트랜잭션 내에서)
      if (order.status === OrderStatus.PAID) {
        this.logger.warn(`⚠️  이미 처리된 주문입니다 (트랜잭션 내): ${orderId}`);
        return null;
      }

      // 3. 주문 상태 업데이트: PENDING → PAID
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          paidAt: paidAtKST,
        },
      });

      // 4. 결제 정보 업데이트 (이미 createOrder에서 생성됨)
      const payment = await tx.payment.findFirst({
        where: { orderId: order.id },
      });

      if (payment) {
        const previousStatus = payment.status;

        // paymentDetails가 없으면 웹훅 데이터라도 저장 (confirmPayment가 먼저 처리하면 이미 있음)
        const updateData: any = {
          pgTransactionId: paymentKey,
          status: PaymentStatus.COMPLETED,
          paidAt: paidAtKST,
        };

        // confirmPayment에서 이미 paymentDetails를 저장했으면 덮어쓰지 않음
        if (!payment.paymentDetails) {
          updateData.paymentDetails = data; // 웹훅 원문 저장
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: updateData,
        });

        // 결제 로그 기록
        await this.createPaymentLog(tx, payment.id, previousStatus, PaymentStatus.COMPLETED, {
          reason: '결제 승인 완료 (웹훅)',
          rawData: data,
        });
      }

      // 5. 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.PAID,
          changeReason: '결제 완료 (웹훅)',
          createdAt: getNowKST(),
        },
      });

      // [제거됨] 챌린지 상품 티켓 발급 로직
      // - 챌린지: quick-start API로만 시작 (challenge.service.ts)
      // - 구독: IAP 인앱결제로만 구매 (iap.service.ts)
      // - 주문 플로우에서 CHALLENGE/SUBSCRIPTION 상품은 orders.service.ts에서 차단됨

      this.logger.log(`✅ 주문 상태 업데이트 완료 (웹훅): ${orderId} → PAID`);

      return order;
    });

    // 7. 플레이오토 주문 생성 (비동기 - 트랜잭션 커밋 후 실행)
    // 카드/간편결제는 confirmPayment에서 이미 처리됨
    // 웹훅에서는 가상계좌/계좌이체 등 비동기 결제만 처리
    // logisticsUniq가 있으면 이미 처리된 것이므로 스킵
    if (updatedOrder && !updatedOrder.logisticsUniq) {
      this.logger.log(`📦 플레이오토 주문 생성 시작 (웹훅 - 비동기 결제): 주문ID=${updatedOrder.id}`);
      this.createPlayautoOrder(updatedOrder.id).catch((error) => {
        this.logger.error(
          `플레이오토 주문 생성 비동기 실패 (웹훅): 주문ID=${updatedOrder.id}`,
          error,
        );
      });
    }
  }

  /**
   * 후처리 누락 보정 (PAID 상태인 주문의 물류 누락 확인 및 보정)
   *
   * 사용 시나리오:
   * - confirmPayment 트랜잭션 중 장애로 물류가 처리되지 않은 경우
   * - 웹훅이 먼저 도착했으나 후처리가 누락된 경우
   *
   * [제거됨] 챌린지 티켓 보정 로직
   * - 챌린지: quick-start API로만 시작 (challenge.service.ts)
   * - 구독: IAP 인앱결제로만 구매 (iap.service.ts)
   * - 주문 플로우에서 CHALLENGE/SUBSCRIPTION 상품은 orders.service.ts에서 차단됨
   */
  private async ensurePostPaymentProcessing(order: any): Promise<void> {
    const orderNumber = order.orderNumber;

    // 물류 누락 보정은 하지 않음
    // 카드/간편결제는 confirmPayment에서 비동기로 처리 중
    // 웹훅이 먼저 도착해도 confirmPayment의 플레이오토 호출이 완료될 때까지 대기해야 함
    // 중복 호출 방지를 위해 여기서는 호출하지 않음
    // 물류 누락 주문은 logistics-retry-scheduler 배치에서 재시도

    this.logger.log(`✅ 후처리 보정 완료: ${orderNumber}`);
  }

  /**
   * 플레이오토 주문 생성 (비동기)
   *
   * PaymentService.createPlayautoOrder와 동일한 로직
   * 웹훅 경로에서도 물류 주문 생성이 가능하도록 함
   */
  private async createPlayautoOrder(orderId: number): Promise<void> {
    try {
      this.logger.log(`플레이오토 주문 생성 시작 (웹훅): 주문ID=${orderId}`);

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
        this.logger.warn(
          `이미 물류 등록된 주문입니다: orderId=${orderId}, uniq=${order.logisticsUniq}`,
        );
        return;
      }

      // 결제 완료된 주문만 물류 등록
      if (order.status !== OrderStatus.PAID) {
        this.logger.warn(
          `결제 완료되지 않은 주문입니다: orderId=${orderId}, status=${order.status}`,
        );
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

      this.logger.log(
        `물류 주문 생성 완료 (웹훅): 주문ID=${orderId}, provider=${this.logistics.name}, uniq=${uniq}, bundleNo=${bundleNo}`,
      );
    } catch (error: any) {
      // 실패해도 결제는 유지됨 (의도된 동작)
      // logisticsApiLog에 FAILURE로 기록됨 → 배치 재시도 가능
      this.logger.error(
        `플레이오토 주문 생성 실패 (웹훅): 주문ID=${orderId}, error=${error.message}`,
      );
    }
  }

  /**
   * 결제 취소 완료 처리
   *
   * 사용 시나리오:
   * - 사용자가 관리자 페이지에서 결제 취소
   * - 토스 관리자가 직접 취소
   *
   * @param data - 결제 취소 데이터
   */
  private async handlePaymentCanceled(data: any) {
    const { paymentKey, orderId, cancelReason, canceledAt } = data;

    this.logger.log(
      `🔄 결제 취소 완료: 주문번호=${orderId}, 사유=${cancelReason}`,
    );

    await this.prisma.$transaction(async (tx) => {
      // 1. 주문 조회
      const order = await tx.order.findFirst({
        where: { orderNumber: orderId },
      });

      if (!order) {
        this.logger.error(`❌ 주문을 찾을 수 없음: ${orderId}`);
        return;
      }

      // 2. 이미 취소된 주문인지 확인
      if (order.status === OrderStatus.CANCELLED) {
        this.logger.warn(`⚠️  이미 취소된 주문입니다: ${orderId}`);
        return;
      }

      // 3. 주문 상태 업데이트: PAID → CANCELLED
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
        },
      });

      // 4. 결제 정보 업데이트
      const payment = await tx.payment.findFirst({
        where: {
          orderId: order.id,
          pgTransactionId: paymentKey,
        },
      });

      if (payment) {
        const previousStatus = payment.status;

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.CANCELLED,
            cancelledAt: getNowKST(),
          },
        });

        // 결제 로그 기록
        await this.createPaymentLog(tx, payment.id, previousStatus, PaymentStatus.CANCELLED, {
          reason: cancelReason || '결제 취소',
          rawData: data,
        });
      }

      this.logger.log(`✅ 결제 취소 처리 완료: ${orderId}`);
    });
  }

  /**
   * 부분 취소 처리
   *
   * 사용 시나리오:
   * - 일부 상품만 취소/환불
   *
   * @param data - 부분 취소 데이터
   */
  private async handlePaymentPartialCanceled(data: any) {
    const { paymentKey, orderId, cancels, balanceAmount } = data;

    // 마지막 취소 정보 추출
    const lastCancel = cancels?.[cancels.length - 1];
    const cancelAmount = lastCancel?.cancelAmount || 0;
    const cancelReason = lastCancel?.cancelReason || '부분 취소';

    this.logger.log(
      `🔄 부분 취소: 주문번호=${orderId}, 취소금액=${cancelAmount}원, 잔여금액=${balanceAmount}원, 사유=${cancelReason}`,
    );

    await this.prisma.$transaction(async (tx) => {
      // 1. 주문 조회
      const order = await tx.order.findFirst({
        where: { orderNumber: orderId },
      });

      if (!order) {
        this.logger.error(`❌ 주문을 찾을 수 없음: ${orderId}`);
        return;
      }

      // 2. 주문 상태는 유지하고 부분 취소 금액만 기록
      // 전체 취소가 아니므로 CANCELLED로 변경하지 않음
      await tx.order.update({
        where: { id: order.id },
        data: {
          // 부분 환불 금액 누적 (필드가 있다면)
          // refundedAmount: { increment: cancelAmount },
          updatedAt: getNowKST(),
        },
      });

      // 3. 결제 정보에 부분 취소 기록
      const payment = await tx.payment.findFirst({
        where: {
          orderId: order.id,
          pgTransactionId: paymentKey,
        },
      });

      if (payment) {
        const previousStatus = payment.status;

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.PARTIAL_CANCELLED,
            updatedAt: getNowKST(),
          },
        });

        // 결제 로그 기록
        await this.createPaymentLog(tx, payment.id, previousStatus, PaymentStatus.PARTIAL_CANCELLED, {
          amount: cancelAmount,
          reason: cancelReason,
          rawData: data,
        });
      }

      this.logger.log(`✅ 부분 취소 처리 완료: ${orderId}, 취소금액=${cancelAmount}원`);
    });
  }

  /**
   * 결제 실패 처리
   *
   * 사용 시나리오:
   * - 가상계좌 입금 기한 만료
   * - 카드 한도 초과
   * - 계좌 잔액 부족
   *
   * @param data - 결제 실패 데이터
   */
  private async handlePaymentFailed(data: any) {
    const { orderId, failReason } = data;

    this.logger.error(`❌ 결제 실패: 주문번호=${orderId}, 사유=${failReason}`);

    await this.prisma.$transaction(async (tx) => {
      // 1. 주문 조회
      const order = await tx.order.findFirst({
        where: { orderNumber: orderId },
      });

      if (!order) {
        this.logger.error(`❌ 주문을 찾을 수 없음: ${orderId}`);
        return;
      }

      // 2. 주문 상태 업데이트: PENDING → PAYMENT_FAILED
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAYMENT_FAILED,
        },
      });

      // 3. 결제 정보 업데이트
      const payment = await tx.payment.findFirst({
        where: {
          orderId: order.id,
          status: PaymentStatus.PENDING,
        },
      });

      if (payment) {
        const previousStatus = payment.status;

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            failedAt: getNowKST(),
            failReason: failReason?.substring(0, 500) || 'Unknown error',
          },
        });

        // 결제 로그 기록
        await this.createPaymentLog(tx, payment.id, previousStatus, PaymentStatus.FAILED, {
          reason: failReason?.substring(0, 500) || 'Unknown error',
          rawData: data,
        });
      }

      this.logger.log(`✅ 결제 실패 처리 완료: ${orderId}`);
    });
  }

  /**
   * 결제 만료 처리 (EXPIRED)
   *
   * 사용자가 결제창에서 시간 초과로 결제를 완료하지 않은 경우
   * 정상적인 케이스이므로 Slack 알림 없이 로그만 기록
   */
  private async handlePaymentExpired(data: any) {
    const { orderId } = data;

    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { orderNumber: orderId },
      });

      if (!order) {
        this.logger.warn(`⚠️ 만료 처리할 주문을 찾을 수 없음: ${orderId}`);
        return;
      }

      // 이미 처리된 주문은 스킵
      if (order.status !== OrderStatus.PENDING_PAYMENT) {
        this.logger.log(`ℹ️ 이미 처리된 주문, 만료 처리 스킵: ${orderId} (현재 상태: ${order.status})`);
        return;
      }

      // 주문 상태 업데이트
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAYMENT_FAILED,
        },
      });

      // 결제 정보 업데이트
      const payment = await tx.payment.findFirst({
        where: {
          orderId: order.id,
          status: PaymentStatus.PENDING,
        },
      });

      if (payment) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            failedAt: getNowKST(),
            failReason: '결제 시간 초과 (EXPIRED)',
          },
        });
      }

      this.logger.log(`✅ 결제 만료 처리 완료: ${orderId}`);
    });
  }

  /**
   * 가상계좌 입금 콜백 처리
   *
   * 사용 시나리오:
   * - 가상계좌 입금 완료
   * - 가상계좌 입금 취소 (환불)
   *
   * @param data - 가상계좌 입금 데이터
   */
  private async handleDepositCallback(data: any) {
    const { orderId, status } = data;

    this.logger.log(
      `🏦 가상계좌 입금 콜백: 주문번호=${orderId}, 상태=${status}`,
    );

    if (status === 'DONE') {
      // 입금 완료 처리
      await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findFirst({
          where: { orderNumber: orderId },
        });

        if (!order) {
          this.logger.error(`❌ 주문을 찾을 수 없음: ${orderId}`);
          return;
        }

        if (order.status === OrderStatus.PAID) {
          this.logger.warn(`⚠️  이미 처리된 주문입니다: ${orderId}`);
          return;
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.PAID,
            paidAt: getNowKST(),
          },
        });

        const payment = await tx.payment.findFirst({
          where: {
            orderId: order.id,
            status: PaymentStatus.PENDING,
          },
        });

        if (payment) {
          const previousStatus = payment.status;

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.COMPLETED,
              paidAt: getNowKST(),
            },
          });

          // 결제 로그 기록
          await this.createPaymentLog(tx, payment.id, previousStatus, PaymentStatus.COMPLETED, {
            reason: '가상계좌 입금 완료',
            rawData: data,
          });
        }

        this.logger.log(`✅ 가상계좌 입금 완료 처리: ${orderId}`);
      });
    } else if (status === 'CANCELED') {
      // 입금 취소 (환불)
      await this.handlePaymentCanceled({ ...data, orderId });
    } else {
      this.logger.warn(`⚠️  알 수 없는 입금 상태: ${status}`);
    }
  }

  /**
   * 빌링키 삭제 처리 (구독 상품 자동결제 해지)
   *
   * 사용 시나리오:
   * - 사용자가 카드 삭제
   * - 사용자가 자동결제 해지
   * - 카드 유효기간 만료
   * - 카드 분실 신고
   *
   * @param data - 빌링키 삭제 데이터
   */
  private async handleBillingDeleted(data: any) {
    const { billingKey, customerKey, deletedAt } = data;

    this.logger.log(
      `🔑 빌링키 삭제: billingKey=${billingKey}, customerKey=${customerKey}`,
    );

    await this.prisma.$transaction(async (tx) => {
      // 1. 해당 빌링키로 등록된 사용자 찾기
      const user = await tx.user.findFirst({
        where: { billingKey: billingKey },
      });

      if (!user) {
        this.logger.warn(`⚠️  빌링키에 해당하는 사용자가 없습니다: ${billingKey}`);
        return;
      }

      this.logger.log(`사용자 발견: userId=${user.id}, email=${user.email}`);

      // 2. 해당 빌링키로 활성화된 구독 찾기
      const subscriptions = await tx.subscription.findMany({
        where: {
          billingKey: billingKey,
          status: SubscriptionStatus.ACTIVE,
        },
        include: {
          product: true,
        },
      });

      if (subscriptions.length === 0) {
        this.logger.warn(`⚠️  활성화된 구독이 없습니다: ${billingKey}`);
        return;
      }

      this.logger.log(
        `활성화된 구독 ${subscriptions.length}건 발견. 상태 변경 시작...`,
      );

      // 3. 구독 상태를 BILLING_DELETED로 변경
      const updateResult = await tx.subscription.updateMany({
        where: {
          billingKey: billingKey,
          status: SubscriptionStatus.ACTIVE,
        },
        data: {
          status: SubscriptionStatus.BILLING_DELETED,
          endDate: getNowKST(),
          updatedAt: getNowKST(),
        },
      });

      this.logger.log(
        `✅ ${updateResult.count}건의 구독 상태를 BILLING_DELETED로 변경 완료`,
      );

      // 4. 사용자 테이블에서 빌링키 삭제
      await tx.user.update({
        where: { id: user.id },
        data: {
          billingKey: null,
          customerKey: null,
          updatedAt: getNowKST(),
        },
      });

      this.logger.log(`사용자의 빌링키 정보 삭제 완료: userId=${user.id}`);

      // 5. 사용자에게 알림 발송 (선택)
      // TODO: 이메일/푸시 알림 발송
      // "자동결제 카드가 삭제되어 구독이 중지되었습니다."
      this.logger.warn(
        `📧 TODO: 사용자에게 구독 중지 알림 발송 필요 - ${user.email}`,
      );

      // 6. 중지된 구독 목록 로깅
      subscriptions.forEach((sub) => {
        this.logger.log(
          `  - 구독 중지: 상품명=${sub.product.name}, 구독ID=${sub.id}`,
        );
      });

      this.logger.log(`✅ 빌링키 삭제 처리 완료: ${billingKey}`);
    });
  }
}
