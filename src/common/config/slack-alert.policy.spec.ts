import { shouldSendSlackAlert } from './slack-alert.policy';

describe('shouldSendSlackAlert', () => {
  describe('상태 코드 필터링', () => {
    it.each([401, 403, 404, 405])('%d 상태 코드는 알림 제외', (statusCode) => {
      expect(shouldSendSlackAlert({ statusCode })).toBe(false);
    });

    it('문자열 상태 코드도 처리', () => {
      expect(shouldSendSlackAlert({ statusCode: '404' })).toBe(false);
    });

    it.each([400, 500, 502, 503])('%d 상태 코드는 알림 발송', (statusCode) => {
      expect(shouldSendSlackAlert({ statusCode })).toBe(true);
    });
  });

  describe('경로 패턴 필터링', () => {
    it.each([
      '/0',
      '/0/',
      '/%c0',
      '/%c0/',
      '/health',
      '/api/health',
      '/favicon.ico',
      '/test.php',
      '/uploads/.env',
      '/upload/phpinfo.php',
      '/vpn/index.html',
      '/dana-na/auth/url_default/welcome.cgi',
      '/global-protect/login.esp',
      '/logon/LogonPoint/tmindex.html',
      '/api/sonicos/is-sslvpn-enabled',
      '/.well-known/security.txt',
      '/wp-admin/login.php',
      '/phpmyadmin/',
      '/actuator/health',
    ])('스캐닝 봇 경로 %s 제외', (url) => {
      expect(shouldSendSlackAlert({ url, statusCode: 500 })).toBe(false);
    });

    it.each([
      '/api/users',
      '/api/orders/123',
      '/api/products',
    ])('정상 API 경로 %s 알림', (url) => {
      expect(shouldSendSlackAlert({ url, statusCode: 500 })).toBe(true);
    });
  });

  describe('메시지 패턴 필터링', () => {
    it.each([
      'CORS policy violation',
      'Cannot GET /some/path',
      'Cannot POST /api/test',
      'Cannot PUT /api/resource',
      'Cannot DELETE /api/item',
    ])('메시지 "%s" 제외', (message) => {
      expect(shouldSendSlackAlert({ message, statusCode: 500 })).toBe(false);
    });

    it('일반 에러 메시지는 알림', () => {
      expect(
        shouldSendSlackAlert({
          message: 'Database connection failed',
          statusCode: 500,
        }),
      ).toBe(true);
    });
  });

  describe('복합 조건', () => {
    it('404 + 스캔 경로 = 제외', () => {
      expect(
        shouldSendSlackAlert({
          statusCode: 404,
          url: '/wp-admin/',
          message: 'Cannot GET /wp-admin/',
        }),
      ).toBe(false);
    });

    it('500 + 정상 경로 + 일반 에러 = 알림', () => {
      expect(
        shouldSendSlackAlert({
          statusCode: 500,
          url: '/api/users/1',
          message: 'Internal server error',
        }),
      ).toBe(true);
    });
  });
});
