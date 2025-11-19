import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { FcmProvider } from '../providers/fcm.provider';
import {
  PushMessage,
  PushSendResult,
} from '../interfaces/push-provider.interface';
import { PushNotificationType } from '../enums/push-notification-type.enum';

/**
 * 푸시 알림 전송 서비스
 *
 * 유저에게 푸시 알림을 전송하는 비즈니스 로직
 */
@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmProvider: FcmProvider,
  ) {}

  /**
   * 특정 유저에게 푸시 알림 전송
   *
   * @param userId - 유저 ID
   * @param message - 푸시 메시지
   * @returns 전송 결과
   */
  async sendToUser(userId: number, message: PushMessage) {
    this.logger.log(
      `📤 [PushNotificationService] 유저에게 푸시 전송: userId=${userId}, title="${message.title}"`,
    );

    // 1. 활성화된 푸시 토큰 조회
    const pushTokens = await this.prisma.pushToken.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    if (pushTokens.length === 0) {
      this.logger.warn(
        `⚠️ [PushNotificationService] 활성 푸시 토큰 없음: userId=${userId}`,
      );
      return {
        success: false,
        message: '활성화된 푸시 토큰이 없습니다',
        sentCount: 0,
        failureCount: 0,
      };
    }

    this.logger.log(
      `🎯 [PushNotificationService] 전송 대상: ${pushTokens.length}개 기기`,
    );

    // 2. FCM 토큰 추출
    const fcmTokens = pushTokens.map((pt) => ({ token: pt.token }));

    // 3. FCM 발송
    const results = await this.fcmProvider.sendToMultiple(fcmTokens, message);

    // 4. 결과 집계
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    this.logger.log(
      `✅ [PushNotificationService] 전송 완료: 성공 ${successCount}/${results.length}`,
    );

    // 5. 로그 저장 및 실패한 토큰 처리
    await this.processResults(pushTokens, results, message, PushNotificationType.MANUAL);

    return {
      success: successCount > 0,
      message: `${successCount}개 기기에 전송 성공`,
      sentCount: successCount,
      failureCount,
    };
  }

  /**
   * 여러 유저에게 푸시 알림 전송 (배치)
   *
   * @param userIds - 유저 ID 배열
   * @param message - 푸시 메시지
   * @returns 전송 결과
   */
  async sendToUsers(userIds: number[], message: PushMessage) {
    this.logger.log(
      `📤 [PushNotificationService] 다수 유저에게 푸시 전송: ${userIds.length}명, title="${message.title}"`,
    );

    const results = await Promise.all(
      userIds.map((userId) => this.sendToUser(userId, message)),
    );

    const totalSent = results.reduce((sum, r) => sum + r.sentCount, 0);
    const totalFailed = results.reduce((sum, r) => sum + (r.failureCount || 0), 0);

    this.logger.log(
      `✅ [PushNotificationService] 배치 전송 완료: 성공 ${totalSent}, 실패 ${totalFailed}`,
    );

    return {
      success: totalSent > 0,
      message: `${totalSent}개 기기에 전송 성공`,
      sentCount: totalSent,
      failureCount: totalFailed,
    };
  }

  /**
   * 모든 유저에게 푸시 알림 전송 (공지사항 등)
   *
   * @param message - 푸시 메시지
   * @param filter - 선택적 필터 (예: 마케팅 동의 여부)
   * @returns 전송 결과
   */
  async sendToAll(
    message: PushMessage,
    filter?: { marketingEnabled?: boolean },
  ) {
    this.logger.log(
      `📣 [PushNotificationService] 전체 푸시 전송: title="${message.title}"`,
    );

    // 활성화된 모든 푸시 토큰 조회
    const pushTokens = await this.prisma.pushToken.findMany({
      where: {
        isActive: true,
        ...(filter?.marketingEnabled !== undefined && {
          marketingEnabled: filter.marketingEnabled,
        }),
      },
    });

    if (pushTokens.length === 0) {
      this.logger.warn(
        `⚠️ [PushNotificationService] 전송 대상 없음 (필터 적용됨)`,
      );
      return {
        success: false,
        message: '전송 대상이 없습니다',
        sentCount: 0,
        failureCount: 0,
      };
    }

    this.logger.log(
      `🎯 [PushNotificationService] 전송 대상: ${pushTokens.length}개 기기`,
    );

    // FCM 토큰 추출
    const fcmTokens = pushTokens.map((pt) => ({ token: pt.token }));

    // FCM 발송 (500개씩 자동 분할)
    const results = await this.fcmProvider.sendToMultiple(fcmTokens, message);

    // 결과 집계
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    this.logger.log(
      `✅ [PushNotificationService] 전체 전송 완료: 성공 ${successCount}/${results.length}`,
    );

    // 로그 저장 및 실패한 토큰 처리
    await this.processResults(pushTokens, results, message, PushNotificationType.BROADCAST);

    return {
      success: successCount > 0,
      message: `${successCount}개 기기에 전송 성공`,
      sentCount: successCount,
      failureCount,
    };
  }

  /**
   * 푸시 전송 결과 처리 (로그 저장 + 실패 토큰 비활성화)
   *
   * @param pushTokens - 푸시 토큰 목록
   * @param results - FCM 전송 결과
   * @param message - 푸시 메시지
   * @param type - 푸시 타입
   * @private
   */
  private async processResults(
    pushTokens: any[],
    results: PushSendResult[],
    message: PushMessage,
    type: PushNotificationType,
  ) {
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const pushToken = pushTokens[i];

      // 1. 푸시 전송 로그 저장
      await this.savePushLog(pushToken, result, message, type);

      // 2. 실패한 토큰 비활성화
      if (this.shouldInvalidateToken(result)) {
        await this.invalidateToken(pushToken, result.errorCode);
      }
    }
  }

  /**
   * 푸시 전송 로그 저장
   *
   * @param pushToken - 푸시 토큰
   * @param result - 전송 결과
   * @param message - 푸시 메시지
   * @param type - 푸시 타입
   * @private
   */
  private async savePushLog(
    pushToken: any,
    result: PushSendResult,
    message: PushMessage,
    type: PushNotificationType,
  ) {
    try {
      await this.prisma.pushNotificationLog.create({
        data: {
          userId: pushToken.userId,
          pushTokenId: pushToken.id,
          title: message.title,
          body: message.body,
          type: (message.data?.type as string) || type,
          data: message.data,
          success: result.success,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        `❌ [PushNotificationService] 로그 저장 실패: ${error.message}`,
      );
      // 로그 저장 실패는 전체 프로세스를 중단하지 않음
    }
  }

  /**
   * 토큰 무효화 여부 판단
   *
   * @param result - FCM 전송 결과
   * @returns 토큰 무효화 필요 여부
   * @private
   */
  private shouldInvalidateToken(result: PushSendResult): boolean {
    return (
      !result.success &&
      (result.errorCode === 'messaging/invalid-registration-token' ||
        result.errorCode === 'messaging/registration-token-not-registered')
    );
  }

  /**
   * 토큰 비활성화
   *
   * @param pushToken - 푸시 토큰
   * @param errorCode - 에러 코드
   * @private
   */
  private async invalidateToken(pushToken: any, errorCode?: string) {
    this.logger.warn(
      `⚠️ [PushNotificationService] 토큰 무효화: deviceId=${pushToken.deviceId}, errorCode=${errorCode}`,
    );

    await this.prisma.pushToken.update({
      where: { id: pushToken.id },
      data: {
        isActive: false,
        invalidatedAt: new Date(),
        invalidReason: errorCode,
      },
    });
  }
}
