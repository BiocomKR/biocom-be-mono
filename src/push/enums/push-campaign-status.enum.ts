/**
 * 푸시 캠페인 상태
 */
export enum PushCampaignStatus {
  /** 대기 중 */
  PENDING = 'PENDING',

  /** 처리 중 */
  PROCESSING = 'PROCESSING',

  /** 완료 */
  COMPLETED = 'COMPLETED',

  /** 실패 */
  FAILED = 'FAILED',

  /** 취소됨 */
  CANCELLED = 'CANCELLED',
}
