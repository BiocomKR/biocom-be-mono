/**
 * 사용자 쿠폰 상태 Enum
 *
 * @description 쿠폰 상태를 나타냅니다.
 * - ACTIVE: 사용 가능
 * - USED: 사용 완료
 * - EXPIRED: 만료
 */
export enum UserCouponStatus {
  /** 사용 가능 */
  ACTIVE = 'ACTIVE',
  /** 사용 완료 */
  USED = 'USED',
  /** 만료 */
  EXPIRED = 'EXPIRED',
}
