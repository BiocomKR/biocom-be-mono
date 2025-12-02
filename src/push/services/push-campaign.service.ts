import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { PushNotificationService } from './push-notification.service';
import { CampaignQueryDto } from '../dto/campaign-query.dto';
import { CampaignResponseDto } from '../dto/campaign-response.dto';
import { getNowKST, stringToKSTDate } from '../../common/utils/kst-date.util';
import { PushScheduleType, PushCampaignType, PushCampaignStatus } from '../enums';

/**
 * 푸시 알림 캠페인 서비스
 *
 * 캠페인 조회 및 실행 로직
 */
@Injectable()
export class PushCampaignService {
  private readonly logger = new Logger(PushCampaignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  /**
   * 캠페인 목록 조회
   */
  async getCampaigns(query: CampaignQueryDto) {
    const { page = 1, limit = 20, scheduleId, campaignType, status, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    this.logger.log(`📋 [PushCampaignService] 캠페인 목록 조회: page=${page}, limit=${limit}`);

    try {
      // 필터 조건
      const where: any = {};
      if (scheduleId !== undefined) where.scheduleId = scheduleId;
      if (campaignType) where.campaignType = campaignType;
      if (status) where.status = status;

      // 날짜 필터
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = stringToKSTDate(startDate, 0, 0, 0);
        }
        if (endDate) {
          where.createdAt.lte = stringToKSTDate(endDate, 23, 59, 59);
        }
      }

      const [campaigns, total] = await Promise.all([
        this.prisma.pushNotificationCampaign.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.pushNotificationCampaign.count({ where }),
      ]);

      this.logger.log(`✅ [PushCampaignService] 조회 완료: ${campaigns.length}개 (전체: ${total}개)`);

      return {
        campaigns: campaigns.map((c) => this.mapToCampaignResponseDto(c)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`❌ [PushCampaignService] 캠페인 목록 조회 실패: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 캠페인 상세 조회
   */
  async getCampaignById(id: number) {
    this.logger.log(`📋 [PushCampaignService] 캠페인 상세 조회: id=${id}`);

    try {
      const campaign = await this.prisma.pushNotificationCampaign.findUnique({
        where: { id },
        include: {
          schedule: true,
          logs: {
            take: 100,
            orderBy: { sentAt: 'desc' },
          },
        },
      });

      if (!campaign) {
        throw new NotFoundException(`캠페인을 찾을 수 없습니다: id=${id}`);
      }

      return campaign;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`❌ [PushCampaignService] 캠페인 조회 실패: id=${id}, ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 스케줄 기반 캠페인 실행
   *
   * @param schedule - 실행할 스케줄
   * @returns 실행 결과
   */
  async executeScheduledCampaign(schedule: any) {
    const now = getNowKST();
    // campaignKey: 중복 실행 방지용 고유 키 (스케줄ID + 분 단위 시간)
    // 밀리초 단위가 아닌 분 단위로 키를 생성하여 동시 요청 시 중복 방지
    const timeKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const campaignKey = `schedule-${schedule.id}-${timeKey}`;

    this.logger.log(`🚀 [PushCampaignService] 스케줄 캠페인 실행: scheduleId=${schedule.id}, key=${campaignKey}`);

    try {
      // 중복 실행 방지
      const existing = await this.prisma.pushNotificationCampaign.findUnique({
        where: { campaignKey },
      });

      if (existing) {
        this.logger.warn(`⚠️ [PushCampaignService] 이미 실행됨: campaignKey=${campaignKey}`);
        return { success: false, message: '이미 실행된 캠페인입니다', campaignId: existing.id };
      }

      // 1. 대상 유저 조회
      const targetQuery = schedule.targetQuery || {};
      const targetUsers = await this.getTargetUsers(targetQuery);

      // 2. 캠페인 생성 (PENDING 상태)
      const campaign = await this.prisma.pushNotificationCampaign.create({
        data: {
          scheduleId: schedule.id,
          campaignKey,
          campaignType: schedule.scheduleType === PushScheduleType.ONCE ? PushCampaignType.SCHEDULED : PushCampaignType.RECURRING,
          title: schedule.title,
          body: schedule.bodyTemplate,
          imageUrl: schedule.imageUrl,
          data: schedule.data,
          type: schedule.type,
          category: schedule.category,
          status: PushCampaignStatus.PENDING,
          targetCount: targetUsers.length,
          scheduledAt: now,
          createdAt: now,
        },
      });

      this.logger.log(`📦 [PushCampaignService] 캠페인 생성 완료: id=${campaign.id}, target=${targetUsers.length}명`);

      // 3. 캠페인 상태 → PROCESSING
      await this.prisma.pushNotificationCampaign.update({
        where: { id: campaign.id },
        data: {
          status: PushCampaignStatus.PROCESSING,
          startedAt: getNowKST(),
        },
      });

      // 4. 푸시 발송 (각 유저별)
      let successCount = 0;
      let failureCount = 0;

      for (const userId of targetUsers) {
        try {
          const result = await this.pushNotificationService.sendToUser(
            userId,
            {
              title: schedule.title,
              body: schedule.bodyTemplate,
              imageUrl: schedule.imageUrl,
              data: {
                ...schedule.data,
                campaignId: campaign.id,
              },
            },
            false, // 실제 발송
          );

          successCount += result.sentCount;
          failureCount += result.failureCount || 0;
        } catch (error) {
          this.logger.error(`❌ [PushCampaignService] 발송 실패: userId=${userId}, error=${error.message}`);
          failureCount++;
        }
      }

      // 5. 캠페인 상태 → COMPLETED/FAILED
      const finalStatus = successCount > 0 ? PushCampaignStatus.COMPLETED : PushCampaignStatus.FAILED;
      await this.prisma.pushNotificationCampaign.update({
        where: { id: campaign.id },
        data: {
          status: finalStatus,
          sentCount: successCount,
          failCount: failureCount,
          completedAt: getNowKST(),
          errorMessage: finalStatus === PushCampaignStatus.FAILED ? '발송에 실패했습니다' : null,
        },
      });

      // 6. ONCE 타입 스케줄이면 자동 비활성화
      if (schedule.scheduleType === PushScheduleType.ONCE) {
        await this.prisma.pushNotificationSchedule.update({
          where: { id: schedule.id },
          data: { isActive: false },
        });
        this.logger.log(`🔒 [PushCampaignService] ONCE 스케줄 비활성화: scheduleId=${schedule.id}`);
      }

      // 7. 스케줄 실행 통계 업데이트
      await this.prisma.pushNotificationSchedule.update({
        where: { id: schedule.id },
        data: {
          lastExecutedAt: now,
          executionCount: { increment: 1 },
        },
      });

      this.logger.log(
        `✅ [PushCampaignService] 캠페인 실행 완료: campaignId=${campaign.id}, status=${finalStatus}, sent=${successCount}, failed=${failureCount}`,
      );

      return {
        success: true,
        message: `캠페인이 실행되었습니다 (성공: ${successCount}, 실패: ${failureCount})`,
        campaignId: campaign.id,
        sentCount: successCount,
        failureCount,
      };
    } catch (error) {
      this.logger.error(
        `❌ [PushCampaignService] 스케줄 캠페인 실행 실패: scheduleId=${schedule.id}, ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 타겟팅 쿼리 기반 대상 유저 조회
   *
   * @param targetQuery - 타겟팅 조건 (JSON)
   * @returns 유저 ID 배열
   */
  private async getTargetUsers(targetQuery: any): Promise<number[]> {
    const where: any = {};

    // marketingEnabled 필터
    if (targetQuery.marketingEnabled !== undefined) {
      where.marketingEnabled = targetQuery.marketingEnabled;
    }

    // userIds 직접 지정
    if (targetQuery.userIds && Array.isArray(targetQuery.userIds)) {
      where.id = { in: targetQuery.userIds };
    }

    // 활성 푸시 토큰이 있는 유저만
    const users = await this.prisma.user.findMany({
      where: {
        ...where,
        pushTokens: {
          some: {
            isActive: true,
          },
        },
      },
      select: { id: true },
    });

    return users.map((u) => u.id);
  }

  /**
   * Prisma 엔티티 → Response DTO 변환
   */
  private mapToCampaignResponseDto(campaign: any): CampaignResponseDto {
    return {
      id: campaign.id,
      scheduleId: campaign.scheduleId,
      campaignKey: campaign.campaignKey,
      campaignType: campaign.campaignType,
      title: campaign.title,
      body: campaign.body,
      imageUrl: campaign.imageUrl,
      data: campaign.data,
      type: campaign.type,
      category: campaign.category,
      status: campaign.status,
      targetCount: campaign.targetCount,
      sentCount: campaign.sentCount,
      failCount: campaign.failCount,
      scheduledAt: campaign.scheduledAt?.toISOString(),
      startedAt: campaign.startedAt?.toISOString(),
      completedAt: campaign.completedAt?.toISOString(),
      cancelledAt: campaign.cancelledAt?.toISOString(),
      cancelReason: campaign.cancelReason,
      errorMessage: campaign.errorMessage,
      createdAt: campaign.createdAt.toISOString(),
      createdBy: campaign.createdBy,
    };
  }
}
