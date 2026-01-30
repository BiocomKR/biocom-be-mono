import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import {
  IPushProvider,
  PUSH_PROVIDER_TOKEN,
  PushMessage,
  PushSendResult,
} from '../interfaces/push-provider.interface';
import { PushNotificationType, PushLogStatus } from '../enums';
import { PushLogQueryDto } from '../dto/push-log-query.dto';
import { PushLogListResponseDto, PushLogResponseDto } from '../dto/push-log-response.dto';
import { PushStatsResponseDto } from '../dto/push-stats-response.dto';
import { getNowKST, stringToKSTDate } from '../../common/utils/kst-date.util';
import { QueueService, PushNotificationType as QueuePushType } from '../../queues/queue.service';

/**
 * 푸시 알림 전송 서비스
 *
 * 유저에게 푸시 알림을 전송하는 비즈니스 로직
 * FCM 직접 발송 대신 MQ Worker에게 위임
 */
@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_PROVIDER_TOKEN) private readonly pushProvider: IPushProvider,
    private readonly queueService: QueueService,
  ) {}

  /**
   * PushNotificationType을 Queue용 타입으로 변환
   */
  private toQueuePushType(type?: PushNotificationType): QueuePushType {
    switch (type) {
      case PushNotificationType.SYSTEM:
        return QueuePushType.SYSTEM;
      case PushNotificationType.REMIND:
        return QueuePushType.REMIND;
      case PushNotificationType.MARKETING:
        return QueuePushType.MARKETING;
      case PushNotificationType.TRANSACTIONAL:
        return QueuePushType.TRANSACTIONAL;
      default:
        return QueuePushType.ETC;
    }
  }

  /**
   * 특정 유저에게 푸시 알림 전송
   *
   * MQ Worker에게 위임하여 비동기 처리
   *
   * @param userId - 유저 ID
   * @param message - 푸시 메시지
   * @param isTest - 테스트 발송 여부 (기본값: false)
   * @returns Job 추가 결과
   */
  async sendToUser(userId: number, message: PushMessage, isTest: boolean = false) {
    this.logger.log(
      `📤 [PushNotificationService] 유저 푸시 전송 요청 (MQ): userId=${userId}, title="${message.title}"`,
    );

    try {
      const job = await this.queueService.addPushToUser(
        userId,
        message,
        this.toQueuePushType(PushNotificationType.ETC),
        isTest,
      );

      this.logger.log(
        `✅ [PushNotificationService] MQ Job 추가 완료: jobId=${job.id}, userId=${userId}`,
      );

      return {
        success: true,
        message: 'MQ에 푸시 발송 요청이 추가되었습니다',
        jobId: job.id,
        sentCount: 0,
        failureCount: 0,
      };
    } catch (error) {
      this.logger.error(
        `❌ [PushNotificationService] MQ Job 추가 실패: userId=${userId}, ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 여러 유저에게 푸시 알림 전송 (배치)
   *
   * MQ Worker에게 위임하여 비동기 처리
   *
   * @param userIds - 유저 ID 배열
   * @param message - 푸시 메시지
   * @param isTest - 테스트 발송 여부 (기본값: false)
   * @returns Job 추가 결과
   */
  async sendToUsers(userIds: number[], message: PushMessage, isTest: boolean = false) {
    this.logger.log(
      `📤 [PushNotificationService] 다수 유저 푸시 전송 요청 (MQ): ${userIds.length}명, title="${message.title}"`,
    );

    try {
      const job = await this.queueService.addPushToUsers(
        userIds,
        message,
        this.toQueuePushType(PushNotificationType.ETC),
        isTest,
      );

      this.logger.log(
        `✅ [PushNotificationService] MQ Job 추가 완료: jobId=${job.id}, count=${userIds.length}`,
      );

      return {
        success: true,
        message: 'MQ에 푸시 발송 요청이 추가되었습니다',
        jobId: job.id,
        sentCount: 0,
        failureCount: 0,
      };
    } catch (error) {
      this.logger.error(
        `❌ [PushNotificationService] MQ Job 추가 실패: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 모든 유저에게 푸시 알림 전송 (공지사항 등)
   *
   * MQ Worker에게 위임하여 비동기 처리
   *
   * @param message - 푸시 메시지
   * @param filter - 선택적 필터 (예: 마케팅 동의 여부)
   * @param isTest - 테스트 발송 여부 (기본값: false)
   * @returns Job 추가 결과
   */
  async sendToAll(
    message: PushMessage,
    filter?: { marketingEnabled?: boolean },
    isTest: boolean = false,
  ) {
    this.logger.log(
      `📣 [PushNotificationService] 전체 푸시 전송 요청 (MQ): title="${message.title}"`,
    );

    try {
      const job = await this.queueService.addPushToAll(
        message,
        this.toQueuePushType(PushNotificationType.SYSTEM),
        isTest,
        filter,
      );

      this.logger.log(
        `✅ [PushNotificationService] MQ Job 추가 완료: jobId=${job.id}`,
      );

      return {
        success: true,
        message: 'MQ에 푸시 발송 요청이 추가되었습니다',
        jobId: job.id,
        sentCount: 0,
        failureCount: 0,
      };
    } catch (error) {
      this.logger.error(
        `❌ [PushNotificationService] MQ Job 추가 실패: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 푸시 로그 조회 (관리자용)
   *
   * @param query - 조회 조건 (페이지네이션, 필터)
   * @returns 푸시 로그 목록
   */
  async getPushLogs(query: PushLogQueryDto): Promise<PushLogListResponseDto> {
    const { page = 1, limit = 100, userId, success, type, startDate, endDate, isTest } = query;
    const skip = (page - 1) * limit;

    this.logger.log(
      `📋 [PushNotificationService] 푸시 로그 조회: page=${page}, limit=${limit}, isTest=${isTest}`,
    );

    try {
      const where: any = {};
      if (userId !== undefined) {
        where.userId = userId;
      }
      if (success !== undefined) {
        where.success = success;
      }
      if (type) {
        where.type = type;
      }
      if (isTest !== undefined) {
        where.isTest = isTest;
      }

      if (startDate || endDate) {
        where.sentAt = {};
        if (startDate) {
          where.sentAt.gte = stringToKSTDate(startDate, 0, 0, 0);
        }
        if (endDate) {
          where.sentAt.lte = stringToKSTDate(endDate, 23, 59, 59);
        }
      }

      const total = await this.prisma.pushNotificationLog.count({ where });

      const logs = await this.prisma.pushNotificationLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          sentAt: 'desc',
        },
      });

      this.logger.log(
        `✅ [PushNotificationService] 로그 조회 완료: ${logs.length}개 (전체: ${total}개)`,
      );

      return {
        logs: logs.map((log) => this.mapToLogResponseDto(log)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(
        `❌ [PushNotificationService] 푸시 로그 조회 실패: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private mapToLogResponseDto(log: any): PushLogResponseDto {
    return {
      id: log.id,
      campaignId: log.campaignId,
      userId: log.userId,
      pushTokenId: log.pushTokenId,
      title: log.title,
      body: log.body,
      type: log.type,
      data: log.data,
      success: log.success,
      errorCode: log.errorCode,
      errorMessage: log.errorMessage,
      sentAt: log.sentAt,
      readAt: log.readAt,
      clickedAt: log.clickedAt,
    };
  }

  /**
   * 푸시 통계 조회 (관리자용)
   */
  async getPushStats(startDate?: string, endDate?: string, isTest?: boolean, bundleId?: string): Promise<PushStatsResponseDto> {
    this.logger.log(`📊 [PushNotificationService] 푸시 통계 조회 (isTest=${isTest}, bundleId=${bundleId})`);

    try {
      const whereFilter: any = {};

      if (startDate) {
        whereFilter.sentAt = {
          ...whereFilter.sentAt,
          gte: stringToKSTDate(startDate, 0, 0, 0),
        };
      }
      if (endDate) {
        whereFilter.sentAt = {
          ...whereFilter.sentAt,
          lte: stringToKSTDate(endDate, 23, 59, 59),
        };
      }
      if (isTest !== undefined) {
        whereFilter.isTest = isTest;
      }
      if (bundleId) {
        whereFilter.bundleId = bundleId;
      }

      const [totalSent, successCount, failureCount, readCount, clickedCount, typeStats] = await Promise.all([
        this.prisma.pushNotificationLog.count({ where: whereFilter }),
        this.prisma.pushNotificationLog.count({
          where: { ...whereFilter, success: true },
        }),
        this.prisma.pushNotificationLog.count({
          where: { ...whereFilter, success: false },
        }),
        this.prisma.pushNotificationLog.count({
          where: { ...whereFilter, readAt: { not: null } },
        }),
        this.prisma.pushNotificationLog.count({
          where: { ...whereFilter, clickedAt: { not: null } },
        }),
        this.prisma.pushNotificationLog.groupBy({
          by: ['type'],
          where: whereFilter,
          _count: { type: true },
        }),
      ]);

      const byType: Record<string, number> = {};
      typeStats.forEach((item: { type: string; _count: { type: number } }) => {
        byType[item.type] = item._count.type;
      });

      this.logger.log(
        `✅ [PushNotificationService] 통계 조회 완료: 총 ${totalSent}건, 성공 ${successCount}건`,
      );

      return {
        totalSent,
        successCount,
        failureCount,
        readCount,
        clickedCount,
        byType,
      };
    } catch (error) {
      this.logger.error(
        `❌ [PushNotificationService] 푸시 통계 조회 실패: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 푸시 로그 상태 업데이트 (readAt 또는 clickedAt)
   */
  async updatePushLogStatus(
    userId: number,
    logId: number,
    status: PushLogStatus,
  ) {
    this.logger.log(
      `📝 [PushNotificationService] 푸시 로그 상태 업데이트: logId=${logId}, status=${status}`,
    );

    try {
      const log = await this.prisma.pushNotificationLog.findFirst({
        where: {
          id: logId,
          userId,
        },
      });

      if (!log) {
        this.logger.warn(
          `⚠️ [PushNotificationService] 로그를 찾을 수 없거나 권한 없음: logId=${logId}, userId=${userId}`,
        );
        return {
          success: false,
          message: '푸시 알림을 찾을 수 없습니다',
        };
      }

      const updateData: any = {};
      if (status === PushLogStatus.READ && !log.readAt) {
        updateData.readAt = getNowKST();
      } else if (status === PushLogStatus.CLICKED && !log.clickedAt) {
        updateData.clickedAt = getNowKST();
        if (!log.readAt) {
          updateData.readAt = getNowKST();
        }
      }

      if (Object.keys(updateData).length === 0) {
        this.logger.log(
          `ℹ️ [PushNotificationService] 이미 업데이트됨: logId=${logId}, status=${status}`,
        );
        return {
          success: true,
          message: '이미 처리된 상태입니다',
        };
      }

      await this.prisma.pushNotificationLog.update({
        where: { id: logId },
        data: updateData,
      });

      this.logger.log(
        `✅ [PushNotificationService] 푸시 로그 상태 업데이트 완료: logId=${logId}`,
      );

      return {
        success: true,
        message: '푸시 상태가 업데이트되었습니다',
      };
    } catch (error) {
      this.logger.error(
        `❌ [PushNotificationService] 푸시 로그 상태 업데이트 실패: logId=${logId}, ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 마케팅 푸시 전송 (Topic 기반 - FCM 직접 발송)
   *
   * Topic 기반으로 마케팅 동의한 유저에게만 푸시 전송
   * 이건 MQ로 이관하지 않고 FCM Topic으로 직접 발송
   */
  async sendMarketingBroadcast(message: {
    title: string;
    body: string;
    imageUrl?: string;
    data?: Record<string, any>;
  }) {
    this.logger.log(
      `📣 [PushNotificationService] 마케팅 푸시 전송: title="${message.title}"`,
    );

    try {
      const result = await this.pushProvider.sendToTopic('marketing', {
        title: message.title,
        body: message.body,
        imageUrl: message.imageUrl,
        data: {
          ...message.data,
          subType: 'MARKETING_BROADCAST',
        },
      });

      await this.createTopicLog(
        'marketing',
        {
          title: message.title,
          body: message.body,
          imageUrl: message.imageUrl,
          data: message.data,
        },
        PushNotificationType.MARKETING,
        result,
      );

      this.logger.log(
        `✅ [PushNotificationService] 마케팅 푸시 전송 완료: success=${result.success}`,
      );

      return {
        success: result.success,
        message: result.success
          ? '마케팅 푸시가 전송되었습니다'
          : '마케팅 푸시 전송에 실패했습니다',
        messageId: result.messageId,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      };
    } catch (error) {
      this.logger.error(
        `❌ [PushNotificationService] 마케팅 푸시 전송 실패: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Topic 발송 로그 생성 (통계용)
   */
  private async createTopicLog(
    topic: string,
    message: PushMessage,
    type: PushNotificationType,
    result: PushSendResult,
  ): Promise<void> {
    try {
      await this.prisma.pushNotificationLog.create({
        data: {
          title: message.title,
          body: message.body,
          type,
          data: { ...message.data, topic },
          success: result.success,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          sentAt: getNowKST(),
          isTest: false,
        },
      });
      this.logger.debug(
        `📝 [PushNotificationService] Topic 로그 생성 완료: topic=${topic}, success=${result.success}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ [PushNotificationService] Topic 로그 생성 실패: ${error.message}`,
      );
    }
  }
}
