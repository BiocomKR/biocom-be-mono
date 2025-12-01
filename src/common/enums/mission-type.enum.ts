/**
 * 미션 타입 Enum
 *
 * @description 미션의 타입을 나타냅니다.
 */
export enum MissionType {
  /**
   * 일반 미션
   * - 기본 챌린지 미션
   */
  MISSION = 'MISSION',

  /**
   * 보너스 미션
   * - 추가 포인트를 획득할 수 있는 미션
   */
  BONUS = 'BONUS',

  /**
   * 기록형 미션
   * - 사용자가 값을 기록하는 미션 (체중, 식단 등)
   */
  RECORD = 'RECORD',
}
