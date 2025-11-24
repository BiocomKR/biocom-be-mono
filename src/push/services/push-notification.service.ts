import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { FcmProvider } from '../providers/fcm.provider';
import {
  PushMessage,
  PushSendResult,
} from '../interfaces/push-provider.interface';
import { PushNotificationType, PushLogStatus } from '../enums';
import { PushLogQueryDto } from '../dto/push-log-query.dto';
import { PushLogListResponseDto, PushLogResponseDto } from '../dto/push-log-response.dto';
import { SendPushToTopicDto } from '../dto/send-push-to-topic.dto';
import { PushStatsResponseDto } from '../dto/push-stats-response.dto';
import { getNowKST, stringToKSTDate } from '../../common/utils/kst-date.util';

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
   * @param isTest - 테스트 발송 여부 (기본값: false)
   * @returns 전송 결과
   */
  async sendToUser(userId: number, message: PushMessage, isTest: boolean = false) {
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

    // 2. 각 토큰별로 로그 생성 후 전송
    const results: PushSendResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const pushToken of pushTokens) {
      this.logger.debug(
        `🔍 [PushNotificationService] 토큰 확인: tokenId=${pushToken.id}, token=${pushToken.token?.substring(0, 20)}..., deviceId=${pushToken.deviceId}`,
      );

      // 2-1. 로그 미리 생성 (success=true로 가정)
      const logId = await this.createPendingLog(
        pushToken,
        message,
        PushNotificationType.ETC,
        isTest,
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
      this.logger.debug(
        `📤 [PushNotificationService] FCM 전송 시도: token=${pushToken.token ? '있음' : '없음'}`,
      );
      const result = await this.fcmProvider.sendToToken(
        pushToken.token,
        enrichedMessage,
      );
      results.push(result);

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
      `✅ [PushNotificationService] 전송 완료: 성공 ${successCount}/${pushTokens.length}`,
    );

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
   * @param isTest - 테스트 발송 여부 (기본값: false)
   * @returns 전송 결과
   */
  async sendToUsers(userIds: number[], message: PushMessage, isTest: boolean = false) {
    this.logger.log(
      `📤 [PushNotificationService] 다수 유저에게 푸시 전송: ${userIds.length}명, title="${message.title}"`,
    );

    const results = await Promise.all(
      userIds.map((userId) => this.sendToUser(userId, message, isTest)),
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
   * @param isTest - 테스트 발송 여부 (기본값: false)
   * @returns 전송 결과
   */
  async sendToAll(
    message: PushMessage,
    filter?: { marketingEnabled?: boolean },
    isTest: boolean = false,
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

    // 각 토큰별로 로그 생성 후 전송
    const results: PushSendResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const pushToken of pushTokens) {
      const logId = await this.createPendingLog(
        pushToken,
        message,
        PushNotificationType.SYSTEM,
        isTest,
      );

      const enrichedMessage: PushMessage = {
        ...message,
        data: {
          ...message.data,
          logId: logId?.toString(),
        },
      };

      const result = await this.fcmProvider.sendToToken(
        pushToken.token,
        enrichedMessage,
      );
      results.push(result);

      if (logId && !result.success) {
        await this.updateLogWithFailure(logId, result);
      }

      await this.updateTokenStats(pushToken.id, result.success);

      if (this.shouldInvalidateToken(result)) {
        await this.invalidateToken(pushToken, result.errorCode);
      }

      if (result.success) successCount++;
      else failureCount++;
    }

    this.logger.log(
      `✅ [PushNotificationService] 전체 전송 완료: 성공 ${successCount}/${pushTokens.length}`,
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
        invalidatedAt: getNowKST(),
        invalidReason: errorCode,
      },
    });
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

    // 필터 조건 구성
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
    // 테스트 발송 필터 (true: 테스트만, false: 실제 발송만, undefined: 전체)
    if (isTest !== undefined) {
      where.isTest = isTest;
    }

    // 날짜 필터 추가
    if (startDate || endDate) {
      where.sentAt = {};
      if (startDate) {
        where.sentAt.gte = stringToKSTDate(startDate, 0, 0, 0);
      }
      if (endDate) {
        where.sentAt.lte = stringToKSTDate(endDate, 23, 59, 59);
      }
    }

    // 전체 개수 조회
    const total = await this.prisma.pushNotificationLog.count({ where });

    // 로그 조회 (최신순)
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
  }

  /**
   * PushNotificationLog 엔티티를 ResponseDto로 변환
   *
   * @param log - Prisma PushNotificationLog 엔티티
   * @returns PushLogResponseDto
   * @private
   */
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
   *
   * 데이터베이스에서 집계된 통계를 반환합니다
   *
   * @param startDate - 시작 날짜 (YYYY-MM-DD)
   * @param endDate - 종료 날짜 (YYYY-MM-DD)
   * @param isTest - 테스트 발송 필터 (true: 테스트만, false: 실제 발송만, undefined: 전체)
   * @returns 푸시 통계
   */
  async getPushStats(startDate?: string, endDate?: string, isTest?: boolean): Promise<PushStatsResponseDto> {
    this.logger.log(`📊 [PushNotificationService] 푸시 통계 조회 (isTest=${isTest})`);

    // 날짜 필터 구성
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.sentAt = {};
      if (startDate) {
        dateFilter.sentAt.gte = stringToKSTDate(startDate, 0, 0, 0);
      }
      if (endDate) {
        dateFilter.sentAt.lte = stringToKSTDate(endDate, 23, 59, 59);
      }
    }

    // 테스트 발송 필터 (true: 테스트만, false: 실제 발송만, undefined: 전체)
    if (isTest !== undefined) {
      dateFilter.isTest = isTest;
    }

    // WHERE 조건 생성
    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      whereConditions.push(`"sentAt" >= $${paramIndex}`);
      params.push(stringToKSTDate(startDate, 0, 0, 0));
      paramIndex++;
    }
    if (endDate) {
      whereConditions.push(`"sentAt" <= $${paramIndex}`);
      params.push(stringToKSTDate(endDate, 23, 59, 59));
      paramIndex++;
    }
    if (isTest !== undefined) {
      whereConditions.push(`"isTest" = $${paramIndex}`);
      params.push(isTest);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 단일 쿼리로 모든 통계 조회 (6개 쿼리 -> 1개 쿼리)
    const statsQuery = `
      SELECT
        COUNT(*) as "totalSent",
        COUNT(*) FILTER (WHERE success = true) as "successCount",
        COUNT(*) FILTER (WHERE success = false) as "failureCount",
        COUNT(*) FILTER (WHERE "readAt" IS NOT NULL) as "readCount",
        COUNT(*) FILTER (WHERE "clickedAt" IS NOT NULL) as "clickedCount"
      FROM "PushNotificationLog"
      ${whereClause}
    `;

    const typeQuery = `
      SELECT type, COUNT(*) as count
      FROM "PushNotificationLog"
      ${whereClause}
      GROUP BY type
    `;

    // 병렬로 실행
    const [statsResult, typeResult] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(statsQuery, ...params),
      this.prisma.$queryRawUnsafe<any[]>(typeQuery, ...params),
    ]);

    const stats = statsResult[0];
    const totalSent = Number(stats.totalSent);
    const successCount = Number(stats.successCount);
    const failureCount = Number(stats.failureCount);
    const readCount = Number(stats.readCount);
    const clickedCount = Number(stats.clickedCount);

    const byType: Record<string, number> = {};
    typeResult.forEach((item: any) => {
      byType[item.type] = Number(item.count);
    });

    this.logger.log(
      `✅ [PushNotificationService] 통계 조회 완료: 총 ${totalSent}건, 성공 ${successCount}건, 실패 ${failureCount}건, 읽음 ${readCount}건, 클릭 ${clickedCount}건`,
    );

    return {
      totalSent,
      successCount,
      failureCount,
      readCount,
      clickedCount,
      byType,
    };
  }

  /**
   * 푸시 로그 상태 업데이트 (readAt 또는 clickedAt)
   *
   * @param userId - 유저 ID (권한 검증용)
   * @param logId - 로그 ID
   * @param status - 업데이트할 상태 (READ 또는 CLICKED)
   * @returns 업데이트 결과
   */
  async updatePushLogStatus(
    userId: number,
    logId: number,
    status: PushLogStatus,
  ) {
    this.logger.log(
      `📝 [PushNotificationService] 푸시 로그 상태 업데이트: logId=${logId}, status=${status}`,
    );

    // 1. 로그 조회 및 권한 확인
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

    // 2. 상태에 따라 업데이트
    const updateData: any = {};
    if (status === PushLogStatus.READ && !log.readAt) {
      updateData.readAt = getNowKST();
    } else if (status === PushLogStatus.CLICKED && !log.clickedAt) {
      updateData.clickedAt = getNowKST();
      // CLICKED는 READ를 포함하므로 readAt도 함께 설정
      if (!log.readAt) {
        updateData.readAt = getNowKST();
      }
    }

    // 이미 업데이트된 경우
    if (Object.keys(updateData).length === 0) {
      this.logger.log(
        `ℹ️ [PushNotificationService] 이미 업데이트됨: logId=${logId}, status=${status}`,
      );
      return {
        success: true,
        message: '이미 처리된 상태입니다',
      };
    }

    // 3. 업데이트 실행
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
  }

  /**
   * 마케팅 푸시 전송 (래퍼 메서드)
   *
   * Topic 기반으로 마케팅 동의한 유저에게만 푸시 전송
   * 향후 UserConsent.agreeToMarketing 필드 추가시 필터링 로직 보강 예정
   *
   * @param message - 마케팅 푸시 메시지
   * @returns 전송 결과
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

    // 마케팅 Topic으로 전송 (marketing Topic 구독자 = 마케팅 동의자)
    const result = await this.fcmProvider.sendToTopic('marketing', {
      title: message.title,
      body: message.body,
      imageUrl: message.imageUrl,
      data: {
        ...message.data,
        subType: 'MARKETING_BROADCAST', // 세부 타입
      },
    });

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
  }

  /**
   * 푸시 로그 미리 생성 (전송 전)
   *
   * @param pushToken - 푸시 토큰
   * @param message - 푸시 메시지
   * @param type - 푸시 타입
   * @returns 생성된 로그 ID (실패 시 null)
   * @private
   */
  private async createPendingLog(
    pushToken: any,
    message: PushMessage,
    type: PushNotificationType,
    isTest: boolean = false,
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
          isTest, // 테스트 발송 여부
        },
      });
      return log.id;
    } catch (error) {
      this.logger.error(
        `❌ [PushNotificationService] 로그 생성 실패: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * 푸시 로그를 실패로 업데이트
   *
   * @param logId - 로그 ID
   * @param result - FCM 전송 결과
   * @private
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
        `❌ [PushNotificationService] 로그 업데이트 실패: ${error.message}`,
      );
    }
  }

  /**
   * PushToken 상태 업데이트 (lastUsedAt, successCount, failureCount)
   *
   * @param tokenId - 토큰 ID
   * @param success - 전송 성공 여부
   * @private
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
        `❌ [PushNotificationService] 토큰 상태 업데이트 실패: ${error.message}`,
      );
    }
  }
}
