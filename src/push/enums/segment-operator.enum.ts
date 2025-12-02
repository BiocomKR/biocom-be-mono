/**
 * 세그먼트 조건 연산자 정의
 *
 * YAGNI 원칙: 연산자는 10개 내외로 고정됨. DB 테이블 대신 코드 상수로 관리.
 */

export interface OperatorDefinition {
  /** 표시 라벨 */
  label: string;
  /** 적용 가능한 값 타입 */
  types: ('number' | 'string' | 'date' | 'boolean' | 'enum')[];
  /** SQL 템플릿 ({expr}은 field_expression으로 치환) */
  sql: string;
  /** 필요한 값 개수 (0: 값 불필요, 1: 단일값, 2: 범위값, -1: 배열) */
  valueCount: number;
}

/**
 * 연산자 레지스트리
 * 모든 연산자 로직은 이 한 곳에서만 정의
 */
export const OPERATORS: Record<string, OperatorDefinition> = {
  // 기본 비교
  eq: {
    label: '같음',
    types: ['number', 'string', 'enum'],
    sql: '{expr} = ?',
    valueCount: 1,
  },
  neq: {
    label: '다름',
    types: ['number', 'string', 'enum'],
    sql: '{expr} != ?',
    valueCount: 1,
  },
  gt: {
    label: '초과',
    types: ['number', 'date'],
    sql: '{expr} > ?',
    valueCount: 1,
  },
  gte: {
    label: '이상',
    types: ['number', 'date'],
    sql: '{expr} >= ?',
    valueCount: 1,
  },
  lt: {
    label: '미만',
    types: ['number', 'date'],
    sql: '{expr} < ?',
    valueCount: 1,
  },
  lte: {
    label: '이하',
    types: ['number', 'date'],
    sql: '{expr} <= ?',
    valueCount: 1,
  },

  // 범위/목록
  between: {
    label: '사이',
    types: ['number', 'date'],
    sql: '{expr} BETWEEN ? AND ?',
    valueCount: 2,
  },
  in: {
    label: '포함',
    types: ['number', 'enum'],
    sql: '{expr} IN (?)',
    valueCount: -1,
  },

  // 날짜 특화 (PostgreSQL)
  days_ago: {
    label: '정확히 N일 전',
    types: ['date'],
    sql: "{expr} >= NOW() - (?::int + 1) * INTERVAL '1 day' AND {expr} < NOW() - ?::int * INTERVAL '1 day'",
    valueCount: 1,
  },
  days_ago_gte: {
    label: 'N일 이상 경과',
    types: ['date'],
    sql: "{expr} <= NOW() - ?::int * INTERVAL '1 day'",
    valueCount: 1,
  },
  days_ago_lte: {
    label: 'N일 이내',
    types: ['date'],
    sql: "{expr} >= NOW() - ?::int * INTERVAL '1 day'",
    valueCount: 1,
  },

  // 불리언
  is_true: {
    label: '참',
    types: ['boolean'],
    sql: '{expr} = true',
    valueCount: 0,
  },
  is_false: {
    label: '거짓',
    types: ['boolean'],
    sql: '{expr} = false',
    valueCount: 0,
  },
  is_null: {
    label: '없음',
    types: ['number', 'string', 'date'],
    sql: '{expr} IS NULL',
    valueCount: 0,
  },
  is_not_null: {
    label: '있음',
    types: ['number', 'string', 'date'],
    sql: '{expr} IS NOT NULL',
    valueCount: 0,
  },
} as const;

export type OperatorCode = keyof typeof OPERATORS;

/**
 * 연산자 코드 유효성 검사
 */
export function isValidOperator(code: string): code is OperatorCode {
  return code in OPERATORS;
}

/**
 * 연산자 정의 조회
 */
export function getOperator(code: string): OperatorDefinition | undefined {
  return OPERATORS[code];
}
