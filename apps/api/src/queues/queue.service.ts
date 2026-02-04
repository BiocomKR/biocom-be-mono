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
 * 이벤트 기반 푸시 타입
 */
export enum EventPushType {
  /** 24시간 미접속 */
  NO_ACCESS_24H = 'NO_ACCESS_24H',
  /** 48시간 미접속 */
  NO_ACCESS_48H = 'NO_ACCESS_48H',
  /** 장바구니 방치 */
  CART_ABANDONED = 'CART_ABANDONED',
  /** 쿠폰 만료 임박 */
  COUPON_EXPIRING = 'COUPON_EXPIRING',
  /** 챌린지 시작 D-1 */
  CHALLENGE_START_D1 = 'CHALLENGE_START_D1',
  /** 챌린지 시작 D-Day */
  CHALLENGE_START_DDAY = 'CHALLENGE_START_DDAY',
  /** 오늘 미션 미완료 */
  MISSION_INCOMPLETE = 'MISSION_INCOMPLETE',
}

/**
 * 조건 파라미터 타입
 */
export interface ConditionParams {
  [key: string]: any;
}

/**
 * 푸시 알림 Job 데이터 인터페이스
 */
export interface PushNotificationJobData {
  type: 'user' | 'users' | 'all' | 'event';
  userId?: number;
  userIds?: number[];
  message: PushMessage;
  notificationType?: PushNotificationType;
  isTest?: boolean;
  filter?: {
    marketingEnabled?: boolean;
  };
  // 이벤트 기반 푸시 전용 필드
  eventType?: EventPushType;
  conditions?: { type: string; params: ConditionParams }[];
  campaignId?: number;
  scheduleId?: number;
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

/**
 * 알러지 동기화 Job 데이터 인터페이스
 */
export interface AllergySyncJobData {
  type: 'master' | 'page';
  syncType?: 'full' | 'incremental';
  pageNo?: number;
  date?: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.APP_EVENT) private appEventQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PUSH_NOTIFICATION) private pushQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ORDER_SYNC) private orderSyncQueue: Queue,
    @InjectQueue(QUEUE_NAMES.HEALTH_CHECK) private healthCheckQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ALLERGY_SYNC) private allergySyncQueue: Queue,
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

  /**
   * 알러지 데이터 동기화 Job 추가
   * 마스터 job이 워커 job들을 생성하는 방식
   */
  async addAllergySync(syncType: 'full' | 'incremental' = 'incremental') {
    const jobData: AllergySyncJobData = {
      type: 'master',
      syncType,
    };

    const job = await this.allergySyncQueue.add('sync', jobData, {
      removeOnComplete: 10,
      removeOnFail: 100,
    });
    this.logger.log(`🧬 [Queue] allergy-sync (master) job added: ${job.id}, syncType=${syncType}`);
    return job;
  }

  /**
   * 이벤트 기반 지연 푸시 Job 추가
   *
   * 지정된 시간 후에 조건을 재평가하여 푸시 발송
   *
   * @param userId - 유저 ID
   * @param eventType - 이벤트 타입
   * @param message - 푸시 메시지
   * @param delayMs - 지연 시간 (밀리초)
   * @param conditions - 재평가할 조건 목록
   * @param options - 추가 옵션 (캠페인 ID, 스케줄 ID 등)
   */
  async addEventPush(
    userId: number,
    eventType: EventPushType,
    message: PushMessage,
    delayMs: number,
    conditions?: { type: string; params: ConditionParams }[],
    options?: {
      campaignId?: number;
      scheduleId?: number;
      notificationType?: PushNotificationType;
      isTest?: boolean;
    },
  ) {
    const jobData: PushNotificationJobData = {
      type: 'event',
      userId,
      eventType,
      message,
      conditions,
      campaignId: options?.campaignId,
      scheduleId: options?.scheduleId,
      notificationType: options?.notificationType || PushNotificationType.REMIND,
      isTest: options?.isTest || false,
    };

    // 중복 방지를 위한 고유 Job ID 생성
    const jobId = `event:${eventType}:${userId}:${options?.campaignId || options?.scheduleId || Date.now()}`;

    const job = await this.pushQueue.add('send', jobData, {
      delay: delayMs,
      jobId, // 동일 ID로 중복 Job 방지
      removeOnComplete: 100,
      removeOnFail: 1000,
    });

    this.logger.log(
      `⏰ [Queue] push-notification (event) job scheduled: ${job.id}, userId=${userId}, eventType=${eventType}, delayMs=${delayMs}`,
    );
    return job;
  }

  /**
   * 이벤트 기반 푸시 Job 취소
   *
   * 유저가 조건을 충족하지 않게 되면 (예: 앱 접속) 예약된 Job을 취소
   *
   * @param eventType - 이벤트 타입
   * @param userId - 유저 ID
   * @param identifier - 캠페인 ID 또는 스케줄 ID
   */
  async cancelEventPush(
    eventType: EventPushType,
    userId: number,
    identifier: number,
  ): Promise<boolean> {
    const jobId = `event:${eventType}:${userId}:${identifier}`;

    try {
      const job = await this.pushQueue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(
          `🗑️ [Queue] push-notification (event) job cancelled: ${jobId}`,
        );
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(
        `❌ [Queue] Failed to cancel event push job: ${jobId}, ${error.message}`,
      );
      return false;
    }
  }
}
