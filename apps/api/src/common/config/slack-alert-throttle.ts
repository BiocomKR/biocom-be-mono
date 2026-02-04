/**
 * Slack 알림 쓰로틀링
 *
 * 동일 에러 반복 알림 방지
 * - 같은 에러는 5분에 1번만 알림
 */

/** 쓰로틀 윈도우 (5분) */
const THROTTLE_WINDOW_MS = 5 * 60 * 1000;

/** 최근 알림 시간 기록 */
const lastAlertTime = new Map<string, number>();

/** 10분마다 오래된 기록 정리 */
setInterval(() => {
  const now = Date.now();
  for (const [key, time] of lastAlertTime.entries()) {
    if (now - time > THROTTLE_WINDOW_MS * 2) {
      lastAlertTime.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * 에러 키 생성
 */
function getAlertKey(info: {
  statusCode?: number | string;
  url?: string;
  message?: string;
}): string {
  const normalizedUrl = (info.url || '')
    .replace(/\/\d+/g, '/:id')
    .replace(/\?.*$/, '');
  const shortMessage = (info.message || '').slice(0, 50);
  return `${info.statusCode}:${normalizedUrl}:${shortMessage}`;
}

/**
 * 쓰로틀 체크
 * @returns true면 알림 발송, false면 스킵
 */
export function shouldSendAlert(info: {
  statusCode?: number | string;
  url?: string;
  message?: string;
}): boolean {
  const key = getAlertKey(info);
  const now = Date.now();
  const lastTime = lastAlertTime.get(key);

  if (lastTime && now - lastTime < THROTTLE_WINDOW_MS) {
    return false; // 스킵
  }

  lastAlertTime.set(key, now);
  return true; // 발송
}
