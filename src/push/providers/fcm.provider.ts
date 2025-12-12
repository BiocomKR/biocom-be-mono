import { Injectable, Inject, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import {
  IPushProvider,
  PushMessage,
  PushSendResult,
} from '../interfaces/push-provider.interface';

/**
 * Firebase Cloud Messaging Provider (MQ Worker용)
 */
@Injectable()
export class FcmProvider implements IPushProvider {
  readonly name = 'FCM';
  private readonly logger = new Logger(FcmProvider.name);
  private readonly admin: typeof admin;

  constructor(@Inject('FIREBASE_ADMIN') firebaseAdmin: typeof admin) {
    this.admin = firebaseAdmin;
  }

  async sendToToken(
    token: string,
    message: PushMessage,
    maxRetries: number = 3,
  ): Promise<PushSendResult> {
    let lastResult: PushSendResult | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await this.sendToTokenOnce(token, message);
      lastResult = result;

      if (result.success || !this.isRetryableError(result.errorCode)) {
        if (attempt > 0 && result.success) {
          this.logger.log(
            `✅ [FCM] 재시도 성공: ${attempt + 1}번째 시도에서 성공`,
          );
        }
        return result;
      }

      if (attempt < maxRetries - 1) {
        const delay = 1000 * Math.pow(2, attempt);
        this.logger.warn(
          `🔄 [FCM] 재시도 ${attempt + 1}/${maxRetries} - ${delay}ms 후 재시도`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    this.logger.error(`❌ [FCM] ${maxRetries}회 재시도 모두 실패`);
    return lastResult!;
  }

  private isRetryableError(errorCode?: string): boolean {
    if (!errorCode) return false;

    const retryableErrors = [
      'messaging/server-unavailable',
      'messaging/internal-error',
      'messaging/unavailable',
    ];

    return retryableErrors.includes(errorCode) || errorCode.startsWith('5');
  }

  private async sendToTokenOnce(
    token: string,
    message: PushMessage,
  ): Promise<PushSendResult> {
    this.logger.log('📤 [FCM] 단일 토큰 발송 시작:', {
      hasToken: !!token,
      title: message.title,
    });

    if (!token) {
      this.logger.error('❌ [FCM] 토큰 누락');
      return {
        success: false,
        errorCode: 'INVALID_TOKEN',
        errorMessage: 'FCM token is missing',
      };
    }

    if (!this.admin) {
      this.logger.error('❌ [FCM] Firebase Admin SDK가 초기화되지 않음');
      return {
        success: false,
        errorCode: 'FIREBASE_NOT_INITIALIZED',
        errorMessage: 'Firebase Admin SDK is not initialized',
      };
    }

    try {
      const fcmMessage: admin.messaging.Message = message.silent
        ? {
            token,
            data: message.data
              ? Object.entries(message.data).reduce(
                  (acc, [key, value]) => ({
                    ...acc,
                    [key]: String(value),
                  }),
                  {},
                )
              : undefined,
            android: { priority: 'normal' },
            apns: {
              headers: {
                'apns-priority': '5',
                'apns-push-type': 'background',
              },
              payload: {
                aps: { contentAvailable: true },
              },
            },
          }
        : {
            token,
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

      this.logger.log('🚀 [FCM] Firebase로 메시지 전송 중...');
      const messageId = await this.admin.messaging().send(fcmMessage);

      this.logger.log('✅ [FCM] 발송 성공:', { messageId, title: message.title });

      return { success: true, messageId };
    } catch (error) {
      this.logger.error('❌ [FCM] 발송 실패:', {
        code: error.code,
        message: error.message,
      });

      return {
        success: false,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message,
      };
    }
  }

  async sendToMultiple(
    tokensData: any[],
    message: PushMessage,
  ): Promise<PushSendResult[]> {
    const tokens = tokensData.map((td) => td.token).filter(Boolean);

    if (tokens.length === 0) {
      return [];
    }

    if (!this.admin) {
      return tokens.map(() => ({
        success: false,
        errorCode: 'FIREBASE_NOT_INITIALIZED',
        errorMessage: 'Firebase Admin SDK is not initialized',
      }));
    }

    if (tokens.length > 500) {
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

  private async sendMulticastBatch(
    tokens: string[],
    message: PushMessage,
  ): Promise<PushSendResult[]> {
    try {
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

      const response = await this.admin
        .messaging()
        .sendEachForMulticast(multicastMessage);

      this.logger.log(
        `✅ FCM 배치 발송 완료: 성공 ${response.successCount}/${tokens.length}`,
      );

      return response.responses.map((r) => ({
        success: r.success,
        messageId: r.messageId,
        errorCode: r.error?.code,
        errorMessage: r.error?.message,
      }));
    } catch (error) {
      this.logger.error('❌ FCM 배치 발송 실패:', error);

      return tokens.map(() => ({
        success: false,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message,
      }));
    }
  }

  async validateToken(tokenData: any): Promise<boolean> {
    const { token } = tokenData;
    if (!token || typeof token !== 'string') {
      return false;
    }
    return token.length > 50;
  }

  async subscribeToTopic(tokens: string[], topic: string): Promise<boolean> {
    this.logger.log(
      `📌 [FCM] Topic 구독 시작: topic=${topic}, tokens=${tokens.length}개`,
    );

    if (!this.admin) {
      this.logger.error('❌ [FCM] Firebase Admin SDK가 초기화되지 않음');
      return false;
    }

    try {
      const response = await this.admin
        .messaging()
        .subscribeToTopic(tokens, topic);
      this.logger.log(
        `✅ [FCM] Topic 구독 성공: ${response.successCount}/${tokens.length}`,
      );
      return response.successCount > 0;
    } catch (error) {
      this.logger.error(`❌ [FCM] Topic 구독 실패:`, error);
      return false;
    }
  }

  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<boolean> {
    this.logger.log(
      `🔕 [FCM] Topic 구독 해제 시작: topic=${topic}, tokens=${tokens.length}개`,
    );

    if (!this.admin) {
      this.logger.error('❌ [FCM] Firebase Admin SDK가 초기화되지 않음');
      return false;
    }

    try {
      const response = await this.admin
        .messaging()
        .unsubscribeFromTopic(tokens, topic);
      this.logger.log(
        `✅ [FCM] Topic 구독 해제 성공: ${response.successCount}/${tokens.length}`,
      );
      return response.successCount > 0;
    } catch (error) {
      this.logger.error(`❌ [FCM] Topic 구독 해제 실패:`, error);
      return false;
    }
  }

  async sendToTopic(topic: string, message: PushMessage): Promise<PushSendResult> {
    this.logger.log(
      `📣 [FCM] Topic 푸시 발송 시작: topic=${topic}, title=${message.title}`,
    );

    if (!this.admin) {
      return {
        success: false,
        errorCode: 'FIREBASE_NOT_INITIALIZED',
        errorMessage: 'Firebase Admin SDK is not initialized',
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

      const messageId = await this.admin.messaging().send(fcmMessage);
      this.logger.log(`✅ [FCM] Topic 푸시 발송 성공: messageId=${messageId}`);

      return { success: true, messageId };
    } catch (error) {
      this.logger.error(`❌ [FCM] Topic 푸시 발송 실패:`, error);

      return {
        success: false,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message,
      };
    }
  }
}
