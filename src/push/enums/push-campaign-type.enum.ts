/**
 * 푸시 캠페인 타입
 */
export enum PushCampaignType {
  /** 수동 발송 */
  MANUAL = 'MANUAL',

  /** 예약 발송 (단발성) */
  SCHEDULED = 'SCHEDULED',

  /** 반복 발송 */
  RECURRING = 'RECURRING',
}
