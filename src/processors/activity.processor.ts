import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from './base.processor';
import { Neo4jService } from '../neo4j/neo4j.service';
import { ActivitySyncJob } from '../types/queue.types';
import {
  ACTIVITY_DELETE_QUERY,
  DAILY_ACTIVITY_SYNC_QUERY,
  ACTIVITY_CREATE_QUERY,
} from '../neo4j/queries/activity.queries';

@Processor('graph-sync-activity')
export class ActivityProcessor extends BaseProcessor {
  constructor(neo4jService: Neo4jService) {
    super(neo4jService);
  }

  async process(job: Job<ActivitySyncJob>): Promise<void> {
    await this.preProcess(job);

    try {
      // 필수 필드 검증
      this.validateJobData(job, [
        'chartId',
        'dateId',
        'date',
        'totalCalories',
        'activityCount',
        'activities',
      ]);

      const {
        chartId,
        dateId,
        date,
        totalCalories,
        activityCount,
        totalDurationMinutes,
        activities,
      } = job.data;

      // Activity 데이터 변환
      const activitiesData = activities.map((activity) => ({
        activityId: activity.activityId,
        activityTypeCode: activity.activityTypeCode,
        name: activity.name,
        activityTime: activity.activityTime,
        durationMinutes: activity.durationMinutes,
        caloriesBurned: activity.estimatedCalories,
        imageUrl: activity.imageUrl || null,
      }));

      // Neo4j에 Activity 노드 저장 (트랜잭션)
      const session = this.neo4jService.getWriteSession();

      try {
        await session.writeTransaction(async (tx) => {
          // Step 1: 기존 Activity 삭제
          await tx.run(ACTIVITY_DELETE_QUERY, {
            chartId,
            dateId,
          });

          // Step 2: DailyActivity 업데이트
          await tx.run(DAILY_ACTIVITY_SYNC_QUERY, {
            chartId,
            dateId,
            date,
            totalCalories,
            activityCount,
            totalDurationMinutes,
          });

          // Step 3: 새 Activity 생성
          if (activitiesData.length > 0) {
            await tx.run(ACTIVITY_CREATE_QUERY, {
              dateId,
              activities: activitiesData,
            });
          }
        });

        this.logger.log(`Activity 노드 동기화 완료: ${dateId} (${activities.length}개)`);
      } finally {
        await session.close();
      }

      await this.postProcess(job);
    } catch (error) {
      await this.handleError(job, error);
      throw error; // BullMQ 재시도 트리거
    }
  }
}
