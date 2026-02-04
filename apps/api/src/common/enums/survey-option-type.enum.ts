/**
 * 설문 옵션 타입 enum
 * 사전문진과 데일리문진의 점수 체계가 다르므로 구분
 */
export enum SurveyOptionType {
  /** 사전문진 (유형 분류) - 점수: 4, 8, 12, 16, 20 */
  PRE_SURVEY = 'PRE_SURVEY',
  /** 데일리문진 (뷰티종합점수) - 점수: 5, 10, 15, 20, 25 */
  DAILY = 'DAILY',
}

/** 사전문진 옵션 타입 */
export const PRE_SURVEY_OPTION_TYPE = SurveyOptionType.PRE_SURVEY;

/** 데일리문진 옵션 타입 */
export const DAILY_OPTION_TYPE = SurveyOptionType.DAILY;

/** 설문 옵션 타입별 점수 배열 */
export const SURVEY_OPTION_SCORES: Record<SurveyOptionType, number[]> = {
  [SurveyOptionType.PRE_SURVEY]: [4, 8, 12, 16, 20],
  [SurveyOptionType.DAILY]: [5, 10, 15, 20, 25],
};
