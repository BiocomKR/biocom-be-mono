import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from './base.processor';
import { Neo4jService } from '../neo4j/neo4j.service';
import { SupplementSyncJob } from '../types/queue.types';
import {
  SUPPLEMENT_DELETE_QUERY,
  SUPPLEMENT_CREATE_QUERY,
} from '../neo4j/queries/supplement.queries';

@Processor('graph-sync-supplement')
export class SupplementProcessor extends BaseProcessor {
  constructor(neo4jService: Neo4jService) {
    super(neo4jService);
  }

  async process(job: Job<SupplementSyncJob>): Promise<void> {
    await this.preProcess(job);

    try {
      // 필수 필드 검증
      this.validateJobData(job, ['chartId', 'dateId', 'date', 'supplements']);

      const { chartId, dateId, date, supplements } = job.data;

      // Supplement 데이터 변환
      const supplementsData = supplements.map((supplement) => ({
        supplementId: supplement.supplementId,
        supplementName: supplement.supplementName,
        intakeCount: supplement.intakeCount,
        recommendedCount: supplement.recommendedCount,
        nutrients: supplement.nutrients,
      }));

      // Neo4j에 Supplement 노드 저장 (트랜잭션)
      const session = this.neo4jService.getWriteSession();

      try {
        await session.writeTransaction(async (tx) => {
          // Step 1: 기존 Supplement 삭제
          await tx.run(SUPPLEMENT_DELETE_QUERY, {
            chartId,
            dateId,
          });

          // Step 2: 새 Supplement 생성
          if (supplementsData.length > 0) {
            await tx.run(SUPPLEMENT_CREATE_QUERY, {
              chartId,
              dateId,
              date,
              supplements: supplementsData,
            });
          }
        });

        this.logger.log(
          `Supplement 노드 동기화 완료: ${chartId} (${supplements.length}개)`,
        );
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
