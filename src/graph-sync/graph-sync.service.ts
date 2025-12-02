/**
 * GraphDB 동기화 서비스 (BullMQ Producer)
 *
 * @description
 * - biocom-api에서 발생한 데이터 변경을 GraphDB에 동기화
 * - Fire-and-Forget 패턴: Queue에 Job만 추가하고 즉시 리턴
 * - 총 10개 Queue별 sync 메서드 제공
 *
 * @usage
 * ```typescript
 * // Controller에서 사용 예시
 * await this.graphSyncService.syncUser({
 *   chartId: user.chartId,
 *   name: user.name,
 *   // ...
 * });
 * ```
 *
 * @author Claude Code
 * @date 2025-12-01
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  UserSyncJob,
  BeautySyncJob,
  FoodSyncJob,
  FastingSyncJob,
  SleepSyncJob,
  ActivitySyncJob,
  AllergyReportSyncJob,
  MissionSyncJob,
  BalanceGameSyncJob,
  SupplementSyncJob,
} from './types/queue.types';

@Injectable()
export class GraphSyncService {
  private readonly logger = new Logger(GraphSyncService.name);

  constructor(
    @InjectQueue('graph-sync-user') private userQueue: Queue,
    @InjectQueue('graph-sync-beauty') private beautyQueue: Queue,
    @InjectQueue('graph-sync-food') private foodQueue: Queue,
    @InjectQueue('graph-sync-fasting') private fastingQueue: Queue,
    @InjectQueue('graph-sync-sleep') private sleepQueue: Queue,
    @InjectQueue('graph-sync-activity') private activityQueue: Queue,
    @InjectQueue('graph-sync-allergy') private allergyReportQueue: Queue,
    @InjectQueue('graph-sync-mission') private missionQueue: Queue,
    @InjectQueue('graph-sync-balance-game') private balanceGameQueue: Queue,
    @InjectQueue('graph-sync-supplement') private supplementQueue: Queue,
  ) {}

  /**
   * 1. 사용자 정보 동기화
   *
   * @param data - UserSyncJob 데이터
   * @returns void (Fire-and-Forget)
   *
   * @example
   * await this.graphSyncService.syncUser({
   *   chartId: 'CHART_001',
   *   name: '홍길동',
   *   innerBeautyType: 'TYPE_A',
   *   outerBeautyType: 'TYPE_B',
   *   gender: 'M',
   *   age: 30,
   * });
   */
  async syncUser(data: UserSyncJob): Promise<void> {
    try {
      await this.userQueue.add('sync', data);
      this.logger.log(`✅ User Queue 추가 완료: chartId=${data.chartId}`);
    } catch (error: any) {
      this.logger.error(
        `❌ User Queue 추가 실패: chartId=${data.chartId}, error=${error.message}`,
      );
    }
  }

  /**
   * 2. 뷰티 점수 동기화
   *
   * @param data - BeautySyncJob 데이터
   * @returns void (Fire-and-Forget)
   *
   * @example
   * await this.graphSyncService.syncBeauty({
   *   chartId: 'CHART_001',
   *   dateId: '20251128',
   *   date: '2025-11-28',
   *   totalScore: 85,
   *   // ...
   * });
   */
  async syncBeauty(data: BeautySyncJob): Promise<void> {
    try {
      await this.beautyQueue.add('sync', data);
      this.logger.log(
        `✅ Beauty Queue 추가 완료: chartId=${data.chartId}, date=${data.date}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Beauty Queue 추가 실패: chartId=${data.chartId}, error=${error.message}`,
      );
    }
  }

  /**
   * 3. 음식 섭취 기록 동기화
   *
   * @param data - FoodSyncJob 데이터
   * @returns void (Fire-and-Forget)
   *
   * @example
   * await this.graphSyncService.syncFood({
   *   chartId: 'CHART_001',
   *   dateId: '20251128',
   *   date: '2025-11-28',
   *   foods: [{ ... }],
   * });
   */
  async syncFood(data: FoodSyncJob): Promise<void> {
    try {
      await this.foodQueue.add('sync', data);
      this.logger.log(
        `✅ Food Queue 추가 완료: chartId=${data.chartId}, date=${data.date}, foods=${data.foods.length}개`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Food Queue 추가 실패: chartId=${data.chartId}, error=${error.message}`,
      );
    }
  }

  /**
   * 4. 단식 기록 동기화
   *
   * @param data - FastingSyncJob 데이터
   * @returns void (Fire-and-Forget)
   *
   * @example
   * await this.graphSyncService.syncFasting({
   *   chartId: 'CHART_001',
   *   dateId: '20251128',
   *   date: '2025-11-28',
   *   startDateTime: '2025-11-28T20:00:00',
   *   endDateTime: '2025-11-29T12:00:00',
   *   fastingHours: 16,
   *   isFastingDay: true,
   * });
   */
  async syncFasting(data: FastingSyncJob): Promise<void> {
    try {
      await this.fastingQueue.add('sync', data);
      this.logger.log(
        `✅ Fasting Queue 추가 완료: chartId=${data.chartId}, date=${data.date}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Fasting Queue 추가 실패: chartId=${data.chartId}, error=${error.message}`,
      );
    }
  }

  /**
   * 5. 수면 기록 동기화
   *
   * @param data - SleepSyncJob 데이터
   * @returns void (Fire-and-Forget)
   *
   * @example
   * await this.graphSyncService.syncSleep({
   *   chartId: 'CHART_001',
   *   dateId: '20251128',
   *   date: '2025-11-28',
   *   bedDateTime: '2025-11-28T23:00:00',
   *   wakeDateTime: '2025-11-29T07:00:00',
   *   sleepHours: 8,
   *   sleepQuality: 'GOOD',
   * });
   */
  async syncSleep(data: SleepSyncJob): Promise<void> {
    try {
      await this.sleepQueue.add('sync', data);
      this.logger.log(
        `✅ Sleep Queue 추가 완료: chartId=${data.chartId}, date=${data.date}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Sleep Queue 추가 실패: chartId=${data.chartId}, error=${error.message}`,
      );
    }
  }

  /**
   * 6. 운동 기록 동기화
   *
   * @param data - ActivitySyncJob 데이터
   * @returns void (Fire-and-Forget)
   *
   * @example
   * await this.graphSyncService.syncActivity({
   *   chartId: 'CHART_001',
   *   dateId: '20251128',
   *   date: '2025-11-28',
   *   totalCalories: 500,
   *   activityCount: 2,
   *   totalDurationMinutes: 60,
   *   activities: [{ ... }],
   * });
   */
  async syncActivity(data: ActivitySyncJob): Promise<void> {
    try {
      await this.activityQueue.add('sync', data);
      this.logger.log(
        `✅ Activity Queue 추가 완료: chartId=${data.chartId}, date=${data.date}, activities=${data.activities.length}개`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Activity Queue 추가 실패: chartId=${data.chartId}, error=${error.message}`,
      );
    }
  }

  /**
   * 7. 알레르기 검사 결과 동기화
   *
   * @param data - AllergyReportSyncJob 데이터
   * @returns void (Fire-and-Forget)
   *
   * @example
   * await this.graphSyncService.syncAllergyReport({
   *   chartId: 'CHART_001',
   *   testDate: '2025-11-28',
   *   allergenCount: 5,
   *   allergenDetails: [{ ... }],
   *   hasTestResult: true,
   * });
   */
  async syncAllergyReport(data: AllergyReportSyncJob): Promise<void> {
    try {
      await this.allergyReportQueue.add('sync', data);
      this.logger.log(
        `✅ Allergy Report Queue 추가 완료: chartId=${data.chartId}, testDate=${data.testDate}`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Allergy Report Queue 추가 실패: chartId=${data.chartId}, error=${error.message}`,
      );
    }
  }

  /**
   * 8. 미션 목록 동기화
   *
   * @param data - MissionSyncJob 데이터
   * @returns void (Fire-and-Forget)
   *
   * @example
   * await this.graphSyncService.syncMissions({
   *   chartId: 'CHART_001',
   *   missions: [{ ... }],
   * });
   */
  async syncMissions(data: MissionSyncJob): Promise<void> {
    try {
      await this.missionQueue.add('sync', data);
      this.logger.log(
        `✅ Mission Queue 추가 완료: chartId=${data.chartId}, missions=${data.missions.length}개`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Mission Queue 추가 실패: chartId=${data.chartId}, error=${error.message}`,
      );
    }
  }

  /**
   * 9. 밸런스 게임 결과 동기화
   *
   * @param data - BalanceGameSyncJob 데이터
   * @returns void (Fire-and-Forget)
   *
   * @example
   * await this.graphSyncService.syncBalanceGames({
   *   chartId: 'CHART_001',
   *   balanceGames: [{ ... }],
   * });
   */
  async syncBalanceGames(data: BalanceGameSyncJob): Promise<void> {
    try {
      await this.balanceGameQueue.add('sync', data);
      this.logger.log(
        `✅ Balance Game Queue 추가 완료: chartId=${data.chartId}, games=${data.balanceGames.length}개`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Balance Game Queue 추가 실패: chartId=${data.chartId}, error=${error.message}`,
      );
    }
  }

  /**
   * 10. 영양제 섭취 기록 동기화
   *
   * @param data - SupplementSyncJob 데이터
   * @returns void (Fire-and-Forget)
   *
   * @example
   * await this.graphSyncService.syncSupplement({
   *   chartId: 'CHART_001',
   *   dateId: '20251128',
   *   date: '2025-11-28',
   *   supplements: [{ ... }],
   * });
   */
  async syncSupplement(data: SupplementSyncJob): Promise<void> {
    try {
      await this.supplementQueue.add('sync', data);
      this.logger.log(
        `✅ Supplement Queue 추가 완료: chartId=${data.chartId}, date=${data.date}, supplements=${data.supplements.length}개`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Supplement Queue 추가 실패: chartId=${data.chartId}, error=${error.message}`,
      );
    }
  }
}
