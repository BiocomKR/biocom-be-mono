/**
 * 백오피스 피드백 처리 상태
 */
export enum FeedbackStatus {
  /** 대기중 */
  PENDING = 'PENDING',
  /** 진행중 */
  IN_PROGRESS = 'IN_PROGRESS',
  /** 완료 */
  RESOLVED = 'RESOLVED',
}
