import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from './base.processor';
import { Neo4jService } from '../neo4j/neo4j.service';
import { FastingSyncJob } from '../types/queue.types';
import { FASTING_SYNC_QUERY } from '../neo4j/queries/fasting.queries';

@Processor('graph-sync-fasting')
export class FastingProcessor extends BaseProcessor {
  constructor(neo4jService: Neo4jService) {
    super(neo4jService);
  }

  async process(job: Job<FastingSyncJob>): Promise<void> {
    await this.preProcess(job);

    try {
      // 필수 필드 검증
      this.validateJobData(job, ['chartId', 'dateId', 'date', 'startDateTime', 'endDateTime']);

      const { chartId, dateId, date, startDateTime, endDateTime, fastingHours } = job.data;

      // Neo4j에 Fasting 노드 저장
      const session = this.neo4jService.getWriteSession();

      try {
        await session.run(FASTING_SYNC_QUERY, {
          chartId,
          dateId,
          date,
          startDateTime,
          endDateTime,
          fastingHours,
        });

        this.logger.log(`Fasting 노드 동기화 완료: ${dateId} (${fastingHours}시간)`);
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
