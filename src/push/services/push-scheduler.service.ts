import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PushScheduleService } from './push-schedule.service';
import { PushCampaignService } from './push-campaign.service';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * ============================================================================
 * 푸시 알림 배치 스케줄러 (Push Notification Batch Scheduler)
 * ============================================================================
 *
 * [역할]
 * - 매분(1분마다) 실행되어 발송해야 할 푸시 알림이 있는지 확인
 * - 조건에 맞는 스케줄을 찾아서 캠페인 실행을 트리거
 *
 * [실행 흐름] (Python 개발자를 위한 설명)
 * 1. @Cron 데코레이터 = Python의 APScheduler나 Celery Beat와 유사
 * 2. 매분 0초에 handleScheduledPushes() 함수가 자동 실행됨
 * 3. DB에서 "지금 보내야 할" 스케줄 목록을 조회
 * 4. 각 스케줄마다 PushCampaignService.executeScheduledCampaign() 호출
 *
 * [관련 파일]
 * - push-schedule.service.ts: 스케줄 CRUD 및 조회 로직
 * - push-campaign.service.ts: 실제 캠페인 실행 로직
 * - push-notification.service.ts: FCM 푸시 발송 로직
 *
 * [NestJS 의존성 주입 설명]
 * constructor의 파라미터들은 NestJS가 자동으로 인스턴스를 생성해서 주입함
 * Python의 FastAPI Depends()와 비슷한 개념
 *
 * @nestjs/schedule을 사용한 크론잡 실행
 */
@Injectable() // NestJS에서 이 클래스를 의존성 주입 가능하게 만드는 데코레이터
export class PushSchedulerService {
  // Logger: Python의 logging 모듈과 동일. 클래스 이름을 컨텍스트로 사용
  private readonly logger = new Logger(PushSchedulerService.name);

  /**
   * 생성자 (Constructor)
   * - NestJS가 자동으로 필요한 서비스 인스턴스를 주입해줌
   * - Python FastAPI의 Depends()와 유사한 개념
   *
   * @param pushScheduleService - 스케줄 조회/관리 서비스
   * @param pushCampaignService - 캠페인 실행 서비스
   */
  constructor(
    private readonly pushScheduleService: PushScheduleService,
    private readonly pushCampaignService: PushCampaignService,
  ) {}

  /**
   * ========================================================================
   * 매분마다 실행되는 메인 스케줄러 함수 (Main Scheduler Entry Point)
   * ========================================================================
   *
   * [크론 표현식 설명]
   * '0 * * * * *' = 매분 0초에 실행
   * 형식: 초 분 시 일 월 요일
   *
   * [Python 비유]
   * APScheduler의 CronTrigger와 동일:
   * scheduler.add_job(func, CronTrigger(second=0))
   *
   * [실행 흐름]
   * 1. getExecutableSchedules()로 "지금 발송해야 할" 스케줄 목록 조회
   * 2. 각 스케줄을 순회하며 조건 검사
   * 3. executeScheduledCampaign()으로 실제 푸시 발송
   */
  @Cron('0 * * * * *', {
    name: 'check-push-schedules',
    timeZone: 'Asia/Seoul', // 한국 시간 기준으로 실행
  })
  async handleScheduledPushes() {
    this.logger.log('🕐 [PushScheduler] 스케줄 확인 시작');

    try {
      // ---------------------------------------------------------------
      // Step 1: DB에서 실행 가능한 스케줄 목록 조회
      // - isActive=true인 스케줄만 조회
      // - ONCE 타입: 예약 시간이 지난 것
      // - RECURRING 타입: 기간 내에 있는 것
      // ---------------------------------------------------------------
      const schedules = await this.pushScheduleService.getExecutableSchedules();

      if (schedules.length === 0) {
        this.logger.log('ℹ️ [PushScheduler] 실행할 스케줄 없음');
        return;
      }

      this.logger.log(`📋 [PushScheduler] 실행할 스케줄: ${schedules.length}개`);

      // ---------------------------------------------------------------
      // Step 2: 각 스케줄별로 캠페인 실행
      // - Python의 for loop과 동일
      // - async/await = Python의 await와 동일
      // ---------------------------------------------------------------
      for (const schedule of schedules) {
        try {
          // ---------------------------------------------------------
          // ONCE 타입: 1회성 예약 발송
          // - 관리자가 특정 시간에 1번만 보내도록 설정한 푸시
          // - 예약 시간이 아직 안 됐으면 건너뜀
          // ---------------------------------------------------------
          if (schedule.scheduleType === 'ONCE') {
            const scheduledTime = new Date(schedule.oneTimeScheduledAt);
            const now = getNowKST();

            // 예약 시간이 현재 시간보다 이후면 건너뜀
            if (scheduledTime > now) {
              this.logger.log(
                `⏭️ [PushScheduler] ONCE 스케줄 아직 시간 안 됨: scheduleId=${schedule.id}, scheduledAt=${scheduledTime.toISOString()}`,
              );
              continue; // Python의 continue와 동일
            }
          }

          // ---------------------------------------------------------
          // RECURRING 타입: 반복 발송
          // - 크론 표현식으로 정의된 반복 발송
          // - 중복 방지는 campaignKey로 처리 (push-campaign.service.ts 참고)
          // ---------------------------------------------------------
          if (schedule.scheduleType === 'RECURRING' && schedule.cronExpression) {
            this.logger.log(
              `🔄 [PushScheduler] RECURRING 스케줄 실행: scheduleId=${schedule.id}, cron=${schedule.cronExpression}`,
            );
          }

          // ---------------------------------------------------------
          // ★★★ 캠페인 실행 (핵심 로직) ★★★
          // → push-campaign.service.ts의 executeScheduledCampaign() 호출
          // → 여기서 실제 푸시 메시지 생성 및 발송이 이루어짐
          //
          // TODO [AI 개발자]: 페르소나별 말투 적용은 여기서 시작
          // schedule 객체에서 대상 유저 정보를 가져오고,
          // 각 유저의 characterId(페르소나)를 조회하여
          // 말투를 변환한 메시지를 전달해야 함
          // ---------------------------------------------------------
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
}
