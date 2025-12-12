/**
 * KST 날짜/시간 유틸리티
 *
 * Prisma가 UTC로 저장하는 문제를 해결하기 위한 유틸 함수들
 * - PostgreSQL DB timezone은 Asia/Seoul
 * - Prisma는 항상 UTC로 변환하여 저장
 * - 해결: KST 시간 그대로 UTC Date 객체로 생성하면 DB에 KST 값이 저장됨
 */

/**
 * KST Date를 생성 (Prisma 저장용)
 * Prisma가 UTC로 저장하므로, KST 시간 그대로 UTC Date 객체로 생성
 *
 * @param year - 연도
 * @param month - 월 (1-12)
 * @param day - 일
 * @param hour - 시 (기본값: 0)
 * @param minute - 분 (기본값: 0)
 * @param second - 초 (기본값: 0)
 * @returns UTC Date 객체 (Prisma가 저장하면 KST 값으로 저장됨)
 *
 * @example
 * const date = createKSTDate(2025, 10, 20);
 * // Prisma가 UTC로 저장하면 DB에 2025-10-20으로 저장됨
 */
export const createKSTDate = (
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): Date => {
  // KST 시간 그대로 UTC Date 객체로 생성
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return date;
};

/**
 * YYYY-MM-DD 문자열을 KST Date로 변환 (Prisma 저장용)
 *
 * @param dateString - YYYY-MM-DD 형식의 문자열
 * @param hour - 시 (기본값: 0)
 * @param minute - 분 (기본값: 0)
 * @param second - 초 (기본값: 0)
 * @returns UTC Date 객체 (Prisma가 저장하면 KST 값으로 저장됨)
 *
 * @example
 * stringToKSTDate('2025-10-20') // KST 2025-10-20 00:00:00으로 저장됨
 * stringToKSTDate('2025-10-20', 14, 30) // KST 2025-10-20 14:30:00으로 저장됨
 */
export const stringToKSTDate = (
  dateString: string,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return createKSTDate(year, month, day, hour, minute, second);
};

/**
 * 현재 시간을 KST로 반환 (Prisma 저장용)
 * new Date() 대신 사용하여 DB에 KST 시간이 저장되도록 함
 *
 * @returns 현재 시간의 UTC Date 객체 (Prisma가 저장하면 KST 값으로 저장됨)
 *
 * @example
 * // ❌ 기존 방식 (UTC로 저장됨)
 * createdAt: new Date()
 *
 * // ✅ 새로운 방식 (KST로 저장됨)
 * createdAt: getNowKST()
 */
export const getNowKST = (): Date => {
  const now = new Date();
  // KST = UTC + 9시간
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstTime = new Date(now.getTime() + kstOffset);

  return createKSTDate(
    kstTime.getUTCFullYear(),
    kstTime.getUTCMonth() + 1,
    kstTime.getUTCDate(),
    kstTime.getUTCHours(),
    kstTime.getUTCMinutes(),
    kstTime.getUTCSeconds()
  );
};

/**
 * 챌린지 시작일(activatedAt) 기준으로 현재 몇일차인지 계산
 * DB에서 가져온 날짜는 이미 KST로 저장되어 있으므로, KST 기준으로 일자 계산
 *
 * @param activatedAt - 챌린지 시작일 (KST 기준으로 DB에 저장된 값)
 * @returns 현재 챌린지 일차 (1일차부터 시작)
 *
 * @example
 * // 오늘이 2025-10-22이고, activatedAt이 2025-10-20인 경우
 * calculateChallengeDay(new Date('2025-10-20')) // returns 3
 *
 * // 오늘이 2025-10-22이고, activatedAt이 2025-10-22인 경우
 * calculateChallengeDay(new Date('2025-10-22')) // returns 1
 */
export const calculateChallengeDay = (activatedAt: Date): number => {
  const now = getNowKST();

  // DB에서 읽은 날짜의 년월일만 추출 (시간 무시)
  // Prisma가 UTC로 읽어오지만, 우리는 KST로 저장했으므로 날짜 부분만 사용
  const activatedDateStr = activatedAt.toISOString().split('T')[0]; // 'YYYY-MM-DD'
  const [year, month, day] = activatedDateStr.split('-').map(Number);

  // 날짜만 비교 (시간은 무시)
  // ⚠️ UTC 메서드 사용해야 타임존 오프셋 문제 없음
  const nowDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startDate = new Date(Date.UTC(year, month - 1, day)); // month는 0부터 시작

  // 경과 일수 계산 (밀리초 -> 일)
  const diffTime = nowDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // 1일차부터 시작 (경과일 + 1)
  return diffDays + 1;
};

/**
 * 프론트엔드에서 받은 datetime 문자열을 KST 기준 Date 객체로 파싱
 *
 * ⚠️ 중요: 프론트엔드가 보내는 "YYYY-MM-DD HH:MM:SS" 형식은 항상 KST 기준입니다.
 * new Date()로 파싱하면 UTC로 취급되므로, 이 함수를 사용하세요.
 *
 * @param datetimeString KST 기준 datetime 문자열 (예: "2025-11-07 20:00:00")
 * @returns Date 객체 (DB 저장 시 KST 시간값 유지)
 *
 * @example
 * // 프론트: "2025-11-07 20:00:00" (KST) 전송
 * const dt = parseKSTDateTime("2025-11-07 20:00:00");
 * // dt는 2025-11-07 20:00:00 KST를 나타내는 Date 객체
 */
export function parseKSTDateTime(datetimeString: string): Date {
  // "YYYY-MM-DD HH:MM:SS" 형식을 파싱
  const match = datetimeString.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);

  if (!match) {
    throw new Error(`Invalid datetime format: ${datetimeString}. Expected "YYYY-MM-DD HH:MM:SS"`);
  }

  const [, year, month, day, hour, minute, second] = match.map(Number);

  // KST 시간 그대로 UTC Date 객체로 생성 (기존 createKSTDate 패턴 활용)
  return createKSTDate(year, month, day, hour, minute, second);
}

/**
 * Date 객체에서 KST 기준 날짜만 추출 (YYYY-MM-DD)
 *
 * @param date Date 객체
 * @returns KST 기준 날짜 문자열 (예: "2025-11-07")
 *
 * @example
 * const dt = parseKSTDateTime("2025-11-07 20:00:00");
 * const dateStr = extractKSTDate(dt); // "2025-11-07"
 */
export function extractKSTDate(date: Date): string {
  // Date 객체에서 UTC 기준 날짜 추출 (우리는 KST 시간을 UTC로 저장했으므로)
  return date.toISOString().split('T')[0];
}

/**
 * 오늘 날짜를 KST 기준으로 YYYY-MM-DD 형식으로 반환
 *
 * @returns 오늘 날짜 문자열 (예: "2025-11-07")
 *
 * @example
 * const today = getKoreanToday(); // "2025-11-07"
 */
export function getKoreanToday(): string {
  const now = getNowKST();
  return extractKSTDate(now);
}

/**
 * Date 객체를 KST 기준 YYYY-MM-DD 형식으로 변환
 *
 * @param date Date 객체
 * @returns YYYY-MM-DD 형식의 문자열
 *
 * @example
 * formatKoreanDate(new Date()) // "2025-12-12"
 */
export function formatKoreanDate(date: Date): string {
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstTime = new Date(date.getTime() + kstOffset);
  return kstTime.toISOString().split('T')[0];
}

/**
 * 날짜 문자열을 요일로 변환
 *
 * @param dateString YYYY-MM-DD 형식의 날짜 문자열
 * @returns 요일 (일, 월, 화, 수, 목, 금, 토)
 *
 * @example
 * getDayOfWeek('2025-12-12') // "목"
 */
export function getDayOfWeek(dateString: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const date = new Date(dateString);
  return days[date.getDay()];
}
