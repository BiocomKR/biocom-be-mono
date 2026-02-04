/**
 * 포인트 히스토리 관련 타입
 * point_histories.related_type 컬럼에 저장되는 값
 */
export enum PointRelatedType {
  /** 기록 완료 (식단, 운동, 영양제 등) */
  RECORD_COMPLETION = 'RECORD_COMPLETION',

  /** 주문 */
  ORDER = 'ORDER',

  /** 리뷰 작성 */
  REVIEW = 'REVIEW',

  /** 퀴즈 완료 */
  QUIZ = 'QUIZ',

  /** 밸런스 게임 */
  BALANCE_GAME = 'BALANCE_GAME',

  /** 주간 리포트 */
  WEEKLY_REPORT = 'WEEKLY_REPORT',

  /** 미션 완료 */
  MISSION_COMPLETION = 'MISSION_COMPLETION',

  /** 챌린지 미션 */
  CHALLENGE_MISSION = 'CHALLENGE_MISSION',

  /** 사후 설문 */
  AFTER_SURVEY = 'AFTER_SURVEY',

  /** 아임웹 포인트 이관 */
  IMWEB_TRANSFER = 'IMWEB_TRANSFER',

  /** 수동 지급/차감 */
  MANUAL = 'MANUAL',
}
