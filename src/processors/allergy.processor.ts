import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from './base.processor';
import { Neo4jService } from '../neo4j/neo4j.service';
import { AllergyReportSyncJob } from '../types/queue.types';
import { ALLERGY_SYNC_QUERY } from '../neo4j/queries/allergy.queries';

@Processor('graph-sync-allergy')
export class AllergyProcessor extends BaseProcessor {
  constructor(neo4jService: Neo4jService) {
    super(neo4jService);
  }

  async process(job: Job<AllergyReportSyncJob>): Promise<void> {
    await this.preProcess(job);

    try {
      // 필수 필드 검증
      this.validateJobData(job, ['chartId', 'reportId']);

      const { chartId, reportId, level1Foods, level2Foods, level3Foods, level4Foods, level5Foods, testedAt } = job.data;

      // Neo4j에 AllergyReport 노드 저장
      const session = this.neo4jService.getWriteSession();

      try {
        await session.run(ALLERGY_SYNC_QUERY, {
          chartId,
          reportId,
          level1Foods,
          level2Foods,
          level3Foods,
          level4Foods,
          level5Foods,
          testedAt: testedAt || null,
        });

        this.logger.log(`AllergyReport 노드 동기화 완료: ${chartId}`);
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
