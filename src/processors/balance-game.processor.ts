import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from './base.processor';
import { Neo4jService } from '../neo4j/neo4j.service';
import { BalanceGameSyncJob } from '../types/queue.types';
import { BALANCE_GAME_DELETE_QUERY, BALANCE_GAME_CREATE_QUERY } from '../neo4j/queries/balance-game.queries';

@Processor('graph-sync-balance-game')
export class BalanceGameProcessor extends BaseProcessor {
  constructor(neo4jService: Neo4jService) {
    super(neo4jService);
  }

  async process(job: Job<BalanceGameSyncJob>): Promise<void> {
    await this.preProcess(job);

    try {
      // 필수 필드 검증
      this.validateJobData(job, ['chartId', 'games']);

      const { chartId, games } = job.data;

      // BalanceGame 데이터 변환
      const gamesData = games.map((game) => ({
        gameId: game.gameId,
        title: game.title,
        description: game.description,
        selectedOption: game.selectedOption,
        keyword: game.keyword,
        linkedProduct: game.linkedProduct,
        playedAt: game.playedAt,
      }));

      // Neo4j에 BalanceGame 노드 저장 (트랜잭션)
      const session = this.neo4jService.getWriteSession();

      try {
        await session.writeTransaction(async (tx) => {
          // Step 1: 기존 BalanceGame 삭제
          await tx.run(BALANCE_GAME_DELETE_QUERY, {
            chartId,
          });

          // Step 2: 새 BalanceGame 생성
          if (gamesData.length > 0) {
            await tx.run(BALANCE_GAME_CREATE_QUERY, {
              chartId,
              balanceGames: gamesData,
            });
          }
        });

        this.logger.log(`BalanceGame 노드 동기화 완료: ${chartId} (${games.length}개)`);
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
