import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from './base.processor';
import { Neo4jService } from '../neo4j/neo4j.service';
import { UserSyncJob } from '../types/queue.types';
import { USER_SYNC_QUERY } from '../neo4j/queries/user.queries';

@Processor('graph-sync-user')
export class UserProcessor extends BaseProcessor {
  constructor(neo4jService: Neo4jService) {
    super(neo4jService);
  }

  async process(job: Job<UserSyncJob>): Promise<void> {
    await this.preProcess(job);

    try {
      // 필수 필드 검증
      this.validateJobData(job, ['chartId']);

      const { chartId, name, innerBeautyType, aiCoachType, mbti, selfDeclaration, praiseMessage } =
        job.data;

      // Neo4j에 User 노드 저장
      const session = this.neo4jService.getWriteSession();

      try {
        await session.run(USER_SYNC_QUERY, {
          chartId,
          name: name || null,
          innerBeautyType: innerBeautyType || null,
          aiCoachType: aiCoachType || null,
          mbti: mbti || null,
          selfDeclaration: selfDeclaration || null,
          praiseMessage: praiseMessage || null,
        });

        this.logger.log(`User 노드 동기화 완료: ${chartId}`);
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
