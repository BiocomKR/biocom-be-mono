import { Injectable, Inject, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import {
  IPushProvider,
  PushMessage,
  PushSendResult,
} from '../interfaces/push-provider.interface';

/**
 * Firebase Cloud Messaging Provider
 *
 * FCM을 사용한 푸시 알림 발송 구현체
 * IPushProvider 인터페이스를 구현하여 서비스 중립적인 비즈니스 로직 지원
 */
@Injectable()
export class FcmProvider implements IPushProvider {
  readonly name = 'FCM';
  private readonly logger = new Logger(FcmProvider.name);

  private readonly admin: typeof admin;

  constructor(
    @Inject('FIREBASE_ADMIN') firebaseAdmin: typeof admin,
  ) {
    this.admin = firebaseAdmin;
  }

  /**
   * 단일 FCM 토큰으로 푸시 발송 (재시도 포함)
   *
   * @param token - FCM 토큰 문자열
   * @param message - 발송할 메시지
   * @param maxRetries - 최대 재시도 횟수 (기본값: 3)
   * @returns 발송 결과
   */
  async sendToToken(
    token: string,
    message: PushMessage,
    maxRetries: number = 3,
  ): Promise<PushSendResult> {
    // 재시도 로직
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await this.sendToTokenOnce(token, message);

      // 성공하거나 재시도 불가능한 에러면 즉시 반환
      if (result.success || !this.isRetryableError(result.errorCode)) {
        if (attempt > 0) {
          this.logger.log(`✅ [FCM] 재시도 성공: ${attempt + 1}번째 시도에서 성공`);
        }
        return result;
      }

      // 마지막 시도가 아니면 대기 후 재시도
      if (attempt < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, attempt); // 1초, 2초, 4초
        this.logger.warn(`🔄 [FCM] 재시도 ${attempt + 1}/${maxRetries - 1} - ${delay}ms 후 재시도`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // 모든 재시도 실패 시 마지막 결과 반환
    return await this.sendToTokenOnce(token, message);
  }

  /**
   * 재시도 가능한 에러인지 판단
   *
   * @param errorCode - FCM 에러 코드
   * @returns 재시도 가능 여부
   * @private
   */
  private isRetryableError(errorCode?: string): boolean {
    if (!errorCode) return false;

    // FCM 서버 일시 장애 에러들
    const retryableErrors = [
      'messaging/server-unavailable',
      'messaging/internal-error',
      'messaging/unavailable',
    ];

    // 5xx 에러나 정의된 재시도 가능 에러
    return retryableErrors.includes(errorCode) || errorCode.startsWith('5');
  }

  /**
   * 단일 FCM 토큰으로 푸시 발송 (재시도 없이 1회만)
   *
   * @param token - FCM 토큰 문자열
   * @param message - 발송할 메시지
   * @returns 발송 결과
   * @private
   */
  private async sendToTokenOnce(
    token: string,
    message: PushMessage,
  ): Promise<PushSendResult> {
    this.logger.log('📤 [FCM] 단일 토큰 발송 시작:', {
      hasToken: !!token,
      title: message.title,
      body: message.body?.substring(0, 50),
    });

    if (!token) {
      this.logger.error('❌ [FCM] 토큰 누락');
      return {
        success: false,
        errorCode: 'INVALID_TOKEN',
        errorMessage: 'FCM token is missing',
      };
    }

    try {
      // FCM 메시지 구성
      const fcmMessage: admin.messaging.Message = message.silent
        ? // Silent Push: 알림 없이 data만 전송
          {
            token,
            // data는 문자열만 가능 (FCM 제약)
            data: message.data
              ? Object.entries(message.data).reduce(
                  (acc, [key, value]) => ({
                    ...acc,
                    [key]: String(value),
                  }),
                  {},
                )
              : undefined,
            // Android 설정 (Silent Push)
            android: {
              priority: 'normal', // Silent은 normal priority
            },
            // iOS 설정 (Silent Push)
            apns: {
              headers: {
                'apns-priority': '5', // Silent push priority
                'apns-push-type': 'background',
              },
              payload: {
                aps: {
                  contentAvailable: true, // 백그라운드 처리 활성화
                  // sound, badge 없음
                },
              },
            },
          }
        : // 일반 Push: 알림과 data 모두 전송
          {
            token,
            notification: {
              title: message.title,
              body: message.body,
              ...(message.imageUrl && { imageUrl: message.imageUrl }),
            },
            // data는 문자열만 가능 (FCM 제약)
            data: message.data
              ? Object.entries(message.data).reduce(
                  (acc, [key, value]) => ({
                    ...acc,
                    [key]: String(value),
                  }),
                  {},
                )
              : undefined,
            // Android 설정
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channelId: 'default',
              },
            },
            // iOS 설정
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1,
                },
              },
            },
          };

      // FCM 발송
      this.logger.log('🚀 [FCM] Firebase로 메시지 전송 중...');
      const messageId = await this.admin.messaging().send(fcmMessage);

      this.logger.log('✅ [FCM] 발송 성공:', {
        messageId,
        title: message.title,
      });

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      this.logger.error('❌ [FCM] 발송 실패:', {
        code: error.code,
        message: error.message,
        title: message.title,
      });

      return {
        success: false,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message,
      };
    }
  }

  /**
   * 여러 FCM 토큰으로 배치 발송
   *
   * FCM은 최대 500개까지 한 번에 발송 가능
   *
   * @param tokensData - FCM 토큰 데이터 배열 [{ token: string }, ...]
   * @param message - 발송할 메시지
   * @returns 각 토큰별 발송 결과 배열
   */
  async sendToMultiple(
    tokensData: any[],
    message: PushMessage,
  ): Promise<PushSendResult[]> {
    const tokens = tokensData.map((td) => td.token).filter(Boolean);

    if (tokens.length === 0) {
      return [];
    }

    // FCM 제약: 최대 500개
    if (tokens.length > 500) {
      this.logger.warn(
        `⚠️ FCM 배치 발송 제한 초과: ${tokens.length}개 (최대 500개)`,
      );
      // 500개씩 나눠서 발송
      const results: PushSendResult[] = [];
      for (let i = 0; i < tokens.length; i += 500) {
        const batch = tokens.slice(i, i + 500);
        const batchResults = await this.sendMulticastBatch(batch, message);
        results.push(...batchResults);
      }
      return results;
    }

    return await this.sendMulticastBatch(tokens, message);
  }

  /**
   * 500개 이하 배치 발송 (내부 메서드)
   *
   * @param tokens - FCM 토큰 배열 (최대 500개)
   * @param message - 발송할 메시지
   * @returns 발송 결과 배열
   */
  private async sendMulticastBatch(
    tokens: string[],
    message: PushMessage,
  ): Promise<PushSendResult[]> {
    try {
      // FCM MulticastMessage 구성
      const multicastMessage: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: message.title,
          body: message.body,
          ...(message.imageUrl && { imageUrl: message.imageUrl }),
        },
        data: message.data
          ? Object.entries(message.data).reduce(
              (acc, [key, value]) => ({
                ...acc,
                [key]: String(value),
              }),
              {},
            )
          : undefined,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      // FCM 배치 발송
      const response = await this.admin
        .messaging()
        .sendEachForMulticast(multicastMessage);

      this.logger.log(
        `✅ FCM 배치 발송 완료: 성공 ${response.successCount}/${tokens.length}`,
      );

      // 각 토큰별 결과 매핑
      return response.responses.map((r) => ({
        success: r.success,
        messageId: r.messageId,
        errorCode: r.error?.code,
        errorMessage: r.error?.message,
      }));
    } catch (error) {
      this.logger.error('❌ FCM 배치 발송 실패:', error);

      // 전체 실패
      return tokens.map(() => ({
        success: false,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message,
      }));
    }
  }

  /**
   * FCM 토큰 유효성 검증
   *
   * @param tokenData - FCM 토큰 데이터 { token: string }
   * @returns 유효하면 true
   */
  async validateToken(tokenData: any): Promise<boolean> {
    const { token } = tokenData;

    if (!token || typeof token !== 'string') {
      return false;
    }

    // FCM 토큰 형식 기본 검증 (길이 체크)
    // 실제 유효성은 발송 시도 시 확인됨
    return token.length > 50;
  }

}
