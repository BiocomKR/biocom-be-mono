/**
 * 챌린지 날짜 계산 유틸리티
 * 정책 정의서의 날짜 규칙을 구현
 */

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
 * 구매일 기준으로 최대 시작 가능일 계산 (구매일 +30일)
 * @param purchaseDate - 구매일
 * @returns 최대 시작 가능일
 */
export const calculateMaxStartDate = (purchaseDate: Date): Date => {
  const maxStartDate = new Date(purchaseDate);
  maxStartDate.setDate(maxStartDate.getDate() + 30);
  return maxStartDate;
};

/**
 * 시작일이 유효한지 검증
 * @param startDate - 설정하려는 시작일
 * @param purchaseDate - 구매일
 * @returns 유효하면 true, 그렇지 않으면 false
 */
export const isValidStartDate = (startDate: Date, purchaseDate: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // 시간을 00:00:00으로 설정

  const maxStartDate = calculateMaxStartDate(purchaseDate);
  
  // 시작일은 오늘 이후이고 구매일로부터 30일 이내여야 함
  return startDate >= today && startDate <= maxStartDate;
};

/**
 * Date를 YYYY-MM-DD 문자열로 변환 (KST 기준)
 * @param date - 변환할 날짜
 * @returns YYYY-MM-DD 형식의 문자열
 */
export const formatDateToString = (date: Date): string => {
  // 한국 시간으로 변환 후 날짜 부분만 추출
  const koreanTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
  return koreanTime.toISOString().split('T')[0];
};

/**
 * YYYY-MM-DD 문자열을 Date 객체로 변환 (KST 기준)
 * @param dateString - YYYY-MM-DD 형식의 문자열
 * @returns Date 객체 (한국 시간 00:00:00)
 */
export const parseStringToDate = (dateString: string): Date => {
  // 한국 시간 기준으로 해석
  return new Date(dateString + 'T00:00:00+09:00');
};