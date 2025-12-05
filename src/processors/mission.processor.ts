import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from './base.processor';
import { Neo4jService } from '../neo4j/neo4j.service';
import { MissionSyncJob } from '../types/queue.types';
import { MISSION_DELETE_QUERY, MISSION_CREATE_QUERY } from '../neo4j/queries/mission.queries';

@Processor('graph-sync-mission')
export class MissionProcessor extends BaseProcessor {
  constructor(neo4jService: Neo4jService) {
    super(neo4jService);
  }

  async process(job: Job<MissionSyncJob>): Promise<void> {
    await this.preProcess(job);

    try {
      // 필수 필드 검증
      this.validateJobData(job, ['chartId', 'missions']);

      const { chartId, missions } = job.data;

      // Mission 데이터 변환
      const missionsData = missions.map((mission) => ({
        missionId: mission.missionId,
        content: mission.content,
        missionType: mission.missionType,
        orderIndex: mission.orderIndex,
      }));

      // Neo4j에 Mission 노드 저장 (트랜잭션)
      const session = this.neo4jService.getWriteSession();

      try {
        await session.writeTransaction(async (tx) => {
          // Step 1: 기존 Mission 삭제
          await tx.run(MISSION_DELETE_QUERY, {
            chartId,
          });

          // Step 2: 새 Mission 생성
          if (missionsData.length > 0) {
            await tx.run(MISSION_CREATE_QUERY, {
              chartId,
              missions: missionsData,
            });
          }
        });

        this.logger.log(`Mission 노드 동기화 완료: ${chartId} (${missions.length}개)`);
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
