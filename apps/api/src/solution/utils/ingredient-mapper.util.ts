/**
 * 식재료-항원 매핑 유틸리티
 *
 * SIB 검사 결과(level1~5)와 상품 식재료를 매핑하여
 * 안전/주의 식재료를 분류합니다.
 */

import {
  ExamVersion,
  getAntigenNames,
  isExcludedIngredient,
  getExamVersion,
} from '../constants/ingredient-antigen-mapping';
import { FoodLevelItem } from '../../sib/interfaces/sib-response.interface';

/**
 * 레벨별 분류 결과
 */
export interface IngredientClassification {
  /** 1-3단계 (안전) 식재료 */
  safe: string[];
  /** 4-5단계 (주의) 식재료 */
  caution: string[];
}

/**
 * 검사 결과 파싱 데이터
 */
interface ParsedFoodLevels {
  /** 1-3단계 항원 목록 (Set) */
  safeFoods: Set<string>;
  /** 4-5단계 항원 목록 (Set) */
  cautionFoods: Set<string>;
}

/**
 * SIB 검사 결과에서 레벨별 항원 파싱
 *
 * @param foodLevelResult SIB 검사 결과
 * @returns 레벨별 항원 Set
 */
function parseFoodLevels(foodLevelResult: FoodLevelItem): ParsedFoodLevels {
  const safeFoods = new Set<string>();
  const cautionFoods = new Set<string>();

  // 1-3단계: 안전
  [foodLevelResult.level1, foodLevelResult.level2, foodLevelResult.level3]
    .filter((level) => level && level !== '해당없음')
    .forEach((level) => {
      level.split(',').forEach((food) => {
        const trimmed = food.trim();
        if (trimmed) safeFoods.add(trimmed);
      });
    });

  // 4-5단계: 주의
  [foodLevelResult.level4, foodLevelResult.level5]
    .filter((level) => level && level !== '해당없음')
    .forEach((level) => {
      level.split(',').forEach((food) => {
        const trimmed = food.trim();
        if (trimmed) cautionFoods.add(trimmed);
      });
    });

  return { safeFoods, cautionFoods };
}

/**
 * 식재료가 특정 항원 목록에 매칭되는지 확인
 *
 * 매칭 우선순위:
 * 1. 매핑 테이블에 정의된 항원명으로 정확히 매칭
 * 2. 매핑 테이블에 없으면 기존 방식 (문자열 포함 관계)
 *
 * @param ingredient 식재료명
 * @param antigens 항원 목록
 * @param examVersion 검사 버전
 * @returns 매칭 여부
 */
function matchIngredientToAntigens(
  ingredient: string,
  antigens: Set<string>,
  examVersion: ExamVersion
): boolean {
  // 1. 매핑 테이블 조회
  const mappedAntigens = getAntigenNames(ingredient, examVersion);

  if (mappedAntigens !== null) {
    // 매핑이 있으면 해당 항원들로만 매칭
    // 빈 배열이면 false (매핑 제외 대상)
    if (mappedAntigens.length === 0) {
      return false;
    }

    // 1:N 매핑: 모든 매핑된 항원 중 하나라도 있으면 매칭
    // (계란의 경우: 흰자와 노른자 중 하나라도 있으면 매칭)
    return mappedAntigens.some((antigen) => antigens.has(antigen));
  }

  // 2. 매핑 테이블에 없으면 기존 방식 (포함 관계 체크)
  const normalizedIngredient = ingredient.trim();
  return [...antigens].some(
    (antigen) =>
      antigen === normalizedIngredient ||
      antigen.includes(normalizedIngredient) ||
      normalizedIngredient.includes(antigen)
  );
}

/**
 * 1:N 매핑 식재료의 주의 레벨 판정
 *
 * 계란처럼 여러 항원에 매핑되는 식재료의 경우:
 * - 둘 다 1~3단계: 안전
 * - 하나라도 4~5단계: 주의
 *
 * @param ingredient 식재료명
 * @param parsedLevels 파싱된 레벨 데이터
 * @param examVersion 검사 버전
 * @returns 'safe' | 'caution' | null (매핑 없음)
 */
function classifyOneToManyIngredient(
  ingredient: string,
  parsedLevels: ParsedFoodLevels,
  examVersion: ExamVersion
): 'safe' | 'caution' | null {
  const mappedAntigens = getAntigenNames(ingredient, examVersion);

  if (mappedAntigens === null || mappedAntigens.length <= 1) {
    return null; // 1:N 매핑이 아님
  }

  // 매핑된 항원 중 하나라도 4-5단계에 있으면 주의
  const hasCaution = mappedAntigens.some((antigen) =>
    parsedLevels.cautionFoods.has(antigen)
  );

  if (hasCaution) {
    return 'caution';
  }

  // 모든 매핑된 항원이 1-3단계에 있으면 안전
  const allSafe = mappedAntigens.every((antigen) =>
    parsedLevels.safeFoods.has(antigen)
  );

  if (allSafe) {
    return 'safe';
  }

  // 검사 결과에 없는 항원이 있으면 null (미분류)
  return null;
}

/**
 * 식재료에서 화면 표시용 항원명 가져오기
 *
 * - 매핑 테이블에 있으면: 항원명 반환 (1:N인 경우 첫 번째 항원명)
 * - 매핑 테이블에 없으면: 원본 식재료명 반환
 *
 * @param ingredient 식재료명
 * @param examVersion 검사 버전
 * @returns 화면 표시용 이름
 */
function getDisplayName(ingredient: string, examVersion: ExamVersion): string {
  const mappedAntigens = getAntigenNames(ingredient, examVersion);

  if (mappedAntigens !== null && mappedAntigens.length > 0) {
    // 매핑된 항원명 반환 (1:N인 경우 첫 번째)
    return mappedAntigens[0];
  }

  // 매핑 테이블에 없으면 원본 반환
  return ingredient;
}

/**
 * 식재료 목록을 SIB 레벨별로 분류
 *
 * 화면에는 항원명으로 표시됨:
 * - 효모(와인) → "효모균"(90종) 또는 "효모"(89종)
 * - 홍고추/꽈리고추/고춧가루 → "고추"(90종)
 * - 올리브유/사과식초/현미/흑미 → 매핑 제외 (화면에 안 나옴)
 *
 * @param ingredients 상품 식재료 목록
 * @param foodLevelResult SIB 검사 결과
 * @param orderCode 검사 타입 (D0004: 89종, D0060: 90종)
 * @returns 레벨별 분류된 항원명
 */
export function classifyIngredients(
  ingredients: string[],
  foodLevelResult: FoodLevelItem,
  orderCode: string
): IngredientClassification {
  const examVersion = getExamVersion(orderCode);
  const parsedLevels = parseFoodLevels(foodLevelResult);

  const safeSet = new Set<string>();
  const cautionSet = new Set<string>();

  for (const ingredient of ingredients) {
    const normalizedIngredient = ingredient.trim();

    // 1. 매핑 제외 대상 체크 (올리브유, 사과식초, 현미, 흑미 등)
    if (isExcludedIngredient(normalizedIngredient, examVersion)) {
      // 제외 대상은 분류하지 않음 (safe/caution 어디에도 포함 안 됨)
      continue;
    }

    // 2. 화면 표시용 항원명 가져오기
    const displayName = getDisplayName(normalizedIngredient, examVersion);

    // 3. 1:N 매핑 식재료 처리 (계란 등)
    const oneToManyResult = classifyOneToManyIngredient(
      normalizedIngredient,
      parsedLevels,
      examVersion
    );

    if (oneToManyResult !== null) {
      if (oneToManyResult === 'caution') {
        cautionSet.add(displayName);
      } else {
        safeSet.add(displayName);
      }
      continue;
    }

    // 4. 일반 매칭: 4-5단계 우선 체크
    const isCaution = matchIngredientToAntigens(
      normalizedIngredient,
      parsedLevels.cautionFoods,
      examVersion
    );

    if (isCaution) {
      cautionSet.add(displayName);
      continue;
    }

    // 5. 1-3단계 체크
    const isSafe = matchIngredientToAntigens(
      normalizedIngredient,
      parsedLevels.safeFoods,
      examVersion
    );

    if (isSafe) {
      safeSet.add(displayName);
    }
    // 어디에도 매칭되지 않으면 분류하지 않음
  }

  // Set → Array 변환
  const safe = Array.from(safeSet);
  const caution = Array.from(cautionSet);

  // caution 배열 정렬: 문자열 길이 오름차순, 길이가 같으면 가나다순
  caution.sort((a, b) => {
    if (a.length !== b.length) {
      return a.length - b.length;
    }
    return a.localeCompare(b, 'ko');
  });

  return { safe, caution };
}

/**
 * 글루텐 과민 레벨 확인
 *
 * 리셋데이 추천 조건 판정용
 * 글루텐 관련 항원이 4-5단계에 있는지 확인
 *
 * @param foodLevelResult SIB 검사 결과
 * @param orderCode 검사 타입
 * @returns 글루텐 레벨 (4, 5, 또는 0)
 */
export function getGlutenLevel(
  foodLevelResult: FoodLevelItem,
  orderCode: string
): number {
  const examVersion = getExamVersion(orderCode);

  // 검사 버전별 글루텐 관련 항원명
  const glutenKeywords =
    examVersion === '90'
      ? ['글루텐', '밀'] // 90종
      : ['글루텐', '밀가루']; // 89종

  const level5Foods =
    foodLevelResult.level5?.split(',').map((f) => f.trim()) || [];
  const level4Foods =
    foodLevelResult.level4?.split(',').map((f) => f.trim()) || [];

  // level5 먼저 체크
  if (
    level5Foods.some((food) =>
      glutenKeywords.some((keyword) => food.includes(keyword))
    )
  ) {
    return 5;
  }

  // level4 체크
  if (
    level4Foods.some((food) =>
      glutenKeywords.some((keyword) => food.includes(keyword))
    )
  ) {
    return 4;
  }

  return 0;
}
