import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import {
  AppleNotificationType,
  GoogleOneTimeNotificationType,
  WebhookProcessResult,
} from '../dto/webhook.dto';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * IAP 웹훅 처리 서비스
 * Apple S2S Notification / Google RTDN 처리
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Apple 웹훅 처리
   * @param payload 디코딩된 페이로드
   */
  async processAppleWebhook(payload: AppleNotificationPayload): Promise<WebhookProcessResult> {
    const { notificationType, data } = payload;
    const transactionId = data?.signedTransactionInfo?.transactionId;

    this.logger.log(`Apple 웹훅 수신 - type: ${notificationType}, transactionId: ${transactionId}`);

    // 웹훅 로그 저장
    await this.saveWebhookLog('APPLE', notificationType, payload);

    switch (notificationType) {
      case AppleNotificationType.REFUND:
        return this.handleAppleRefund(data);

      case AppleNotificationType.REVOKE:
        return this.handleAppleRevoke(data);

      case AppleNotificationType.REFUND_REVERSED:
        return this.handleAppleRefundReversed(data);

      case AppleNotificationType.TEST:
        return { success: true, message: 'Test notification received', notificationType };

      default:
        this.logger.log(`미처리 Apple 알림 타입: ${notificationType}`);
        return { success: true, message: `Unhandled notification type: ${notificationType}`, notificationType };
    }
  }

  /**
   * Google 웹훅 처리
   * @param payload 디코딩된 페이로드
   */
  async processGoogleWebhook(payload: GoogleNotificationPayload): Promise<WebhookProcessResult> {
    const { oneTimeProductNotification } = payload;

    if (!oneTimeProductNotification) {
      this.logger.log('Google 구독 알림은 현재 미지원');
      return { success: true, message: 'Subscription notifications not supported yet' };
    }

    const { notificationType, purchaseToken, sku } = oneTimeProductNotification;
    this.logger.log(`Google 웹훅 수신 - type: ${notificationType}, sku: ${sku}`);

    // 웹훅 로그 저장
    await this.saveWebhookLog('GOOGLE', String(notificationType), payload);

    switch (notificationType) {
      case GoogleOneTimeNotificationType.ONE_TIME_PRODUCT_CANCELED:
        return this.handleGoogleCanceled(purchaseToken, sku);

      case GoogleOneTimeNotificationType.ONE_TIME_PRODUCT_PURCHASED:
        // 구매는 앱에서 직접 처리하므로 로깅만
        return { success: true, message: 'Purchase notification logged', notificationType: String(notificationType) };

      default:
        return { success: true, message: `Unhandled notification type: ${notificationType}` };
    }
  }

  /**
   * Apple 환불 처리
   */
  private async handleAppleRefund(data: AppleNotificationData): Promise<WebhookProcessResult> {
    const transactionInfo = data.signedTransactionInfo;
    if (!transactionInfo) {
      return { success: false, message: 'Missing transaction info' };
    }

    const { transactionId, revocationDate, revocationReason } = transactionInfo;

    // 영수증 찾기
    const receipt = await this.prisma.iAPReceipt.findUnique({
      where: { transactionId },
      include: { challengeTicket: true },
    });

    if (!receipt) {
      this.logger.warn(`환불 처리 실패 - 영수증 없음: ${transactionId}`);
      return { success: false, message: 'Receipt not found', transactionId };
    }

    // 영수증 상태 업데이트
    await this.prisma.iAPReceipt.update({
      where: { id: receipt.id },
      data: {
        status: 'REFUNDED',
        refundedAt: revocationDate ? new Date(revocationDate) : getNowKST(),
        refundReason: revocationReason?.toString(),
      },
    });

    // 티켓 회수 (AVAILABLE 상태인 경우만)
    if (receipt.challengeTicket?.status === 'AVAILABLE') {
      await this.prisma.challengeTicket.update({
        where: { id: receipt.challengeTicket.id },
        data: { status: 'REVOKED' },
      });
      this.logger.log(`티켓 회수 완료 - ticketId: ${receipt.challengeTicket.id}`);
    }

    this.logger.log(`Apple 환불 처리 완료 - transactionId: ${transactionId}`);
    return { success: true, message: 'Refund processed', notificationType: 'REFUND', transactionId };
  }

  /**
   * Apple 취소 처리 (Family Sharing 취소 등)
   */
  private async handleAppleRevoke(data: AppleNotificationData): Promise<WebhookProcessResult> {
    // REFUND와 동일한 처리
    return this.handleAppleRefund(data);
  }

  /**
   * Apple 환불 취소 처리 (환불이 번복된 경우)
   */
  private async handleAppleRefundReversed(data: AppleNotificationData): Promise<WebhookProcessResult> {
    const transactionInfo = data.signedTransactionInfo;
    if (!transactionInfo) {
      return { success: false, message: 'Missing transaction info' };
    }

    const { transactionId } = transactionInfo;

    // 영수증 찾기
    const receipt = await this.prisma.iAPReceipt.findUnique({
      where: { transactionId },
      include: { challengeTicket: true },
    });

    if (!receipt) {
      return { success: false, message: 'Receipt not found', transactionId };
    }

    // 영수증 상태 복원
    await this.prisma.iAPReceipt.update({
      where: { id: receipt.id },
      data: {
        status: 'VERIFIED',
        refundedAt: null,
        refundReason: null,
      },
    });

    // 티켓 복원 (REVOKED 상태인 경우만)
    if (receipt.challengeTicket?.status === 'REVOKED') {
      await this.prisma.challengeTicket.update({
        where: { id: receipt.challengeTicket.id },
        data: { status: 'AVAILABLE' },
      });
      this.logger.log(`티켓 복원 완료 - ticketId: ${receipt.challengeTicket.id}`);
    }

    this.logger.log(`Apple 환불 취소 처리 완료 - transactionId: ${transactionId}`);
    return { success: true, message: 'Refund reversed', notificationType: 'REFUND_REVERSED', transactionId };
  }

  /**
   * Google 취소/환불 처리
   */
  private async handleGoogleCanceled(purchaseToken: string, sku: string): Promise<WebhookProcessResult> {
    // Google은 purchaseToken으로 영수증 찾기 (receiptData에 저장됨)
    const receipt = await this.prisma.iAPReceipt.findFirst({
      where: {
        platform: 'GOOGLE',
        receiptData: purchaseToken,
      },
      include: { challengeTicket: true },
    });

    if (!receipt) {
      this.logger.warn(`Google 취소 처리 실패 - 영수증 없음: ${purchaseToken}`);
      return { success: false, message: 'Receipt not found' };
    }

    // 영수증 상태 업데이트
    await this.prisma.iAPReceipt.update({
      where: { id: receipt.id },
      data: {
        status: 'REFUNDED',
        refundedAt: getNowKST(),
      },
    });

    // 티켓 회수 (AVAILABLE 상태인 경우만)
    if (receipt.challengeTicket?.status === 'AVAILABLE') {
      await this.prisma.challengeTicket.update({
        where: { id: receipt.challengeTicket.id },
        data: { status: 'REVOKED' },
      });
      this.logger.log(`티켓 회수 완료 - ticketId: ${receipt.challengeTicket.id}`);
    }

    this.logger.log(`Google 취소 처리 완료 - transactionId: ${receipt.transactionId}`);
    return { success: true, message: 'Cancellation processed', transactionId: receipt.transactionId };
  }

  /**
   * 웹훅 로그 저장
   */
  private async saveWebhookLog(platform: 'APPLE' | 'GOOGLE', notificationType: string, payload: any) {
    try {
      await this.prisma.iAPWebhookLog.create({
        data: {
          platform,
          notificationType,
          payload,
          processedAt: getNowKST(),
        },
      });
    } catch (error) {
      this.logger.error(`웹훅 로그 저장 실패: ${error.message}`);
    }
  }
}

/**
 * Apple 알림 페이로드
 */
interface AppleNotificationPayload {
  notificationType: AppleNotificationType;
  subtype?: string;
  notificationUUID: string;
  data: AppleNotificationData;
  version: string;
  signedDate: number;
}

interface AppleNotificationData {
  appAppleId?: number;
  bundleId?: string;
  bundleVersion?: string;
  environment?: string;
  signedTransactionInfo?: {
    transactionId: string;
    originalTransactionId: string;
    productId: string;
    purchaseDate: number;
    revocationDate?: number;
    revocationReason?: number;
  };
  signedRenewalInfo?: any;
}

/**
 * Google 알림 페이로드
 */
interface GoogleNotificationPayload {
  version: string;
  packageName: string;
  eventTimeMillis: string;
  oneTimeProductNotification?: {
    version: string;
    notificationType: GoogleOneTimeNotificationType;
    purchaseToken: string;
    sku: string;
  };
  subscriptionNotification?: {
    version: string;
    notificationType: number;
    purchaseToken: string;
    subscriptionId: string;
  };
}
