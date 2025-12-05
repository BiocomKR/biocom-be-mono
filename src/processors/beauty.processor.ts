import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from './base.processor';
import { Neo4jService } from '../neo4j/neo4j.service';
import { BeautySyncJob } from '../types/queue.types';
import { BEAUTY_SYNC_QUERY } from '../neo4j/queries/beauty.queries';

@Processor('graph-sync-beauty')
export class BeautyProcessor extends BaseProcessor {
  constructor(neo4jService: Neo4jService) {
    super(neo4jService);
  }

  async process(job: Job<BeautySyncJob>): Promise<void> {
    await this.preProcess(job);

    try {
      // 필수 필드 검증
      this.validateJobData(job, ['chartId', 'dateId', 'date', 'totalScore']);

      const {
        chartId,
        dateId,
        date,
        totalScore,
        innerBeautyScore,
        outerBeautyScore,
        innerBeautyDetails,
        outerBeautyDetails,
      } = job.data;

      // Neo4j에 Beauty 노드 저장
      const session = this.neo4jService.getWriteSession();

      try {
        await session.run(BEAUTY_SYNC_QUERY, {
          chartId,
          dateId,
          date,
          totalScore,
          innerBeautyScore,
          outerBeautyScore,
          innerBeautyDetails: JSON.stringify(innerBeautyDetails),
          outerBeautyDetails: JSON.stringify(outerBeautyDetails),
        });

        this.logger.log(`Beauty 노드 동기화 완료: ${dateId} (점수: ${totalScore})`);
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
