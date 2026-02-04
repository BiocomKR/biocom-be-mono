import { shouldSendAlert } from './slack-alert-throttle';

describe('shouldSendAlert (쓰로틀링)', () => {
  // 테스트마다 고유 URL 생성
  let testId = 0;
  const uniqueUrl = () => `/api/test-${Date.now()}-${++testId}`;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('첫 번째 알림은 발송', () => {
    expect(
      shouldSendAlert({
        statusCode: 500,
        url: uniqueUrl(),
        message: 'Error',
      }),
    ).toBe(true);
  });

  it('5분 내 동일 에러는 스킵', () => {
    const url = uniqueUrl();
    const info = { statusCode: 500, url, message: 'Error' };

    // 첫 번째: 발송
    expect(shouldSendAlert(info)).toBe(true);

    // 두 번째: 스킵
    expect(shouldSendAlert(info)).toBe(false);

    // 1분 후: 여전히 스킵
    jest.advanceTimersByTime(60 * 1000);
    expect(shouldSendAlert(info)).toBe(false);
  });

  it('5분 경과 후 다시 발송', () => {
    const url = uniqueUrl();
    const info = { statusCode: 500, url, message: 'Error' };

    expect(shouldSendAlert(info)).toBe(true);
    expect(shouldSendAlert(info)).toBe(false);

    // 5분 경과
    jest.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(shouldSendAlert(info)).toBe(true);
  });

  it('다른 에러는 별도 추적', () => {
    const urlA = uniqueUrl();
    const urlB = uniqueUrl();

    expect(
      shouldSendAlert({ statusCode: 500, url: urlA, message: 'Error A' }),
    ).toBe(true);

    expect(
      shouldSendAlert({ statusCode: 500, url: urlB, message: 'Error B' }),
    ).toBe(true);

    // 같은 에러 다시 호출 시 스킵
    expect(
      shouldSendAlert({ statusCode: 500, url: urlA, message: 'Error A' }),
    ).toBe(false);
  });

  it('URL의 동적 파라미터 정규화', () => {
    const baseUrl = uniqueUrl();
    // /api/users/123 과 /api/users/456 은 같은 에러로 취급
    expect(
      shouldSendAlert({ statusCode: 500, url: `${baseUrl}/123`, message: 'Error' }),
    ).toBe(true);

    expect(
      shouldSendAlert({ statusCode: 500, url: `${baseUrl}/456`, message: 'Error' }),
    ).toBe(false); // 같은 패턴이므로 스킵
  });
});
