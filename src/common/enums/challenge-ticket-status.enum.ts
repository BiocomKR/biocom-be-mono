/**
 * 챌린지 티켓 상태 Enum
 *
 * @description 챌린지 이용권의 사용 상태를 나타냅니다.
 * 챌린지 진행 상태(완료/만료)는 UserChallenge.status에서 관리됩니다.
 */
export enum ChallengeTicketStatus {
  /**
   * 구매 완료 (아직 시작 안함)
   * - 챌린지 이용권을 구매했지만 시작일을 설정하지 않은 상태
   */
  PURCHASED = 'PURCHASED',

  /**
   * 활성화됨 (시작일 설정 완료, 챌린지 진행 중)
   * - 시작일을 설정하고 챌린지가 시작된 상태
   * - UserChallenge 레코드가 생성됨
   */
  ACTIVATED = 'ACTIVATED',
}

/**
 * 챌린지 진행 상태 Enum (UserChallenge)
 *
 * @description 실제 챌린지 진행 상황을 나타냅니다.
 */
export enum UserChallengeStatus {
  /**
   * 대기 중
   * - 챌린지가 생성되었지만 아직 시작되지 않은 상태
   */
  PENDING = 'PENDING',

  /**
   * 진행 중
   * - 챌린지가 활성화되어 진행 중인 상태
   */
  ACTIVE = 'ACTIVE',

  /**
   * 완료
   * - 챌린지를 정상적으로 완료한 상태
   */
  COMPLETED = 'COMPLETED',

  /**
   * 만료
   * - 챌린지 기간이 만료된 상태
   */
  EXPIRED = 'EXPIRED',
}
