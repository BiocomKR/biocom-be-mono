/**
 * Slack 알림 정책 설정
 *
 * 불필요한 알림(스캐닝 봇, CORS 에러 등)을 필터링
 */

/**
 * 알림 제외 상태 코드
 */
const EXCLUDE_STATUS_CODES: number[] = [401, 403, 404, 405];

/**
 * 알림 제외 경로 패턴 (정규식)
 */
const EXCLUDE_PATH_PATTERNS: RegExp[] = [
  // 헬스체크
  /^\/health/i,
  /^\/api\/health/i,

  // 파비콘/정적 파일
  /\/favicon\.ico$/i,
  /\.(php|asp|aspx|jsp|cgi|env|config)$/i,

  // 스캐닝 봇 패턴
  /^\/(0|%c0)/i,
  /^\/uploads?\/.*(\.env|phpinfo)/i,
  /^\/(vpn|dana-na|global-protect)/i,
  /^\/(logon|LogonPoint)/i,
  /\/sonicos/i,
  /\/\.well-known\//i,
  /\/wp-(admin|content|includes)/i,
  /\/phpmyadmin/i,
  /\/actuator/i,
];

/**
 * 알림 제외 메시지 패턴 (정규식)
 */
const EXCLUDE_MESSAGE_PATTERNS: RegExp[] = [
  /CORS policy violation/i,
  /Cannot GET/i,
  /Cannot POST/i,
  /Cannot PUT/i,
  /Cannot DELETE/i,
];

/**
 * 알림 여부 판단
 */
export function shouldSendSlackAlert(info: {
  statusCode?: number | string;
  url?: string;
  message?: string;
  error?: string;
}): boolean {
  const statusCode =
    typeof info.statusCode === 'string'
      ? parseInt(info.statusCode, 10)
      : info.statusCode;

  // 1. 상태 코드 기반 제외
  if (statusCode && EXCLUDE_STATUS_CODES.includes(statusCode)) {
    return false;
  }

  // 2. 경로 패턴 기반 제외
  if (info.url) {
    for (const pattern of EXCLUDE_PATH_PATTERNS) {
      if (pattern.test(info.url)) {
        return false;
      }
    }
  }

  // 3. 메시지 패턴 기반 제외
  const fullMessage = `${info.message || ''} ${info.error || ''}`;
  for (const pattern of EXCLUDE_MESSAGE_PATTERNS) {
    if (pattern.test(fullMessage)) {
      return false;
    }
  }

  return true;
}
