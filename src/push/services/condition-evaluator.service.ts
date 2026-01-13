import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST, calculateChallengeDay } from '../../common/utils/kst-date.util';
import { UserChallengeStatus } from '../../common/enums/challenge-ticket-status.enum';

/**
 * 조건 평가 서비스 (Condition Evaluator Service)
 *
 * 조건 타입(conditionType)과 파라미터(conditionParams)를 기반으로
 * 해당 조건을 만족하는 유저 목록을 조회
 */
@Injectable()
export class ConditionEvaluatorService {
  private readonly logger = new Logger(ConditionEvaluatorService.name);

  constructor(private readonly prisma: PrismaService) {}

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
   * 조건에 맞는 유저 ID 목록 조회 (푸시 토큰 필터링 포함)
   */
  async evaluateCondition(
    conditionType: string,
    conditionParams: Record<string, any>,
  ): Promise<number[]> {
    const userIds = await this.evaluateConditionRaw(conditionType, conditionParams);
    return this.filterUsersWithActiveToken(userIds);
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
      case 'POINTS':
        return this.evaluatePoints(conditionParams);
      case 'COUPON_EXPIRING_HOURS':
        return this.evaluateCouponExpiring(conditionParams);
      case 'CART_HAS_ITEMS':
        return this.evaluateCartHasItems();
      default:
        this.logger.warn(`⚠️ 알 수 없는 조건 타입: ${conditionType}`);
        return [];
    }
  }

  private async filterUsersWithActiveToken(userIds: number[]): Promise<number[]> {
    if (userIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        pushTokens: { some: { isActive: true } },
      },
      select: { id: true },
    });

    return users.map((u: { id: number }) => u.id);
  }

  private async evaluateChallengeDay(params: Record<string, any>): Promise<number[]> {
    const targetDay = params.day;
    if (targetDay === undefined) return [];

    const challenges = await this.prisma.userChallenge.findMany({
      where: {
        status: UserChallengeStatus.ACTIVE,
        activatedAt: { not: null },
      },
      select: { userId: true, activatedAt: true },
    });

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

  private async evaluateNoAccessHours(params: Record<string, any>): Promise<number[]> {
    const hours = params.hours;
    if (hours === undefined) return [];

    const now = getNowKST();
    const threshold = new Date(now.getTime() - hours * 60 * 60 * 1000);

    const users = await this.prisma.user.findMany({
      where: {
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: threshold } }],
      },
      select: { id: true },
    });

    return users.map((u: { id: number }) => u.id);
  }

  private async evaluateIncompleteCount(params: Record<string, any>): Promise<number[]> {
    const minCount = params.count;
    if (minCount === undefined) return [];

    const now = getNowKST();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const incompleteData = await this.prisma.dailyProgress.groupBy({
      by: ['userChallengeId'],
      where: {
        date: { gte: todayStart, lte: todayEnd },
        isCompleted: false,
      },
      _count: true,
    });

    const targetChallengeIds = incompleteData
      .filter((d: { _count: number }) => d._count >= minCount)
      .map((d: { userChallengeId: number }) => d.userChallengeId);

    if (targetChallengeIds.length === 0) return [];

    const challenges = await this.prisma.userChallenge.findMany({
      where: { id: { in: targetChallengeIds } },
      select: { userId: true },
    });

    const userIdSet = new Set<number>();
    challenges.forEach((c: { userId: number }) => userIdSet.add(c.userId));
    return Array.from(userIdSet);
  }

  private async evaluateIncompleteTypes(params: Record<string, any>): Promise<number[]> {
    const types = params.types;
    if (!types || !Array.isArray(types) || types.length === 0) return [];

    const now = getNowKST();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const incompleteProgress = await this.prisma.dailyProgress.findMany({
      where: {
        date: { gte: todayStart, lte: todayEnd },
        missionType: { in: types },
        isCompleted: false,
      },
      select: { userChallengeId: true },
      distinct: ['userChallengeId'],
    });

    if (incompleteProgress.length === 0) return [];

    const challenges = await this.prisma.userChallenge.findMany({
      where: { id: { in: incompleteProgress.map((p: { userChallengeId: number }) => p.userChallengeId) } },
      select: { userId: true },
    });

    const userIdSet = new Set<number>();
    challenges.forEach((c: { userId: number }) => userIdSet.add(c.userId));
    return Array.from(userIdSet);
  }

  private async evaluateCompletionRate(params: Record<string, any>): Promise<number[]> {
    const maxRate = params.rate;
    if (maxRate === undefined) return [];

    const now = getNowKST();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const progress = await this.prisma.dailyProgress.findMany({
      where: { date: { gte: todayStart, lte: todayEnd } },
      select: { userChallengeId: true, isCompleted: true },
    });

    const rateMap = new Map<number, { total: number; completed: number }>();
    for (const p of progress) {
      const current = rateMap.get(p.userChallengeId) || { total: 0, completed: 0 };
      current.total += 1;
      if (p.isCompleted) current.completed += 1;
      rateMap.set(p.userChallengeId, current);
    }

    const targetChallengeIds: number[] = [];
    for (const [challengeId, stats] of rateMap.entries()) {
      const rate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
      if (rate < maxRate) {
        targetChallengeIds.push(challengeId);
      }
    }

    if (targetChallengeIds.length === 0) return [];

    const challenges = await this.prisma.userChallenge.findMany({
      where: { id: { in: targetChallengeIds } },
      select: { userId: true },
    });

    const userIdSet = new Set<number>();
    challenges.forEach((c: { userId: number }) => userIdSet.add(c.userId));
    return Array.from(userIdSet);
  }

  private async evaluateOnboardingState(params: Record<string, any>): Promise<number[]> {
    const state = params.state;
    if (!state) return [];

    let users: { id: number }[] = [];

    switch (state) {
      case 'NOT_STARTED':
        users = await this.prisma.user.findMany({
          where: { challenges: { none: {} } },
          select: { id: true },
        });
        break;
      case 'IN_PROGRESS':
        users = await this.prisma.user.findMany({
          where: { challenges: { some: { status: UserChallengeStatus.ACTIVE } } },
          select: { id: true },
        });
        break;
      case 'COMPLETED':
        users = await this.prisma.user.findMany({
          where: { challenges: { some: { status: UserChallengeStatus.COMPLETED } } },
          select: { id: true },
        });
        break;
      default:
        return [];
    }

    return users.map((u: { id: number }) => u.id);
  }

  private async evaluateChallengeStartOffset(params: Record<string, any>): Promise<number[]> {
    const days = params.days;
    if (days === undefined) return [];

    const now = getNowKST();
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + days);

    const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const targetEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

    const challenges = await this.prisma.userChallenge.findMany({
      where: {
        status: UserChallengeStatus.PENDING,
        activatedAt: { gte: targetStart, lte: targetEnd },
      },
      select: { userId: true },
    });

    const userIdSet = new Set<number>();
    challenges.forEach((c: { userId: number }) => userIdSet.add(c.userId));
    return Array.from(userIdSet);
  }

  private async evaluatePoints(params: Record<string, any>): Promise<number[]> {
    const minPoints = params.min;
    if (minPoints === undefined) return [];

    const users = await this.prisma.user.findMany({
      where: { points: { gte: minPoints } },
      select: { id: true },
    });

    return users.map((u: { id: number }) => u.id);
  }

  private async evaluateCouponExpiring(params: Record<string, any>): Promise<number[]> {
    const hours = params.hours;
    if (hours === undefined) return [];

    const now = getNowKST();
    const thresholdStart = new Date(now.getTime());
    const thresholdEnd = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const userCoupons = await this.prisma.userCoupon.findMany({
      where: {
        usedAt: null,
        expiresAt: { gte: thresholdStart, lte: thresholdEnd },
      },
      select: { userId: true },
    });

    const userIdSet = new Set<number>();
    userCoupons.forEach((c: { userId: number }) => userIdSet.add(c.userId));
    return Array.from(userIdSet);
  }

  private async evaluateCartHasItems(): Promise<number[]> {
    const carts = await this.prisma.cart.findMany({
      where: { items: { some: {} } },
      select: { userId: true },
    });

    return carts.map((c: { userId: number }) => c.userId);
  }
}
