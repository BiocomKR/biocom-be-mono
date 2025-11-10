import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

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

  constructor(private readonly prisma: PrismaService) {}

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
   * 결제 승인 완료 처리
   *
   * 사용 시나리오:
   * - 가상계좌 입금 완료
   * - 계좌이체 완료
   * - 휴대폰 결제 완료
   *
   * @param data - 결제 승인 데이터
   */
  private async handlePaymentApproved(data: any) {
    const { paymentKey, orderId, orderName, amount, method, approvedAt } =
      data;

    this.logger.log(
      `💰 결제 승인 완료: 주문번호=${orderId}, 금액=${amount}원, 방식=${method}`,
    );

    // 트랜잭션으로 DB 업데이트 (원자성 보장)
    await this.prisma.$transaction(async (tx) => {
      // 1. 주문 조회
      const order = await tx.orders.findFirst({
        where: { orderNumber: orderId },
      });

      if (!order) {
        this.logger.error(`❌ 주문을 찾을 수 없음: ${orderId}`);
        throw new Error(`주문을 찾을 수 없습니다: ${orderId}`);
      }

      // 2. 이미 처리된 결제인지 확인 (멱등성 보장)
      if (order.status === 'PAID') {
        this.logger.warn(`⚠️  이미 처리된 주문입니다: ${orderId}`);
        return; // 중복 처리 방지
      }

      // 3. 금액 검증 (보안)
      if (order.finalPrice !== amount) {
        this.logger.error(
          `❌ 금액 불일치: 주문=${order.finalPrice}원, 결제=${amount}원`,
        );
        throw new Error(
          `결제 금액이 일치하지 않습니다. 주문: ${order.finalPrice}원, 결제: ${amount}원`,
        );
      }

      // 4. 주문 상태 업데이트: PENDING → PAID
      await tx.orders.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          updatedAt: new Date(),
        },
      });

      // 5. 결제 정보 저장 (중복 확인 후)
      const existingPayment = await tx.payments.findFirst({
        where: {
          orderId: order.id,
          pgTransactionId: paymentKey,
        },
      });

      if (!existingPayment) {
        await tx.payments.create({
          data: {
            orderId: order.id,
            pgTransactionId: paymentKey,
            amount: amount,
            method: method || '가상계좌',
            status: 'COMPLETED',
            approvedAt: approvedAt ? new Date(approvedAt) : new Date(),
          },
        });
      } else {
        this.logger.warn(`⚠️  이미 결제 정보가 존재합니다: ${paymentKey}`);
      }

      this.logger.log(
        `✅ 주문 상태 업데이트 완료: ${orderId} → PAID (${amount}원)`,
      );
    });
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
      const order = await tx.orders.findFirst({
        where: { orderNumber: orderId },
      });

      if (!order) {
        this.logger.error(`❌ 주문을 찾을 수 없음: ${orderId}`);
        return;
      }

      // 2. 이미 취소된 주문인지 확인
      if (order.status === 'CANCELLED') {
        this.logger.warn(`⚠️  이미 취소된 주문입니다: ${orderId}`);
        return;
      }

      // 3. 주문 상태 업데이트: PAID → CANCELLED
      await tx.orders.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date(),
        },
      });

      // 4. 결제 정보 업데이트
      await tx.payments.updateMany({
        where: {
          orderId: order.id,
          pgTransactionId: paymentKey,
        },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date(),
        },
      });

      this.logger.log(`✅ 결제 취소 처리 완료: ${orderId}`);
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
      const order = await tx.orders.findFirst({
        where: { orderNumber: orderId },
      });

      if (!order) {
        this.logger.error(`❌ 주문을 찾을 수 없음: ${orderId}`);
        return;
      }

      // 2. 주문 상태 업데이트: PENDING → PAYMENT_FAILED
      await tx.orders.update({
        where: { id: order.id },
        data: {
          status: 'PAYMENT_FAILED',
          updatedAt: new Date(),
        },
      });

      this.logger.log(`✅ 결제 실패 처리 완료: ${orderId}`);
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
    const { orderId, depositAmount, depositStatus } = data;

    this.logger.log(
      `🏦 가상계좌 입금 콜백: 주문번호=${orderId}, 금액=${depositAmount}원, 상태=${depositStatus}`,
    );

    if (depositStatus === 'DONE') {
      // 입금 완료 - Payment.Approved와 동일하게 처리
      await this.handlePaymentApproved(data);
    } else if (depositStatus === 'CANCELED') {
      // 입금 취소 (환불)
      await this.handlePaymentCanceled(data);
    } else {
      this.logger.warn(`⚠️  알 수 없는 입금 상태: ${depositStatus}`);
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
          status: 'ACTIVE',
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
          status: 'ACTIVE',
        },
        data: {
          status: 'BILLING_DELETED',
          endDate: new Date(),
          updatedAt: new Date(),
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
          updatedAt: new Date(),
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
