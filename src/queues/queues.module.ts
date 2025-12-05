import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { UserProcessor } from '../processors/user.processor';
import { BeautyProcessor } from '../processors/beauty.processor';
import { FoodProcessor } from '../processors/food.processor';
import { FastingProcessor } from '../processors/fasting.processor';
import { SleepProcessor } from '../processors/sleep.processor';
import { ActivityProcessor } from '../processors/activity.processor';
import { AllergyProcessor } from '../processors/allergy.processor';
import { MissionProcessor } from '../processors/mission.processor';
import { BalanceGameProcessor } from '../processors/balance-game.processor';
import { SupplementProcessor } from '../processors/supplement.processor';

/**
 * Queue 설정
 */
const QUEUE_OPTIONS = {
  defaultJobOptions: {
    attempts: 3, // 최대 재시도 3회
    backoff: {
      type: 'exponential' as const,
      delay: 1000, // 1초 -> 2초 -> 4초
    },
    removeOnComplete: 100, // 완료된 Job 100개만 유지
    removeOnFail: 1000, // 실패한 Job 1000개 유지 (디버깅용)
  },
};

@Module({
  imports: [
    // User Queue
    BullModule.registerQueue({
      name: 'graph-sync-user',
      ...QUEUE_OPTIONS,
    }),

    // Beauty Queue
    BullModule.registerQueue({
      name: 'graph-sync-beauty',
      ...QUEUE_OPTIONS,
    }),

    // Food Queue
    BullModule.registerQueue({
      name: 'graph-sync-food',
      ...QUEUE_OPTIONS,
    }),

    // Fasting Queue
    BullModule.registerQueue({
      name: 'graph-sync-fasting',
      ...QUEUE_OPTIONS,
    }),

    // Sleep Queue
    BullModule.registerQueue({
      name: 'graph-sync-sleep',
      ...QUEUE_OPTIONS,
    }),

    // Activity Queue
    BullModule.registerQueue({
      name: 'graph-sync-activity',
      ...QUEUE_OPTIONS,
    }),

    // Allergy Queue
    BullModule.registerQueue({
      name: 'graph-sync-allergy',
      ...QUEUE_OPTIONS,
    }),

    // Mission Queue
    BullModule.registerQueue({
      name: 'graph-sync-mission',
      ...QUEUE_OPTIONS,
    }),

    // BalanceGame Queue
    BullModule.registerQueue({
      name: 'graph-sync-balance-game',
      ...QUEUE_OPTIONS,
    }),

    // Supplement Queue
    BullModule.registerQueue({
      name: 'graph-sync-supplement',
      ...QUEUE_OPTIONS,
    }),

    // Bull Board - Queue 모니터링
    BullBoardModule.forFeature({
      name: 'graph-sync-user',
      adapter: BullMQAdapter as any,
    }),
    BullBoardModule.forFeature({
      name: 'graph-sync-beauty',
      adapter: BullMQAdapter as any,
    }),
    BullBoardModule.forFeature({
      name: 'graph-sync-food',
      adapter: BullMQAdapter as any,
    }),
    BullBoardModule.forFeature({
      name: 'graph-sync-fasting',
      adapter: BullMQAdapter as any,
    }),
    BullBoardModule.forFeature({
      name: 'graph-sync-sleep',
      adapter: BullMQAdapter as any,
    }),
    BullBoardModule.forFeature({
      name: 'graph-sync-activity',
      adapter: BullMQAdapter as any,
    }),
    BullBoardModule.forFeature({
      name: 'graph-sync-allergy',
      adapter: BullMQAdapter as any,
    }),
    BullBoardModule.forFeature({
      name: 'graph-sync-mission',
      adapter: BullMQAdapter as any,
    }),
    BullBoardModule.forFeature({
      name: 'graph-sync-balance-game',
      adapter: BullMQAdapter as any,
    }),
    BullBoardModule.forFeature({
      name: 'graph-sync-supplement',
      adapter: BullMQAdapter as any,
    }),
  ],
  providers: [
    UserProcessor,
    BeautyProcessor,
    FoodProcessor,
    FastingProcessor,
    SleepProcessor,
    ActivityProcessor,
    AllergyProcessor,
    MissionProcessor,
    BalanceGameProcessor,
    SupplementProcessor,
  ],
  exports: [],
})
export class QueuesModule {}
