/**
 * SIB 검사 타입 코드
 */
export enum ExamType {
  /** (구)지연성알러지 */
  IGG_OLD = 'D0004',

  /** 지연성알러지 */
  IGG = 'D0060',

  /** 종합대사기능 */
  UGI = 'D0050',

  /** 스트레스/노화 호르몬, 종합호르몬 (공용) */
  HORMONE = 'D0030',

  /** 영양중금속 */
  NUTRITION_HEAVY_METAL = 'D0010',

  /** 장내세균 */
  GUT_BACTERIA = 'D0020',
}

/** 지연성 알러지 관련 검사 타입 (D0004, D0060) */
export const IGG_EXAM_TYPES = [ExamType.IGG_OLD, ExamType.IGG];
