import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { QueueTestController } from './queue-test.controller';
import { QUEUE_NAMES } from './queue-names';

export { QUEUE_NAMES };

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.APP_EVENT },
      { name: QUEUE_NAMES.PUSH_NOTIFICATION },
      { name: QUEUE_NAMES.ORDER_SYNC },
      { name: QUEUE_NAMES.HEALTH_CHECK },
      { name: QUEUE_NAMES.ALLERGY_SYNC },
    ),
  ],
  controllers: [QueueTestController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueuesModule implements OnModuleInit {
  private readonly logger = new Logger(QueuesModule.name);

  onModuleInit() {
    this.logger.log('QueuesModule initialized with BullMQ');
  }
}
