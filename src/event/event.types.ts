import { Event, EventSurvey, Survey, EventMission, Mission, EventQuiz, Quiz, SurveyQuestion } from '@prisma/client';

/**
 * 이벤트-설문 옵션 타입
 * event_surveys.survey_options JSON 필드의 타입 정의
 */
export interface EventSurveyOptions {
  type: 'before' | 'after';  // 설문 타입
  fromDay?: number;          // 설문 가능 시작일 (기본: 1)
  toDay?: number;            // 설문 가능 종료일 (옵션)
}

/**
 * JSON 타입 가드 함수
 */
export function isEventSurveyOptions(value: any): value is EventSurveyOptions {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value.type === 'before' || value.type === 'after') &&
    (value.fromDay === undefined || typeof value.fromDay === 'number')
  );
}

/**
 * 이벤트 타입 enum
 */
export enum EventType {
  EVENT = 'EVENT',
  SURVEY = 'SURVEY', 
  PROMOTION = 'PROMOTION',
  CHALLENGE = 'CHALLENGE'
}

/**
 * Survey with questions
 */
export type SurveyWithQuestions = Survey & {
  surveyQuestions?: SurveyQuestion[];
};

/**
 * 타입이 명확한 EventSurvey
 */
export type EventSurveyWithTypedOptions = Omit<EventSurvey, 'surveyOptions'> & {
  surveyOptions: EventSurveyOptions | null;
  survey?: SurveyWithQuestions;
};

/**
 * 이벤트 관련 타입 정의
 */
export type EventWithRelations = Event & {
  eventSurveys?: EventSurveyWithTypedOptions[];
  eventMissions?: (EventMission & {
    mission?: Mission;
  })[];
  eventQuizzes?: (EventQuiz & {
    quiz?: Quiz;
  })[];
};

/**
 * 이벤트 옵션 타입 (Legacy - 관계 테이블로 대체됨)
 * @deprecated 이벤트 옵션은 이제 관계 테이블(event_surveys, event_missions, event_quizzes)로 관리됩니다.
 */
export interface EventOptions {
  // 챌린지 타입인 경우 설문 설정
  survey?: {
    before?: {
      enabled: boolean;
      fromDay: number;  // 1 = 이벤트 1일차부터
    };
    after?: {
      enabled: boolean;
      fromDay: number;  // 21 = 이벤트 21일차부터
    };
  };
  // 향후 다른 타입별 옵션 추가 가능
  [key: string]: any;
}

/**
 * eventOptions JSON 파싱 헬퍼 (Legacy)
 * @deprecated 이벤트 옵션은 이제 관계 테이블로 관리됩니다.
 */
export function parseEventOptions(options: any): EventOptions | null {
  if (!options) return null;
  
  // Prisma에서 반환된 JsonValue를 EventOptions로 변환
  return options as EventOptions;
}

/**
 * 하위 호환성을 위한 별칭
 * @deprecated parseEventOptions를 사용하세요
 */
export function parseSurveyConfig(config: any): EventOptions | null {
  return parseEventOptions(config);
}

/**
 * 설문 사용 여부 체크 헬퍼 (Legacy)
 * @deprecated event_surveys 관계 테이블을 직접 확인하세요.
 */
export function hasSurveyBefore(options: EventOptions | null): boolean {
  return options?.survey?.before?.enabled === true;
}

/**
 * @deprecated event_surveys 관계 테이블을 직접 확인하세요.
 */
export function hasSurveyAfter(options: EventOptions | null): boolean {
  return options?.survey?.after?.enabled === true;
}

/**
 * 설문 시작 일차 가져오기 헬퍼 (Legacy)
 * @deprecated event_surveys.survey_options JSON 필드를 직접 확인하세요.
 */
export function getSurveyBeforeFromDay(options: EventOptions | null): number {
  return options?.survey?.before?.fromDay || 1;
}

/**
 * @deprecated event_surveys.survey_options JSON 필드를 직접 확인하세요.
 */
export function getSurveyAfterFromDay(options: EventOptions | null, totalDays: number): number {
  return options?.survey?.after?.fromDay || totalDays;
}