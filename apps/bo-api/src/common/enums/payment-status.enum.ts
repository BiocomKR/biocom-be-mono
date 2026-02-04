/**
 * 결제 상태 Enum
 *
 * @description 결제의 현재 상태를 나타냅니다.
 */
export enum PaymentStatus {
  /**
   * 결제 준비
   * - 결제가 시작되기 전 초기 상태
   */
  READY = 'READY',

  /**
   * 결제 진행 중
   * - 결제가 진행 중인 상태
   */
  IN_PROGRESS = 'IN_PROGRESS',

  /**
   * 결제 완료
   * - 결제가 성공적으로 완료된 상태
   */
  DONE = 'DONE',

  /**
   * 결제 취소
   * - 결제가 취소된 상태
   */
  CANCELED = 'CANCELED',

  /**
   * 부분 취소
   * - 결제 금액 중 일부만 취소된 상태
   */
  PARTIAL_CANCELED = 'PARTIAL_CANCELED',

  /**
   * 결제 실패
   * - 결제가 실패한 상태
   */
  FAILED = 'FAILED',

  /**
   * 가상계좌 입금 대기
   * - 가상계좌 발급 후 입금 대기 상태
   */
  WAITING_FOR_DEPOSIT = 'WAITING_FOR_DEPOSIT',

  /**
   * 결제 만료
   * - 결제 유효 기간이 만료된 상태
   */
  EXPIRED = 'EXPIRED',
}
