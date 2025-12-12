import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { QUEUE_NAMES } from './queue-names';

export { QUEUE_NAMES };

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.PUSH_NOTIFICATION }),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueuesModule implements OnModuleInit {
  private readonly logger = new Logger(QueuesModule.name);

  onModuleInit() {
    this.logger.log('QueuesModule initialized with BullMQ');
  }
}
