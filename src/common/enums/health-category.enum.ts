/**
 * 건강 카테고리 enum
 * 설문 질문 카테고리 및 동물 캐릭터 유형
 */
export enum HealthCategory {
  /** 피부건강/염증 */
  SKIN_HEALTH = 'SKIN_HEALTH',
  /** 대사밸런스 */
  METABOLISM = 'METABOLISM',
  /** 면역과민반응 */
  IMMUNE_BALANCE = 'IMMUNE_BALANCE',
  /** 장건강 */
  GUT_HEALTH = 'GUT_HEALTH',
  /** 수면 */
  SLEEP = 'SLEEP',
}

/**
 * 동물 캐릭터 우선순위 (최저점수 카테고리 선정 시 사용)
 * 장 → 면역 → 염증 → 대사
 */
export const HEALTH_CATEGORY_PRIORITY = [
  HealthCategory.GUT_HEALTH,
  HealthCategory.IMMUNE_BALANCE,
  HealthCategory.SKIN_HEALTH,
  HealthCategory.METABOLISM,
];
