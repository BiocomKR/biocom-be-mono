/**
 * 챌린지 날짜 계산 유틸리티
 * 정책 정의서의 날짜 규칙을 구현
 *
 * KST 저장 정책:
 * - Prisma는 항상 UTC로 저장하려고 함
 * - 우리는 KST 값을 그대로 저장하고 싶음
 * - 해결: 저장할 때 +9시간을 더해서 UTC에 KST 값이 저장되도록 함
 */

/**
 * KST Date를 생성 (Prisma 저장용)
 * Prisma가 UTC로 저장하므로, KST 시간에 9시간을 더해서 반환
 *
 * @param year - 연도
 * @param month - 월 (1-12)
 * @param day - 일
 * @param hour - 시 (기본값: 0)
 * @param minute - 분 (기본값: 0)
 * @param second - 초 (기본값: 0)
 * @returns UTC+9 시간이 더해진 Date 객체
 *
 * @example
 * // KST 2025-10-20을 저장하고 싶을 때
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
  // Prisma가 UTC로 저장하면 DB에 KST 값이 저장됨
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
 * @returns UTC+9 시간이 더해진 Date 객체
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
 * 주어진 날짜가 평일인지 확인
 * @param date - 확인할 날짜
 * @returns 평일이면 true, 주말이면 false
 */
export const isWeekday = (date: Date): boolean => {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
};

/**
 * 시작일 기준으로 배송일 계산 (시작일 -1일, 평일만)
 * @param startDate - 챌린지 시작일
 * @returns 배송 가능한 가장 가까운 평일
 */
export const calculateDeliveryDate = (startDate: Date): Date => {
  const deliveryDate = new Date(startDate);
  deliveryDate.setDate(deliveryDate.getDate() - 1);

  // 시작일 -1일이 주말이면 그 이전 평일을 찾음
  while (!isWeekday(deliveryDate)) {
    deliveryDate.setDate(deliveryDate.getDate() - 1);
  }

  return deliveryDate;
};

/**
 * 시작일 기준으로 종료일 계산 (시작일 +20일)
 * @param startDate - 챌린지 시작일
 * @returns 종료일 (21일 챌린지이므로 시작일 +20일)
 */
export const calculateEndDate = (startDate: Date): Date => {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 20); // 21일 챌린지 = 시작일 + 20일
  return endDate;
};


/**
 * Date를 YYYY-MM-DD 문자열로 변환
 * @param date - 변환할 날짜
 * @returns YYYY-MM-DD 형식의 문자열
 */
export const formatDateToString = (date: Date): string => {
  // Prisma 미들웨어가 UTC 날짜에 +9시간을 추가한 Date 객체를 제공합니다
  // 하지만 Date 객체 내부는 여전히 UTC 타임스탬프이므로
  // UTC 메서드를 사용해야 정확한 날짜를 추출할 수 있습니다
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * YYYY-MM-DD 문자열을 Date 객체로 변환
 * @param dateString - YYYY-MM-DD 형식의 문자열
 * @returns Date 객체 (로컬 타임존 00:00:00)
 */
export const parseStringToDate = (dateString: string): Date => {
  // 로컬 타임존 기준으로 Date 객체 생성
  // Prisma의 create/update 변환이 비활성화되어 있으므로
  // 로컬 타임존으로 생성해야 DB에 정확한 날짜가 저장됩니다
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};