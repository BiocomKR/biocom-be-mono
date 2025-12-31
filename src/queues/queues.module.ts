import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { AppEventProcessor } from '../processors/app-event.processor';
import { PushNotificationProcessor } from '../processors/push-notification.processor';
import { OrderSyncProcessor } from '../processors/order-sync.processor';
import { HealthCheckProcessor } from '../processors/health-check.processor';
import { FirebaseAdminModule } from '../push/firebase-admin.module';
import { FcmProvider } from '../push/providers/fcm.provider';

/**
 * Queue 설정
 */
export const QUEUE_OPTIONS = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
};

@Module({
  imports: [
    // Firebase Admin SDK
    FirebaseAdminModule,

    // App Event Queue
    BullModule.registerQueue({
      name: 'app-event',
      ...QUEUE_OPTIONS,
    }),

    // Push Notification Queue
    BullModule.registerQueue({
      name: 'push-notification',
      ...QUEUE_OPTIONS,
    }),

    // Order Sync Queue
    BullModule.registerQueue({
      name: 'order-sync',
      ...QUEUE_OPTIONS,
    }),

    // Health Check Queue
    BullModule.registerQueue({
      name: 'health-check',
      ...QUEUE_OPTIONS,
    }),

    // Bull Board - Queue 모니터링
    BullBoardModule.forFeature({
      name: 'app-event',
      adapter: BullMQAdapter as any,
    }),
    BullBoardModule.forFeature({
      name: 'push-notification',
      adapter: BullMQAdapter as any,
    }),
    BullBoardModule.forFeature({
      name: 'order-sync',
      adapter: BullMQAdapter as any,
    }),
  ],
  providers: [AppEventProcessor, PushNotificationProcessor, OrderSyncProcessor, HealthCheckProcessor, FcmProvider],
  exports: [],
})
export class QueuesModule {}
