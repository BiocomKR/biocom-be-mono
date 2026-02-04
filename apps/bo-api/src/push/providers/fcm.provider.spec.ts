import { Test, TestingModule } from '@nestjs/testing';
import { FcmProvider } from './fcm.provider';

describe('FcmProvider - 재시도 로직 테스트', () => {
  let provider: FcmProvider;
  let mockFirebaseApps: any;
  let sendSpy: jest.SpyInstance;
  let mockMessaging: any;

  beforeEach(async () => {
    // Firebase Messaging Mock
    mockMessaging = {
      send: jest.fn(),
    };

    // Firebase Apps Mock (FIREBASE_APPS)
    mockFirebaseApps = {
      dev: { messaging: () => mockMessaging },
      prod: { messaging: () => mockMessaging },
      getAppForBundleId: jest.fn().mockReturnValue({ messaging: () => mockMessaging }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FcmProvider,
        {
          provide: 'FIREBASE_APPS',
          useValue: mockFirebaseApps,
        },
      ],
    }).compile();

    provider = module.get<FcmProvider>(FcmProvider);
    sendSpy = mockMessaging.send;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('재시도 가능한 에러', () => {
    it('server-unavailable 에러 시 3번 재시도 후 성공', async () => {
      // 처음 2번 실패, 3번째 성공
      sendSpy
        .mockRejectedValueOnce({ code: 'messaging/server-unavailable', message: '서버 장애' })
        .mockRejectedValueOnce({ code: 'messaging/server-unavailable', message: '서버 장애' })
        .mockResolvedValueOnce('message-id-123');

      const result = await provider.sendToToken('test-token', {
        title: '테스트',
        body: '재시도 테스트',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('message-id-123');
      expect(sendSpy).toHaveBeenCalledTimes(3);
    });

    it('internal-error 에러 시 재시도', async () => {
      sendSpy
        .mockRejectedValueOnce({ code: 'messaging/internal-error', message: '내부 오류' })
        .mockResolvedValueOnce('message-id-456');

      const result = await provider.sendToToken('test-token', {
        title: '테스트',
        body: '재시도 테스트',
      });

      expect(result.success).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(2);
    });

    it('5xx 에러 시 재시도', async () => {
      sendSpy
        .mockRejectedValueOnce({ code: '503', message: 'Service Unavailable' })
        .mockResolvedValueOnce('message-id-789');

      const result = await provider.sendToToken('test-token', {
        title: '테스트',
        body: '재시도 테스트',
      });

      expect(result.success).toBe(true);
      expect(sendSpy).toHaveBeenCalledTimes(2);
    });

    it('3번 모두 실패 시 최종 실패 반환', async () => {
      sendSpy.mockRejectedValue({
        code: 'messaging/server-unavailable',
        message: '서버 계속 장애'
      });

      const result = await provider.sendToToken('test-token', {
        title: '테스트',
        body: '재시도 테스트',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('messaging/server-unavailable');
      expect(sendSpy).toHaveBeenCalledTimes(3); // 최대 3회 시도
    });
  });

  describe('재시도 불가능한 에러', () => {
    it('invalid-registration-token 에러 시 즉시 반환 (재시도 안함)', async () => {
      sendSpy.mockRejectedValue({
        code: 'messaging/invalid-registration-token',
        message: '유효하지 않은 토큰'
      });

      const result = await provider.sendToToken('invalid-token', {
        title: '테스트',
        body: '재시도 테스트',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('messaging/invalid-registration-token');
      expect(sendSpy).toHaveBeenCalledTimes(1); // 재시도 안함
    });

    it('registration-token-not-registered 에러 시 즉시 반환', async () => {
      sendSpy.mockRejectedValue({
        code: 'messaging/registration-token-not-registered',
        message: '등록되지 않은 토큰'
      });

      const result = await provider.sendToToken('unregistered-token', {
        title: '테스트',
        body: '재시도 테스트',
      });

      expect(result.success).toBe(false);
      expect(sendSpy).toHaveBeenCalledTimes(1); // 재시도 안함
    });

    it('4xx 클라이언트 에러 시 즉시 반환', async () => {
      sendSpy.mockRejectedValue({
        code: '400',
        message: 'Bad Request'
      });

      const result = await provider.sendToToken('test-token', {
        title: '테스트',
        body: '재시도 테스트',
      });

      expect(result.success).toBe(false);
      expect(sendSpy).toHaveBeenCalledTimes(1); // 재시도 안함
    });
  });

  describe('정상 동작', () => {
    it('첫 시도에서 성공 시 재시도 없음', async () => {
      sendSpy.mockResolvedValue('message-id-success');

      const result = await provider.sendToToken('test-token', {
        title: '테스트',
        body: '성공 테스트',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('message-id-success');
      expect(sendSpy).toHaveBeenCalledTimes(1); // 재시도 없음
    });
  });

  describe('bundleId 기반 앱 선택', () => {
    it('dev bundleId 시 dev 앱 사용', async () => {
      sendSpy.mockResolvedValue('message-id-dev');

      await provider.sendToToken('test-token', {
        title: '테스트',
        body: 'dev 앱 테스트',
      }, 3, 'kr.biocom.challenge.dev');

      expect(mockFirebaseApps.getAppForBundleId).toHaveBeenCalledWith('kr.biocom.challenge.dev');
    });

    it('prod bundleId 시 prod 앱 사용', async () => {
      sendSpy.mockResolvedValue('message-id-prod');

      await provider.sendToToken('test-token', {
        title: '테스트',
        body: 'prod 앱 테스트',
      }, 3, 'kr.biocom.challenge');

      expect(mockFirebaseApps.getAppForBundleId).toHaveBeenCalledWith('kr.biocom.challenge');
    });
  });
});
