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
   * 다중 조건 미리보기 - AND 조합 대상 유저 수 및 샘플 조회 (발송 없이)
   *
   * @param conditions 조건 배열 (AND 조합)
   * @throws BadRequestException 빈 조건이 포함된 경우
   */
  async previewConditions(
    conditions: Array<{ type: string; params: Record<string, any> }>,
  ): Promise<{
    totalCount: number;
    withTokenCount: number;
    testerCount: number;
    sampleUsers: { id: number; name: string; mobile: string; isTester: boolean }[];
    conditionResults: Array<{ type: string; count: number }>;
  }> {
    // 빈 조건 검증
    if (!conditions || conditions.length === 0) {
      throw new Error('최소 하나의 조건이 필요합니다');
    }

    // 각 조건에 type이 있는지 검증
    for (let i = 0; i < conditions.length; i++) {
      if (!conditions[i].type) {
        throw new Error(`조건 ${i + 1}: 조건 타입이 지정되지 않았습니다`);
      }
    }

    this.logger.log(
      `🔍 [ConditionEvaluator] 다중 조건 미리보기: ${conditions.length}개 조건`,
    );

    // 각 조건별 유저 ID 조회 (병렬)
    const results = await Promise.all(
      conditions.map(async (c) => {
        const userIds = await this.evaluateConditionRaw(c.type, c.params);
        return { type: c.type, userIds };
      }),
    );

    // 각 조건별 결과 기록
    const conditionResults = results.map((r) => ({
      type: r.type,
      count: r.userIds.length,
    }));

    // AND 교집합 계산
    const [first, ...rest] = results.map((r) => r.userIds);
    let acc = new Set(first);
    for (const curr of rest) {
      const set = new Set(curr);
      acc = new Set([...acc].filter((id) => set.has(id)));
    }

    const rawUserIds = [...acc];
    const totalCount = rawUserIds.length;

    if (totalCount === 0) {
      return { totalCount: 0, withTokenCount: 0, testerCount: 0, sampleUsers: [], conditionResults };
    }

    const withTokenUserIds = await this.filterUsersWithActiveToken(rawUserIds);
    const withTokenCount = withTokenUserIds.length;

    const users = await this.prisma.user.findMany({
      where: { id: { in: rawUserIds.slice(0, 20) }, isActive: true },
      select: { id: true, name: true, mobile: true, isTester: true },
    });

    const testerCount = await this.prisma.user.count({
      where: { id: { in: rawUserIds }, isTester: true },
    });

    this.logger.log(
      `✅ [ConditionEvaluator] 다중 조건 미리보기 완료: total=${totalCount}, withToken=${withTokenCount}, testers=${testerCount}`,
    );

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
      conditionResults,
    };
  }

  /**
   * @deprecated previewConditions 사용 권장
   * 단일 조건 미리보기 - 대상 유저 수 및 샘플 조회 (발송 없이)
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
    // 단일 조건을 배열로 변환하여 previewConditions 호출
    const result = await this.previewConditions([
      { type: conditionType, params: conditionParams },
    ]);

    return {
      totalCount: result.totalCount,
      withTokenCount: result.withTokenCount,
      testerCount: result.testerCount,
      sampleUsers: result.sampleUsers,
    };
  }

  /**
   * 다중 조건에 맞는 테스터만 조회 (AND 조합)
   */
  async evaluateConditionsTestersOnly(
    conditions: Array<{ type: string; params: Record<string, any> }>,
  ): Promise<number[]> {
    // 빈 조건 검증
    if (!conditions || conditions.length === 0) {
      throw new Error('최소 하나의 조건이 필요합니다');
    }

    for (let i = 0; i < conditions.length; i++) {
      if (!conditions[i].type) {
        throw new Error(`조건 ${i + 1}: 조건 타입이 지정되지 않았습니다`);
      }
    }

    this.logger.log(`🧪 [ConditionEvaluator] 테스터 대상 다중 조건 평가: ${conditions.length}개 조건`);

    // 각 조건별 유저 ID 조회 (병렬)
    const results = await Promise.all(
      conditions.map((c) => this.evaluateCondition(c.type, c.params)),
    );

    // AND 교집합 계산
    const [first, ...rest] = results;
    let acc = new Set(first);
    for (const curr of rest) {
      const set = new Set(curr);
      acc = new Set([...acc].filter((id) => set.has(id)));
    }

    const userIds = [...acc];
    if (userIds.length === 0) return [];

    // 테스터만 필터링
    const testers = await this.prisma.user.findMany({
      where: { id: { in: userIds }, isTester: true },
      select: { id: true },
    });

    const testerIds = testers.map((u: { id: number }) => u.id);
    this.logger.log(`✅ [ConditionEvaluator] 테스터 필터링: total=${userIds.length}, testers=${testerIds.length}`);

    return testerIds;
  }

  /**
   * @deprecated evaluateConditionsTestersOnly 사용 권장
   * 단일 조건에 맞는 테스터만 조회
   */
  async evaluateConditionTestersOnly(
    conditionType: string,
    conditionParams: Record<string, any>,
  ): Promise<number[]> {
    return this.evaluateConditionsTestersOnly([
      { type: conditionType, params: conditionParams },
    ]);
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
   * 다중 조건 AND 조합 평가
   * 모든 조건을 만족하는 유저만 반환 (교집합)
   */
  async evaluateConditions(schedule: {
    id: number;
    conditions?: Array<{ type: string; params: Record<string, any> }> | null;
  }): Promise<number[]> {
    if (!schedule.conditions?.length) {
      this.logger.warn(`⚠️ [ConditionEvaluator] 스케줄 ${schedule.id}: conditions가 없습니다`);
      return [];
    }

    this.logger.log(
      `🔍 [ConditionEvaluator] AND 조합 평가 시작: 스케줄 ${schedule.id}, 조건 ${schedule.conditions.length}개`,
    );

    // 각 조건별 유저 ID 조회 (병렬)
    const results = await Promise.all(
      schedule.conditions.map((c) => this.evaluateCondition(c.type, c.params)),
    );

    // 교집합 반환 (Set 사용으로 O(n) 보장)
    const [first, ...rest] = results;
    let acc = new Set(first);
    for (const curr of rest) {
      const set = new Set(curr);
      acc = new Set([...acc].filter((id) => set.has(id)));
    }

    const userIds = [...acc];
    this.logger.log(`✅ [ConditionEvaluator] AND 조합 결과: ${userIds.length}명`);
    return userIds;
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
      case 'REPORT_STATE':
        return this.evaluateReportState(conditionParams);
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

  /**
   * CHALLENGE_DAY: 챌린지 N일차 유저
   * params:
   * - day: 정확한 일차 (예: 7)
   * - dayMin, dayMax: 일차 범위 (예: 1~3)
   */
  private async evaluateChallengeDay(params: Record<string, any>): Promise<number[]> {
    const { day, dayMin, dayMax } = params;
    if (day === undefined && dayMin === undefined && dayMax === undefined) return [];

    const challenges = await this.prisma.userChallenge.findMany({
      where: {
        status: UserChallengeStatus.ACTIVE,
        activatedAt: { not: undefined },
      },
      select: { userId: true, activatedAt: true },
    });

    const userIdSet = new Set<number>();
    for (const challenge of challenges) {
      if (challenge.activatedAt) {
        const currentDay = calculateChallengeDay(challenge.activatedAt);

        let matched = false;
        if (day !== undefined) {
          matched = currentDay === day;
        } else if (dayMin !== undefined || dayMax !== undefined) {
          const min = dayMin ?? 1;
          const max = dayMax ?? 999;
          matched = currentDay >= min && currentDay <= max;
        }

        if (matched) {
          userIdSet.add(challenge.userId);
        }
      }
    }

    return Array.from(userIdSet);
  }

  /**
   * CHALLENGE_STATUS: 특정 챌린지 상태의 유저
   * params:
   * - status: 단일 상태 (예: 'ACTIVE')
   * - statuses: 복수 상태 (예: ['ACTIVE', 'PENDING'])
   */
  private async evaluateChallengeStatus(params: Record<string, any>): Promise<number[]> {
    const { status, statuses } = params;
    const statusList = statuses || (status ? [status] : []);

    if (statusList.length === 0) {
      this.logger.warn('[CHALLENGE_STATUS] 상태 조건이 지정되지 않음');
      return [];
    }

    const challenges = await this.prisma.userChallenge.findMany({
      where: { status: { in: statusList } },
      select: { userId: true },
      distinct: ['userId'],
    });

    return challenges.map((c: { userId: number }) => c.userId);
  }

  /**
   * NO_ACCESS_HOURS: N시간 이상 미접속 유저
   * params:
   * - hours: 정확한 시간 이상 미접속 (예: 24)
   * - hoursMin, hoursMax: 시간 범위 (예: 24~48)
   */
  private async evaluateNoAccessHours(params: Record<string, any>): Promise<number[]> {
    const { hours, hoursMin, hoursMax } = params;
    if (hours === undefined && hoursMin === undefined && hoursMax === undefined) return [];

    const now = getNowKST();

    // lastSeenAt이 있는 유저 조회
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        pushEnabled: true,
      },
      select: { id: true, lastSeenAt: true },
    });

    const matchedUserIds: number[] = [];

    for (const user of users) {
      // lastSeenAt이 없으면 미접속으로 간주
      let diffHours = Infinity;
      if (user.lastSeenAt) {
        const diffMs = now.getTime() - user.lastSeenAt.getTime();
        diffHours = diffMs / (1000 * 60 * 60);
      }

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

    return matchedUserIds;
  }

  /**
   * INCOMPLETE_COUNT: 오늘 미완료 미션 수 (ChallengeMission 기반 - biocom-api와 동일)
   */
  private async evaluateIncompleteCount(params: Record<string, any>): Promise<number[]> {
    const count = params.count;
    const countMin = params.countMin;
    const countMax = params.countMax;
    if (count === undefined && countMin === undefined && countMax === undefined) return [];

    const now = getNowKST();

    // 활성 챌린지 유저 조회 (activatedAt, productId 포함)
    const activeUserChallenges = await this.prisma.userChallenge.findMany({
      where: { status: UserChallengeStatus.ACTIVE, activatedAt: { not: undefined } },
      select: { userId: true, id: true, productId: true, activatedAt: true },
    });

    const matchedUserIds: number[] = [];

    for (const uc of activeUserChallenges) {
      if (!uc.activatedAt) continue;

      // 현재 일차 계산
      const currentDay = calculateChallengeDay(uc.activatedAt);

      // 오늘 일차의 미션 목록 조회
      const todayMissions = await this.prisma.challengeMission.findMany({
        where: {
          productId: uc.productId,
          day: currentDay,
          isActive: true,
        },
        select: { id: true },
      });

      if (todayMissions.length === 0) continue;

      // 완료된 미션 조회 (metadata.isCompleted = true)
      const completedRecords = await this.prisma.userRecord.findMany({
        where: {
          userId: uc.userId,
          userChallengeId: uc.id,
          metadata: {
            path: ['isCompleted'],
            equals: true,
          },
        },
        select: { metadata: true },
      });

      // 완료된 challengeMissionId 수집
      const completedMissionIds = new Set(
        completedRecords
          .map((r: { metadata: unknown }) => (r.metadata as any)?.challengeMissionId)
          .filter((id: unknown) => id !== undefined),
      );

      // 미완료 미션 수 계산
      const incompleteCount = todayMissions.filter(
        (m: { id: number }) => !completedMissionIds.has(m.id),
      ).length;

      let matched = false;

      if (count !== undefined) {
        matched = incompleteCount === count;
      } else if (countMin !== undefined || countMax !== undefined) {
        const min = countMin ?? 0;
        const max = countMax ?? 999;
        matched = incompleteCount >= min && incompleteCount <= max;
      }

      if (matched) {
        matchedUserIds.push(uc.userId);
      }
    }

    return matchedUserIds;
  }

  /**
   * INCOMPLETE_TYPES: 특정 recordType 미완료 (UserRecord 기반 - biocom-api와 동일)
   *
   * 실제 DB의 recordType 값: BEAUTY, DIET, FASTING, SLEEP, ACTIVITY,
   * DECLARATION, SELF_PRAISE, QUIZ, BALANCE_GAME, DAILY_MISSION, SUPPLEMENT 등
   */
  private async evaluateIncompleteTypes(params: Record<string, any>): Promise<number[]> {
    const types = params.types;
    if (!types || !Array.isArray(types) || types.length === 0) return [];

    const now = getNowKST();
    const todayStr = now.toISOString().split('T')[0];

    // 활성 챌린지 유저 조회
    const activeUserChallenges = await this.prisma.userChallenge.findMany({
      where: { status: UserChallengeStatus.ACTIVE },
      select: { userId: true, id: true },
    });

    const matchedUserIds: number[] = [];

    for (const uc of activeUserChallenges) {
      // 오늘 기록 조회
      const todayRecords = await this.prisma.userRecord.findMany({
        where: {
          userId: uc.userId,
          userChallengeId: uc.id,
          date: new Date(todayStr),
        },
        select: { recordType: true },
      });

      const completedTypes = new Set(todayRecords.map((r) => r.recordType));

      // 지정된 타입 중 하나라도 미완료면 매칭
      const hasIncomplete = types.some((t: string) => !completedTypes.has(t));

      if (hasIncomplete) {
        matchedUserIds.push(uc.userId);
      }
    }

    return matchedUserIds;
  }

  /**
   * COMPLETION_RATE: 오늘 미션 완료율 (ChallengeMission 기반)
   *
   * params:
   * - rate: 정확한 비율 (0~100)
   * - rateMin, rateMax: 비율 범위
   */
  private async evaluateCompletionRate(params: Record<string, any>): Promise<number[]> {
    const rate = params.rate;
    const rateMin = params.rateMin;
    const rateMax = params.rateMax;
    if (rate === undefined && rateMin === undefined && rateMax === undefined) return [];

    const now = getNowKST();

    // 활성 챌린지 유저 조회 (activatedAt, productId 포함)
    const activeUserChallenges = await this.prisma.userChallenge.findMany({
      where: { status: UserChallengeStatus.ACTIVE, activatedAt: { not: undefined } },
      select: {
        userId: true,
        id: true,
        productId: true,
        activatedAt: true,
      },
    });

    const matchedUserIds: number[] = [];

    for (const uc of activeUserChallenges) {
      if (!uc.activatedAt) continue;

      // 현재 일차 계산
      const currentDay = calculateChallengeDay(uc.activatedAt);

      // 오늘 일차의 미션 목록 조회
      const todayMissions = await this.prisma.challengeMission.findMany({
        where: {
          productId: uc.productId,
          day: currentDay,
          isActive: true,
        },
        select: { id: true },
      });

      if (todayMissions.length === 0) continue;

      // 완료된 미션 조회 (metadata.isCompleted = true)
      const completedRecords = await this.prisma.userRecord.findMany({
        where: {
          userId: uc.userId,
          userChallengeId: uc.id,
          metadata: {
            path: ['isCompleted'],
            equals: true,
          },
        },
        select: { metadata: true },
      });

      // 완료된 challengeMissionId 수집
      const completedMissionIds = new Set(
        completedRecords
          .map((r) => (r.metadata as any)?.challengeMissionId)
          .filter((id) => id !== undefined),
      );

      // 완료율 계산
      const completedCount = todayMissions.filter((m) => completedMissionIds.has(m.id)).length;
      const completionRate = (completedCount / todayMissions.length) * 100;

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

    return matchedUserIds;
  }

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
        // 챌린지가 있지만 사전설문 결과가 없는 유저
        const usersWithChallenge = await this.prisma.user.findMany({
          where: {
            userChallenges: { some: {} },
            challengeSurveyResults: { none: { beforeCompletedAt: { not: null } } },
          },
          select: { id: true },
        });
        return usersWithChallenge.map((u: { id: number }) => u.id);
      }

      // 맞춤 솔루션 조회 미완료 (유형분류 문진 완료 + 솔루션 미조회)
      // 참고: 현재 DB에 솔루션 조회 여부 필드가 없어서 구현 보류
      case 'SOLUTION_NOT_VIEWED': {
        this.logger.warn('⚠️ SOLUTION_NOT_VIEWED 조건은 솔루션 조회 추적 필드가 필요합니다.');
        return [];
      }

      // 맞춤 솔루션 조회 완료 + 시작일 미지정
      case 'SOLUTION_VIEWED_START_NOT_SET': {
        // 사전설문 완료 + 시작일 미지정된 유저
        // 솔루션 조회 여부는 추적할 수 없으므로 사전설문 완료 + 시작일 미지정으로 대체
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

  private async evaluateChallengeStartOffset(params: Record<string, any>): Promise<number[]> {
    // offsetDays 또는 days 파라미터 지원
    const offsetDays = params.offsetDays ?? params.days;
    if (offsetDays === undefined) return [];

    const now = getNowKST();
    const targetDate = new Date(now);
    // offsetDays가 -1이면: 오늘 + (-1) = 어제가 targetDate
    // 즉, 내일(targetDate + 1일)이 시작일인 유저를 찾음
    // 다시 말해: activatedAt이 오늘 - offsetDays 인 유저
    targetDate.setDate(targetDate.getDate() - offsetDays);

    const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const targetEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

    // activatedAt이 targetDate인 PENDING 상태의 챌린지를 가진 유저
    // offsetDays=-1: 내일 시작 예정인 유저 (activatedAt이 내일)
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

  /**
   * POINTS: 보유 포인트 조건
   * params:
   * - pointsMin: 최소 포인트
   * - pointsMax: 최대 포인트
   */
  private async evaluatePoints(params: Record<string, any>): Promise<number[]> {
    const { pointsMin, pointsMax } = params;

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        pushEnabled: true,
        ...(pointsMin !== undefined || pointsMax !== undefined
          ? {
              points: {
                ...(pointsMin !== undefined ? { gte: pointsMin } : {}),
                ...(pointsMax !== undefined ? { lte: pointsMax } : {}),
              },
            }
          : {}),
      },
      select: { id: true },
    });

    return users.map((u: { id: number }) => u.id);
  }

  /**
   * COUPON_EXPIRING_HOURS: 쿠폰 만료 임박 유저
   * params:
   * - expiringHours: N시간 내 만료 예정
   */
  private async evaluateCouponExpiring(params: Record<string, any>): Promise<number[]> {
    const expiringHours = params.expiringHours;
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

    return userCoupons.map((uc: { userId: number }) => uc.userId);
  }

  /**
   * CART_HAS_ITEMS: 장바구니에 상품이 있는 유저
   */
  private async evaluateCartHasItems(): Promise<number[]> {
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

    return carts.map((c: { userId: number }) => c.userId);
  }

  private async evaluateReportState(params: Record<string, any>): Promise<number[]> {
    const state = params.state;
    if (!state) return [];

    switch (state) {
      // 심층 리포트 미확인 (isRead = false인 리포트가 있는 유저)
      case 'UNREAD': {
        const reports = await this.prisma.userDeepReport.findMany({
          where: { isRead: false },
          select: { userId: true },
        });
        const userIdSet = new Set<number>();
        reports.forEach((r: { userId: number }) => userIdSet.add(r.userId));
        return Array.from(userIdSet);
      }

      // 심층 리포트 확인 완료 (모든 리포트가 isRead = true인 유저)
      case 'ALL_READ': {
        // 리포트가 있고, 미읽음 리포트가 없는 유저
        const usersWithReports = await this.prisma.userDeepReport.findMany({
          select: { userId: true },
          distinct: ['userId'],
        });
        const usersWithUnread = await this.prisma.userDeepReport.findMany({
          where: { isRead: false },
          select: { userId: true },
          distinct: ['userId'],
        });
        const unreadUserIds = new Set(usersWithUnread.map((r: { userId: number }) => r.userId));
        return usersWithReports
          .map((r: { userId: number }) => r.userId)
          .filter((id: number) => !unreadUserIds.has(id));
      }

      default:
        this.logger.warn(`⚠️ 알 수 없는 REPORT_STATE: ${state}`);
        return [];
    }
  }
}
