import { YesNo } from '../../common/enums';

/**
 * 차트 ID 조회 응답 - 개별 검사 정보
 * SIB API 실제 응답 필드명 사용 (chartID, orderCode)
 */
export interface ChartExamInfo {
  /** 차트 ID */
  chartID: string;

  /** 검사 타입 코드 (D0004, D0060 등) */
  orderCode: string;

  /** 결과 여부 (Y/N) */
  resultYN: YesNo;

  /** 접수일 */
  receiptDate: string;
}

/**
 * 전화번호로 차트 ID 조회 API 응답
 */
export interface ChartIdByMobileResponse {
  /** 검사 목록 */
  data: ChartExamInfo[];
}

/**
 * 지연성 알러지 검사 결과 (IgG Levels)
 * 신규/구 API 동일한 응답 형태
 */
export interface FoodLevelItem {
  userName?: string; // SIB API 응답에는 있지만, DB에 저장하지 않음 (개인정보 정책)
  chartId: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
  level5: string;
}

export type IggLevelsResponse = FoodLevelItem[];

/**
 * 종합대사기능 검사 결과 (UGI Levels)
 */
export interface UgiLevelsResponse {
  chartId: string;
  data: any; // 실제 응답 구조에 맞게 확장 필요
}

/**
 * 영양제 추천 결과 (AI Solution)
 */
export interface UgiAiSolutionResponse {
  username: string;
  data: any; // 실제 응답 구조에 맞게 확장 필요
}

/**
 * 홈 화면용 검사 정보 (가공된 데이터)
 */
export interface HomeExamInfo {
  /** 차트 ID (없으면 null) */
  chartId: string | null;

  /** 결과 여부 (Y/N) */
  resultYN: YesNo;

  /** SIB API 에러 발생 여부 */
  sibError?: boolean;
}
