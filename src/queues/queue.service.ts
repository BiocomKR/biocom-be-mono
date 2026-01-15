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

/**
 * 주문 동기화 Job 데이터 인터페이스
 */
export interface OrderSyncJobData {
  orderId: number;
  playautoData: {
    status: string;
    carrier?: string;
    trackingNumber?: string;
  };
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.APP_EVENT) private appEventQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PUSH_NOTIFICATION) private pushQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ORDER_SYNC) private orderSyncQueue: Queue,
    @InjectQueue(QUEUE_NAMES.HEALTH_CHECK) private healthCheckQueue: Queue,
  ) {}

  async addAppEvent(data: {
    appId?: string;
    eventName: string;
    eventCategory?: string;
    userId?: number;
    sessionId?: string;
    platform: string;
    itemId?: string;
    itemType?: string;
    amount?: number;
    quantity?: number;
    params?: Record<string, any>;
  }) {
    const job = await this.appEventQueue.add('create', data, {
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
    this.logger.debug(`📊 [Queue] app-event job added: ${job.id}`);
    return job;
  }

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

  /**
   * 주문 상태 동기화 Job 추가
   */
  async addOrderSync(
    orderId: number,
    playautoData: { status: string; carrier?: string; trackingNumber?: string },
  ) {
    const jobData: OrderSyncJobData = {
      orderId,
      playautoData,
    };

    const job = await this.orderSyncQueue.add('sync', jobData, {
      removeOnComplete: 100,
      removeOnFail: 1000,
    });
    this.logger.debug(`📦 [Queue] order-sync job added: ${job.id}, orderId=${orderId}`);
    return job;
  }

  // 테스트용 메서드 - Redis 연결만 확인 (실제 job 추가 안 함)
  async testConnection() {
    try {
      const client = await this.appEventQueue.client;
      const pong = await client.ping();
      this.logger.log(`Redis ping: ${pong}`);
      return { success: true, ping: pong };
    } catch (error) {
      this.logger.error('Queue connection test failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * MQ 헬스체크 Job 추가
   * MQ 워커가 이 잡을 처리하면서 app_configs에 MQ_HEALTH_CHECK 값을 기록
   */
  async addHealthCheck() {
    const job = await this.healthCheckQueue.add('check', {
      source: 'biocom-api',
      requestedAt: new Date().toISOString(),
    }, {
      removeOnComplete: 10,
      removeOnFail: 10,
    });
    this.logger.log(`🏥 [Queue] health-check job added: ${job.id}`);
    return job;
  }
}
