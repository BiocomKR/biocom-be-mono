/**
 * 퀴즈 난이도 enum
 */
export enum QuizDifficulty {
  EASY = 'EASY',       // 쉬움
  MEDIUM = 'MEDIUM',   // 보통
  HARD = 'HARD'        // 어려움
}

/**
 * 퀴즈 옵션 타입
 * JSON 필드의 타입 정의
 */
export interface QuizOption {
  id?: number;
  text: string;
}

/**
 * 퀴즈 옵션 타입 가드
 */
export function isQuizOption(value: any): value is QuizOption {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.text === 'string'
  );
}

/**
 * 퀴즈 옵션 배열 타입 가드
 */
export function isQuizOptionArray(value: any): value is QuizOption[] {
  return Array.isArray(value) && value.every(isQuizOption);
}

/**
 * 문자열 배열 타입 가드
 */
export function isStringArray(value: any): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/**
 * 난이도별 기본 포인트 맵
 */
export const DIFFICULTY_POINTS_MAP: Record<QuizDifficulty, number> = {
  [QuizDifficulty.EASY]: 30,
  [QuizDifficulty.MEDIUM]: 50,
  [QuizDifficulty.HARD]: 100
};