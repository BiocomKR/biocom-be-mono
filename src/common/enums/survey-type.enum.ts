/**
 * 설문 타입 Enum
 *
 * @description 설문조사의 타입을 나타냅니다.
 */
export enum SurveyType {
  /**
   * 사전 설문
   * - 챌린지 시작 전 진행하는 설문
   */
  BEFORE = 'before',

  /**
   * 사후 설문
   * - 챌린지 완료 후 진행하는 설문
   */
  AFTER = 'after',
}
