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
  return createKSTDate(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds()
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
  // DB에서 가져온 activatedAt는 이미 KST로 저장되어 있음
  // 따라서 그대로 사용 (UTC 변환 없이)
  const now = getNowKST();

  // 날짜만 비교 (시간은 무시)
  // activatedAt는 DB에서 KST로 저장된 값이므로 그대로 사용
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(activatedAt.getFullYear(), activatedAt.getMonth(), activatedAt.getDate());

  // 경과 일수 계산 (밀리초 -> 일)
  const diffTime = nowDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // 1일차부터 시작 (경과일 + 1)
  return diffDays + 1;
};
