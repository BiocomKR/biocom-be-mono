import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from './base.processor';
import { Neo4jService } from '../neo4j/neo4j.service';
import { SleepSyncJob } from '../types/queue.types';
import { SLEEP_SYNC_QUERY } from '../neo4j/queries/sleep.queries';

@Processor('graph-sync-sleep')
export class SleepProcessor extends BaseProcessor {
  constructor(neo4jService: Neo4jService) {
    super(neo4jService);
  }

  async process(job: Job<SleepSyncJob>): Promise<void> {
    await this.preProcess(job);

    try {
      // 필수 필드 검증
      this.validateJobData(job, ['chartId', 'dateId', 'date', 'bedDateTime', 'wakeDateTime']);

      const { chartId, dateId, date, bedDateTime, wakeDateTime, sleepHours } = job.data;

      // Neo4j에 Sleep 노드 저장
      const session = this.neo4jService.getWriteSession();

      try {
        await session.run(SLEEP_SYNC_QUERY, {
          chartId,
          dateId,
          date,
          bedDateTime,
          wakeDateTime,
          sleepHours,
        });

        this.logger.log(`Sleep 노드 동기화 완료: ${dateId} (${sleepHours}시간)`);
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
