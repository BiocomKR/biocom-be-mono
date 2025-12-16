/**
 * 주문 상태 Enum
 *
 * @description 주문의 현재 상태를 나타냅니다.
 */
export enum OrderStatus {
  /**
   * 결제 대기
   * - 주문이 생성되었지만 결제가 완료되지 않은 상태
   */
  PENDING_PAYMENT = 'PENDING_PAYMENT',

  /**
   * 결제 완료
   * - 결제가 완료되어 상품 준비 대기 중
   */
  PAID = 'PAID',

  /**
   * 상품 준비 중
   * - 결제 확인 후 상품을 준비하는 상태
   */
  PREPARING = 'PREPARING',

  /**
   * 배송 중
   * - 상품이 출고되어 배송 중인 상태
   */
  SHIPPED = 'SHIPPED',

  /**
   * 배송 완료
   * - 상품이 고객에게 전달된 상태
   */
  DELIVERED = 'DELIVERED',

  /**
   * 취소 요청
   * - 송장 등록 후 취소 요청된 상태 (실무자 확인 필요)
   */
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',

  /**
   * 주문 취소
   * - 주문이 취소된 상태
   */
  CANCELLED = 'CANCELLED',

  /**
   * 주문 완료
   * - 모든 프로세스가 완료된 상태 (구매 확정)
   */
  COMPLETED = 'COMPLETED',

  /**
   * 결제 실패
   * - 결제 처리 중 실패한 상태
   */
  PAYMENT_FAILED = 'PAYMENT_FAILED',
}
