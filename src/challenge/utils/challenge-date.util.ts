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
 * 주어진 날짜가 월요일인지 확인
 * @param date - 확인할 날짜
 * @returns 월요일이면 true, 아니면 false
 */
export const isMonday = (date: Date): boolean => {
  return date.getDay() === 1; // 1 = Monday
};

/**
 * 신청일 기준 선택 가능한 시작일 범위 계산
 *
 * 현재 정책:
 * - 모든 요일 신청: 다음주 월요일부터 3주간의 월요일
 *
 * 이전 정책 (배송 준비 기간 확보):
 * - 월~수요일 신청: 다음주 월요일부터 3주간의 월요일
 * - 목~금요일 신청: 차차주 월요일부터 3주간의 월요일 (배송 준비 기간 확보)
 * - 토~일요일 신청: 다음주 월요일부터 3주간의 월요일
 * ⚠️ 도시락 배송 정책 폐지로 인해 목~금 특별 조건 제거됨 (2025-11-14)
 *
 * @param applicationDate - 신청일 (오늘)
 * @returns 선택 가능한 월요일 목록 3개
 *
 * @example
 * // 신청일이 2025-10-28 (화요일)인 경우
 * // 다음주 월요일: 2025-11-03, 2025-11-10, 2025-11-17
 *
 * // 신청일이 2025-12-26 (금요일)인 경우
 * // 다음주 월요일: 2025-12-29, 2026-01-05, 2026-01-12
 */
export const getAvailableStartDates = (applicationDate: Date): Date[] => {
  const result: Date[] = [];
  const today = new Date(applicationDate);
  today.setHours(0, 0, 0, 0);

  const dayOfWeek = today.getDay(); // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토

  // 다음주 월요일 찾기
  const nextMonday = new Date(today);
  const daysUntilNextMonday = (8 - dayOfWeek) % 7 || 7; // 다음주 월요일까지 남은 일수
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);

  // ⚠️ 배송 준비 기간 확보 조건 제거됨 (도시락 배송 정책 폐지)
  // 이전: 목요일(4) 또는 금요일(5)에 신청하면 차차주 월요일부터 시작
  // const startWeekOffset = (dayOfWeek === 4 || dayOfWeek === 5) ? 7 : 0;

  // 현재: 모든 요일 동일하게 다음주 월요일부터 시작
  const startWeekOffset = 0;

  // 시작 월요일부터 3주간의 월요일 추가
  for (let i = 0; i < 3; i++) {
    const monday = new Date(nextMonday);
    monday.setDate(nextMonday.getDate() + startWeekOffset + (i * 7));
    result.push(monday);
  }

  return result;
};

/**
 * 주어진 날짜가 유효한 시작일인지 검증
 * 정책: 신청일 기준 다음주부터 3주간의 월요일만 가능
 *
 * @param startDate - 검증할 시작일
 * @param applicationDate - 신청일
 * @returns 유효하면 true, 아니면 false
 */
export const isValidStartDate = (startDate: Date, applicationDate: Date): boolean => {
  // 월요일이 아니면 불가
  if (!isMonday(startDate)) {
    return false;
  }

  // 선택 가능한 월요일 목록 가져오기
  const availableDates = getAvailableStartDates(applicationDate);

  // 시작일을 YYYY-MM-DD 문자열로 변환하여 비교
  const startDateStr = formatDateToString(startDate);

  return availableDates.some(date => formatDateToString(date) === startDateStr);
};

/**
 * 시작일 기준으로 배송도착예정일 계산
 * 정책: 시작일 전주 금요일 (단, 금요일이 주말/공휴일이면 앞당김)
 *
 * @param startDate - 챌린지 시작일 (월요일)
 * @returns 배송도착예정일 (전주 금요일, 또는 가장 가까운 평일)
 *
 * @example
 * // 시작일이 2025-11-03 (월요일)인 경우
 * // 배송도착예정일: 2025-10-31 (전주 금요일)
 * // 만약 10-31이 공휴일이면 10-30 (목요일)
 */
export const calculateDeliveryArrivalDate = async (startDate: Date): Promise<Date> => {
  const { findNearestDeliveryDate } = await import('../../common/utils/holiday.util');

  const arrivalDate = new Date(startDate);
  // 시작일(월요일) - 3일 = 전주 금요일
  arrivalDate.setDate(arrivalDate.getDate() - 3);

  // 배송 가능한 가장 가까운 날짜 찾기 (금요일부터 과거로 최대 7일)
  const deliveryDate = await findNearestDeliveryDate(arrivalDate, 7);

  if (!deliveryDate) {
    throw new Error('배송 가능한 날짜를 찾을 수 없습니다. 관리자에게 문의하세요.');
  }

  return deliveryDate;
};

/**
 * 배송도착예정일 기준으로 배송시작일 계산
 * 정책: 배송도착일 2일전 (단, 주말/공휴일이면 앞당김)
 *
 * @param deliveryArrivalDate - 배송도착예정일
 * @returns 배송시작일 (배송도착일 2일전, 또는 가장 가까운 평일)
 *
 * @example
 * // 배송도착예정일이 2025-10-31 (금요일)인 경우
 * // 배송시작일: 2025-10-29 (수요일)
 * // 만약 10-29가 공휴일이면 10-28 (화요일)
 */
export const calculateDeliveryStartDate = async (deliveryArrivalDate: Date): Promise<Date> => {
  const { findNearestDeliveryDate } = await import('../../common/utils/holiday.util');

  const startDate = new Date(deliveryArrivalDate);
  startDate.setDate(startDate.getDate() - 2);

  // 배송 가능한 가장 가까운 날짜 찾기 (2일전부터 과거로 최대 7일)
  const deliveryDate = await findNearestDeliveryDate(startDate, 7);

  if (!deliveryDate) {
    throw new Error('배송 시작 가능한 날짜를 찾을 수 없습니다. 관리자에게 문의하세요.');
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