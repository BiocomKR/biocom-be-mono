import { Injectable, Inject } from '@nestjs/common';
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

  private readonly admin: typeof admin;

  constructor(
    @Inject('FIREBASE_ADMIN') firebaseAdmin: typeof admin,
  ) {
    this.admin = firebaseAdmin;
  }

  /**
   * 단일 FCM 토큰으로 푸시 발송
   *
   * @param token - FCM 토큰 문자열
   * @param message - 발송할 메시지
   * @returns 발송 결과
   */
  async sendToToken(
    token: string,
    message: PushMessage,
  ): Promise<PushSendResult> {
    console.log('📤 [FCM] 단일 토큰 발송 시작:', {
      hasToken: !!token,
      title: message.title,
      body: message.body?.substring(0, 50),
    });

    if (!token) {
      console.error('❌ [FCM] 토큰 누락');
      return {
        success: false,
        errorCode: 'INVALID_TOKEN',
        errorMessage: 'FCM token is missing',
      };
    }

    try {
      // FCM 메시지 구성
      const fcmMessage: admin.messaging.Message = {
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
      console.log('🚀 [FCM] Firebase로 메시지 전송 중...');
      const messageId = await this.admin.messaging().send(fcmMessage);

      console.log('✅ [FCM] 발송 성공:', {
        messageId,
        title: message.title,
      });

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      console.error('❌ [FCM] 발송 실패:', {
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
      console.warn(
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

      console.log(
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
      console.error('❌ FCM 배치 발송 실패:', error);

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

  /**
   * FCM Topic 구독
   *
   * @param tokens - FCM 토큰 배열
   * @param topic - 토픽 이름
   * @returns 구독 성공 여부
   */
  async subscribeToTopic(tokens: string[], topic: string): Promise<boolean> {
    console.log(`📌 [FCM] Topic 구독 시작: topic=${topic}, tokens=${tokens.length}개`);

    try {
      const response = await this.admin.messaging().subscribeToTopic(tokens, topic);

      console.log(`✅ [FCM] Topic 구독 성공: ${response.successCount}/${tokens.length}`);

      if (response.failureCount > 0) {
        console.warn(`⚠️ [FCM] Topic 구독 실패: ${response.failureCount}개`, response.errors);
      }

      return response.successCount > 0;
    } catch (error) {
      console.error(`❌ [FCM] Topic 구독 실패:`, error);
      return false;
    }
  }

  /**
   * FCM Topic 구독 해제
   *
   * @param tokens - FCM 토큰 배열
   * @param topic - 토픽 이름
   * @returns 구독 해제 성공 여부
   */
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<boolean> {
    console.log(`🔕 [FCM] Topic 구독 해제 시작: topic=${topic}, tokens=${tokens.length}개`);

    try {
      const response = await this.admin.messaging().unsubscribeFromTopic(tokens, topic);

      console.log(`✅ [FCM] Topic 구독 해제 성공: ${response.successCount}/${tokens.length}`);

      if (response.failureCount > 0) {
        console.warn(`⚠️ [FCM] Topic 구독 해제 실패: ${response.failureCount}개`, response.errors);
      }

      return response.successCount > 0;
    } catch (error) {
      console.error(`❌ [FCM] Topic 구독 해제 실패:`, error);
      return false;
    }
  }

  /**
   * FCM Topic으로 푸시 발송
   *
   * @param topic - 토픽 이름
   * @param message - 발송할 메시지
   * @returns 발송 결과
   */
  async sendToTopic(topic: string, message: PushMessage): Promise<PushSendResult> {
    console.log(`📣 [FCM] Topic 푸시 발송 시작: topic=${topic}, title=${message.title}`);

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

      console.log(`✅ [FCM] Topic 푸시 발송 성공: messageId=${messageId}`);

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      console.error(`❌ [FCM] Topic 푸시 발송 실패:`, error);

      return {
        success: false,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message,
      };
    }
  }
}
