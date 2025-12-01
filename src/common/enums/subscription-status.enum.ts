/**
 * 구독 상태 Enum
 *
 * @description 구독의 현재 상태를 나타냅니다.
 */
export enum SubscriptionStatus {
  /**
   * 활성
   * - 구독이 정상적으로 진행 중인 상태
   */
  ACTIVE = 'ACTIVE',

  /**
   * 일시 정지
   * - 사용자가 구독을 일시 정지한 상태
   */
  PAUSED = 'PAUSED',

  /**
   * 취소됨
   * - 사용자가 구독을 취소한 상태
   */
  CANCELLED = 'CANCELLED',

  /**
   * 빌링키 삭제됨
   * - 결제 수단(빌링키)이 삭제된 상태
   */
  BILLING_DELETED = 'BILLING_DELETED',

  /**
   * 결제 실패
   * - 정기 결제가 실패한 상태
   */
  PAYMENT_FAILED = 'PAYMENT_FAILED',

  /**
   * 만료됨
   * - 구독 기간이 만료된 상태
   */
  EXPIRED = 'EXPIRED',
}
