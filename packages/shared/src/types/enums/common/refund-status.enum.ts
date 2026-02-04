/**
 * 환불 상태 Enum
 *
 * @description 환불 요청의 현재 상태를 나타냅니다.
 */
export enum RefundStatus {
  /**
   * 환불 요청
   * - 고객이 환불을 요청한 상태
   */
  REQUESTED = 'REQUESTED',

  /**
   * 환불 승인
   * - 관리자가 환불을 승인한 상태
   */
  APPROVED = 'APPROVED',

  /**
   * 환불 처리 중
   * - 관리자가 환불을 검토/처리 중인 상태
   */
  PENDING = 'PENDING',

  /**
   * 처리 진행 중
   * - 환불 처리가 진행 중인 상태
   */
  PROCESSING = 'PROCESSING',

  /**
   * 환불 완료
   * - 환불이 완료된 상태
   */
  COMPLETED = 'COMPLETED',

  /**
   * 환불 거절
   * - 환불 요청이 거절된 상태
   */
  REJECTED = 'REJECTED',

  /**
   * 환불 실패
   * - 환불 처리가 실패한 상태
   */
  FAILED = 'FAILED',
}
