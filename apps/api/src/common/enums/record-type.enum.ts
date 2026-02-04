/**
 * 사용자 기록 타입 Enum
 *
 * 사용자가 앱에서 기록할 수 있는 다양한 활동 타입
 *
 * @enum {string}
 */
export enum RecordType {
  /** 뷰티 기록 (얼굴 촬영 등) */
  BEAUTY = 'BEAUTY',

  /** 식단 기록 */
  DIET = 'DIET',

  /** 영양제 섭취 기록 */
  SUPPLEMENT = 'SUPPLEMENT',

  /** 간헐적 단식 기록 */
  FASTING = 'FASTING',

  /** 수면 기록 */
  SLEEP = 'SLEEP',

  /** 활동 기록 (운동 등) */
  ACTIVITY = 'ACTIVITY',

  /** 퀴즈 기록 */
  QUIZ = 'QUIZ',

  /** 일일 미션 기록 */
  DAILY_MISSION = 'DAILY_MISSION',

  /** 다짐 기록 */
  DECLARATION = 'DECLARATION',
}

/**
 * RecordType의 한글 이름 매핑
 */
export const RecordTypeLabel: Record<RecordType, string> = {
  [RecordType.BEAUTY]: '뷰티',
  [RecordType.DIET]: '식단',
  [RecordType.SUPPLEMENT]: '영양제',
  [RecordType.FASTING]: '간헐적 단식',
  [RecordType.SLEEP]: '수면',
  [RecordType.ACTIVITY]: '활동',
  [RecordType.QUIZ]: '퀴즈',
  [RecordType.DAILY_MISSION]: '일일 미션',
  [RecordType.DECLARATION]: '다짐',
};

/**
 * RecordType 배열 (순회용)
 */
export const RecordTypeValues = Object.values(RecordType);

/**
 * 주요 건강 기록 타입 (통계에서 사용)
 */
export const MainRecordTypes = [
  RecordType.BEAUTY,
  RecordType.DIET,
  RecordType.SUPPLEMENT,
  RecordType.FASTING,
  RecordType.SLEEP,
  RecordType.ACTIVITY,
] as const;
