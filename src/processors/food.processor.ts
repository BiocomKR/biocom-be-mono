import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from './base.processor';
import { Neo4jService } from '../neo4j/neo4j.service';
import { FoodSyncJob } from '../types/queue.types';
import { FOOD_DELETE_QUERY, FOOD_CREATE_QUERY } from '../neo4j/queries/food.queries';

@Processor('graph-sync-food')
export class FoodProcessor extends BaseProcessor {
  constructor(neo4jService: Neo4jService) {
    super(neo4jService);
  }

  async process(job: Job<FoodSyncJob>): Promise<void> {
    await this.preProcess(job);

    try {
      // 필수 필드 검증
      this.validateJobData(job, ['chartId', 'dateId', 'date', 'foods']);

      const { chartId, dateId, date, foods } = job.data;

      // Food 데이터 변환 (JSON 문자열로)
      const foodsData = foods.map((food) => ({
        foodId: food.foodId,
        foodName: food.foodName,
        dietType: food.dietType,
        isFasting: food.isFasting,
        imageUrl: food.imageUrl || null,
        allergyFoods: JSON.stringify(food.allergyFoods),
        allergyScore: food.allergyScore,
        processedCount: food.processedCount,
        processedFoods: JSON.stringify(food.processedFoods),
        highFodmapCount: food.highFodmapCount,
        highFodmapFoods: JSON.stringify(food.highFodmapFoods),
      }));

      // Neo4j에 Food 노드 저장 (트랜잭션)
      const session = this.neo4jService.getWriteSession();

      try {
        await session.writeTransaction(async (tx) => {
          // Step 1: 기존 Food 삭제
          await tx.run(FOOD_DELETE_QUERY, {
            chartId,
            dateId,
          });

          // Step 2: 새 Food 생성
          await tx.run(FOOD_CREATE_QUERY, {
            chartId,
            dateId,
            date,
            foods: foodsData,
          });
        });

        this.logger.log(`Food 노드 동기화 완료: ${dateId} (${foods.length}개)`);
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
