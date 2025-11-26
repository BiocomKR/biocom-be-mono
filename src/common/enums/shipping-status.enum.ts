/**
 * 배송 상태 Enum
 *
 * @description 배송의 현재 상태를 나타냅니다.
 */
export enum ShippingStatus {
  /**
   * 대기 중
   * - 배송 준비 전 상태
   */
  PENDING = 'PENDING',

  /**
   * 출고 준비 완료
   * - 상품 포장 완료, 택배사 픽업 대기
   */
  READY_FOR_SHIPMENT = 'READY_FOR_SHIPMENT',

  /**
   * 배송 중
   * - 택배사에서 배송 진행 중
   */
  IN_TRANSIT = 'IN_TRANSIT',

  /**
   * 배송 완료
   * - 고객에게 상품 전달 완료
   */
  DELIVERED = 'DELIVERED',
}
