import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST, calculateChallengeDay } from '../../common/utils/kst-date.util';
import { UserChallengeStatus } from '../../common/enums';

/**
 * ============================================================================
 * 조건 평가 서비스 (Condition Evaluator Service)
 * ============================================================================
 *
 * [역할]
 * - 조건 타입(conditionType)과 파라미터(conditionParams)를 기반으로
 *   해당 조건을 만족하는 유저 목록을 조회
 * - PushCampaignService에서 호출되어 조건 기반 푸시 대상 결정
 *
 * [지원 조건 타입]
 * - CHALLENGE_DAY: 챌린지 N일차 유저
 * - CHALLENGE_STATUS: 특정 챌린지 상태 유저
 * - NO_ACCESS_HOURS: N시간 이상 미접속 유저
 * - INCOMPLETE_COUNT: 미완료 미션 N개 이상 유저
 * - INCOMPLETE_TYPES: 특정 미션 타입 미완료 유저
 * - COMPLETION_RATE: 완료율 N% 미만 유저
 * - ONBOARDING_STATE: 특정 온보딩 상태 유저
 * - CHALLENGE_START_OFFSET_DAYS: 챌린지 시작 D-N 유저
 * - REPORT_STATE: 특정 리포트 상태 유저
 * - POINTS: 포인트 N 이상 유저
 * - COUPON_EXPIRING_HOURS: 쿠폰 만료 N시간 전 유저
 * - CART_HAS_ITEMS: 장바구니 상품 있는 유저
 */
@Injectable()
export class ConditionEvaluatorService {
  private readonly logger = new Logger(ConditionEvaluatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 조건에 맞는 유저 ID 목록 조회
   *
   * @param conditionType - 조건 타입
   * @param conditionParams - 조건 파라미터
   * @returns 조건을 만족하는 유저 ID 배열
   */
  async evaluateCondition(
    conditionType: string,
    conditionParams: Record<string, any>,
  ): Promise<number[]> {
    this.logger.log(
      `🔍 [ConditionEvaluator] 조건 평가 시작: type=${conditionType}, params=${JSON.stringify(conditionParams)}`,
    );

    let userIds: number[] = [];

    switch (conditionType) {
      case 'CHALLENGE_DAY':
        userIds = await this.evaluateChallengeDay(conditionParams);
        break;

      case 'CHALLENGE_STATUS':
        userIds = await this.evaluateChallengeStatus(conditionParams);
        break;

      case 'NO_ACCESS_HOURS':
        userIds = await this.evaluateNoAccessHours(conditionParams);
        break;

      case 'INCOMPLETE_COUNT':
        userIds = await this.evaluateIncompleteCount(conditionParams);
        break;

      case 'INCOMPLETE_TYPES':
        userIds = await this.evaluateIncompleteTypes(conditionParams);
        break;

      case 'COMPLETION_RATE':
        userIds = await this.evaluateCompletionRate(conditionParams);
        break;

      case 'ONBOARDING_STATE':
        userIds = await this.evaluateOnboardingState(conditionParams);
        break;

      case 'CHALLENGE_START_OFFSET_DAYS':
        userIds = await this.evaluateChallengeStartOffset(conditionParams);
        break;

      case 'REPORT_STATE':
        userIds = await this.evaluateReportState(conditionParams);
        break;

      case 'POINTS':
        userIds = await this.evaluatePoints(conditionParams);
        break;

      case 'COUPON_EXPIRING_HOURS':
        userIds = await this.evaluateCouponExpiring(conditionParams);
        break;

      case 'CART_HAS_ITEMS':
        userIds = await this.evaluateCartHasItems();
        break;

      default:
        this.logger.warn(`⚠️ [ConditionEvaluator] 알 수 없는 조건 타입: ${conditionType}`);
        return [];
    }

    // 푸시 토큰이 활성화된 유저만 필터링
    const usersWithToken = await this.filterUsersWithActiveToken(userIds);

    this.logger.log(
      `✅ [ConditionEvaluator] 조건 평가 완료: type=${conditionType}, total=${userIds.length}, withToken=${usersWithToken.length}`,
    );

    return usersWithToken;
  }

  /**
   * 조건 미리보기 - 대상 유저 수 및 샘플 조회 (발송 없이)
   */
  async previewCondition(
    conditionType: string,
    conditionParams: Record<string, any>,
  ): Promise<{
    totalCount: number;
    withTokenCount: number;
    testerCount: number;
    sampleUsers: { id: number; name: string; mobile: string; isTester: boolean }[];
  }> {
    this.logger.log(
      `🔍 [ConditionEvaluator] 조건 미리보기: type=${conditionType}, params=${JSON.stringify(conditionParams)}`,
    );

    const rawUserIds = await this.evaluateConditionRaw(conditionType, conditionParams);
    const totalCount = rawUserIds.length;

    if (totalCount === 0) {
      return { totalCount: 0, withTokenCount: 0, testerCount: 0, sampleUsers: [] };
    }

    const withTokenUserIds = await this.filterUsersWithActiveToken(rawUserIds);
    const withTokenCount = withTokenUserIds.length;

    const users = await this.prisma.user.findMany({
      where: { id: { in: rawUserIds.slice(0, 20) } },
      select: { id: true, name: true, mobile: true, isTester: true },
    });

    const testerCount = await this.prisma.user.count({
      where: { id: { in: rawUserIds }, isTester: true },
    });

    return {
      totalCount,
      withTokenCount,
      testerCount,
      sampleUsers: users.map((u) => ({
        id: u.id,
        name: u.name || '',
        mobile: u.mobile || '',
        isTester: u.isTester,
      })),
    };
  }

  /**
   * 조건에 맞는 테스터만 조회
   */
  async evaluateConditionTestersOnly(
    conditionType: string,
    conditionParams: Record<string, any>,
  ): Promise<number[]> {
    this.logger.log(`🧪 [ConditionEvaluator] 테스터 대상 조건 평가: type=${conditionType}`);

    const userIds = await this.evaluateCondition(conditionType, conditionParams);
    if (userIds.length === 0) return [];

    const testers = await this.prisma.user.findMany({
      where: { id: { in: userIds }, isTester: true },
      select: { id: true },
    });

    const testerIds = testers.map((u: { id: number }) => u.id);
    this.logger.log(`✅ [ConditionEvaluator] 테스터 필터링: total=${userIds.length}, testers=${testerIds.length}`);

    return testerIds;
  }

  /**
   * 조건에 맞는 유저 ID 조회 (토큰 필터링 없이 - 미리보기용)
   */
  private async evaluateConditionRaw(
    conditionType: string,
    conditionParams: Record<string, any>,
  ): Promise<number[]> {
    switch (conditionType) {
      case 'CHALLENGE_DAY':
        return this.evaluateChallengeDay(conditionParams);
      case 'CHALLENGE_STATUS':
        return this.evaluateChallengeStatus(conditionParams);
      case 'NO_ACCESS_HOURS':
        return this.evaluateNoAccessHours(conditionParams);
      case 'INCOMPLETE_COUNT':
        return this.evaluateIncompleteCount(conditionParams);
      case 'INCOMPLETE_TYPES':
        return this.evaluateIncompleteTypes(conditionParams);
      case 'COMPLETION_RATE':
        return this.evaluateCompletionRate(conditionParams);
      case 'ONBOARDING_STATE':
        return this.evaluateOnboardingState(conditionParams);
      case 'CHALLENGE_START_OFFSET_DAYS':
        return this.evaluateChallengeStartOffset(conditionParams);
      case 'REPORT_STATE':
        return this.evaluateReportState(conditionParams);
      case 'POINTS':
        return this.evaluatePoints(conditionParams);
      case 'COUPON_EXPIRING_HOURS':
        return this.evaluateCouponExpiring(conditionParams);
      case 'CART_HAS_ITEMS':
        return this.evaluateCartHasItems();
      default:
        return [];
    }
  }

  /**
   * 푸시 토큰이 활성화된 유저만 필터링
   */
  private async filterUsersWithActiveToken(userIds: number[]): Promise<number[]> {
    if (userIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        pushTokens: {
          some: { isActive: true },
        },
      },
      select: { id: true },
    });

    return users.map((u: { id: number }) => u.id);
  }

  /**
   * CHALLENGE_DAY: 챌린지 N일차 유저
   * params: { day: number }
   *
   * activatedAt 기준 calculateChallengeDay() 사용하여 N일차 유저 필터링
   */
  private async evaluateChallengeDay(params: Record<string, any>): Promise<number[]> {
    const targetDay = params.day;
    if (targetDay === undefined) return [];

    // ACTIVE 챌린지 중 activatedAt이 있는 것만 조회
    const challenges = await this.prisma.userChallenge.findMany({
      where: {
        status: UserChallengeStatus.ACTIVE,
        activatedAt: { not: null },
      },
      select: { userId: true, activatedAt: true },
    });

    // activatedAt 기준으로 현재 N일차인 유저만 필터링
    const userIdSet = new Set<number>();
    for (const challenge of challenges) {
      if (challenge.activatedAt) {
        const currentDay = calculateChallengeDay(challenge.activatedAt);
        if (currentDay === targetDay) {
          userIdSet.add(challenge.userId);
        }
      }
    }

    return Array.from(userIdSet);
  }

  /**
   * CHALLENGE_STATUS: 특정 챌린지 상태 유저
   * params: { status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' }
   */
  private async evaluateChallengeStatus(params: Record<string, any>): Promise<number[]> {
    const status = params.status;
    if (!status) return [];

    const challenges = await this.prisma.userChallenge.findMany({
      where: { status },
      select: { userId: true },
    });

    const userIdSet = new Set<number>();
    challenges.forEach((c: { userId: number }) => userIdSet.add(c.userId));
    return Array.from(userIdSet);
  }

  /**
   * NO_ACCESS_HOURS: N시간 이상 미접속 유저
   * params: { hours: number }
   */
  private async evaluateNoAccessHours(params: Record<string, any>): Promise<number[]> {
    const hours = params.hours;
    if (hours === undefined) return [];

    const now = getNowKST();
    const threshold = new Date(now.getTime() - hours * 60 * 60 * 1000);

    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { lastSeenAt: null },
          { lastSeenAt: { lt: threshold } },
        ],
      },
      select: { id: true },
    });

    return users.map((u: { id: number }) => u.id);
  }

  /**
   * INCOMPLETE_COUNT: 오늘 미완료 미션 N개 이상 유저
   * params: { count: number }
   */
  private async evaluateIncompleteCount(params: Record<string, any>): Promise<number[]> {
    const minCount = params.count;
    if (minCount === undefined) return [];

    const now = getNowKST();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // 오늘 생성된 미완료 미션 개수를 유저별로 집계
    const incompleteData = await this.prisma.dailyProgress.groupBy({
      by: ['userChallengeId'],
      where: {
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
        isCompleted: false,
      },
      _count: true,
    });

    // minCount 이상인 userChallengeId 추출
    const targetChallengeIds = incompleteData
      .filter((d: { _count: number }) => d._count >= minCount)
      .map((d: { userChallengeId: number }) => d.userChallengeId);

    if (targetChallengeIds.length === 0) return [];

    // userChallengeId → userId 변환
    const challenges = await this.prisma.userChallenge.findMany({
      where: { id: { in: targetChallengeIds } },
      select: { userId: true },
    });

    const userIdSet = new Set<number>();
    challenges.forEach((c: { userId: number }) => userIdSet.add(c.userId));
    return Array.from(userIdSet);
  }

  /**
   * INCOMPLETE_TYPES: 특정 미션 타입 미완료 유저
   * params: { types: string[] }
   */
  private async evaluateIncompleteTypes(params: Record<string, any>): Promise<number[]> {
    const types = params.types;
    if (!types || !Array.isArray(types) || types.length === 0) return [];

    const now = getNowKST();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // 해당 타입의 미완료 미션이 있는 userChallengeId 조회
    const incompleteProgress = await this.prisma.dailyProgress.findMany({
      where: {
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
        missionType: { in: types },
        isCompleted: false,
      },
      select: { userChallengeId: true },
      distinct: ['userChallengeId'],
    });

    if (incompleteProgress.length === 0) return [];

    // userChallengeId → userId 변환
    const challenges = await this.prisma.userChallenge.findMany({
      where: { id: { in: incompleteProgress.map((p: { userChallengeId: number }) => p.userChallengeId) } },
      select: { userId: true },
    });

    const userIdSet = new Set<number>();
    challenges.forEach((c: { userId: number }) => userIdSet.add(c.userId));
    return Array.from(userIdSet);
  }

  /**
   * COMPLETION_RATE: 오늘 미션 완료율 N% 미만 유저
   * params: { rate: number }
   */
  private async evaluateCompletionRate(params: Record<string, any>): Promise<number[]> {
    const maxRate = params.rate;
    if (maxRate === undefined) return [];

    const now = getNowKST();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // 오늘 진행 상황 조회
    const progress = await this.prisma.dailyProgress.findMany({
      where: {
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      select: {
        userChallengeId: true,
        isCompleted: true,
      },
    });

    // userChallengeId별로 완료율 계산
    const rateMap = new Map<number, { total: number; completed: number }>();
    for (const p of progress) {
      const current = rateMap.get(p.userChallengeId) || { total: 0, completed: 0 };
      current.total += 1;
      if (p.isCompleted) current.completed += 1;
      rateMap.set(p.userChallengeId, current);
    }

    // maxRate 미만인 userChallengeId 추출
    const targetChallengeIds: number[] = [];
    for (const [challengeId, stats] of rateMap.entries()) {
      const rate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
      if (rate < maxRate) {
        targetChallengeIds.push(challengeId);
      }
    }

    if (targetChallengeIds.length === 0) return [];

    // userChallengeId → userId 변환
    const challenges = await this.prisma.userChallenge.findMany({
      where: { id: { in: targetChallengeIds } },
      select: { userId: true },
    });

    const userIdSet = new Set<number>();
    challenges.forEach((c: { userId: number }) => userIdSet.add(c.userId));
    return Array.from(userIdSet);
  }

  /**
   * ONBOARDING_STATE: 특정 온보딩 상태 유저
   * params: { state: string }
   *
   * 지원 상태:
   * - NOT_STARTED: 챌린지가 없는 유저
   * - IN_PROGRESS: ACTIVE 챌린지가 있는 유저
   * - COMPLETED: COMPLETED 챌린지가 있는 유저
   * - TYPE_SURVEY_INCOMPLETE: 챌린지 있지만 사전설문 미완료
   * - SOLUTION_NOT_VIEWED: 솔루션 조회 미완료 (DB 필드 없어서 보류)
   * - SOLUTION_VIEWED_START_NOT_SET: 사전설문 완료 + 시작일 미지정
   */
  private async evaluateOnboardingState(params: Record<string, any>): Promise<number[]> {
    const state = params.state;
    if (!state) return [];

    let users: { id: number }[] = [];

    switch (state) {
      case 'NOT_STARTED':
        users = await this.prisma.user.findMany({
          where: { userChallenges: { none: {} } },
          select: { id: true },
        });
        break;

      case 'IN_PROGRESS':
        users = await this.prisma.user.findMany({
          where: { userChallenges: { some: { status: UserChallengeStatus.ACTIVE } } },
          select: { id: true },
        });
        break;

      case 'COMPLETED':
        users = await this.prisma.user.findMany({
          where: { userChallenges: { some: { status: UserChallengeStatus.COMPLETED } } },
          select: { id: true },
        });
        break;

      // 유형분류 문진 미완료 (챌린지 구매 후 사전설문 미완료)
      case 'TYPE_SURVEY_INCOMPLETE': {
        const usersWithChallenge = await this.prisma.user.findMany({
          where: {
            userChallenges: { some: {} },
            challengeSurveyResults: { none: { beforeCompletedAt: { not: null } } },
          },
          select: { id: true },
        });
        return usersWithChallenge.map((u: { id: number }) => u.id);
      }

      // 맞춤 솔루션 조회 미완료 (현재 DB에 솔루션 조회 여부 필드가 없어서 보류)
      case 'SOLUTION_NOT_VIEWED': {
        this.logger.warn('⚠️ SOLUTION_NOT_VIEWED 조건은 솔루션 조회 추적 필드가 필요합니다.');
        return [];
      }

      // 맞춤 솔루션 조회 완료 + 시작일 미지정
      case 'SOLUTION_VIEWED_START_NOT_SET': {
        const usersNotStarted = await this.prisma.user.findMany({
          where: {
            challengeSurveyResults: { some: { beforeCompletedAt: { not: null } } },
            userChallenges: {
              some: {
                status: UserChallengeStatus.PENDING,
                startDateSetAt: null,
              },
            },
          },
          select: { id: true },
        });
        return usersNotStarted.map((u: { id: number }) => u.id);
      }

      default:
        return [];
    }

    return users.map((u: { id: number }) => u.id);
  }

  /**
   * CHALLENGE_START_OFFSET_DAYS: 챌린지 시작 D-N 유저
   * params: { offsetDays: number } 또는 { days: number }
   *
   * offsetDays=-1: 내일 시작 예정인 유저 (activatedAt이 내일)
   */
  private async evaluateChallengeStartOffset(params: Record<string, any>): Promise<number[]> {
    // offsetDays 또는 days 파라미터 지원
    const offsetDays = params.offsetDays ?? params.days;
    if (offsetDays === undefined) return [];

    const now = getNowKST();
    const targetDate = new Date(now);
    // offsetDays가 -1이면: 오늘 - (-1) = 내일이 targetDate
    targetDate.setDate(targetDate.getDate() - offsetDays);

    const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const targetEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

    // activatedAt이 targetDate인 PENDING 상태의 챌린지를 가진 유저
    const challenges = await this.prisma.userChallenge.findMany({
      where: {
        status: UserChallengeStatus.PENDING,
        activatedAt: {
          gte: targetStart,
          lte: targetEnd,
        },
      },
      select: { userId: true },
    });

    const userIdSet = new Set<number>();
    challenges.forEach((c: { userId: number }) => userIdSet.add(c.userId));
    return Array.from(userIdSet);
  }

  /**
   * REPORT_STATE: 특정 리포트 상태 유저
   * params: { state: 'UNREAD' | 'ALL_READ' }
   *
   * 지원 상태:
   * - UNREAD: 읽지 않은 심층 리포트가 있는 유저
   * - ALL_READ: 모든 심층 리포트를 읽은 유저
   */
  private async evaluateReportState(params: Record<string, any>): Promise<number[]> {
    const state = params.state;
    if (!state) return [];

    switch (state) {
      case 'UNREAD': {
        // 읽지 않은 리포트가 있는 유저
        const unreadReports = await this.prisma.userDeepReport.findMany({
          where: { readAt: null },
          select: { userId: true },
          distinct: ['userId'],
        });
        return unreadReports.map((r: { userId: number }) => r.userId);
      }

      case 'ALL_READ': {
        // 리포트가 있고, 모든 리포트를 읽은 유저
        const usersWithReports = await this.prisma.userDeepReport.findMany({
          select: { userId: true },
          distinct: ['userId'],
        });
        const userIdsWithReports = usersWithReports.map((r: { userId: number }) => r.userId);

        if (userIdsWithReports.length === 0) return [];

        // 읽지 않은 리포트가 있는 유저 제외
        const usersWithUnread = await this.prisma.userDeepReport.findMany({
          where: { readAt: null },
          select: { userId: true },
          distinct: ['userId'],
        });
        const userIdsWithUnread = new Set(usersWithUnread.map((r: { userId: number }) => r.userId));

        return userIdsWithReports.filter((id: number) => !userIdsWithUnread.has(id));
      }

      default:
        this.logger.warn(`⚠️ [ConditionEvaluator] 알 수 없는 REPORT_STATE: ${state}`);
        return [];
    }
  }

  /**
   * POINTS: 포인트 N 이상 유저
   * params: { min: number }
   */
  private async evaluatePoints(params: Record<string, any>): Promise<number[]> {
    const minPoints = params.min;
    if (minPoints === undefined) return [];

    const users = await this.prisma.user.findMany({
      where: {
        points: { gte: minPoints },
      },
      select: { id: true },
    });

    return users.map((u: { id: number }) => u.id);
  }

  /**
   * COUPON_EXPIRING_HOURS: 쿠폰 만료 N시간 전 유저
   * params: { hours: number }
   */
  private async evaluateCouponExpiring(params: Record<string, any>): Promise<number[]> {
    const hours = params.hours;
    if (hours === undefined) return [];

    const now = getNowKST();
    const thresholdStart = new Date(now.getTime());
    const thresholdEnd = new Date(now.getTime() + hours * 60 * 60 * 1000);

    // 만료 예정 쿠폰이 있는 유저 조회
    const userCoupons = await this.prisma.userCoupon.findMany({
      where: {
        usedAt: null, // 미사용 쿠폰
        expiresAt: {
          gte: thresholdStart,
          lte: thresholdEnd,
        },
      },
      select: { userId: true },
    });

    const userIdSet = new Set<number>();
    userCoupons.forEach((c: { userId: number }) => userIdSet.add(c.userId));
    return Array.from(userIdSet);
  }

  /**
   * CART_HAS_ITEMS: 장바구니에 상품이 있는 유저
   */
  private async evaluateCartHasItems(): Promise<number[]> {
    // 장바구니에 아이템이 있는 Cart 조회 → userId 추출
    const carts = await this.prisma.cart.findMany({
      where: {
        items: {
          some: {},
        },
      },
      select: { userId: true },
    });

    return carts.map((c: { userId: number }) => c.userId);
  }
}
