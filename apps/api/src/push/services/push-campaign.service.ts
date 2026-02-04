import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST } from '../../common/utils/kst-date.util';
import { PushScheduleType, PushCampaignType, PushCampaignStatus } from '../enums';
import { QueueService, PushNotificationType } from '../../queues/queue.service';
import { ConditionEvaluatorService } from './condition-evaluator.service';

/**
 * ============================================================================
 * 푸시 알림 캠페인 서비스 (Push Campaign Service)
 * ============================================================================
 *
 * [역할]
 * - 캠페인 생성, 조회, 실행 로직을 담당
 * - 스케줄러에서 호출되어 실제 푸시 발송을 처리
 *
 * [핵심 메서드]
 * - executeScheduledCampaign(): 스케줄 기반 캠페인 실행 (★ 가장 중요)
 * - getTargetUsers(): 타겟팅 조건에 맞는 유저 조회
 *
 * [데이터 흐름] (Python 개발자를 위한 설명)
 * 1. push-scheduler.service.ts에서 이 서비스의 executeScheduledCampaign() 호출
 * 2. DB에서 대상 유저 목록 조회 (getTargetUsers)
 * 3. 캠페인 레코드 생성 (상태: PENDING → PROCESSING)
 * 4. 각 유저에게 푸시 발송 (pushNotificationService.sendToUser)
 * 5. 캠페인 완료 처리 (상태: COMPLETED 또는 FAILED)
 *
 * [DB 테이블 관계]
 * - PushNotificationSchedule: 스케줄 정보 (언제, 어떤 조건으로 발송)
 * - PushNotificationCampaign: 캠페인 실행 기록 (발송 결과)
 * - User: 대상 유저 정보 (characterId = 페르소나 ID)
 * - AiPersona: 페르소나 정보 (personality = 말투 스타일)
 *
 * [스케줄(bodyTemplate) 등록 위치]
 * - 프로젝트: biocom-bo-api (백오피스 API)
 * - 경로: src/push/push-schedule.controller.ts
 * - 어드민 화면: biocom-admin의 푸시 스케줄 관리 페이지에서 bodyTemplate 입력
 * - 흐름: 어드민 → biocom-bo-api (스케줄 저장) → biocom-api (배치 실행)
 *
 * [Prisma ORM 설명]
 * - Python의 SQLAlchemy와 유사한 ORM
 * - this.prisma.user.findMany() = User.query.filter(...).all()
 * - await = Python의 await와 동일 (비동기 처리)
 */
@Injectable()
export class PushCampaignService {
  private readonly logger = new Logger(PushCampaignService.name);

  constructor(
    private readonly prisma: PrismaService, // DB 접근용 (SQLAlchemy의 session과 유사)
    private readonly queueService: QueueService, // MQ를 통한 푸시 발송
    private readonly conditionEvaluator: ConditionEvaluatorService, // 조건 기반 타겟팅
  ) {}

  /**
   * ========================================================================
   * ★★★ 스케줄 기반 캠페인 실행 (핵심 메서드) ★★★
   * ========================================================================
   *
   * [역할]
   * - 스케줄러에서 호출되어 실제 푸시 알림을 발송하는 핵심 로직
   * - 대상 유저 조회 → 캠페인 생성 → 푸시 발송 → 결과 기록
   *
   * [Python 비유]
   * async def execute_scheduled_campaign(self, schedule: dict) -> dict:
   *     # 동일한 로직
   *
   * [TODO - AI 개발자: 페르소나별 말투 적용 위치]
   * 현재: 모든 유저에게 동일한 메시지(schedule.bodyTemplate) 발송
   * 변경: 각 유저의 페르소나(characterId)에 맞는 말투로 메시지 변환 후 발송
   *
   * 구현 방법:
   * 1. getTargetUsers() 수정: userId와 함께 characterId도 반환하도록 변경
   * 2. 각 유저별로 AiPersona.personality 조회
   * 3. AI 모델로 schedule.bodyTemplate을 해당 personality 스타일로 변환
   * 4. 변환된 메시지를 sendToUser()에 전달
   *
   * @param schedule - 실행할 스케줄 (PushNotificationSchedule 레코드)
   * @returns 실행 결과 { success, message, campaignId, sentCount, failureCount }
   */
  async executeScheduledCampaign(schedule: any) {
    const now = getNowKST();
    // campaignKey: 중복 실행 방지용 고유 키 (스케줄ID + 분 단위 시간)
    // 밀리초 단위가 아닌 분 단위로 키를 생성하여 동시 요청 시 중복 방지
    const timeKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const campaignKey = `schedule-${schedule.id}-${timeKey}`;

    this.logger.log(`🚀 [PushCampaignService] 스케줄 캠페인 실행: scheduleId=${schedule.id}, key=${campaignKey}`);

    try {
      // ---------------------------------------------------------------
      // Step 0: 중복 실행 방지
      // - 같은 캠페인이 이미 실행됐는지 확인
      // - DB에 unique constraint가 걸려있어서 중복 생성 불가
      // ---------------------------------------------------------------
      const existing = await this.prisma.pushNotificationCampaign.findUnique({
        where: { campaignKey },
      });

      if (existing) {
        this.logger.warn(`⚠️ [PushCampaignService] 이미 실행됨: campaignKey=${campaignKey}`);
        return { success: false, message: '이미 실행된 캠페인입니다', campaignId: existing.id };
      }

      // ---------------------------------------------------------------
      // Step 0.5: 테스트 모드 체크
      // - isTest=true면 testUserIds에게만 발송
      // - testUserIds가 비어있으면 발송 스킵
      // ---------------------------------------------------------------
      if (schedule.isTest) {
        if (!schedule.testUserIds || schedule.testUserIds.length === 0) {
          this.logger.warn(`⚠️ [PushCampaignService] 테스트 모드지만 testUserIds가 비어있음: scheduleId=${schedule.id}`);
          return { success: false, message: '테스트 모드이지만 테스트 대상 유저가 없습니다', campaignId: null };
        }
        this.logger.log(`🧪 [PushCampaignService] 테스트 모드: ${schedule.testUserIds.length}명에게만 발송`);
      }

      // ---------------------------------------------------------------
      // Step 1: 대상 유저 조회
      // - conditions 배열이 있으면 조건 기반 타겟팅 (AND 조합)
      // - 없으면 targetQuery로 유저 필터링
      // - schedule.bundleId에 맞는 토큰을 가진 유저만 조회
      // - 테스트 모드면 testUserIds로 제한
      // ---------------------------------------------------------------
      let targetUsers: number[];

      // conditions 배열이 있으면 조건 기반 타겟팅 사용
      const conditions = schedule.conditions as Array<{ type: string; params: Record<string, any> }> | null;
      if (conditions && conditions.length > 0) {
        this.logger.log(`🎯 [PushCampaignService] 조건 기반 타겟팅: ${conditions.length}개 조건 (AND)`);
        targetUsers = await this.conditionEvaluator.evaluateConditions({
          id: schedule.id,
          conditions,
        });
        this.logger.log(`🎯 [PushCampaignService] 조건 평가 결과: ${targetUsers.length}명`);
      } else {
        // 기존 targetQuery 방식
        const targetQuery = schedule.targetQuery || {};
        targetUsers = await this.getTargetUsers(targetQuery, schedule.bundleId);
      }

      // 테스트 모드면 testUserIds와 교집합
      if (schedule.isTest && schedule.testUserIds?.length > 0) {
        const testUserSet = new Set(schedule.testUserIds);
        targetUsers = targetUsers.filter((userId) => testUserSet.has(userId));
        this.logger.log(`🧪 [PushCampaignService] 테스트 대상으로 필터링: ${targetUsers.length}명`);
      }

      // ---------------------------------------------------------------
      // Step 2: 캠페인 레코드 생성 (상태: PENDING)
      // - 발송 시작 전에 먼저 DB에 캠페인 기록 생성
      // - 발송 결과를 나중에 업데이트할 예정
      // ---------------------------------------------------------------
      const campaign = await this.prisma.pushNotificationCampaign.create({
        data: {
          scheduleId: schedule.id,
          campaignKey,
          campaignType: schedule.scheduleType === PushScheduleType.ONCE ? PushCampaignType.SCHEDULED : PushCampaignType.RECURRING,
          title: schedule.title,
          body: schedule.bodyTemplate, // 원본 메시지 템플릿
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

      // ---------------------------------------------------------------
      // Step 3: 캠페인 상태 → PROCESSING (발송 중)
      // ---------------------------------------------------------------
      await this.prisma.pushNotificationCampaign.update({
        where: { id: campaign.id },
        data: {
          status: PushCampaignStatus.PROCESSING,
          startedAt: getNowKST(),
        },
      });

      // ---------------------------------------------------------------
      // Step 4: 푸시 발송 (MQ로 비동기 처리)
      // - 대상 유저 전체를 한 번에 MQ Job으로 전달
      // - 실제 FCM 발송은 MQ Worker가 처리
      // ---------------------------------------------------------------
      const job = await this.queueService.addPushToUsers(
        targetUsers,
        {
          title: schedule.title,
          body: schedule.bodyTemplate,
          imageUrl: schedule.imageUrl,
          data: {
            ...schedule.data,
            campaignId: campaign.id,
            pushCode: schedule.pushCode, // GA4 이벤트 추적용
            type: schedule.type, // notification_type용
          },
        },
        PushNotificationType.SYSTEM,
        schedule.isTest ?? false, // 테스트 모드 여부
      );

      this.logger.log(
        `📤 [PushCampaignService] MQ Job 추가 완료: jobId=${job.id}, targetCount=${targetUsers.length}`,
      );

      // MQ에서 비동기 처리되므로 일단 대상 수만큼 성공으로 간주
      // 실제 결과는 MQ Worker에서 로그로 기록됨
      const successCount = targetUsers.length;
      const failureCount = 0;

      // ---------------------------------------------------------------
      // Step 5: 캠페인 상태 → COMPLETED 또는 FAILED
      // - 한 명이라도 성공하면 COMPLETED
      // - 전원 실패하면 FAILED
      // ---------------------------------------------------------------
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

      // ---------------------------------------------------------------
      // Step 6: ONCE 타입 스케줄이면 자동 비활성화
      // - 1회성 발송이므로 다시 실행되지 않도록 isActive=false 처리
      // ---------------------------------------------------------------
      if (schedule.scheduleType === PushScheduleType.ONCE) {
        await this.prisma.pushNotificationSchedule.update({
          where: { id: schedule.id },
          data: { isActive: false },
        });
        this.logger.log(`🔒 [PushCampaignService] ONCE 스케줄 비활성화: scheduleId=${schedule.id}`);
      }

      // ---------------------------------------------------------------
      // Step 7: 스케줄 실행 통계 업데이트
      // - lastExecutedAt: 마지막 실행 시간
      // - executionCount: 총 실행 횟수 (increment = SQL의 +1)
      // ---------------------------------------------------------------
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
   * ========================================================================
   * 타겟팅 쿼리 기반 대상 유저 조회
   * ========================================================================
   *
   * [역할]
   * - 푸시 발송 대상 유저를 DB에서 조회
   * - targetQuery의 조건에 맞는 유저만 필터링
   *
   * [현재 반환값]
   * - number[] (유저 ID 배열)
   *
   * [TODO - AI 개발자: 페르소나 정보도 함께 조회]
   * 현재: userId만 반환
   * 변경: userId와 characterId를 함께 반환하도록 수정 필요
   *
   * 변경 예시:
   *   return users.map((u) => ({
   *     userId: u.id,
   *     characterId: u.characterId  // 유저가 선택한 페르소나 ID
   *   }));
   *
   * [DB 테이블 참고]
   * - User 테이블의 characterId 필드 = AiPersona 테이블의 id를 참조
   * - AiPersona.personality 필드에 말투 스타일 정보가 저장되어 있음
   *
   * @param targetQuery - 타겟팅 조건 (JSON)
   *   - marketingEnabled: boolean (마케팅 수신 동의 여부)
   *   - userIds: number[] (특정 유저 ID 지정)
   * @param bundleId - 대상 앱 번들ID (해당 앱 토큰을 가진 유저만 조회)
   * @returns 유저 ID 배열 (TODO: 페르소나 정보 포함하도록 변경)
   */
  private async getTargetUsers(targetQuery: any, bundleId?: string): Promise<number[]> {
    // Prisma의 where 조건 객체 (Python SQLAlchemy의 filter()와 유사)
    const where: any = {};

    // 마케팅 동의 필터 (targetQuery.marketingEnabled가 지정된 경우)
    if (targetQuery.marketingEnabled !== undefined) {
      where.marketingEnabled = targetQuery.marketingEnabled;
    }

    // 특정 유저 ID 지정 (targetQuery.userIds가 배열로 전달된 경우)
    // SQL: WHERE id IN (1, 2, 3, ...)
    if (targetQuery.userIds && Array.isArray(targetQuery.userIds)) {
      where.id = { in: targetQuery.userIds };
    }

    // ---------------------------------------------------------------
    // DB 쿼리 실행
    // - 활성 푸시 토큰이 있는 유저만 조회 (푸시 토큰 없으면 발송 불가)
    // - bundleId가 지정된 경우 해당 앱의 토큰을 가진 유저만 조회
    //
    // TODO [AI 개발자]: characterId도 select에 추가
    //   select: { id: true, characterId: true }
    // ---------------------------------------------------------------
    const pushTokenWhere: any = { isActive: true };
    if (bundleId) {
      pushTokenWhere.bundleId = bundleId;
      this.logger.log(`🎯 [PushCampaignService] bundleId 필터 적용: ${bundleId}`);
    }

    const users = await this.prisma.user.findMany({
      where: {
        ...where,
        // 푸시 토큰이 활성화된 유저만 (isActive=true인 토큰이 1개 이상)
        // bundleId가 지정된 경우 해당 앱의 토큰을 가진 유저만
        pushTokens: {
          some: pushTokenWhere,
        },
      },
      select: { id: true }, // TODO: characterId도 추가
    });

    // userId 배열로 변환하여 반환
    // TODO [AI 개발자]: { userId, characterId } 객체 배열로 변경
    return users.map((u) => u.id);
  }
}
