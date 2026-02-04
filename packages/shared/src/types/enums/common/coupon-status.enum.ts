/**
 * 쿠폰 상태 Enum
 *
 * @description 사용자 쿠폰의 현재 상태를 나타냅니다.
 */
export enum CouponStatus {
  /**
   * 활성 (사용 가능)
   * - 쿠폰을 사용할 수 있는 상태
   */
  ACTIVE = 'ACTIVE',

  /**
   * 사용됨
   * - 쿠폰이 사용된 상태
   */
  USED = 'USED',

  /**
   * 만료됨
   * - 쿠폰 유효기간이 지난 상태
   */
  EXPIRED = 'EXPIRED',
}
