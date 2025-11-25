/**
 * 컨텐츠 접근 권한 레벨
 * 사용자 유형에 따른 컨텐츠 접근 제어
 */
export enum ContentAccessLevel {
  /**
   * 모든 사용자 접근 가능
   * - 일반 사용자
   * - 구독자
   * - 챌린지 이용자
   */
  ALL = 'ALL',

  /**
   * 챌린지 이용자만 접근 가능
   * - 챌린지 수행권을 활성화한 사용자만
   */
  CHALLENGE_ONLY = 'CHALLENGE_ONLY',

  /**
   * 구독자만 접근 가능
   * - 월/연 구독권 보유 사용자만
   */
  SUBSCRIPTION_ONLY = 'SUBSCRIPTION_ONLY',

  /**
   * 챌린지 이용자 또는 구독자 접근 가능
   * - 챌린지 이용자
   * - 구독자
   * (일반 사용자는 접근 불가)
   */
  CHALLENGE_OR_SUB = 'CHALLENGE_OR_SUB',
}
