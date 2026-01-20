import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * 조건 타입 정의
 */
export enum ConditionType {
  // 챌린지 관련
  CHALLENGE_DAY = 'CHALLENGE_DAY',
  CHALLENGE_STATUS = 'CHALLENGE_STATUS',

  // 미접속 관련
  NO_ACCESS_HOURS = 'NO_ACCESS_HOURS',

  // 기록 관련
  INCOMPLETE_COUNT = 'INCOMPLETE_COUNT',
  INCOMPLETE_TYPES = 'INCOMPLETE_TYPES',
  COMPLETION_RATE = 'COMPLETION_RATE',

  // 온보딩/리포트
  ONBOARDING_STATE = 'ONBOARDING_STATE',
  REPORT_STATE = 'REPORT_STATE',

  // 챌린지 시작 오프셋
  CHALLENGE_START_OFFSET_DAYS = 'CHALLENGE_START_OFFSET_DAYS',

  // 기타
  POINTS = 'POINTS',
  COUPON_EXPIRING_HOURS = 'COUPON_EXPIRING_HOURS',
  CART_HAS_ITEMS = 'CART_HAS_ITEMS',
}

/**
 * 조건 파라미터 타입
 */
export interface ConditionParams {
  // CHALLENGE_DAY
  day?: number;
  dayMin?: number;
  dayMax?: number;

  // CHALLENGE_STATUS
  status?: string;
  statuses?: string[];

  // NO_ACCESS_HOURS
  hours?: number;
  hoursMin?: number;
  hoursMax?: number;

  // INCOMPLETE_COUNT
  count?: number;
  countMin?: number;
  countMax?: number;

  // INCOMPLETE_TYPES
  types?: string[];

  // COMPLETION_RATE
  rate?: number;
  rateMin?: number;
  rateMax?: number;

  // ONBOARDING_STATE
  state?: string;

  // REPORT_STATE
  reportType?: string;
  hasReport?: boolean;

  // POINTS
  pointsMin?: number;
  pointsMax?: number;

  // COUPON_EXPIRING_HOURS
  expiringHours?: number;

  // 기타
  [key: string]: any;
}

/**
 * 조건 평가 결과
 */
export interface EvaluationResult {
  matched: boolean;
  userId: number;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * 조건 평가 서비스
 *
 * 푸시 알림 발송 조건을 평가하여 대상 유저를 필터링
 */
@Injectable()
export class ConditionEvaluatorService {
  private readonly logger = new Logger(ConditionEvaluatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 조건에 맞는 유저 ID 목록 반환
   */
  async evaluateCondition(
    conditionType: ConditionType | string,
    params: ConditionParams,
  ): Promise<number[]> {
    this.logger.log(
      `🔍 [ConditionEvaluator] 조건 평가 시작: ${conditionType}, params: ${JSON.stringify(params)}`,
    );

    let userIds: number[] = [];

    switch (conditionType) {
      case ConditionType.CHALLENGE_DAY:
        userIds = await this.evaluateChallengeDay(params);
        break;

      case ConditionType.CHALLENGE_STATUS:
        userIds = await this.evaluateChallengeStatus(params);
        break;

      case ConditionType.NO_ACCESS_HOURS:
        userIds = await this.evaluateNoAccessHours(params);
        break;

      case ConditionType.INCOMPLETE_COUNT:
        userIds = await this.evaluateIncompleteCount(params);
        break;

      case ConditionType.INCOMPLETE_TYPES:
        userIds = await this.evaluateIncompleteTypes(params);
        break;

      case ConditionType.COMPLETION_RATE:
        userIds = await this.evaluateCompletionRate(params);
        break;

      case ConditionType.ONBOARDING_STATE:
        userIds = await this.evaluateOnboardingState(params);
        break;

      case ConditionType.CHALLENGE_START_OFFSET_DAYS:
        userIds = await this.evaluateChallengeStartOffsetDays(params);
        break;

      case ConditionType.REPORT_STATE:
        userIds = await this.evaluateReportState(params);
        break;

      case ConditionType.POINTS:
        userIds = await this.evaluatePoints(params);
        break;

      case ConditionType.COUPON_EXPIRING_HOURS:
        userIds = await this.evaluateCouponExpiringHours(params);
        break;

      case ConditionType.CART_HAS_ITEMS:
        userIds = await this.evaluateCartHasItems(params);
        break;

      default:
        this.logger.warn(
          `⚠️ [ConditionEvaluator] 미구현 조건 타입: ${conditionType}`,
        );
    }

    this.logger.log(
      `✅ [ConditionEvaluator] 조건 평가 완료: ${userIds.length}명 매칭`,
    );

    return userIds;
  }

  /**
   * 단일 유저에 대해 조건 평가
   */
  async evaluateForUser(
    userId: number,
    conditionType: ConditionType | string,
    params: ConditionParams,
  ): Promise<EvaluationResult> {
    const matchedUserIds = await this.evaluateCondition(conditionType, params);
    const matched = matchedUserIds.includes(userId);

    return {
      matched,
      userId,
      reason: matched ? '조건 충족' : '조건 미충족',
    };
  }

  /**
   * CHALLENGE_DAY: 챌린지 N일차 유저
   *
   * params:
   * - day: 정확한 일차 (예: 7)
   * - dayMin, dayMax: 일차 범위 (예: 1~3)
   */
  private async evaluateChallengeDay(params: ConditionParams): Promise<number[]> {
    const { day, dayMin, dayMax } = params;
    const now = getNowKST();

    // 활성 챌린지가 있는 유저 조회
    const activeUserChallenges = await this.prisma.userChallenge.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        userId: true,
        activatedAt: true,
      },
    });

    const matchedUserIds: number[] = [];

    for (const uc of activeUserChallenges) {
      // 챌린지 일차 계산 (activatedAt 기준)
      const challengeDay = this.calculateChallengeDay(uc.activatedAt, now);

      let matched = false;

      if (day !== undefined) {
        // 정확한 일차 매칭
        matched = challengeDay === day;
      } else if (dayMin !== undefined || dayMax !== undefined) {
        // 범위 매칭
        const min = dayMin ?? 1;
        const max = dayMax ?? 999;
        matched = challengeDay >= min && challengeDay <= max;
      }

      if (matched) {
        matchedUserIds.push(uc.userId);
      }
    }

    this.logger.debug(
      `[CHALLENGE_DAY] day=${day}, dayMin=${dayMin}, dayMax=${dayMax} → ${matchedUserIds.length}명`,
    );

    return matchedUserIds;
  }

  /**
   * CHALLENGE_STATUS: 특정 챌린지 상태의 유저
   *
   * params:
   * - status: 단일 상태 (예: 'ACTIVE')
   * - statuses: 복수 상태 (예: ['ACTIVE', 'PENDING'])
   */
  private async evaluateChallengeStatus(
    params: ConditionParams,
  ): Promise<number[]> {
    const { status, statuses } = params;

    const statusList = statuses || (status ? [status] : []);

    if (statusList.length === 0) {
      this.logger.warn('[CHALLENGE_STATUS] 상태 조건이 지정되지 않음');
      return [];
    }

    const userChallenges = await this.prisma.userChallenge.findMany({
      where: {
        status: { in: statusList },
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
    });

    const userIds = userChallenges.map((uc) => uc.userId);

    this.logger.debug(
      `[CHALLENGE_STATUS] statuses=${statusList.join(',')} → ${userIds.length}명`,
    );

    return userIds;
  }

  /**
   * NO_ACCESS_HOURS: N시간 이상 미접속 유저
   *
   * params:
   * - hours: 정확한 시간 (예: 24)
   * - hoursMin, hoursMax: 시간 범위 (예: 24~48)
   */
  private async evaluateNoAccessHours(
    params: ConditionParams,
  ): Promise<number[]> {
    const { hours, hoursMin, hoursMax } = params;
    const now = getNowKST();

    // lastSeenAt이 있는 유저 조회
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        lastSeenAt: { not: null },
        pushEnabled: true,
      },
      select: {
        id: true,
        lastSeenAt: true,
      },
    });

    const matchedUserIds: number[] = [];

    for (const user of users) {
      if (!user.lastSeenAt) continue;

      // 미접속 시간 계산 (시간 단위)
      const diffMs = now.getTime() - user.lastSeenAt.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      let matched = false;

      if (hours !== undefined) {
        // 정확한 시간 이상 미접속
        matched = diffHours >= hours;
      } else if (hoursMin !== undefined || hoursMax !== undefined) {
        // 범위 매칭
        const min = hoursMin ?? 0;
        const max = hoursMax ?? Infinity;
        matched = diffHours >= min && diffHours <= max;
      }

      if (matched) {
        matchedUserIds.push(user.id);
      }
    }

    this.logger.debug(
      `[NO_ACCESS_HOURS] hours=${hours}, hoursMin=${hoursMin}, hoursMax=${hoursMax} → ${matchedUserIds.length}명`,
    );

    return matchedUserIds;
  }

  /**
   * INCOMPLETE_COUNT: 오늘 미완료 기록 수
   *
   * params:
   * - count: 정확한 개수
   * - countMin, countMax: 개수 범위
   */
  private async evaluateIncompleteCount(
    params: ConditionParams,
  ): Promise<number[]> {
    const { count, countMin, countMax } = params;
    const today = this.getTodayDateString();

    // 활성 챌린지 유저 조회
    const activeUserChallenges = await this.prisma.userChallenge.findMany({
      where: { status: 'ACTIVE' },
      select: {
        userId: true,
        id: true,
      },
    });

    const matchedUserIds: number[] = [];

    // 필수 기록 타입 (6개)
    const requiredTypes = [
      'WEIGHT',
      'BREAKFAST',
      'LUNCH',
      'DINNER',
      'EXERCISE',
      'SLEEP',
    ];

    for (const uc of activeUserChallenges) {
      // 오늘 기록 조회
      const todayRecords = await this.prisma.userRecord.findMany({
        where: {
          userId: uc.userId,
          userChallengeId: uc.id,
          date: new Date(today),
        },
        select: {
          recordType: true,
        },
      });

      const completedTypes = new Set(todayRecords.map((r) => r.recordType));
      const incompleteCount = requiredTypes.filter(
        (t) => !completedTypes.has(t),
      ).length;

      let matched = false;

      if (count !== undefined) {
        matched = incompleteCount === count;
      } else if (countMin !== undefined || countMax !== undefined) {
        const min = countMin ?? 0;
        const max = countMax ?? 6;
        matched = incompleteCount >= min && incompleteCount <= max;
      }

      if (matched) {
        matchedUserIds.push(uc.userId);
      }
    }

    this.logger.debug(
      `[INCOMPLETE_COUNT] count=${count}, countMin=${countMin}, countMax=${countMax} → ${matchedUserIds.length}명`,
    );

    return matchedUserIds;
  }

  /**
   * INCOMPLETE_TYPES: 특정 기록 타입 미완료
   *
   * params:
   * - types: 미완료 체크할 타입 배열 (예: ['BREAKFAST', 'LUNCH'])
   */
  private async evaluateIncompleteTypes(
    params: ConditionParams,
  ): Promise<number[]> {
    const { types } = params;

    if (!types || types.length === 0) {
      this.logger.warn('[INCOMPLETE_TYPES] 타입이 지정되지 않음');
      return [];
    }

    const today = this.getTodayDateString();

    // 활성 챌린지 유저 조회
    const activeUserChallenges = await this.prisma.userChallenge.findMany({
      where: { status: 'ACTIVE' },
      select: {
        userId: true,
        id: true,
      },
    });

    const matchedUserIds: number[] = [];

    for (const uc of activeUserChallenges) {
      // 오늘 기록 조회
      const todayRecords = await this.prisma.userRecord.findMany({
        where: {
          userId: uc.userId,
          userChallengeId: uc.id,
          date: new Date(today),
        },
        select: {
          recordType: true,
        },
      });

      const completedTypes = new Set(todayRecords.map((r) => r.recordType));

      // 지정된 타입 중 하나라도 미완료면 매칭
      const hasIncomplete = types.some((t) => !completedTypes.has(t));

      if (hasIncomplete) {
        matchedUserIds.push(uc.userId);
      }
    }

    this.logger.debug(
      `[INCOMPLETE_TYPES] types=${types.join(',')} → ${matchedUserIds.length}명`,
    );

    return matchedUserIds;
  }

  /**
   * COMPLETION_RATE: 오늘 기록 완료율
   *
   * params:
   * - rate: 정확한 비율 (0~100)
   * - rateMin, rateMax: 비율 범위
   */
  private async evaluateCompletionRate(
    params: ConditionParams,
  ): Promise<number[]> {
    const { rate, rateMin, rateMax } = params;
    const today = this.getTodayDateString();

    // 활성 챌린지 유저 조회
    const activeUserChallenges = await this.prisma.userChallenge.findMany({
      where: { status: 'ACTIVE' },
      select: {
        userId: true,
        id: true,
      },
    });

    const matchedUserIds: number[] = [];

    // 필수 기록 타입 (6개)
    const requiredTypes = [
      'WEIGHT',
      'BREAKFAST',
      'LUNCH',
      'DINNER',
      'EXERCISE',
      'SLEEP',
    ];
    const totalRequired = requiredTypes.length;

    for (const uc of activeUserChallenges) {
      // 오늘 기록 조회
      const todayRecords = await this.prisma.userRecord.findMany({
        where: {
          userId: uc.userId,
          userChallengeId: uc.id,
          date: new Date(today),
        },
        select: {
          recordType: true,
        },
      });

      const completedTypes = new Set(todayRecords.map((r) => r.recordType));
      const completedCount = requiredTypes.filter((t) =>
        completedTypes.has(t),
      ).length;
      const completionRate = (completedCount / totalRequired) * 100;

      let matched = false;

      if (rate !== undefined) {
        matched = Math.round(completionRate) === rate;
      } else if (rateMin !== undefined || rateMax !== undefined) {
        const min = rateMin ?? 0;
        const max = rateMax ?? 100;
        matched = completionRate >= min && completionRate <= max;
      }

      if (matched) {
        matchedUserIds.push(uc.userId);
      }
    }

    this.logger.debug(
      `[COMPLETION_RATE] rate=${rate}, rateMin=${rateMin}, rateMax=${rateMax} → ${matchedUserIds.length}명`,
    );

    return matchedUserIds;
  }

  /**
   * ONBOARDING_STATE: 온보딩 상태별 유저
   *
   * params:
   * - state: 온보딩 상태
   *   - TYPE_SURVEY_INCOMPLETE: 유형분류 문진 미완료
   *   - SOLUTION_VIEWED_START_NOT_SET: 솔루션 조회 완료 + 시작일 미지정
   *   - NOT_STARTED: 챌린지 없는 유저
   *   - IN_PROGRESS: ACTIVE 챌린지 있는 유저
   *   - COMPLETED: COMPLETED 챌린지 있는 유저
   */
  private async evaluateOnboardingState(
    params: ConditionParams,
  ): Promise<number[]> {
    const { state } = params;

    if (!state) {
      this.logger.warn('[ONBOARDING_STATE] 상태가 지정되지 않음');
      return [];
    }

    let userIds: number[] = [];

    switch (state) {
      case 'TYPE_SURVEY_INCOMPLETE': {
        // 챌린지가 있지만 유형분류 문진(사전설문) 미완료
        // beforeHealthType이 null이면 사전설문 미완료로 판단
        const users = await this.prisma.user.findMany({
          where: {
            isActive: true,
            pushEnabled: true,
            userChallenges: {
              some: {},
            },
            challengeSurveyResults: {
              every: {
                beforeHealthType: null,
              },
            },
          },
          select: { id: true },
        });
        userIds = users.map((u) => u.id);
        break;
      }

      case 'SOLUTION_VIEWED_START_NOT_SET': {
        // 솔루션 조회 완료 (solutionSeenAt 있음) + 시작일 미지정 (startDateSetAt이 null)
        const users = await this.prisma.user.findMany({
          where: {
            isActive: true,
            pushEnabled: true,
            solutionSeenAt: { not: null },
            userChallenges: {
              some: {
                status: 'PENDING',
                startDateSetAt: null,
              },
            },
          },
          select: { id: true },
        });
        userIds = users.map((u) => u.id);
        break;
      }

      case 'NOT_STARTED': {
        // 챌린지가 없는 유저
        const users = await this.prisma.user.findMany({
          where: {
            isActive: true,
            pushEnabled: true,
            userChallenges: {
              none: {},
            },
          },
          select: { id: true },
        });
        userIds = users.map((u) => u.id);
        break;
      }

      case 'IN_PROGRESS': {
        // ACTIVE 챌린지가 있는 유저
        const userChallenges = await this.prisma.userChallenge.findMany({
          where: { status: 'ACTIVE' },
          select: { userId: true },
          distinct: ['userId'],
        });
        userIds = userChallenges.map((uc) => uc.userId);
        break;
      }

      case 'COMPLETED': {
        // COMPLETED 챌린지가 있는 유저
        const userChallenges = await this.prisma.userChallenge.findMany({
          where: { status: 'COMPLETED' },
          select: { userId: true },
          distinct: ['userId'],
        });
        userIds = userChallenges.map((uc) => uc.userId);
        break;
      }

      default:
        this.logger.warn(`[ONBOARDING_STATE] 알 수 없는 상태: ${state}`);
    }

    this.logger.debug(
      `[ONBOARDING_STATE] state=${state} → ${userIds.length}명`,
    );

    return userIds;
  }

  /**
   * CHALLENGE_START_OFFSET_DAYS: 챌린지 시작 D-N 유저
   *
   * params:
   * - offsetDays: 시작일 기준 오프셋 (양수: D-N, 음수: D+N, 0: D-Day)
   */
  private async evaluateChallengeStartOffsetDays(
    params: ConditionParams,
  ): Promise<number[]> {
    const { offsetDays } = params;

    if (offsetDays === undefined) {
      this.logger.warn('[CHALLENGE_START_OFFSET_DAYS] offsetDays가 지정되지 않음');
      return [];
    }

    const now = getNowKST();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // 타겟 날짜 계산 (offsetDays가 -1이면 내일 시작, 0이면 오늘 시작)
    const targetDate = new Date(todayStart);
    targetDate.setDate(targetDate.getDate() - offsetDays);

    const targetDateEnd = new Date(targetDate);
    targetDateEnd.setHours(23, 59, 59, 999);

    // PENDING 상태이면서 activatedAt(시작일)이 타겟 날짜인 챌린지
    const userChallenges = await this.prisma.userChallenge.findMany({
      where: {
        status: 'PENDING',
        activatedAt: {
          gte: targetDate,
          lte: targetDateEnd,
        },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    const userIds = userChallenges.map((uc) => uc.userId);

    this.logger.debug(
      `[CHALLENGE_START_OFFSET_DAYS] offsetDays=${offsetDays}, targetDate=${targetDate.toISOString().split('T')[0]} → ${userIds.length}명`,
    );

    return userIds;
  }

  /**
   * REPORT_STATE: 심층 리포트 상태별 유저
   *
   * params:
   * - state: UNREAD | ALL_READ
   */
  private async evaluateReportState(
    params: ConditionParams,
  ): Promise<number[]> {
    const { state } = params;

    if (!state) {
      this.logger.warn('[REPORT_STATE] 상태가 지정되지 않음');
      return [];
    }

    let userIds: number[] = [];

    if (state === 'UNREAD') {
      // 읽지 않은 심층 리포트가 있는 유저
      const reports = await this.prisma.userDeepReport.findMany({
        where: {
          isRead: false,
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      userIds = reports.map((r) => r.userId);
    } else if (state === 'ALL_READ') {
      // 모든 심층 리포트를 읽은 유저 (리포트가 있고 모두 읽음)
      // 리포트가 있는 유저 중에서 읽지 않은 리포트가 없는 유저
      const usersWithReports = await this.prisma.userDeepReport.groupBy({
        by: ['userId'],
      });

      const usersWithUnread = await this.prisma.userDeepReport.findMany({
        where: { isRead: false },
        select: { userId: true },
        distinct: ['userId'],
      });

      const unreadUserIds = new Set(usersWithUnread.map((u) => u.userId));
      userIds = usersWithReports
        .map((u) => u.userId)
        .filter((id) => !unreadUserIds.has(id));
    }

    this.logger.debug(`[REPORT_STATE] state=${state} → ${userIds.length}명`);

    return userIds;
  }

  /**
   * POINTS: 보유 포인트 조건
   *
   * params:
   * - pointsMin: 최소 포인트
   * - pointsMax: 최대 포인트
   */
  private async evaluatePoints(params: ConditionParams): Promise<number[]> {
    const { pointsMin, pointsMax } = params;

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        pushEnabled: true,
        ...(pointsMin !== undefined || pointsMax !== undefined
          ? {
              point: {
                ...(pointsMin !== undefined ? { gte: pointsMin } : {}),
                ...(pointsMax !== undefined ? { lte: pointsMax } : {}),
              },
            }
          : {}),
      },
      select: { id: true },
    });

    const userIds = users.map((u) => u.id);

    this.logger.debug(
      `[POINTS] pointsMin=${pointsMin}, pointsMax=${pointsMax} → ${userIds.length}명`,
    );

    return userIds;
  }

  /**
   * COUPON_EXPIRING_HOURS: 쿠폰 만료 임박 유저
   *
   * params:
   * - expiringHours: N시간 내 만료 예정
   */
  private async evaluateCouponExpiringHours(
    params: ConditionParams,
  ): Promise<number[]> {
    const { expiringHours } = params;

    if (expiringHours === undefined) {
      this.logger.warn('[COUPON_EXPIRING_HOURS] expiringHours가 지정되지 않음');
      return [];
    }

    const now = getNowKST();
    const expiryThreshold = new Date(now.getTime() + expiringHours * 60 * 60 * 1000);

    // N시간 내 만료 예정인 쿠폰을 가진 유저 (status가 ACTIVE인 쿠폰)
    const userCoupons = await this.prisma.userCoupon.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: {
          gt: now,
          lte: expiryThreshold,
        },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    const userIds = userCoupons.map((uc) => uc.userId);

    this.logger.debug(
      `[COUPON_EXPIRING_HOURS] expiringHours=${expiringHours} → ${userIds.length}명`,
    );

    return userIds;
  }

  /**
   * CART_HAS_ITEMS: 장바구니에 상품이 있는 유저
   */
  private async evaluateCartHasItems(
    _params: ConditionParams,
  ): Promise<number[]> {
    // 장바구니에 아이템이 있는 유저 (Cart를 통해 userId 조회)
    const carts = await this.prisma.cart.findMany({
      where: {
        items: {
          some: {
            quantity: { gt: 0 },
          },
        },
      },
      select: { userId: true },
    });

    const userIds = carts.map((c) => c.userId);

    this.logger.debug(`[CART_HAS_ITEMS] → ${userIds.length}명`);

    return userIds;
  }

  // ===== 헬퍼 메서드 =====

  /**
   * 챌린지 일차 계산
   */
  private calculateChallengeDay(activatedAt: Date, now: Date): number {
    const startOfActivated = new Date(activatedAt);
    startOfActivated.setHours(0, 0, 0, 0);

    const startOfNow = new Date(now);
    startOfNow.setHours(0, 0, 0, 0);

    const diffMs = startOfNow.getTime() - startOfActivated.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays + 1; // 1일차부터 시작
  }

  /**
   * 오늘 날짜 문자열 (YYYY-MM-DD)
   */
  private getTodayDateString(): string {
    const now = getNowKST();
    return now.toISOString().split('T')[0];
  }
}
