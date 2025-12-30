import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from './queue-names';

/**
 * 푸시 메시지 인터페이스
 */
export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  silent?: boolean;
}

/**
 * 푸시 알림 타입 (비즈니스 관점 분류)
 */
export enum PushNotificationType {
  SYSTEM = 'SYSTEM',
  REMIND = 'REMIND',
  MARKETING = 'MARKETING',
  TRANSACTIONAL = 'TRANSACTIONAL',
  ETC = 'ETC',
}

/**
 * 푸시 알림 Job 데이터 인터페이스
 */
export interface PushNotificationJobData {
  type: 'user' | 'users' | 'all';
  userId?: number;
  userIds?: number[];
  message: PushMessage;
  notificationType?: PushNotificationType;
  isTest?: boolean;
  filter?: {
    marketingEnabled?: boolean;
  };
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.PUSH_NOTIFICATION) private pushQueue: Queue,
  ) {}

  /**
   * 단일 유저에게 푸시 전송 Job 추가
   */
  async addPushToUser(
    userId: number,
    message: PushMessage,
    notificationType: PushNotificationType = PushNotificationType.ETC,
    isTest: boolean = false,
  ) {
    const jobData: PushNotificationJobData = {
      type: 'user',
      userId,
      message,
      notificationType,
      isTest,
    };

    const job = await this.pushQueue.add('send', jobData, {
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
    this.logger.log(`📤 [Queue] push-notification (user) job added: ${job.id}, userId=${userId}`);
    return job;
  }

  /**
   * 다수 유저에게 푸시 전송 Job 추가
   */
  async addPushToUsers(
    userIds: number[],
    message: PushMessage,
    notificationType: PushNotificationType = PushNotificationType.ETC,
    isTest: boolean = false,
  ) {
    const jobData: PushNotificationJobData = {
      type: 'users',
      userIds,
      message,
      notificationType,
      isTest,
    };

    const job = await this.pushQueue.add('send', jobData, {
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
    this.logger.log(`📤 [Queue] push-notification (users) job added: ${job.id}, count=${userIds.length}`);
    return job;
  }

  /**
   * 전체 유저에게 푸시 전송 Job 추가
   */
  async addPushToAll(
    message: PushMessage,
    notificationType: PushNotificationType = PushNotificationType.SYSTEM,
    isTest: boolean = false,
    filter?: { marketingEnabled?: boolean },
  ) {
    const jobData: PushNotificationJobData = {
      type: 'all',
      message,
      notificationType,
      isTest,
      filter,
    };

    const job = await this.pushQueue.add('send', jobData, {
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
    this.logger.log(`📤 [Queue] push-notification (all) job added: ${job.id}`);
    return job;
  }

  // 테스트용 메서드 - Redis 연결만 확인 (실제 job 추가 안 함)
  async testConnection() {
    try {
      const client = await this.pushQueue.client;
      const pong = await client.ping();
      this.logger.log(`Redis ping: ${pong}`);
      return { success: true, ping: pong };
    } catch (error) {
      this.logger.error('Queue connection test failed', error);
      return { success: false, error: error.message };
    }
  }
}
