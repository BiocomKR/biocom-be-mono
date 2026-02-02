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
import { ConditionEvaluatorService, ConditionParams } from '../push/services/condition-evaluator.service';
import { RedisService } from '../common/services/redis.service';

/**
 * 푸시 알림 Job 데이터 인터페이스
 */
export interface PushNotificationJobData {
  /** Job 타입: user (단일), users (다수), all (전체), event (이벤트 기반) */
  type: 'user' | 'users' | 'all' | 'event';

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

  /** 페르소나별 메시지 (키: 페르소나 이름, 값: { title, body }) */
  personaMessages?: Record<string, { title: string; body: string }>;

  /** 발송자 타입 (BIOCOM: 공통 메시지, PERSONA: 페르소나별 메시지) */
  senderType?: 'BIOCOM' | 'PERSONA';

  // ===== 이벤트 기반 푸시 전용 필드 =====

  /** 이벤트 타입 (type=event일 때) */
  eventType?: EventPushType;

  /** 조건 재평가용 파라미터 */
  conditions?: { type: string; params: ConditionParams }[];

  /** 캠페인 ID (중복 발송 방지용) */
  campaignId?: number;

  /** 스케줄 ID (로깅용) */
  scheduleId?: number;
}

/**
 * 이벤트 기반 푸시 타입
 */
export enum EventPushType {
  /** 24시간 미접속 */
  NO_ACCESS_24H = 'NO_ACCESS_24H',
  /** 48시간 미접속 */
  NO_ACCESS_48H = 'NO_ACCESS_48H',
  /** 장바구니 방치 */
  CART_ABANDONED = 'CART_ABANDONED',
  /** 쿠폰 만료 임박 */
  COUPON_EXPIRING = 'COUPON_EXPIRING',
  /** 챌린지 시작 D-1 */
  CHALLENGE_START_D1 = 'CHALLENGE_START_D1',
  /** 챌린지 시작 D-Day */
  CHALLENGE_START_DDAY = 'CHALLENGE_START_DDAY',
  /** 오늘 미션 미완료 */
  MISSION_INCOMPLETE = 'MISSION_INCOMPLETE',
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
    private readonly conditionEvaluator: ConditionEvaluatorService,
    private readonly redisService: RedisService,
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
        case 'event':
          result = await this.sendToEvent(job.data);
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

      // 2-2. logId와 pushCode를 포함한 메시지 생성
      const enrichedMessage: PushMessage = {
        ...message,
        data: {
          ...message.data,
          logId: logId?.toString(),
          pushCode: message.data?.pushCode, // GA4 이벤트 추적용
        },
      };

      // 2-3. FCM 전송 (bundleId로 올바른 Firebase 앱 선택)
      const result = await this.fcmProvider.sendToToken(
        pushToken.token,
        enrichedMessage,
        3, // maxRetries
        pushToken.bundleId || undefined,
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
   * - senderType이 PERSONA이고 personaMessages가 있으면 유저별 페르소나에 맞는 메시지 발송
   * - 그 외에는 기본 message 사용
   */
  private async sendToUsers(data: PushNotificationJobData) {
    const { userIds, message, personaMessages, senderType } = data;

    if (!userIds || userIds.length === 0) {
      throw new Error('userIds is required for type=users');
    }

    this.logger.log(
      `📤 [PushProcessor] 다수 유저 푸시 전송: ${userIds.length}명, senderType=${senderType || 'BIOCOM'}`,
    );

    // 페르소나별 메시지 사용 여부
    const usePersonaMessages = senderType === 'PERSONA' && personaMessages && Object.keys(personaMessages).length > 0;

    // 페르소나별 메시지 사용 시 유저별 페르소나 정보 조회
    let userPersonaMap: Map<number, string> = new Map();
    if (usePersonaMessages) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          aiPersona: { select: { name: true } },
        },
      });
      users.forEach((u) => {
        if (u.aiPersona?.name) {
          userPersonaMap.set(u.id, u.aiPersona.name);
        }
      });
      this.logger.log(`🎭 [PushProcessor] 페르소나 정보 조회 완료: ${userPersonaMap.size}명`);
    }

    let totalSent = 0;
    let totalFailed = 0;
    const BATCH_SIZE = 50;

    // 유저별 메시지 미리 결정
    const userMessages = userIds.map((userId) => {
      let userMessage = message;

      if (usePersonaMessages && personaMessages) {
        const personaName = userPersonaMap.get(userId);
        if (personaName && personaMessages[personaName]) {
          userMessage = {
            ...message,
            title: personaMessages[personaName].title,
            body: personaMessages[personaName].body,
          };
        } else if (personaMessages['default']) {
          userMessage = {
            ...message,
            title: personaMessages['default'].title,
            body: personaMessages['default'].body,
          };
        }
      }

      return { userId, userMessage };
    });

    // 배치 병렬 처리
    for (let i = 0; i < userMessages.length; i += BATCH_SIZE) {
      const batch = userMessages.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async ({ userId, userMessage }) => {
          const result = await this.sendToUser({
            ...data,
            type: 'user',
            userId,
            message: userMessage,
          });
          return result;
        }),
      );

      for (const result of batchResults) {
        totalSent += result.sentCount;
        totalFailed += result.failureCount || 0;
      }
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
        user: {
          pushEnabled: true,
          ...(filter?.marketingEnabled !== undefined && {
            marketingEnabled: filter.marketingEnabled,
          }),
        },
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

  /**
   * 이벤트 기반 푸시 전송
   *
   * Delayed Job이 실행될 때 조건을 재평가하여 여전히 조건에 맞는 유저에게만 발송
   * 분산락을 통해 중복 발송 방지
   */
  private async sendToEvent(data: PushNotificationJobData) {
    const { userId, message, eventType, conditions, campaignId, scheduleId } = data;

    if (!userId) {
      throw new Error('userId is required for type=event');
    }

    this.logger.log(
      `🎯 [PushProcessor] 이벤트 기반 푸시 시작: userId=${userId}, eventType=${eventType}, scheduleId=${scheduleId}`,
    );

    // 1. 분산락 획득 (중복 처리 방지)
    const lockKey = `push:event:lock:${campaignId || scheduleId}:${userId}`;
    const lockAcquired = await this.redisService.acquireLock(lockKey, 30000); // 30초 TTL

    if (!lockAcquired) {
      this.logger.warn(
        `⚠️ [PushProcessor] 분산락 획득 실패 (이미 처리 중): userId=${userId}`,
      );
      return {
        success: false,
        message: '이미 처리 중인 요청입니다',
        sentCount: 0,
        failureCount: 0,
        skipped: true,
      };
    }

    try {
      // 2. 중복 발송 체크
      const sentKey = `push:event:sent:${campaignId || scheduleId}:${userId}`;
      const canSend = await this.redisService.markSent(sentKey, 86400000); // 24시간 TTL

      if (!canSend) {
        this.logger.warn(
          `⚠️ [PushProcessor] 이미 발송됨: userId=${userId}, scheduleId=${scheduleId}`,
        );
        return {
          success: false,
          message: '이미 발송된 푸시입니다',
          sentCount: 0,
          failureCount: 0,
          skipped: true,
        };
      }

      // 3. 조건 재평가 (지연된 시간 동안 조건이 변경되었을 수 있음)
      if (conditions && conditions.length > 0) {
        const stillEligible = await this.checkConditionsForUser(userId, conditions);

        if (!stillEligible) {
          this.logger.log(
            `ℹ️ [PushProcessor] 조건 재평가 실패 (조건 변경됨): userId=${userId}`,
          );
          return {
            success: false,
            message: '조건이 더 이상 충족되지 않습니다',
            sentCount: 0,
            failureCount: 0,
            skipped: true,
          };
        }
      }

      // 4. 실제 푸시 발송
      const result = await this.sendToUser({
        ...data,
        type: 'user',
        userId,
      });

      this.logger.log(
        `✅ [PushProcessor] 이벤트 기반 푸시 완료: userId=${userId}, success=${result.success}`,
      );

      return result;
    } finally {
      // 5. 분산락 해제
      await this.redisService.releaseLock(lockKey);
    }
  }

  /**
   * 단일 유저에 대해 조건 목록 재평가
   */
  private async checkConditionsForUser(
    userId: number,
    conditions: { type: string; params: ConditionParams }[],
  ): Promise<boolean> {
    for (const condition of conditions) {
      const result = await this.conditionEvaluator.evaluateForUser(
        userId,
        condition.type,
        condition.params,
      );

      if (!result.matched) {
        this.logger.debug(
          `[ConditionCheck] 조건 미충족: userId=${userId}, type=${condition.type}`,
        );
        return false;
      }
    }

    return true;
  }
}
