/**
 * 맞춤솔루션 식재료-항원 매핑 정의서
 *
 * 기준 문서: [맞춤솔루션] 식재료-항원 정의서 - v1.0 (260106).csv
 *
 * 검사 종류:
 * - 90종 (D0060, 알바이오팜): antigen90
 * - 89종 (D0004, 프로티아): antigen89
 */

import { ExamType } from '../../sib/enums/exam-type.enum';

/**
 * 검사 종류 타입
 */
export type ExamVersion = '90' | '89';

/**
 * 식재료-항원 매핑 정보
 */
export interface IngredientAntigenMapping {
  /** 90종 검사 항원명 (없으면 빈 배열 = 매핑 제외) */
  antigen90: string[];
  /** 89종 검사 항원명 (없으면 빈 배열 = 매핑 제외) */
  antigen89: string[];
}

/**
 * 식재료 → 항원 매핑 테이블
 *
 * 매핑 규칙:
 * 1. 1:N 매핑: 하나의 식재료가 여러 항원에 매핑 (예: 계란 → 계란흰자 + 계란노른자)
 * 2. N:1 매핑: 여러 식재료가 하나의 항원에 매핑 (예: 홍고추/꽈리고추/고춧가루 → 고추)
 * 3. 유사 명칭: 워딩이 다르지만 같은 항원 (예: 효모(와인) → 효모균)
 * 4. 매핑 제외: 빈 배열로 설정 (예: 올리브유 ≠ 올리브)
 *
 * 참고:
 * - 이 테이블에 없는 식재료는 기존 문자열 포함 매칭 사용
 * - 빈 배열([])은 의도적 매핑 제외 (항원과 연결하지 않음)
 */
export const INGREDIENT_TO_ANTIGEN_MAP: Record<string, IngredientAntigenMapping> = {
  // ═══════════════════════════════════════════════════════════════
  // 1:N 매핑 (하나의 식재료 → 여러 항원)
  // 식단 노출 규칙: 둘 다 1~3단계일 때만 상위 노출, 하나라도 4~5단계면 후순위
  // ═══════════════════════════════════════════════════════════════
  '계란': {
    antigen90: ['계란흰자', '계란노른자'],
    antigen89: ['계란흰자', '계란노른자']
  },

  // ═══════════════════════════════════════════════════════════════
  // N:1 매핑 (여러 식재료 → 하나의 항원)
  // 고추 관련: 90종만 '고추' 항원 있음, 89종은 없음
  // ═══════════════════════════════════════════════════════════════
  '홍고추': { antigen90: ['고추'], antigen89: [] },
  '꽈리고추': { antigen90: ['고추'], antigen89: [] },
  '고춧가루': { antigen90: ['고추'], antigen89: [] },
  '청양고추': { antigen90: ['고추'], antigen89: [] },
  '고추(페퍼론치노)': { antigen90: ['고추'], antigen89: [] },

  // ═══════════════════════════════════════════════════════════════
  // 유사 명칭 매핑 (식재료명 ≠ 항원명이지만 동일한 것)
  // ═══════════════════════════════════════════════════════════════

  // 효모 계열
  '효모(와인)': { antigen90: ['효모균'], antigen89: ['효모'] },
  '효모(주정)': { antigen90: ['효모균'], antigen89: ['효모'] },

  // 토마토 계열 (토마토, 방울토마토 → 토마토)
  '토마토': { antigen90: ['토마토'], antigen89: ['토마토'] },
  '방울토마토': { antigen90: ['토마토'], antigen89: ['토마토'] },

  // 호박 계열
  '쥬키니호박': { antigen90: ['호박'], antigen89: ['호박'] },

  // 밀 (90종: 밀, 89종: 밀가루)
  '밀': { antigen90: ['밀'], antigen89: ['밀가루'] },

  // 버섯 계열
  '표고버섯': { antigen90: ['버섯'], antigen89: ['버섯'] },
  '버섯': { antigen90: ['버섯'], antigen89: ['버섯'] },

  // 올리브 (올리브 식재료만 매핑, 올리브유는 제외)
  '올리브': { antigen90: ['올리브'], antigen89: ['올리브열매'] },

  // ═══════════════════════════════════════════════════════════════
  // 매핑 제외 (빈 배열 = 해당 항원과 연결하지 않음)
  // ═══════════════════════════════════════════════════════════════

  // 올리브유 ≠ 올리브/올리브열매
  '올리브유': { antigen90: [], antigen89: [] },

  // 사과식초 ≠ 사과
  '사과식초': { antigen90: [], antigen89: [] },

  // 현미/흑미 ≠ 쌀
  '현미': { antigen90: [], antigen89: [] },
  '흑미': { antigen90: [], antigen89: [] },

  // 우유 관련 주의사항:
  // - 우유 ≠ 우유단백질(카제인) (90종)
  // - 우유 ≠ 카제인, 유청단백질 (89종)
  // 즉, '우유' 식재료는 '우유' 항원에만 매핑
  '우유': { antigen90: ['우유'], antigen89: ['우유'] },

  // ═══════════════════════════════════════════════════════════════
  // 단독 항목 매핑 (특정 검사에만 존재)
  // ═══════════════════════════════════════════════════════════════

  // 90종에만 있는 항원
  '오리고기': { antigen90: ['오리고기'], antigen89: [] },
  '계피': { antigen90: ['계피'], antigen89: [] },
  '후추': { antigen90: ['후추'], antigen89: [] },
  '치즈': { antigen90: ['치즈'], antigen89: [] },

  // 89종에만 있는 항원
  '브로콜리': { antigen90: [], antigen89: ['브로콜리'] },

  // ═══════════════════════════════════════════════════════════════
  // 일반 매핑 (동일 명칭이지만 명시적으로 정의)
  // ═══════════════════════════════════════════════════════════════

  // 육류/가금류
  '돼지고기': { antigen90: ['돼지고기'], antigen89: ['돼지고기'] },
  '소고기': { antigen90: ['소고기'], antigen89: ['소고기'] },
  '닭고기': { antigen90: ['닭고기'], antigen89: ['닭고기'] },
  '양고기': { antigen90: ['양고기'], antigen89: ['양고기'] },

  // 어류/조개류
  '삼치': { antigen90: [], antigen89: [] }, // 삼치는 항원 목록에 없음
  '대구': { antigen90: ['대구'], antigen89: ['대구'] },
  '연어': { antigen90: ['연어'], antigen89: ['연어'] },
  '참치': { antigen90: ['참치'], antigen89: ['참치'] },
  '고등어': { antigen90: ['고등어'], antigen89: ['고등어'] },
  '멸치': { antigen90: ['멸치'], antigen89: ['멸치'] },
  '가다랑어': { antigen90: [], antigen89: [] }, // 가다랑어는 항원 목록에 없음
  '새우': { antigen90: ['새우'], antigen89: ['새우'] },
  '게': { antigen90: ['게'], antigen89: ['게'] },
  '굴': { antigen90: ['굴'], antigen89: ['굴'] },
  '홍합': { antigen90: ['홍합'], antigen89: ['홍합'] },
  '오징어': { antigen90: ['오징어'], antigen89: ['오징어'] },
  '문어': { antigen90: ['문어'], antigen89: ['문어'] },

  // 채소
  '감자': { antigen90: ['감자'], antigen89: ['감자'] },
  '고구마': { antigen90: ['고구마'], antigen89: ['고구마'] },
  '당근': { antigen90: ['당근'], antigen89: ['당근'] },
  '양파': { antigen90: ['양파'], antigen89: ['양파'] },
  '마늘': { antigen90: ['마늘'], antigen89: ['마늘'] },
  '시금치': { antigen90: ['시금치'], antigen89: ['시금치'] },
  '양배추': { antigen90: ['양배추'], antigen89: ['양배추'] },
  '오이': { antigen90: ['오이'], antigen89: ['오이'] },
  '가지': { antigen90: ['가지'], antigen89: ['가지'] },
  '상추': { antigen90: ['상추'], antigen89: ['상추'] },
  '배추': { antigen90: ['배추'], antigen89: [] }, // 89종에 배추 없음
  '무': { antigen90: ['무'], antigen89: [] }, // 89종에 무 없음

  // 과일
  '사과': { antigen90: ['사과'], antigen89: ['사과'] },
  '바나나': { antigen90: ['바나나'], antigen89: ['바나나'] },
  '오렌지': { antigen90: ['오렌지'], antigen89: ['오렌지'] },
  '포도': { antigen90: ['포도'], antigen89: ['포도'] },
  '딸기': { antigen90: ['딸기'], antigen89: ['딸기'] },
  '복숭아': { antigen90: ['복숭아'], antigen89: ['복숭아'] },
  '키위': { antigen90: ['키위'], antigen89: ['키위'] },
  '파인애플': { antigen90: ['파인애플'], antigen89: ['파인애플'] },
  '망고': { antigen90: ['망고'], antigen89: ['망고'] },
  '멜론': { antigen90: ['멜론'], antigen89: ['멜론'] },
  '수박': { antigen90: ['수박'], antigen89: ['수박'] },
  '배': { antigen90: ['배'], antigen89: ['배'] },
  '레몬': { antigen90: ['레몬'], antigen89: ['레몬'] },
  '라임': { antigen90: [], antigen89: [] }, // 라임은 항원 목록에 없음
  '코코넛': { antigen90: [], antigen89: ['코코넛'] }, // 89종에만 있음

  // 곡물
  '쌀': { antigen90: ['쌀'], antigen89: ['쌀'] },
  '보리': { antigen90: ['보리'], antigen89: ['보리'] },
  '옥수수': { antigen90: ['옥수수'], antigen89: ['옥수수'] },
  '귀리': { antigen90: ['오트밀'], antigen89: [] }, // 89종에 오트밀 없음
  '타피오카': { antigen90: [], antigen89: [] }, // 타피오카는 항원 목록에 없음

  // 콩류
  '대두콩': { antigen90: ['대두콩'], antigen89: ['대두콩'] },
  '땅콩': { antigen90: ['땅콩'], antigen89: ['땅콩'] },
  '완두콩': { antigen90: ['완두콩'], antigen89: ['완두콩'] },

  // 견과류
  '아몬드': { antigen90: ['아몬드'], antigen89: ['아몬드'] },
  '호두': { antigen90: ['호두'], antigen89: ['호두'] },
  '잣': { antigen90: ['잣'], antigen89: ['잣'] },
  '참깨': { antigen90: ['참깨'], antigen89: ['참깨'] },
  '해바라기씨': { antigen90: ['해바라기씨'], antigen89: ['해바라기씨'] },
  '피스타치오': { antigen90: ['피스타치오'], antigen89: ['피스타치오'] },

  // 기타
  '커리': { antigen90: ['카레'], antigen89: [] }, // 89종에 카레 없음
  '커피': { antigen90: ['커피'], antigen89: [] }, // 89종에 커피 없음
  '꿀': { antigen90: ['꿀'], antigen89: [] }, // 89종에 꿀 없음
  '바질': { antigen90: [], antigen89: [] }, // 바질은 항원 목록에 없음
  '파슬리': { antigen90: [], antigen89: [] }, // 파슬리는 항원 목록에 없음
  '들깨': { antigen90: [], antigen89: [] }, // 들깨는 항원 목록에 없음
  '들기름': { antigen90: [], antigen89: [] }, // 들기름은 항원 목록에 없음
  '깻잎': { antigen90: [], antigen89: [] }, // 깻잎은 항원 목록에 없음
  '김': { antigen90: [], antigen89: [] }, // 김은 항원 목록에 없음
  '쪽파': { antigen90: [], antigen89: [] }, // 쪽파는 항원 목록에 없음
  '대파': { antigen90: [], antigen89: [] }, // 대파는 항원 목록에 없음
  '부추': { antigen90: [], antigen89: [] }, // 부추는 항원 목록에 없음
  '피망': { antigen90: [], antigen89: [] }, // 피망은 항원 목록에 없음
  '홍피망': { antigen90: [], antigen89: [] }, // 홍피망은 항원 목록에 없음
  '그린빈': { antigen90: [], antigen89: [] }, // 그린빈은 항원 목록에 없음
  '컬리플라워': { antigen90: [], antigen89: [] }, // 컬리플라워는 항원 목록에 없음
  '청경채': { antigen90: [], antigen89: [] }, // 청경채는 항원 목록에 없음
  '우지': { antigen90: [], antigen89: [] }, // 우지는 항원 목록에 없음
  '와인': { antigen90: [], antigen89: [] }, // 와인은 항원 목록에 없음 (효모와 별개)
};

/**
 * 검사 타입(orderCode)을 검사 버전으로 변환
 */
export function getExamVersion(orderCode: string): ExamVersion {
  return orderCode === ExamType.IGG_OLD ? '89' : '90';
}

/**
 * 식재료에 해당하는 항원명 목록 조회
 *
 * @param ingredient 식재료명
 * @param examVersion 검사 버전 ('90' | '89')
 * @returns 항원명 배열 (매핑 없으면 null, 제외 대상이면 빈 배열)
 */
export function getAntigenNames(
  ingredient: string,
  examVersion: ExamVersion
): string[] | null {
  const mapping = INGREDIENT_TO_ANTIGEN_MAP[ingredient];

  if (!mapping) {
    // 매핑 테이블에 없으면 null 반환 (기존 매칭 로직 사용)
    return null;
  }

  // 검사 버전에 따라 해당 항원 배열 반환
  return examVersion === '90' ? mapping.antigen90 : mapping.antigen89;
}

/**
 * 식재료가 매핑 제외 대상인지 확인
 *
 * @param ingredient 식재료명
 * @param examVersion 검사 버전
 * @returns true면 매핑 제외 (검사 결과와 비교하지 않음)
 */
export function isExcludedIngredient(
  ingredient: string,
  examVersion: ExamVersion
): boolean {
  const antigens = getAntigenNames(ingredient, examVersion);
  // 명시적으로 빈 배열이면 제외 대상
  return antigens !== null && antigens.length === 0;
}
