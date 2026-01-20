import { Injectable, Inject, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import {
  IPushProvider,
  PushMessage,
  PushSendResult,
} from '../interfaces/push-provider.interface';
import { FirebaseApps } from '../firebase-admin.module';

/**
 * 토큰 데이터 인터페이스 (bundleId 포함)
 */
export interface TokenData {
  token: string;
  bundleId?: string | null;
}

/**
 * Firebase Cloud Messaging Provider
 *
 * Dev/Prod 두 개의 Firebase 앱을 지원하여
 * bundleId에 따라 올바른 FCM credential 사용
 *
 * IPushProvider 인터페이스를 구현하여 서비스 중립적인 비즈니스 로직 지원
 */
@Injectable()
export class FcmProvider implements IPushProvider {
  readonly name = 'FCM';
  private readonly logger = new Logger(FcmProvider.name);
  private readonly firebaseApps: FirebaseApps;

  constructor(@Inject('FIREBASE_APPS') firebaseApps: FirebaseApps) {
    this.firebaseApps = firebaseApps;
  }

  /**
   * bundleId에 맞는 Firebase 앱의 messaging 인스턴스 반환
   */
  private getMessaging(bundleId?: string): admin.messaging.Messaging | null {
    const app = this.firebaseApps.getAppForBundleId(bundleId || '');
    if (!app) {
      this.logger.error(`❌ [FCM] Firebase 앱 없음: bundleId=${bundleId}`);
      return null;
    }
    return app.messaging();
  }

  /**
   * 단일 FCM 토큰으로 푸시 발송 (재시도 포함)
   *
   * @param token - FCM 토큰 문자열
   * @param message - 발송할 메시지
   * @param maxRetries - 최대 재시도 횟수 (기본값: 3)
   * @param bundleId - 토큰의 bundleId (dev/prod 앱 선택용)
   * @returns 발송 결과
   */
  async sendToToken(
    token: string,
    message: PushMessage,
    maxRetries: number = 3,
    bundleId?: string,
  ): Promise<PushSendResult> {
    let lastResult: PushSendResult | null = null;

    // 재시도 로직 (최대 maxRetries 번 시도)
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await this.sendToTokenOnce(token, message, bundleId);
      lastResult = result;

      // 성공하거나 재시도 불가능한 에러면 즉시 반환
      if (result.success || !this.isRetryableError(result.errorCode)) {
        if (attempt > 0 && result.success) {
          this.logger.log(`✅ [FCM] 재시도 성공: ${attempt + 1}번째 시도에서 성공`);
        }
        return result;
      }

      // 마지막 시도가 아니면 대기 후 재시도
      if (attempt < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, attempt); // 1초, 2초, 4초
        this.logger.warn(`🔄 [FCM] 재시도 ${attempt + 1}/${maxRetries} - ${delay}ms 후 재시도`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // 모든 재시도 실패 시 마지막 결과 반환
    this.logger.error(`❌ [FCM] ${maxRetries}회 재시도 모두 실패`);
    return lastResult!;
  }

  /**
   * 재시도 가능한 에러인지 판단
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
   */
  private async sendToTokenOnce(
    token: string,
    message: PushMessage,
    bundleId?: string,
  ): Promise<PushSendResult> {
    this.logger.log('📤 [FCM] 단일 토큰 발송 시작:', {
      hasToken: !!token,
      title: message.title,
      body: message.body?.substring(0, 50),
      bundleId,
    });

    if (!token) {
      this.logger.error('❌ [FCM] 토큰 누락');
      return {
        success: false,
        errorCode: 'INVALID_TOKEN',
        errorMessage: 'FCM token is missing',
      };
    }

    const messaging = this.getMessaging(bundleId);
    if (!messaging) {
      this.logger.error('❌ [FCM] Firebase Messaging 인스턴스 없음');
      return {
        success: false,
        errorCode: 'FIREBASE_NOT_INITIALIZED',
        errorMessage: `Firebase app not found for bundleId: ${bundleId}`,
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
      this.logger.log(`🚀 [FCM] Firebase로 메시지 전송 중... (bundleId=${bundleId})`);
      const messageId = await messaging.send(fcmMessage);

      this.logger.log('✅ [FCM] 발송 성공:', {
        messageId,
        title: message.title,
      });

      return {
        success: true,
        messageId,
      };
    } catch (error: any) {
      this.logger.error('❌ [FCM] 발송 실패:', {
        code: error.code,
        message: error.message,
        title: message.title,
        bundleId,
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
   * tokensData는 { token, bundleId } 형태의 배열
   * bundleId별로 그룹핑하여 각각의 Firebase 앱으로 발송
   */
  async sendToMultiple(
    tokensData: TokenData[],
    message: PushMessage,
  ): Promise<PushSendResult[]> {
    if (tokensData.length === 0) {
      return [];
    }

    // bundleId별로 그룹핑
    const groupedByBundle = new Map<string, { token: string; index: number }[]>();

    tokensData.forEach((td, index) => {
      if (!td.token) return;
      const bundleKey = td.bundleId || 'prod'; // bundleId 없으면 prod로 간주
      if (!groupedByBundle.has(bundleKey)) {
        groupedByBundle.set(bundleKey, []);
      }
      groupedByBundle.get(bundleKey)!.push({ token: td.token, index });
    });

    // 결과 배열 초기화
    const results: PushSendResult[] = new Array(tokensData.length).fill({
      success: false,
      errorCode: 'NOT_PROCESSED',
      errorMessage: 'Token was not processed',
    });

    // 각 bundleId 그룹별로 발송
    for (const [bundleId, tokenGroup] of groupedByBundle) {
      const messaging = this.getMessaging(bundleId);

      if (!messaging) {
        // Firebase 앱이 없으면 해당 그룹 전체 실패 처리
        tokenGroup.forEach(({ index }) => {
          results[index] = {
            success: false,
            errorCode: 'FIREBASE_NOT_INITIALIZED',
            errorMessage: `Firebase app not found for bundleId: ${bundleId}`,
          };
        });
        continue;
      }

      const tokens = tokenGroup.map((t) => t.token);

      // 500개씩 배치 처리
      for (let i = 0; i < tokens.length; i += 500) {
        const batchTokens = tokens.slice(i, i + 500);
        const batchIndices = tokenGroup.slice(i, i + 500).map((t) => t.index);

        const batchResults = await this.sendMulticastBatch(batchTokens, message, messaging);

        batchResults.forEach((result, batchIndex) => {
          results[batchIndices[batchIndex]] = result;
        });
      }
    }

    return results;
  }

  /**
   * 500개 이하 배치 발송 (내부 메서드)
   */
  private async sendMulticastBatch(
    tokens: string[],
    message: PushMessage,
    messaging: admin.messaging.Messaging,
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
      const response = await messaging.sendEachForMulticast(multicastMessage);

      this.logger.log(
        `✅ FCM 배치 발송 완료: 성공 ${response.successCount}/${tokens.length}`,
      );

      // 각 토큰별 결과 매핑
      return response.responses.map((r: admin.messaging.SendResponse) => ({
        success: r.success,
        messageId: r.messageId,
        errorCode: r.error?.code,
        errorMessage: r.error?.message,
      }));
    } catch (error: any) {
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
   */
  async validateToken(tokenData: TokenData): Promise<boolean> {
    const { token } = tokenData;

    if (!token || typeof token !== 'string') {
      return false;
    }

    // FCM 토큰 형식 기본 검증 (길이 체크)
    // 실제 유효성은 발송 시도 시 확인됨
    return token.length > 50;
  }

  /**
   * FCM Topic 구독 (bundleId에 따른 Firebase 앱 선택)
   */
  async subscribeToTopic(tokens: string[], topic: string, bundleId?: string): Promise<boolean> {
    this.logger.log(`📌 [FCM] Topic 구독 시작: topic=${topic}, tokens=${tokens.length}개, bundleId=${bundleId}`);

    const messaging = this.getMessaging(bundleId);
    if (!messaging) {
      this.logger.error('❌ [FCM] Firebase Messaging 인스턴스 없음');
      return false;
    }

    try {
      const response = await messaging.subscribeToTopic(tokens, topic);

      this.logger.log(`✅ [FCM] Topic 구독 성공: ${response.successCount}/${tokens.length}`);

      if (response.failureCount > 0) {
        this.logger.warn(`⚠️ [FCM] Topic 구독 실패: ${response.failureCount}개`, response.errors);
      }

      return response.successCount > 0;
    } catch (error: any) {
      this.logger.error(`❌ [FCM] Topic 구독 실패:`, error);
      return false;
    }
  }

  /**
   * FCM Topic 구독 해제 (bundleId에 따른 Firebase 앱 선택)
   */
  async unsubscribeFromTopic(tokens: string[], topic: string, bundleId?: string): Promise<boolean> {
    this.logger.log(`🔕 [FCM] Topic 구독 해제 시작: topic=${topic}, tokens=${tokens.length}개, bundleId=${bundleId}`);

    const messaging = this.getMessaging(bundleId);
    if (!messaging) {
      this.logger.error('❌ [FCM] Firebase Messaging 인스턴스 없음');
      return false;
    }

    try {
      const response = await messaging.unsubscribeFromTopic(tokens, topic);

      this.logger.log(`✅ [FCM] Topic 구독 해제 성공: ${response.successCount}/${tokens.length}`);

      if (response.failureCount > 0) {
        this.logger.warn(`⚠️ [FCM] Topic 구독 해제 실패: ${response.failureCount}개`, response.errors);
      }

      return response.successCount > 0;
    } catch (error: any) {
      this.logger.error(`❌ [FCM] Topic 구독 해제 실패:`, error);
      return false;
    }
  }

  /**
   * FCM Topic으로 푸시 발송 (bundleId에 따른 Firebase 앱 선택)
   */
  async sendToTopic(topic: string, message: PushMessage, bundleId?: string): Promise<PushSendResult> {
    this.logger.log(`📣 [FCM] Topic 푸시 발송 시작: topic=${topic}, title=${message.title}, bundleId=${bundleId}`);

    const messaging = this.getMessaging(bundleId);
    if (!messaging) {
      return {
        success: false,
        errorCode: 'FIREBASE_NOT_INITIALIZED',
        errorMessage: 'Firebase app not initialized',
      };
    }

    try {
      const fcmMessage: admin.messaging.Message = {
        topic,
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

      const messageId = await messaging.send(fcmMessage);

      this.logger.log(`✅ [FCM] Topic 푸시 발송 성공: messageId=${messageId}`);

      return {
        success: true,
        messageId,
      };
    } catch (error: any) {
      this.logger.error(`❌ [FCM] Topic 푸시 발송 실패:`, error);

      return {
        success: false,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message,
      };
    }
  }
}
