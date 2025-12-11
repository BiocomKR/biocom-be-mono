import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from './queue-names';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.APP_EVENT) private appEventQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PUSH_NOTIFICATION) private pushQueue: Queue,
  ) {}

  async addAppEvent(data: {
    eventType: string;
    userId?: string;
    payload?: Record<string, any>;
  }) {
    const job = await this.appEventQueue.add('app-event', data, {
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
    this.logger.log(`Added app-event job: ${job.id}`);
    return job;
  }

  async addPushNotification(data: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, any>;
  }) {
    const job = await this.pushQueue.add('push-notification', data, {
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
    this.logger.log(`Added push-notification job: ${job.id}`);
    return job;
  }

  // 테스트용 메서드
  async testConnection() {
    try {
      const job = await this.appEventQueue.add('test', { test: true, timestamp: new Date().toISOString() });
      this.logger.log(`Test job added: ${job.id}`);
      return { success: true, jobId: job.id };
    } catch (error) {
      this.logger.error('Queue connection test failed', error);
      return { success: false, error: error.message };
    }
  }
}
