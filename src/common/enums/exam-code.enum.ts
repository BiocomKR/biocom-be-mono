/**
 * 검사 코드 enum
 * 바이오컴 검사 항목별 코드
 */
export enum ExamCode {
  /** (구)지연성알러지 */
  LEGACY_DELAYED_ALLERGY = 'D0004',

  /** 지연성알러지 */
  DELAYED_ALLERGY = 'D0060',

  /** 종합대사기능 */
  COMPREHENSIVE_METABOLISM = 'D0050',

  /** 종합호르몬 (종합대사기능, 스트레스/노화 호르몬 포함) */
  TOTAL_HORMONE = 'D0030',

  /** 영양중금속 */
  NUTRITION_HEAVY_METAL = 'D0010',

  /** 장내세균 */
  GUT_MICROBIOME = 'D0020',
}

/**
 * 검사 코드 설명 매핑
 */
export const ExamCodeDescription: Record<string, string> = {
  [ExamCode.LEGACY_DELAYED_ALLERGY]: '(구)지연성알러지',
  [ExamCode.DELAYED_ALLERGY]: '지연성알러지',
  [ExamCode.COMPREHENSIVE_METABOLISM]: '종합대사기능',
  [ExamCode.TOTAL_HORMONE]: '종합호르몬',
  [ExamCode.NUTRITION_HEAVY_METAL]: '영양중금속',
  [ExamCode.GUT_MICROBIOME]: '장내세균',
};
