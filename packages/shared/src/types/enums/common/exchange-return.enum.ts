/**
 * 교환/반품 타입 Enum
 *
 * @description 교환/반품 요청의 타입을 나타냅니다.
 */
export enum ExchangeReturnType {
  /**
   * 교환
   * - 상품 교환 요청
   */
  EXCHANGE = 'EXCHANGE',

  /**
   * 반품
   * - 상품 반품 요청
   */
  RETURN = 'RETURN',
}

/**
 * 교환/반품 상태 Enum
 *
 * @description 교환/반품 요청의 현재 상태를 나타냅니다.
 */
export enum ExchangeReturnStatus {
  /**
   * 요청됨
   * - 고객이 교환/반품을 요청한 상태
   */
  REQUESTED = 'REQUESTED',

  /**
   * 승인됨
   * - 관리자가 요청을 승인한 상태
   */
  APPROVED = 'APPROVED',

  /**
   * 거절됨
   * - 관리자가 요청을 거절한 상태
   */
  REJECTED = 'REJECTED',

  /**
   * 완료됨
   * - 교환/반품 처리가 완료된 상태
   */
  COMPLETED = 'COMPLETED',
}
