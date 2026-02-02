import { Injectable, Logger } from '@nestjs/common';
import {
  QueueService,
  EventPushType,
  PushMessage,
  PushNotificationType,
  ConditionParams,
} from '../../queues/queue.service';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * 이벤트 기반 푸시 서비스
 *
 * PushNotificationSchedule 테이블에서 이벤트 타입별 설정을 조회하여
 * 지연된 푸시 알림을 스케줄링하거나 취소
 *
 * @description
 * 관리자가 설정한 스케줄(type 필드로 이벤트 타입 구분)에서
 * 메시지, 조건, 랜딩 정보 등을 가져와서 사용
 */
@Injectable()
export class PushEventService {
  private readonly logger = new Logger(PushEventService.name);

  // 지연 시간 상수 (밀리초)
  private readonly HOURS_24 = 24 * 60 * 60 * 1000;
  private readonly HOURS_48 = 48 * 60 * 60 * 1000;
  private readonly HOURS_1 = 1 * 60 * 60 * 1000;

  constructor(
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 이벤트 타입에 해당하는 스케줄 설정 조회
   *
   * @param eventType - 이벤트 타입 (PushNotificationSchedule.type과 매칭)
   */
  private async getScheduleByEventType(eventType: string) {
    return this.prisma.pushNotificationSchedule.findFirst({
      where: {
        type: eventType,
        isActive: true,
      },
    });
  }

  /**
   * 스케줄 설정에서 푸시 메시지 생성
   *
   * @param schedule - PushNotificationSchedule 레코드
   * @param additionalData - 추가 데이터 (쿠폰 이름 등 동적 값)
   */
  private buildMessageFromSchedule(
    schedule: {
      title: string;
      bodyTemplate: string;
      imageUrl?: string | null;
      data?: any;
      landingType?: string | null;
      landingParams?: any;
      pushCode?: string | null;
    },
    additionalData?: Record<string, string>,
  ): PushMessage {
    let body = schedule.bodyTemplate;

    // 템플릿 변수 치환 ({{변수명}} 형식)
    if (additionalData) {
      for (const [key, value] of Object.entries(additionalData)) {
        body = body.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    }

    return {
      title: schedule.title,
      body,
      imageUrl: schedule.imageUrl || undefined,
      data: {
        ...((schedule.data as Record<string, any>) || {}),
        landingType: schedule.landingType,
        landingParams: schedule.landingParams,
        pushCode: schedule.pushCode,
        ...additionalData,
      },
    };
  }

  /**
   * 쿠폰 만료 임박 알림 예약
   *
   * 쿠폰 만료 24시간 전에 푸시 발송
   * 스케줄 type: COUPON_EXPIRING
   *
   * @param userId - 유저 ID
   * @param userCouponId - 유저 쿠폰 ID
   * @param expiresAt - 쿠폰 만료 일시
   */
  async scheduleCouponExpiringPush(
    userId: number,
    userCouponId: number,
    expiresAt: Date,
  ) {
    // 스케줄 설정 조회
    const schedule = await this.getScheduleByEventType(EventPushType.COUPON_EXPIRING);
    if (!schedule) {
      this.logger.warn(`[PushEvent] 스케줄 설정 없음: type=${EventPushType.COUPON_EXPIRING}`);
      return;
    }

    const now = getNowKST();
    const notifyAt = new Date(expiresAt.getTime() - this.HOURS_24);

    // 만료까지 24시간 이내면 즉시 발송 (1시간 후)
    const delayMs = notifyAt > now ? notifyAt.getTime() - now.getTime() : this.HOURS_1;

    // 쿠폰 정보 조회
    const userCoupon = await this.prisma.userCoupon.findUnique({
      where: { id: userCouponId },
      include: { coupon: true },
    });

    if (!userCoupon) {
      this.logger.warn(`[PushEvent] 쿠폰을 찾을 수 없음: userCouponId=${userCouponId}`);
      return;
    }

    // 메시지 생성 (템플릿 변수 치환)
    const message = this.buildMessageFromSchedule(schedule, {
      couponName: userCoupon.coupon.name,
      couponId: userCoupon.couponId.toString(),
      userCouponId: userCouponId.toString(),
    });

    // 조건 가져오기
    const conditions = (schedule.conditions as { type: string; params: ConditionParams }[]) || [
      { type: 'COUPON_EXPIRING_HOURS', params: { expiringHours: 24 } },
    ];

    try {
      await this.queueService.addEventPush(
        userId,
        EventPushType.COUPON_EXPIRING,
        message,
        delayMs,
        conditions,
        {
          scheduleId: schedule.id,
          notificationType: PushNotificationType.REMIND,
        },
      );

      this.logger.log(
        `[PushEvent] 쿠폰 만료 알림 예약: userId=${userId}, scheduleId=${schedule.id}, delay=${Math.round(delayMs / 1000 / 60)}분`,
      );
    } catch (error) {
      this.logger.error(`[PushEvent] 쿠폰 만료 알림 예약 실패: ${error.message}`);
    }
  }

  /**
   * 장바구니 방치 알림 예약
   *
   * 장바구니에 상품 추가 후 24시간 동안 결제하지 않으면 푸시 발송
   * 스케줄 type: CART_ABANDONED
   *
   * @param userId - 유저 ID
   */
  async scheduleCartAbandonedPush(userId: number) {
    const schedule = await this.getScheduleByEventType(EventPushType.CART_ABANDONED);
    if (!schedule) {
      this.logger.warn(`[PushEvent] 스케줄 설정 없음: type=${EventPushType.CART_ABANDONED}`);
      return;
    }

    const message = this.buildMessageFromSchedule(schedule);
    const conditions = (schedule.conditions as { type: string; params: ConditionParams }[]) || [
      { type: 'CART_HAS_ITEMS', params: {} },
    ];

    try {
      await this.queueService.addEventPush(
        userId,
        EventPushType.CART_ABANDONED,
        message,
        this.HOURS_24,
        conditions,
        {
          scheduleId: schedule.id,
          notificationType: PushNotificationType.MARKETING,
        },
      );

      this.logger.log(`[PushEvent] 장바구니 방치 알림 예약: userId=${userId}, scheduleId=${schedule.id}`);
    } catch (error) {
      this.logger.error(`[PushEvent] 장바구니 방치 알림 예약 실패: ${error.message}`);
    }
  }

  /**
   * 장바구니 방치 알림 취소
   *
   * 결제 완료 또는 장바구니 비우기 시 호출
   *
   * @param userId - 유저 ID
   */
  async cancelCartAbandonedPush(userId: number) {
    const schedule = await this.getScheduleByEventType(EventPushType.CART_ABANDONED);
    if (!schedule) return;

    try {
      const cancelled = await this.queueService.cancelEventPush(
        EventPushType.CART_ABANDONED,
        userId,
        schedule.id,
      );

      if (cancelled) {
        this.logger.log(`[PushEvent] 장바구니 방치 알림 취소: userId=${userId}`);
      }
    } catch (error) {
      this.logger.error(`[PushEvent] 장바구니 방치 알림 취소 실패: ${error.message}`);
    }
  }

  /**
   * 챌린지 시작 D-1 알림 예약
   *
   * 챌린지 시작일 하루 전에 푸시 발송
   * 스케줄 type: CHALLENGE_START_D1
   *
   * @param userId - 유저 ID
   * @param userChallengeId - 유저 챌린지 ID
   * @param startDate - 챌린지 시작일
   */
  async scheduleChallengeStartD1Push(
    userId: number,
    userChallengeId: number,
    startDate: Date,
  ) {
    const schedule = await this.getScheduleByEventType(EventPushType.CHALLENGE_START_D1);
    if (!schedule) {
      this.logger.warn(`[PushEvent] 스케줄 설정 없음: type=${EventPushType.CHALLENGE_START_D1}`);
      return;
    }

    const now = getNowKST();
    const notifyAt = new Date(startDate.getTime() - this.HOURS_24);

    // 이미 D-1을 지났으면 스킵
    if (notifyAt <= now) {
      this.logger.log(
        `[PushEvent] 챌린지 시작 D-1 이미 지남: userId=${userId}, userChallengeId=${userChallengeId}`,
      );
      return;
    }

    const delayMs = notifyAt.getTime() - now.getTime();

    const message = this.buildMessageFromSchedule(schedule, {
      userChallengeId: userChallengeId.toString(),
    });

    const conditions = (schedule.conditions as { type: string; params: ConditionParams }[]) || [
      { type: 'CHALLENGE_START_OFFSET_DAYS', params: { offsetDays: 1 } },
    ];

    try {
      await this.queueService.addEventPush(
        userId,
        EventPushType.CHALLENGE_START_D1,
        message,
        delayMs,
        conditions,
        {
          scheduleId: schedule.id,
          notificationType: PushNotificationType.REMIND,
        },
      );

      this.logger.log(
        `[PushEvent] 챌린지 시작 D-1 알림 예약: userId=${userId}, scheduleId=${schedule.id}, delay=${Math.round(delayMs / 1000 / 60 / 60)}시간`,
      );
    } catch (error) {
      this.logger.error(`[PushEvent] 챌린지 시작 D-1 알림 예약 실패: ${error.message}`);
    }
  }

  /**
   * 유저 앱 접속 처리
   *
   * 기존 미접속 알림을 취소하고 새로운 알림을 예약
   * 스케줄 type: NO_ACCESS_24H, NO_ACCESS_48H
   *
   * @param userId - 유저 ID
   */
  async handleUserAccess(userId: number) {
    // 기존 미접속 알림 취소
    const schedule24h = await this.getScheduleByEventType(EventPushType.NO_ACCESS_24H);
    const schedule48h = await this.getScheduleByEventType(EventPushType.NO_ACCESS_48H);

    if (schedule24h) {
      await this.queueService.cancelEventPush(EventPushType.NO_ACCESS_24H, userId, schedule24h.id);
    }
    if (schedule48h) {
      await this.queueService.cancelEventPush(EventPushType.NO_ACCESS_48H, userId, schedule48h.id);
    }

    // 24시간 미접속 알림 예약
    if (schedule24h) {
      const message24h = this.buildMessageFromSchedule(schedule24h);
      const conditions24h = (schedule24h.conditions as { type: string; params: ConditionParams }[]) || [
        { type: 'NO_ACCESS_HOURS', params: { hoursMin: 24 } },
      ];

      await this.queueService.addEventPush(
        userId,
        EventPushType.NO_ACCESS_24H,
        message24h,
        this.HOURS_24,
        conditions24h,
        {
          scheduleId: schedule24h.id,
          notificationType: PushNotificationType.REMIND,
        },
      );
    }

    // 48시간 미접속 알림 예약
    if (schedule48h) {
      const message48h = this.buildMessageFromSchedule(schedule48h);
      const conditions48h = (schedule48h.conditions as { type: string; params: ConditionParams }[]) || [
        { type: 'NO_ACCESS_HOURS', params: { hoursMin: 48 } },
      ];

      await this.queueService.addEventPush(
        userId,
        EventPushType.NO_ACCESS_48H,
        message48h,
        this.HOURS_48,
        conditions48h,
        {
          scheduleId: schedule48h.id,
          notificationType: PushNotificationType.REMIND,
        },
      );
    }

    this.logger.debug(`[PushEvent] 미접속 알림 재예약: userId=${userId}`);
  }
}
