import { Injectable, Logger } from '@nestjs/common';
// import { Cron, CronExpression } from '@nestjs/schedule'; // 미사용
import { PushScheduleService } from './push-schedule.service';
import { PushCampaignService } from './push-campaign.service';
import { getNowKST } from '../../common/utils/kst-date.util';
import CronExpressionParser from 'cron-parser';

/**
 * 푸시 알림 배치 스케줄러
 *
 * @nestjs/schedule을 사용한 크론잡 실행
 */
@Injectable()
export class PushSchedulerService {
  private readonly logger = new Logger(PushSchedulerService.name);

  constructor(
    private readonly pushScheduleService: PushScheduleService,
    private readonly pushCampaignService: PushCampaignService,
  ) {}

  /**
   * 매분마다 실행할 스케줄 확인 및 실행
   *
   * 크론 표현식: '0 * * * * *' = 매분 0초에 실행
   *
   * NOTE: biocom-bo-api에서는 크론 비활성화
   * 실제 배치 실행은 biocom-api에서만 수행
   */
  // @Cron('0 * * * * *', {
  //   name: 'check-push-schedules',
  //   timeZone: 'Asia/Seoul',
  // })
  async handleScheduledPushes() {
    this.logger.log('🕐 [PushScheduler] 스케줄 확인 시작');

    try {
      // 1. 실행 가능한 스케줄 조회
      const schedules = await this.pushScheduleService.getExecutableSchedules();

      if (schedules.length === 0) {
        this.logger.log('ℹ️ [PushScheduler] 실행할 스케줄 없음');
        return;
      }

      this.logger.log(`📋 [PushScheduler] 실행할 스케줄: ${schedules.length}개`);

      // 2. 각 스케줄별로 캠페인 실행
      for (const schedule of schedules) {
        try {
          // ONCE 타입인 경우 실행 조건 확인
          if (schedule.scheduleType === 'ONCE') {
            const scheduledTime = new Date(schedule.oneTimeScheduledAt);
            const now = getNowKST();

            // 예약 시간이 현재 시간보다 이후면 건너뜀
            if (scheduledTime > now) {
              this.logger.log(
                `⏭️ [PushScheduler] ONCE 스케줄 아직 시간 안 됨: scheduleId=${schedule.id}, scheduledAt=${scheduledTime.toISOString()}`,
              );
              continue;
            }
          }

          // RECURRING 타입인 경우 크론 표현식이 현재 시간에 맞는지 검증
          if (schedule.scheduleType === 'RECURRING' && schedule.cronExpression) {
            if (!this.shouldExecuteCron(schedule.cronExpression)) {
              this.logger.debug(
                `⏭️ [PushScheduler] RECURRING 스케줄 크론 조건 불일치: scheduleId=${schedule.id}, cron=${schedule.cronExpression}`,
              );
              continue;
            }
            this.logger.log(
              `🔄 [PushScheduler] RECURRING 스케줄 실행: scheduleId=${schedule.id}, cron=${schedule.cronExpression}`,
            );
          }

          // 캠페인 실행
          const result = await this.pushCampaignService.executeScheduledCampaign(schedule);

          if (result.success) {
            this.logger.log(
              `✅ [PushScheduler] 캠페인 실행 성공: scheduleId=${schedule.id}, campaignId=${result.campaignId}, sent=${result.sentCount}`,
            );
          } else {
            this.logger.warn(
              `⚠️ [PushScheduler] 캠페인 실행 실패 또는 중복: scheduleId=${schedule.id}, message=${result.message}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `❌ [PushScheduler] 스케줄 실행 중 에러: scheduleId=${schedule.id}, error=${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log('✅ [PushScheduler] 스케줄 확인 완료');
    } catch (error) {
      this.logger.error(`❌ [PushScheduler] 스케줄 확인 실패: ${error.message}`, error.stack);
    }
  }

  /**
   * 수동 테스트용 메서드 (개발/테스트 환경)
   *
   * API에서 호출하여 즉시 스케줄 확인 가능
   */
  async triggerScheduleCheck() {
    this.logger.log('🔧 [PushScheduler] 수동 트리거 실행');
    await this.handleScheduledPushes();
    return { success: true, message: '스케줄 확인이 수동으로 트리거되었습니다' };
  }

  /**
   * 크론 표현식이 현재 시간에 실행되어야 하는지 검증
   *
   * @param cronExpression - 크론 표현식
   * @returns 현재 시간에 실행해야 하면 true
   */
  private shouldExecuteCron(cronExpression: string): boolean {
    try {
      const now = getNowKST();

      // 크론 표현식 파싱 (KST 기준)
      const interval = CronExpressionParser.parse(cronExpression, {
        currentDate: now,
        tz: 'Asia/Seoul',
      });

      // 이전 실행 시간 조회
      const prevDate = interval.prev().toDate();

      // 현재 시간과 이전 실행 시간의 차이가 1분 이내면 실행
      const diffMs = now.getTime() - prevDate.getTime();
      const shouldExecute = diffMs >= 0 && diffMs < 60000; // 0~59초 이내

      this.logger.debug(
        `🕐 [PushScheduler] 크론 검증: cron=${cronExpression}, prev=${prevDate.toISOString()}, now=${now.toISOString()}, diff=${diffMs}ms, execute=${shouldExecute}`,
      );

      return shouldExecute;
    } catch (error) {
      this.logger.error(
        `❌ [PushScheduler] 크론 표현식 파싱 실패: cron=${cronExpression}, error=${error.message}`,
      );
      return false;
    }
  }
}
