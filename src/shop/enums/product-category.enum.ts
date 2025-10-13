/**
 * 상품 카테고리 코드 Enum
 * 바이브코딩 쇼핑몰의 모든 상품 카테고리를 정의합니다.
 */
export enum ProductCategory {
  // 기존 카테고리
  SUPPLEMENT = 'SUPPLEMENT',           // 영양제
  HEALTH_FOOD = 'HEALTH_FOOD',         // 건강식품
  VITAMIN = 'VITAMIN',                  // 비타민
  PROBIOTICS = 'PROBIOTICS',            // 프로바이오틱스
  LUNCHBOX = 'LUNCHBOX',                // 도시락

  // 신규 추가 카테고리
  OVERSEASUPPLEMENT = 'OVERSEASUPPLEMENT',  // 해외직구영양제
  HEALTH_CHECK = 'HEALTH_CHECK',            // 건강검진
  CHALLENGE = 'CHALLENGE',                  // 챌린지
}

/**
 * 카테고리 이름 매핑
 */
export const CategoryNameMap: Record<ProductCategory, string> = {
  [ProductCategory.SUPPLEMENT]: '영양제',
  [ProductCategory.HEALTH_FOOD]: '건강식품',
  [ProductCategory.VITAMIN]: '비타민',
  [ProductCategory.PROBIOTICS]: '프로바이오틱스',
  [ProductCategory.LUNCHBOX]: '도시락',
  [ProductCategory.OVERSEASUPPLEMENT]: '해외직구영양제',
  [ProductCategory.HEALTH_CHECK]: '건강검진',
  [ProductCategory.CHALLENGE]: '챌린지',
};

/**
 * 카테고리 정렬 순서
 * UI에서 카테고리를 표시할 때 사용
 */
export const CategorySortOrder: ProductCategory[] = [
  ProductCategory.CHALLENGE,           // 챌린지가 가장 우선
  ProductCategory.HEALTH_CHECK,        // 건강검진
  ProductCategory.SUPPLEMENT,          // 영양제
  ProductCategory.OVERSEASUPPLEMENT,   // 해외직구영양제
  ProductCategory.VITAMIN,             // 비타민
  ProductCategory.PROBIOTICS,          // 프로바이오틱스
  ProductCategory.HEALTH_FOOD,         // 건강식품
  ProductCategory.LUNCHBOX,            // 도시락
];