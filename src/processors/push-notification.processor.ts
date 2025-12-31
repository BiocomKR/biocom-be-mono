import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { PushToken } from '@prisma/client';
import { PrismaService } from '../common/services/prisma.service';
import { FcmProvider } from '../push/providers/fcm.provider';
import {
  PushMessage,
  PushSendResult,
} from '../push/interfaces/push-provider.interface';
import { PushNotificationType } from '../push/enums';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 푸시 알림 Job 데이터 인터페이스
 */
export interface PushNotificationJobData {
  /** Job 타입: user (단일), users (다수), all (전체) */
  type: 'user' | 'users' | 'all';

  /** 유저 ID (type=user일 때) */
  userId?: number;

  /** 유저 ID 배열 (type=users일 때) */
  userIds?: number[];

  /** 푸시 메시지 */
  message: PushMessage;

  /** 알림 타입 */
  notificationType?: PushNotificationType;

  /** 테스트 발송 여부 */
  isTest?: boolean;

  /** 필터 조건 (type=all일 때) */
  filter?: {
    marketingEnabled?: boolean;
  };
}

/**
 * 푸시 알림 프로세서 (MQ Worker)
 *
 * Queue에서 푸시 전송 Job을 받아서 FCM으로 발송 처리
 */
@Processor('push-notification')
export class PushNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(PushNotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmProvider: FcmProvider,
  ) {
    super();
  }

  async process(job: Job<PushNotificationJobData>): Promise<any> {
    const { type, message, isTest } = job.data;

    this.logger.log(
      `📨 [PushProcessor] Job 시작: id=${job.id}, type=${type}, title="${message.title}"`,
    );

    try {
      let result: any;

      switch (type) {
        case 'user':
          result = await this.sendToUser(job.data);
          break;
        case 'users':
          result = await this.sendToUsers(job.data);
          break;
        case 'all':
          result = await this.sendToAll(job.data);
          break;
        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      this.logger.log(
        `✅ [PushProcessor] Job 완료: id=${job.id}, sentCount=${result.sentCount}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `❌ [PushProcessor] Job 실패: id=${job.id}, error=${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 단일 유저에게 푸시 전송
   */
  private async sendToUser(data: PushNotificationJobData) {
    const { userId, message, notificationType, isTest } = data;

    if (!userId) {
      throw new Error('userId is required for type=user');
    }

    this.logger.log(`📤 [PushProcessor] 유저 푸시 전송: userId=${userId}`);

    // 1. 활성화된 FCM 푸시 토큰 조회 (pushEnabled 체크)
    const pushTokens = await this.prisma.pushToken.findMany({
      where: {
        userId,
        isActive: true,
        provider: 'FCM',
        user: { pushEnabled: true },
      },
    });

    if (pushTokens.length === 0) {
      this.logger.warn(`⚠️ [PushProcessor] 활성 토큰 없음: userId=${userId}`);
      return {
        success: false,
        message: '활성화된 푸시 토큰이 없습니다',
        sentCount: 0,
        failureCount: 0,
      };
    }

    this.logger.log(
      `🎯 [PushProcessor] 전송 대상: ${pushTokens.length}개 기기`,
    );

    // 2. 각 토큰별로 로그 생성 후 전송
    let successCount = 0;
    let failureCount = 0;

    for (const pushToken of pushTokens) {
      // 2-1. 로그 미리 생성
      const logId = await this.createPendingLog(
        pushToken,
        message,
        notificationType || PushNotificationType.ETC,
        isTest || false,
      );

      // 2-2. logId를 포함한 메시지 생성
      const enrichedMessage: PushMessage = {
        ...message,
        data: {
          ...message.data,
          logId: logId?.toString(),
        },
      };

      // 2-3. FCM 전송
      const result = await this.fcmProvider.sendToToken(
        pushToken.token,
        enrichedMessage,
      );

      // 2-4. 로그 업데이트 (실패 시)
      if (logId && !result.success) {
        await this.updateLogWithFailure(logId, result);
      }

      // 2-5. PushToken 상태 업데이트
      await this.updateTokenStats(pushToken.id, result.success);

      // 2-6. 실패한 토큰 비활성화
      if (this.shouldInvalidateToken(result)) {
        await this.invalidateToken(pushToken, result.errorCode);
      }

      if (result.success) successCount++;
      else failureCount++;
    }

    this.logger.log(
      `✅ [PushProcessor] 전송 완료: 성공 ${successCount}/${pushTokens.length}`,
    );

    return {
      success: successCount > 0,
      message: `${successCount}개 기기에 전송 성공`,
      sentCount: successCount,
      failureCount,
    };
  }

  /**
   * 다수 유저에게 푸시 전송
   */
  private async sendToUsers(data: PushNotificationJobData) {
    const { userIds, message, notificationType, isTest } = data;

    if (!userIds || userIds.length === 0) {
      throw new Error('userIds is required for type=users');
    }

    this.logger.log(
      `📤 [PushProcessor] 다수 유저 푸시 전송: ${userIds.length}명`,
    );

    let totalSent = 0;
    let totalFailed = 0;

    for (const userId of userIds) {
      const result = await this.sendToUser({
        ...data,
        type: 'user',
        userId,
      });
      totalSent += result.sentCount;
      totalFailed += result.failureCount || 0;
    }

    this.logger.log(
      `✅ [PushProcessor] 배치 전송 완료: 성공 ${totalSent}, 실패 ${totalFailed}`,
    );

    return {
      success: totalSent > 0,
      message: `${totalSent}개 기기에 전송 성공`,
      sentCount: totalSent,
      failureCount: totalFailed,
    };
  }

  /**
   * 전체 유저에게 푸시 전송
   */
  private async sendToAll(data: PushNotificationJobData) {
    const { message, filter, notificationType, isTest } = data;

    this.logger.log(`📣 [PushProcessor] 전체 푸시 전송: title="${message.title}"`);

    // 활성화된 모든 FCM 푸시 토큰 조회 (pushEnabled 체크)
    const pushTokens = await this.prisma.pushToken.findMany({
      where: {
        isActive: true,
        provider: 'FCM',
        user: { pushEnabled: true },
        ...(filter?.marketingEnabled !== undefined && {
          marketingEnabled: filter.marketingEnabled,
        }),
      },
    });

    if (pushTokens.length === 0) {
      this.logger.warn(`⚠️ [PushProcessor] 전송 대상 없음`);
      return {
        success: false,
        message: '전송 대상이 없습니다',
        sentCount: 0,
        failureCount: 0,
      };
    }

    this.logger.log(
      `🎯 [PushProcessor] 전송 대상: ${pushTokens.length}개 기기`,
    );

    // FCM Multicast 배치 크기 (최대 500개)
    const BATCH_SIZE = 500;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < pushTokens.length; i += BATCH_SIZE) {
      const batch: PushToken[] = pushTokens.slice(i, i + BATCH_SIZE);

      // 1. 배치 내 모든 토큰에 대해 로그 미리 생성
      const logIds: (number | null)[] = await Promise.all(
        batch.map((pushToken: PushToken) =>
          this.createPendingLog(
            pushToken,
            message,
            notificationType || PushNotificationType.SYSTEM,
            isTest || false,
          ),
        ),
      );

      // 2. FCM Multicast 발송
      const batchResults = await this.fcmProvider.sendToMultiple(batch, message);

      // 3. 각 토큰별 결과 처리
      await Promise.all(
        batch.map(async (pushToken: PushToken, index: number) => {
          const result = batchResults[index];
          const logId = logIds[index];

          if (logId && !result.success) {
            await this.updateLogWithFailure(logId, result);
          }

          await this.updateTokenStats(pushToken.id, result.success);

          if (this.shouldInvalidateToken(result)) {
            await this.invalidateToken(pushToken, result.errorCode);
          }

          if (result.success) successCount++;
          else failureCount++;
        }),
      );

      this.logger.debug(
        `📦 [PushProcessor] 배치 ${Math.floor(i / BATCH_SIZE) + 1} 완료: ${batch.length}개 처리`,
      );
    }

    this.logger.log(
      `✅ [PushProcessor] 전체 전송 완료: 성공 ${successCount}/${pushTokens.length}`,
    );

    return {
      success: successCount > 0,
      message: `${successCount}개 기기에 전송 성공`,
      sentCount: successCount,
      failureCount,
    };
  }

  /**
   * 토큰 무효화 여부 판단
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
   */
  private async invalidateToken(pushToken: any, errorCode?: string) {
    this.logger.warn(
      `⚠️ [PushProcessor] 토큰 무효화: deviceId=${pushToken.deviceId}, errorCode=${errorCode}`,
    );

    await this.prisma.pushToken.update({
      where: { id: pushToken.id },
      data: {
        isActive: false,
        invalidatedAt: getNowKST(),
        invalidReason: errorCode,
      },
    });
  }

  /**
   * 푸시 로그 미리 생성 (전송 전)
   */
  private async createPendingLog(
    pushToken: any,
    message: PushMessage,
    type: PushNotificationType,
    isTest: boolean,
  ): Promise<number | null> {
    try {
      const log = await this.prisma.pushNotificationLog.create({
        data: {
          userId: pushToken.userId,
          pushTokenId: pushToken.id,
          title: message.title,
          body: message.body,
          type,
          data: message.data,
          success: true, // 기본값 true (실패 시 업데이트)
          sentAt: getNowKST(),
          isTest,
        },
      });
      return log.id;
    } catch (error) {
      this.logger.error(
        `❌ [PushProcessor] 로그 생성 실패: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * 푸시 로그를 실패로 업데이트
   */
  private async updateLogWithFailure(logId: number, result: PushSendResult) {
    try {
      await this.prisma.pushNotificationLog.update({
        where: { id: logId },
        data: {
          success: false,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
        },
      });
    } catch (error) {
      this.logger.error(
        `❌ [PushProcessor] 로그 업데이트 실패: ${error.message}`,
      );
    }
  }

  /**
   * PushToken 상태 업데이트
   */
  private async updateTokenStats(tokenId: number, success: boolean) {
    try {
      await this.prisma.pushToken.update({
        where: { id: tokenId },
        data: {
          lastUsedAt: getNowKST(),
          successCount: success ? { increment: 1 } : undefined,
          failureCount: success ? undefined : { increment: 1 },
        },
      });
    } catch (error) {
      this.logger.error(
        `❌ [PushProcessor] 토큰 상태 업데이트 실패: ${error.message}`,
      );
    }
  }
}
