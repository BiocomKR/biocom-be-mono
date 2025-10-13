/**
 * 한국 시간(KST) 기준 날짜 처리 유틸리티
 * 모든 날짜 처리를 한국 시간 기준으로 통일
 */

/**
 * 현재 한국 시간 기준 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
export function getKoreanToday(): string {
  const now = new Date();
  // 한국 시간(UTC+9) 기준으로 변환
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return koreanTime.toISOString().split('T')[0];
}

/**
 * YYYY-MM-DD 문자열을 한국 시간 기준 Date 객체로 변환
 * @param dateString YYYY-MM-DD 형식의 날짜 문자열
 * @returns 한국 시간 00:00:00으로 설정된 Date 객체
 */
export function parseKoreanDate(dateString: string): Date {
  // 한국 시간 기준으로 해석 (타임존 정보 포함)
  return new Date(`${dateString}T00:00:00+09:00`);
}

/**
 * Date 객체를 한국 시간 기준 YYYY-MM-DD 형식으로 변환
 * @param date Date 객체
 * @returns YYYY-MM-DD 형식의 문자열
 */
export function formatKoreanDate(date: Date): string {
  // 한국 시간으로 변환 후 날짜 부분만 추출
  const koreanTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
  return koreanTime.toISOString().split('T')[0];
}

/**
 * 현재 한국 시간 기준 Date 객체 반환
 */
export function getKoreanNow(): Date {
  const now = new Date();
  return new Date(now.getTime() + (9 * 60 * 60 * 1000));
}