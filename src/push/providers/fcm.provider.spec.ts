import { Test, TestingModule } from '@nestjs/testing';
import { FcmProvider } from './fcm.provider';
import * as admin from 'firebase-admin';

describe('FcmProvider - 재시도 로직 테스트', () => {
  let provider: FcmProvider;
  let mockFirebaseAdmin: any;
  let sendSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Firebase Admin Mock
    mockFirebaseAdmin = {
      messaging: jest.fn().mockReturnValue({
        send: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FcmProvider,
        {
          provide: 'FIREBASE_ADMIN',
          useValue: mockFirebaseAdmin,
        },
      ],
    }).compile();

    provider = module.get<FcmProvider>(FcmProvider);
    sendSpy = mockFirebaseAdmin.messaging().send;
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
      expect(sendSpy).toHaveBeenCalledTimes(3); // maxRetries=3 → 총 3번 시도
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
});
