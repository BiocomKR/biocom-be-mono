import { ApiProperty } from '@nestjs/swagger';

/**
 * Apple App Store Server Notification V2
 * https://developer.apple.com/documentation/appstoreservernotifications
 */
export class AppleWebhookDto {
  @ApiProperty({ description: 'Signed payload (JWS)' })
  signedPayload: string;
}

/**
 * Google Play Real-time Developer Notification (RTDN)
 * https://developer.android.com/google/play/billing/rtdn-reference
 */
export class GoogleWebhookDto {
  @ApiProperty({ description: 'Pub/Sub message' })
  message: {
    data: string; // Base64 encoded
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

/**
 * Apple 알림 타입
 */
export enum AppleNotificationType {
  CONSUMPTION_REQUEST = 'CONSUMPTION_REQUEST',
  DID_CHANGE_RENEWAL_PREF = 'DID_CHANGE_RENEWAL_PREF',
  DID_CHANGE_RENEWAL_STATUS = 'DID_CHANGE_RENEWAL_STATUS',
  DID_FAIL_TO_RENEW = 'DID_FAIL_TO_RENEW',
  DID_RENEW = 'DID_RENEW',
  EXPIRED = 'EXPIRED',
  GRACE_PERIOD_EXPIRED = 'GRACE_PERIOD_EXPIRED',
  OFFER_REDEEMED = 'OFFER_REDEEMED',
  PRICE_INCREASE = 'PRICE_INCREASE',
  REFUND = 'REFUND',
  REFUND_DECLINED = 'REFUND_DECLINED',
  REFUND_REVERSED = 'REFUND_REVERSED',
  RENEWAL_EXTENDED = 'RENEWAL_EXTENDED',
  REVOKE = 'REVOKE',
  SUBSCRIBED = 'SUBSCRIBED',
  TEST = 'TEST',
}

/**
 * Google 알림 타입 (One-time products)
 */
export enum GoogleOneTimeNotificationType {
  ONE_TIME_PRODUCT_PURCHASED = 1,
  ONE_TIME_PRODUCT_CANCELED = 2,
}

/**
 * 웹훅 처리 결과
 */
export interface WebhookProcessResult {
  success: boolean;
  message: string;
  notificationType?: string;
  transactionId?: string;
}
