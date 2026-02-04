import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { getNowKST, calculateChallengeDay } from '../../common/utils/kst-date.util';
import {
  DryRunRequestDto,
  DryRunMode,
  MockUserStateDto,
  MatchedScheduleDto,
  DryRunMockResponseDto,
  DryRunRealUserResponseDto,
  DryRunRealScheduleResponseDto,
  UserMatchResultDto,
} from '../dto/dry-run.dto';

/**
 * dry-run 서비스
 *
 * 푸시 발송 시뮬레이션 - 실제 발송 없이 조건 평가 결과 확인
 */
@Injectable()
export class DryRunService {
  private readonly logger = new Logger(DryRunService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly conditionEvaluator: ConditionEvaluatorService,
  ) {}

  /**
   * dry-run 실행
   */
  async execute(
    dto: DryRunRequestDto,
  ): Promise<DryRunMockResponseDto | DryRunRealUserResponseDto | DryRunRealScheduleResponseDto> {
    this.logger.log(`🔍 [DryRun] 실행: mode=${dto.mode}, activeOnly=${dto.activeOnly ?? false}`);

    const activeOnly = dto.activeOnly ?? false;

    if (dto.mode === DryRunMode.MOCK) {
      return this.executeMockMode(dto.mockUserState, activeOnly);
    } else {
      if (dto.userId) {
        return this.executeRealUserMode(dto.userId, activeOnly);
      } else if (dto.scheduleId) {
        return this.executeRealScheduleMode(dto.scheduleId, dto.limit || 100);
      } else {
        throw new BadRequestException('Real 모드에서는 userId 또는 scheduleId가 필요합니다');
      }
    }
  }

  /**
   * Mock 모드 - 가상 유저 상태로 시뮬레이션
   */
  private async executeMockMode(mockUserState?: MockUserStateDto, activeOnly: boolean = false): Promise<DryRunMockResponseDto> {
    if (!mockUserState) {
      throw new BadRequestException('Mock 모드에서는 mockUserState가 필요합니다');
    }

    this.logger.log(`🎭 [DryRun/Mock] 가상 상태: ${JSON.stringify(mockUserState)}`);

    // 스케줄 목록 조회
    const schedules = await this.getConditionSchedules(activeOnly);

    // 각 스케줄에 대해 mock 상태가 조건을 만족하는지 평가 (AND 조합)
    const matchedSchedules: MatchedScheduleDto[] = [];

    for (const schedule of schedules) {
      const conditions = schedule.conditions as Array<{ type: string; params: Record<string, any> }> | null;
      if (!conditions || conditions.length === 0) continue;

      // 모든 조건을 만족해야 함 (AND)
      const allMatched = conditions.every((c) =>
        this.evaluateMockCondition(c.type, c.params, mockUserState),
      );

      if (allMatched) {
        matchedSchedules.push({
          id: schedule.id,
          name: schedule.name,
          pushCode: schedule.pushCode || undefined,
          pushGroup: schedule.pushGroup,
          priority: schedule.priority,
          conditions: conditions,
          isActive: schedule.isActive,
        });
      }
    }

    // 그룹별 우선순위 기반 선정
    const selectedSchedules = this.selectByPriority(matchedSchedules);

    this.logger.log(
      `✅ [DryRun/Mock] 매칭: ${matchedSchedules.length}개, 선정: ${selectedSchedules.length}개`,
    );

    return {
      mode: 'mock',
      userState: mockUserState,
      matchedSchedules,
      selectedSchedules,
    };
  }

  /**
   * Real 모드 - 특정 유저의 실제 상태로 시뮬레이션
   */
  private async executeRealUserMode(userId: number, activeOnly: boolean = false): Promise<DryRunRealUserResponseDto> {
    this.logger.log(`👤 [DryRun/Real] userId=${userId}, activeOnly=${activeOnly}`);

    // 유저 정보 및 상태 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userChallenges: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new BadRequestException(`유저를 찾을 수 없습니다: ${userId}`);
    }

    // 유저 상태 구성 (userChallenges를 challenges로 변환)
    const userForState = { ...user, challenges: user.userChallenges };
    const userState = await this.buildUserState(userId, userForState);

    // 스케줄 목록 조회
    const schedules = await this.getConditionSchedules(activeOnly);

    // 각 스케줄에 대해 유저가 조건을 만족하는지 평가 (AND 조합)
    const matchedSchedules: MatchedScheduleDto[] = [];

    for (const schedule of schedules) {
      const conditions = schedule.conditions as Array<{ type: string; params: Record<string, any> }> | null;
      if (!conditions || conditions.length === 0) continue;

      // AND 조합 평가
      const matchedUserIds = await this.conditionEvaluator.evaluateConditions({
        id: schedule.id,
        conditions,
      });

      if (matchedUserIds.includes(userId)) {
        matchedSchedules.push({
          id: schedule.id,
          name: schedule.name,
          pushCode: schedule.pushCode || undefined,
          pushGroup: schedule.pushGroup,
          priority: schedule.priority,
          conditions,
          isActive: schedule.isActive,
        });
      }
    }

    // 그룹별 우선순위 기반 선정
    const selectedSchedules = this.selectByPriority(matchedSchedules);

    this.logger.log(
      `✅ [DryRun/Real] userId=${userId} 매칭: ${matchedSchedules.length}개, 선정: ${selectedSchedules.length}개`,
    );

    return {
      mode: 'real',
      userId,
      userName: user.name || undefined,
      userState,
      matchedSchedules,
      selectedSchedules,
    };
  }

  /**
   * Real 모드 - 특정 스케줄에 매칭되는 유저들 조회
   */
  private async executeRealScheduleMode(
    scheduleId: number,
    limit: number,
  ): Promise<DryRunRealScheduleResponseDto> {
    this.logger.log(`📋 [DryRun/Real] scheduleId=${scheduleId}, limit=${limit}`);

    const schedule = await this.prisma.pushNotificationSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new BadRequestException(`스케줄을 찾을 수 없습니다: ${scheduleId}`);
    }

    const conditions = schedule.conditions as Array<{ type: string; params: Record<string, any> }> | null;
    if (!conditions || conditions.length === 0) {
      throw new BadRequestException('조건 기반 스케줄이 아닙니다');
    }

    // 스케줄 조건에 매칭되는 유저 조회 (AND 조합)
    const matchedUserIds = await this.conditionEvaluator.evaluateConditions({
      id: schedule.id,
      conditions,
    });

    const totalCount = matchedUserIds.length;

    // 제한된 수만큼 유저 상세 정보 조회
    const limitedUserIds = matchedUserIds.slice(0, limit);

    // 각 유저에 대해 전체 스케줄 매칭 결과 조회 (그룹별 선정 포함)
    const matchedUsers: UserMatchResultDto[] = [];

    for (const userId of limitedUserIds) {
      const result = await this.executeRealUserMode(userId);
      matchedUsers.push({
        userId,
        userName: result.userName,
        matchedSchedules: result.matchedSchedules,
        selectedSchedules: result.selectedSchedules,
      });
    }

    this.logger.log(
      `✅ [DryRun/Real] scheduleId=${scheduleId} 매칭: ${totalCount}명 (샘플: ${matchedUsers.length}명)`,
    );

    return {
      mode: 'real',
      scheduleId,
      scheduleName: schedule.name,
      matchedUsers,
      totalCount,
    };
  }

  /**
   * 조건 기반 스케줄 조회
   * @param activeOnly true면 활성 스케줄만, false면 전체
   */
  private async getConditionSchedules(activeOnly: boolean = false) {
    return this.prisma.pushNotificationSchedule.findMany({
      where: {
        conditions: { not: null },
        ...(activeOnly ? { isActive: true } : {}),
      },
      select: {
        id: true,
        name: true,
        pushCode: true,
        conditions: true,
        pushGroup: true,
        priority: true,
        isActive: true,
      },
    });
  }

  /**
   * 유저 상태 구성 (디버깅용)
   */
  private async buildUserState(
    userId: number,
    user: any,
  ): Promise<Record<string, any>> {
    const now = getNowKST();
    const activeChallenge = user.challenges?.[0];

    let challengeDay: number | null = null;
    if (activeChallenge?.activatedAt) {
      challengeDay = calculateChallengeDay(activeChallenge.activatedAt);
    }

    // 미완료 미션 조회
    let incompleteCount = 0;
    let incompleteTypes: string[] = [];
    let completionRate = 0;

    if (activeChallenge) {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      // DailyProgress는 일별 집계 데이터 (missionsTotal, missionsCompleted 등)
      const dailyProgress = await this.prisma.dailyProgress.findFirst({
        where: {
          userChallengeId: activeChallenge.id,
          date: { gte: todayStart, lte: todayEnd },
        },
        select: {
          missionsTotal: true,
          missionsCompleted: true,
          trackingsTotal: true,
          trackingsCompleted: true,
        },
      });

      if (dailyProgress) {
        const totalMissions = dailyProgress.missionsTotal + dailyProgress.trackingsTotal;
        const completedMissions = dailyProgress.missionsCompleted + dailyProgress.trackingsCompleted;
        incompleteCount = totalMissions - completedMissions;
        completionRate = totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0;
      }
    }

    // 미접속 시간 계산
    let noAccessHours: number | null = null;
    if (user.lastSeenAt) {
      const diffMs = now.getTime() - new Date(user.lastSeenAt).getTime();
      noAccessHours = Math.round(diffMs / (1000 * 60 * 60));
    }

    return {
      challengeDay,
      challengeStatus: activeChallenge?.status || null,
      lastSeenAt: user.lastSeenAt?.toISOString() || null,
      noAccessHours,
      incompleteCount,
      incompleteTypes,
      completionRate,
      points: user.points || 0,
    };
  }

  /**
   * Mock 상태로 조건 평가 (DB 조회 없이)
   */
  private evaluateMockCondition(
    conditionType: string,
    params: Record<string, any>,
    mockState: MockUserStateDto,
  ): boolean {
    switch (conditionType) {
      case 'CHALLENGE_DAY':
        return mockState.challengeDay === params.day;

      case 'CHALLENGE_STATUS':
        return mockState.challengeStatus === params.status;

      case 'NO_ACCESS_HOURS': {
        if (!mockState.lastSeenAt) return false;
        const now = getNowKST();
        const lastSeen = new Date(mockState.lastSeenAt);
        const diffHours = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);
        return diffHours >= params.hours;
      }

      case 'INCOMPLETE_COUNT':
        return (mockState.incompleteCount || 0) >= (params.count || 0);

      case 'INCOMPLETE_TYPES': {
        if (!mockState.incompleteTypes || !params.types) return false;
        return params.types.some((t: string) => mockState.incompleteTypes!.includes(t));
      }

      case 'COMPLETION_RATE':
        return (mockState.completionRate || 0) < (params.rate || 100);

      case 'POINTS':
        return (mockState.points || 0) >= (params.min || 0);

      case 'COUPON_EXPIRING_HOURS':
        return mockState.couponExpiringHours !== undefined &&
          mockState.couponExpiringHours <= (params.hours || 12);

      case 'CART_HAS_ITEMS':
        return mockState.cartHasItems === true;

      case 'ONBOARDING_STATE':
        return mockState.onboardingState === params.state;

      case 'CHALLENGE_START_OFFSET_DAYS': {
        const offsetDays = params.offsetDays ?? params.days;
        return mockState.challengeStartOffsetDays === offsetDays;
      }

      case 'REPORT_STATE':
        return mockState.reportState === params.state;

      default:
        return false;
    }
  }

  /**
   * 그룹별 우선순위 기반 스케줄 선정
   */
  private selectByPriority(schedules: MatchedScheduleDto[]): MatchedScheduleDto[] {
    // 그룹별로 분류
    const groupMap = new Map<string, MatchedScheduleDto[]>();

    for (const schedule of schedules) {
      const group = schedule.pushGroup || 'MISSION';
      if (!groupMap.has(group)) {
        groupMap.set(group, []);
      }
      groupMap.get(group)!.push(schedule);
    }

    // 각 그룹에서 priority 가장 높은 것 선정
    const selected: MatchedScheduleDto[] = [];

    for (const [group, groupSchedules] of groupMap.entries()) {
      const sorted = groupSchedules.sort((a, b) => b.priority - a.priority);
      if (sorted.length > 0) {
        selected.push(sorted[0]);
        this.logger.debug(`[SelectByPriority] ${group}: ${sorted[0].name} (priority=${sorted[0].priority})`);
      }
    }

    return selected;
  }
}
