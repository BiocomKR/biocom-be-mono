/**
 * 환불 보증 상태 Enum
 *
 * @description 환불 보증권의 현재 상태를 나타냅니다.
 */
export enum WarrantyStatus {
  /**
   * 활성 (사용 가능)
   * - 환불 보증을 사용할 수 있는 상태
   */
  ACTIVE = 'ACTIVE',

  /**
   * 사용됨
   * - 환불 보증이 사용된 상태
   */
  USED = 'USED',

  /**
   * 만료됨
   * - 환불 보증 유효기간이 지난 상태
   */
  EXPIRED = 'EXPIRED',
}
