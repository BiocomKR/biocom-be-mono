import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';
import { CryptoUtil } from '../common/utils/crypto.util';
import {
  RecordsDashboardDto,
  RecordsByTypeDto,
  DailyTrendDto,
  TypeHabitDto,
  ChallengeAnalysisDto,
  DayRecordRateDto,
  WeekCompletionDto,
  RecordsStatsDto,
  RecordTypeStatsDto,
  UserRecordStatsListDto,
  UserRecordSummaryDto,
  RecordRowListDto,
  RecordRowItemDto,
  ComparisonDto,
  MetricChangeDto,
  FunnelStageDto,
  CohortDto,
  CohortWeekDto,
} from './dto/records-dashboard.dto';
import {
  UserRecordsQueryDto,
  UserRecordItemDto,
  UserRecordsResponseDto,
  RecordType,
  RECORD_TYPE_LABELS,
} from './dto/user-records.dto';

@Injectable()
export class RecordsService {
  private readonly logger = new Logger(RecordsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 기록 통계 대시보드 (경영진용)
   */
  async getDashboard(excludeTesters: boolean = false): Promise<RecordsDashboardDto> {
    const testerCondition = excludeTesters ? { isTester: false } : {};
    const now = getNowKST();

    // 날짜 범위 계산
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 7일 전
    const days7Ago = new Date(today);
    days7Ago.setDate(days7Ago.getDate() - 7);

    // 14일 전 (트렌드용)
    const days14Ago = new Date(today);
    days14Ago.setDate(days14Ago.getDate() - 14);

    // 30일 전
    const days30Ago = new Date(today);
    days30Ago.setDate(days30Ago.getDate() - 30);

    // 이번 주 시작 (월요일)
    const weekStart = new Date(now);
    const dayOfWeek = weekStart.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - diff);
    weekStart.setUTCHours(0, 0, 0, 0);

    // 지난 주 시작/끝
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekStart);

    // ========== 리텐션 지표 ==========
    // DAU: 오늘 기록한 사용자
    const todayRecords = await this.prisma.userRecord.findMany({
      where: {
        createdAt: { gte: today, lt: tomorrow },
        ...(excludeTesters ? { user: { isTester: false } } : {}),
      },
      select: { userId: true },
    });
    const dau = new Set(todayRecords.map((r) => r.userId)).size;

    // WAU: 최근 7일 기록한 사용자
    const weekRecords = await this.prisma.userRecord.findMany({
      where: {
        createdAt: { gte: days7Ago, lt: tomorrow },
        ...(excludeTesters ? { user: { isTester: false } } : {}),
      },
      select: { userId: true, createdAt: true },
    });
    const wau = new Set(weekRecords.map((r) => r.userId)).size;

    // MAU: 최근 30일 기록한 사용자
    const monthRecords = await this.prisma.userRecord.findMany({
      where: {
        createdAt: { gte: days30Ago, lt: tomorrow },
        ...(excludeTesters ? { user: { isTester: false } } : {}),
      },
      select: { userId: true },
    });
    const mau = new Set(monthRecords.map((r) => r.userId)).size;

    // 스티키니스 (DAU/MAU)
    const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;

    // 7일 리텐션: 7일 전 기록한 사용자 중 오늘도 기록한 비율
    const days7AgoEnd = new Date(days7Ago);
    days7AgoEnd.setDate(days7AgoEnd.getDate() + 1);
    const users7dAgo = await this.prisma.userRecord.findMany({
      where: { createdAt: { gte: days7Ago, lt: days7AgoEnd } },
      select: { userId: true },
    });
    const userIds7dAgo = new Set(users7dAgo.map((r) => r.userId));
    const todayUserIds = new Set(todayRecords.map((r) => r.userId));
    const retained7d = [...userIds7dAgo].filter((id) => todayUserIds.has(id)).length;
    const retention7d = userIds7dAgo.size > 0 ? Math.round((retained7d / userIds7dAgo.size) * 100) : 0;

    // 30일 리텐션
    const days30AgoEnd = new Date(days30Ago);
    days30AgoEnd.setDate(days30AgoEnd.getDate() + 1);
    const users30dAgo = await this.prisma.userRecord.findMany({
      where: { createdAt: { gte: days30Ago, lt: days30AgoEnd } },
      select: { userId: true },
    });
    const userIds30dAgo = new Set(users30dAgo.map((r) => r.userId));
    const retained30d = [...userIds30dAgo].filter((id) => todayUserIds.has(id)).length;
    const retention30d = userIds30dAgo.size > 0 ? Math.round((retained30d / userIds30dAgo.size) * 100) : 0;

    // ========== 참여도 지표 ==========
    // 이번 주 인당 평균 기록 수
    const thisWeekRecords = await this.prisma.userRecord.findMany({
      where: { createdAt: { gte: weekStart, lt: tomorrow } },
      select: { userId: true, date: true },
    });
    const thisWeekUsers = new Set(thisWeekRecords.map((r) => r.userId));
    const avgRecordsPerUser = thisWeekUsers.size > 0
      ? Math.round((thisWeekRecords.length / thisWeekUsers.size) * 10) / 10
      : 0;

    // 연속 기록 일수 계산 (활성 챌린지 사용자 대상)
    const activeUsers = await this.prisma.userChallenge.findMany({
      where: { status: 'ACTIVE' },
      select: { userId: true },
    });
    const activeUserIds = [...new Set(activeUsers.map((u) => u.userId))];

    let totalStreak = 0;
    let maxStreak = 0;
    let streak7dUsers = 0;

    for (const userId of activeUserIds) {
      const userRecordDates = await this.prisma.userRecord.findMany({
        where: {
          userId,
          createdAt: { gte: days30Ago, lt: tomorrow },
        },
        select: { date: true },
        orderBy: { date: 'desc' },
      });

      const uniqueDates = [...new Set(userRecordDates.map((r) => r.date.toISOString().split('T')[0]))].sort().reverse();

      // 현재 연속 일수 계산
      let streak = 0;
      const todayStr = today.toISOString().split('T')[0];
      let checkDate = new Date(today);

      for (let i = 0; i < uniqueDates.length; i++) {
        const checkStr = checkDate.toISOString().split('T')[0];
        if (uniqueDates.includes(checkStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      totalStreak += streak;
      if (streak > maxStreak) maxStreak = streak;
      if (streak >= 7) streak7dUsers++;
    }

    const avgStreakDays = activeUserIds.length > 0
      ? Math.round((totalStreak / activeUserIds.length) * 10) / 10
      : 0;

    // ========== 이탈 위험 지표 ==========
    // 최근 기록 날짜 기준 비활성 사용자
    const days3Ago = new Date(today);
    days3Ago.setDate(days3Ago.getDate() - 3);

    // 활성 챌린지 사용자 중 3일/7일 미기록 사용자
    const recentActiveUsers = await this.prisma.userRecord.findMany({
      where: {
        userId: { in: activeUserIds },
        createdAt: { gte: days3Ago, lt: tomorrow },
      },
      select: { userId: true },
    });
    const recentActiveUserIds = new Set(recentActiveUsers.map((r) => r.userId));
    const inactive3d = activeUserIds.filter((id) => !recentActiveUserIds.has(id)).length;

    const recent7dUsers = await this.prisma.userRecord.findMany({
      where: {
        userId: { in: activeUserIds },
        createdAt: { gte: days7Ago, lt: tomorrow },
      },
      select: { userId: true },
    });
    const recent7dUserIds = new Set(recent7dUsers.map((r) => r.userId));
    const inactive7d = activeUserIds.filter((id) => !recent7dUserIds.has(id)).length;

    const churnRiskRate = activeUserIds.length > 0
      ? Math.round((inactive3d / activeUserIds.length) * 100)
      : 0;

    // ========== 성장 지표 ==========
    // 이번 주 신규 가입자
    const newUsersThisWeek = await this.prisma.user.count({
      where: {
        createdAt: { gte: weekStart, lt: tomorrow },
        ...testerCondition,
      },
    });

    // 신규 가입자 중 첫 기록 전환율
    const newUserIds = await this.prisma.user.findMany({
      where: {
        createdAt: { gte: weekStart, lt: tomorrow },
        ...testerCondition,
      },
      select: { id: true },
    });
    const newUserIdList = newUserIds.map((u) => u.id);
    const newUsersWithRecords = await this.prisma.userRecord.findMany({
      where: { userId: { in: newUserIdList } },
      select: { userId: true },
    });
    const newUsersRecorded = new Set(newUsersWithRecords.map((r) => r.userId)).size;
    const firstRecordConversionRate = newUserIdList.length > 0
      ? Math.round((newUsersRecorded / newUserIdList.length) * 100)
      : 0;

    // 전주 대비 DAU 증감률
    const lastWeekDayRecords = await this.prisma.userRecord.findMany({
      where: {
        createdAt: {
          gte: lastWeekStart,
          lt: new Date(lastWeekStart.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      select: { userId: true },
    });
    const lastWeekDau = new Set(lastWeekDayRecords.map((r) => r.userId)).size;
    const dauGrowthRate = lastWeekDau > 0
      ? Math.round(((dau - lastWeekDau) / lastWeekDau) * 100)
      : 0;

    // ========== 기록 유형별 습관화 ==========
    const typeHabits: TypeHabitDto[] = [];
    const recordTypes = Object.values(RecordType);

    for (const recordType of recordTypes) {
      // 이번 주 해당 유형 기록
      const typeRecords = await this.prisma.userRecord.findMany({
        where: {
          recordType,
          createdAt: { gte: weekStart, lt: tomorrow },
        },
        select: { userId: true, date: true, metadata: true },
      });

      // 사용자별 기록 일수
      const userRecordDays: Map<number, Set<string>> = new Map();
      for (const r of typeRecords) {
        // SUPPLEMENT는 미리 생성되므로, 실제 섭취(morning/afternoon/evening 중 하나라도 true)한 경우만 카운트
        if (recordType === RecordType.SUPPLEMENT) {
          const meta = r.metadata as any;
          if (!meta?.morning && !meta?.afternoon && !meta?.evening) {
            continue; // 하나도 섭취 안 했으면 스킵
          }
        }

        const dateStr = r.date.toISOString().split('T')[0];
        if (!userRecordDays.has(r.userId)) {
          userRecordDays.set(r.userId, new Set());
        }
        userRecordDays.get(r.userId)!.add(dateStr);
      }

      // 주 3회 이상 기록 사용자
      let habitUsers = 0;
      for (const [, dates] of userRecordDays) {
        if (dates.size >= 3) habitUsers++;
      }

      const userCount = userRecordDays.size;
      const habitRate = userCount > 0 ? Math.round((habitUsers / userCount) * 100) : 0;

      typeHabits.push({
        type: recordType,
        label: RECORD_TYPE_LABELS[recordType],
        habitRate,
        userCount,
      });
    }

    // ========== DAU 트렌드 (최근 14일) ==========
    const trendRecords = await this.prisma.userRecord.findMany({
      where: { createdAt: { gte: days14Ago, lt: tomorrow } },
      select: { userId: true, createdAt: true },
    });

    const dauTrend: DailyTrendDto[] = [];
    const current = new Date(days14Ago);
    while (current < tomorrow) {
      const dateStr = current.toISOString().split('T')[0];
      const nextDay = new Date(current);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayRecords = trendRecords.filter((r) => {
        const recordDate = r.createdAt.toISOString().split('T')[0];
        return recordDate === dateStr;
      });

      dauTrend.push({
        date: dateStr,
        records: dayRecords.length,
        users: new Set(dayRecords.map((r) => r.userId)).size,
      });

      current.setDate(current.getDate() + 1);
    }

    // ========== 챌린지 분석 ==========
    const challengeAnalysis = await this.getChallengeAnalysis();

    return {
      retention: {
        dau,
        wau,
        mau,
        stickiness,
        retention7d,
        retention30d,
      },
      engagement: {
        avgRecordsPerUser,
        avgStreakDays,
        maxStreakDays: maxStreak,
        streak7dUsers,
      },
      churnRisk: {
        inactive3d,
        inactive7d,
        churnRiskRate,
      },
      growth: {
        newUsersThisWeek,
        firstRecordConversionRate,
        dauGrowthRate,
      },
      typeHabits,
      dauTrend,
      challengeAnalysis,
      // 고도화: 비교, 퍼널, 코호트
      comparison: await this.getComparison(excludeTesters),
      funnel: await this.getFunnel(excludeTesters),
      cohorts: await this.getCohorts(excludeTesters),
    };
  }

  /**
   * 전주 대비 비교 데이터
   */
  private async getComparison(excludeTesters: boolean): Promise<ComparisonDto> {
    const now = getNowKST();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 이번 주 시작 (월요일)
    const weekStart = new Date(today);
    const dayOfWeek = weekStart.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - diff);
    weekStart.setUTCHours(0, 0, 0, 0);

    // 저번 주 시작/끝
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekStart);

    // 7일 전
    const days7Ago = new Date(today);
    days7Ago.setDate(days7Ago.getDate() - 7);
    const days14Ago = new Date(today);
    days14Ago.setDate(days14Ago.getDate() - 14);

    const testerFilter = excludeTesters ? { user: { isTester: false } } : {};

    // 이번 주 DAU (오늘)
    const todayRecords = await this.prisma.userRecord.findMany({
      where: { createdAt: { gte: today, lt: tomorrow }, ...testerFilter },
      select: { userId: true },
    });
    const currentDau = new Set(todayRecords.map((r) => r.userId)).size;

    // 저번 주 같은 요일 DAU
    const lastWeekSameDay = new Date(today);
    lastWeekSameDay.setDate(lastWeekSameDay.getDate() - 7);
    const lastWeekSameDayEnd = new Date(lastWeekSameDay);
    lastWeekSameDayEnd.setDate(lastWeekSameDayEnd.getDate() + 1);
    const lastWeekRecords = await this.prisma.userRecord.findMany({
      where: { createdAt: { gte: lastWeekSameDay, lt: lastWeekSameDayEnd }, ...testerFilter },
      select: { userId: true },
    });
    const previousDau = new Set(lastWeekRecords.map((r) => r.userId)).size;

    // 이번 주 WAU
    const thisWeekRecords = await this.prisma.userRecord.findMany({
      where: { createdAt: { gte: weekStart, lt: tomorrow }, ...testerFilter },
      select: { userId: true },
    });
    const currentWau = new Set(thisWeekRecords.map((r) => r.userId)).size;

    // 저번 주 WAU
    const lastWeekAllRecords = await this.prisma.userRecord.findMany({
      where: { createdAt: { gte: lastWeekStart, lt: lastWeekEnd }, ...testerFilter },
      select: { userId: true },
    });
    const previousWau = new Set(lastWeekAllRecords.map((r) => r.userId)).size;

    // 7일 리텐션 비교 (이번 주 vs 저번 주)
    // 이번 주: 7일 전 기록자 중 오늘 기록자
    const users7dAgo = await this.prisma.userRecord.findMany({
      where: { createdAt: { gte: days7Ago, lt: new Date(days7Ago.getTime() + 86400000) } },
      select: { userId: true },
    });
    const userIds7dAgo = new Set(users7dAgo.map((r) => r.userId));
    const todayUserIds = new Set(todayRecords.map((r) => r.userId));
    const retained7d = [...userIds7dAgo].filter((id) => todayUserIds.has(id)).length;
    const currentRetention7d = userIds7dAgo.size > 0 ? Math.round((retained7d / userIds7dAgo.size) * 100) : 0;

    // 저번 주: 14일 전 기록자 중 7일 전 기록자
    const users14dAgo = await this.prisma.userRecord.findMany({
      where: { createdAt: { gte: days14Ago, lt: new Date(days14Ago.getTime() + 86400000) } },
      select: { userId: true },
    });
    const userIds14dAgo = new Set(users14dAgo.map((r) => r.userId));
    const userIds7dAgoSet = new Set(users7dAgo.map((r) => r.userId));
    const retained7dPrev = [...userIds14dAgo].filter((id) => userIds7dAgoSet.has(id)).length;
    const previousRetention7d = userIds14dAgo.size > 0 ? Math.round((retained7dPrev / userIds14dAgo.size) * 100) : 0;

    // 완주율 비교
    const days30Ago = new Date(today);
    days30Ago.setDate(days30Ago.getDate() - 30);
    const days60Ago = new Date(today);
    days60Ago.setDate(days60Ago.getDate() - 60);

    const currentCompleted = await this.prisma.userChallenge.count({
      where: { status: 'COMPLETED', updatedAt: { gte: days30Ago } },
    });
    const currentTotal = await this.prisma.userChallenge.count({
      where: { activatedAt: { lte: days30Ago }, OR: [{ status: 'COMPLETED' }, { status: 'ACTIVE' }] },
    });
    const currentCompletionRate = currentTotal > 0 ? Math.round((currentCompleted / currentTotal) * 100) : 0;

    const previousCompleted = await this.prisma.userChallenge.count({
      where: { status: 'COMPLETED', updatedAt: { gte: days60Ago, lt: days30Ago } },
    });
    const previousTotal = await this.prisma.userChallenge.count({
      where: { activatedAt: { lte: days60Ago }, updatedAt: { lt: days30Ago }, OR: [{ status: 'COMPLETED' }, { status: 'ACTIVE' }] },
    });
    const previousCompletionRate = previousTotal > 0 ? Math.round((previousCompleted / previousTotal) * 100) : 0;

    const calcChange = (current: number, previous: number): MetricChangeDto => ({
      current,
      previous,
      change: current - previous,
      changePercent: previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0,
    });

    return {
      dau: calcChange(currentDau, previousDau),
      wau: calcChange(currentWau, previousWau),
      retention7d: calcChange(currentRetention7d, previousRetention7d),
      completionRate: calcChange(currentCompletionRate, previousCompletionRate),
    };
  }

  /**
   * 퍼널 데이터
   */
  private async getFunnel(excludeTesters: boolean): Promise<FunnelStageDto[]> {
    const now = getNowKST();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);

    const days30Ago = new Date(today);
    days30Ago.setDate(days30Ago.getDate() - 30);

    // 기준: 최근 30일 챌린지 시작자
    const challengeStarted = await this.prisma.userChallenge.findMany({
      where: {
        activatedAt: { gte: days30Ago },
        ...(excludeTesters ? { user: { isTester: false } } : {}),
      },
      select: { userId: true, status: true },
    });
    const challengeStartUserIds = [...new Set(challengeStarted.map((c: { userId: number; status: string }) => c.userId))] as number[];
    const challengeStartUsers = challengeStartUserIds.length;

    if (challengeStartUsers === 0) {
      return [
        { stage: 'CHALLENGE_START', label: '챌린지 시작', users: 0, rate: 100, dropoffRate: 0 },
        { stage: 'WEEK1', label: '1주차 유지', users: 0, rate: 0, dropoffRate: 0 },
        { stage: 'WEEK2', label: '2주차 유지', users: 0, rate: 0, dropoffRate: 0 },
        { stage: 'COMPLETED', label: '21일 완주', users: 0, rate: 0, dropoffRate: 0 },
      ];
    }

    // 1주차 유지 (7일 이상 기록한 사용자)
    const week1Retained = await this.countUsersWithRecordDays(challengeStartUserIds, 7, excludeTesters);

    // 2주차 유지 (14일 이상 기록한 사용자)
    const week2Retained = await this.countUsersWithRecordDays(challengeStartUserIds, 14, excludeTesters);

    // 21일 완주
    const completedCount = challengeStarted.filter((c: { userId: number; status: string }) => c.status === 'COMPLETED').length;

    const stages = [
      { stage: 'CHALLENGE_START', label: '챌린지 시작', users: challengeStartUsers },
      { stage: 'WEEK1', label: '1주차 유지', users: week1Retained },
      { stage: 'WEEK2', label: '2주차 유지', users: week2Retained },
      { stage: 'COMPLETED', label: '21일 완주', users: completedCount },
    ];

    const funnel: FunnelStageDto[] = [];
    for (let i = 0; i < stages.length; i++) {
      const rate = challengeStartUsers > 0 ? Math.round((stages[i].users / challengeStartUsers) * 100) : 0;
      const dropoffRate = i === 0 ? 0 : (stages[i - 1].users > 0
        ? Math.round(((stages[i - 1].users - stages[i].users) / stages[i - 1].users) * 100)
        : 0);

      funnel.push({
        stage: stages[i].stage,
        label: stages[i].label,
        users: stages[i].users,
        rate,
        dropoffRate,
      });
    }

    return funnel;
  }

  /**
   * N일 이상 기록한 사용자 수 카운트
   */
  private async countUsersWithRecordDays(
    userIds: number[],
    minDays: number,
    excludeTesters: boolean,
  ): Promise<number> {
    let count = 0;
    for (const userId of userIds) {
      const records = await this.prisma.userRecord.findMany({
        where: {
          userId,
          ...(excludeTesters ? { user: { isTester: false } } : {}),
        },
        select: { date: true },
      });
      const uniqueDays = new Set(records.map((r: { date: Date | null }) => r.date?.toISOString().split('T')[0])).size;
      if (uniqueDays >= minDays) count++;
    }
    return count;
  }

  /**
   * 코호트 데이터 (챌린지 시작월 기준, 최근 6개월)
   */
  private async getCohorts(excludeTesters: boolean): Promise<CohortDto[]> {
    const now = getNowKST();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);

    const cohorts: CohortDto[] = [];

    // 최근 6개월
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      const monthStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;

      // 해당 월 챌린지 시작자 (개인별 시작일 기준)
      const monthChallenges = await this.prisma.userChallenge.findMany({
        where: {
          activatedAt: { gte: monthStart, lt: monthEnd },
          ...(excludeTesters ? { user: { isTester: false } } : {}),
        },
        select: { userId: true, activatedAt: true },
      });

      if (monthChallenges.length === 0) {
        cohorts.push({ month: monthStr, totalUsers: 0, weeks: [] });
        continue;
      }

      // 중복 제거 (한 사용자가 여러 챌린지 시작할 수 있음)
      const userStartDates = new Map<number, Date>();
      for (const c of monthChallenges) {
        if (c.activatedAt && !userStartDates.has(c.userId)) {
          userStartDates.set(c.userId, c.activatedAt);
        }
      }
      const userIds = Array.from(userStartDates.keys());
      const totalUsers = userIds.length;

      // 주차별 리텐션 (개인별 시작일 기준, 1~3주차)
      const weeks: CohortWeekDto[] = [];

      for (let w = 0; w < 3; w++) {
        let activeCount = 0;

        for (const [userId, startDate] of userStartDates) {
          const weekStart = new Date(startDate.getTime() + w * 7 * 86400000);
          const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

          // 아직 해당 주차가 안 된 사용자는 제외
          if (weekEnd > today) continue;

          const hasRecord = await this.prisma.userRecord.findFirst({
            where: {
              userId,
              createdAt: { gte: weekStart, lt: weekEnd },
            },
            select: { id: true },
          });

          if (hasRecord) activeCount++;
        }

        const eligibleUsers = Array.from(userStartDates.entries()).filter(([, startDate]) => {
          const weekEnd = new Date(startDate.getTime() + (w + 1) * 7 * 86400000);
          return weekEnd <= today;
        }).length;

        const rate = eligibleUsers > 0 ? Math.round((activeCount / eligibleUsers) * 100) : 0;
        weeks.push({ week: w + 1, users: activeCount, rate });
      }

      cohorts.push({ month: monthStr, totalUsers, weeks });
    }

    return cohorts;
  }

  /**
   * 챌린지 분석 데이터
   */
  private async getChallengeAnalysis(): Promise<ChallengeAnalysisDto> {
    const now = getNowKST();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);

    // 활성 챌린지 상품 수 (Product 테이블에서 categoryCode='CHALLENGE')
    const activeChallenges = await this.prisma.product.count({
      where: { categoryCode: 'CHALLENGE', status: 'ACTIVE' },
    });

    // 만료된 챌린지 조회 (status가 EXPIRED인 것들)
    const expiredChallenges = await this.prisma.userChallenge.findMany({
      where: { status: 'EXPIRED' },
      select: {
        id: true,
        activatedAt: true,
        expiresAt: true,
        dailyProgress: {
          orderBy: { day: 'desc' },
          take: 1,
          select: { day: true },
        },
      },
    });

    // 완주 = 마지막 일차까지 도달한 챌린지
    const completedChallengeList = expiredChallenges.filter((challenge) => {
      // 날짜만 비교 (시간 무시)
      const startDate = new Date(challenge.activatedAt);
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(challenge.expiresAt);
      endDate.setUTCHours(0, 0, 0, 0);
      const totalDays = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const lastProgress = challenge.dailyProgress[0];
      return lastProgress?.day === totalDays;
    });
    const completedChallenges = completedChallengeList.length;

    // 완주율 = 완주한 챌린지 / 만료된 전체 챌린지
    const completionRate =
      expiredChallenges.length > 0
        ? Math.round((completedChallenges / expiredChallenges.length) * 100)
        : 0;

    // 일차별 기록율 계산을 위해 모든 챌린지의 총 일수 파악
    const allChallenges = await this.prisma.userChallenge.findMany({
      select: {
        id: true,
        activatedAt: true,
        expiresAt: true,
      },
    });

    // 최대 일수 계산 (동적으로, 날짜만 비교)
    const maxDays = allChallenges.reduce((max, challenge) => {
      const startDate = new Date(challenge.activatedAt);
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(challenge.expiresAt);
      endDate.setUTCHours(0, 0, 0, 0);
      const days = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return Math.max(max, days);
    }, 0);

    // 일차별 기록율 (DailyProgress 기반)
    const dayRecordRates: DayRecordRateDto[] = [];
    for (let day = 1; day <= maxDays; day++) {
      const progressData = await this.prisma.dailyProgress.findMany({
        where: { day },
        select: {
          trackingsTotal: true,
          trackingsCompleted: true,
        },
      });

      const totalUsers = progressData.length;
      const recordedUsers = progressData.filter(
        (p) => p.trackingsCompleted > 0,
      ).length;
      const recordRate =
        totalUsers > 0 ? Math.round((recordedUsers / totalUsers) * 100) : 0;

      dayRecordRates.push({
        day,
        totalUsers,
        recordedUsers,
        recordRate,
      });
    }

    // 주차별 완료율 (7일 단위, 동적 주차 수)
    const totalWeeks = Math.ceil(maxDays / 7);
    const weekCompletions: WeekCompletionDto[] = [];
    for (let week = 1; week <= totalWeeks; week++) {
      const startDay = (week - 1) * 7 + 1;
      const endDay = Math.min(week * 7, maxDays);

      // 해당 주차 시작일에 있던 사용자
      const startDayProgress = await this.prisma.dailyProgress.findMany({
        where: { day: startDay },
        select: { userChallengeId: true },
      });
      const startUsers = startDayProgress.length;

      // 해당 주차 마지막일 완료한 사용자
      const endDayProgress = await this.prisma.dailyProgress.findMany({
        where: {
          day: endDay,
          trackingsCompleted: { gt: 0 },
        },
        select: { userChallengeId: true },
      });
      const completedUsers = endDayProgress.length;

      const droppedUsers = startUsers - completedUsers;
      const weekCompletionRate =
        startUsers > 0 ? Math.round((completedUsers / startUsers) * 100) : 0;

      weekCompletions.push({
        week,
        startUsers,
        completedUsers,
        completionRate: weekCompletionRate,
        droppedUsers: Math.max(0, droppedUsers),
      });
    }

    return {
      activeChallenges,
      completedChallenges,
      completionRate,
      dayRecordRates,
      weekCompletions,
    };
  }

  /**
   * 회원별 기록 조회
   */
  async getUserRecords(
    userId: number,
    query: UserRecordsQueryDto,
  ): Promise<UserRecordsResponseDto> {
    const { startDate, endDate, recordType, page = 1, limit = 20 } = query;

    // 날짜 조건
    const dateWhere: any = {};
    if (startDate) {
      dateWhere.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      dateWhere.lt = end;
    }

    const where: any = { userId };
    if (Object.keys(dateWhere).length > 0) {
      where.createdAt = dateWhere;
    }
    if (recordType) {
      where.recordType = recordType;
    }

    // 기록 조회
    const [records, total] = await Promise.all([
      this.prisma.userRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.userRecord.count({ where }),
    ]);

    // SUPPLEMENT 기록에 영양제 정보 추가
    const supplementRecords = records.filter((r) => r.recordType === 'SUPPLEMENT');
    const productIds = supplementRecords
      .map((r) => (r.metadata as any)?.productId)
      .filter((id): id is number => typeof id === 'number');

    let productMap: Map<number, string> = new Map();
    if (productIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      });
      productMap = new Map(products.map((p) => [p.id, p.name]));
    }

    const enrichedRecords = records.map((r) => {
      if (r.recordType === 'SUPPLEMENT') {
        const metadata = r.metadata as any;
        const productId = metadata?.productId;
        const productName = productId ? productMap.get(productId) : null;
        return {
          ...r,
          metadata: {
            ...metadata,
            supplementName: productName || null,
          },
        };
      }
      return r;
    });

    // 전체 기록 요약
    const allRecords = await this.prisma.userRecord.findMany({
      where: { userId },
      select: { recordType: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const byType = this.aggregateByType(allRecords);
    const recentDate = allRecords.length > 0
      ? allRecords[0].createdAt.toISOString().split('T')[0]
      : null;

    return {
      records: enrichedRecords.map((r) => this.toRecordItemDto(r)),
      summary: {
        totalRecords: allRecords.length,
        byType,
        recentDate,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private toRecordItemDto(record: any): UserRecordItemDto {
    return {
      id: record.id,
      recordType: record.recordType,
      recordTypeLabel: RECORD_TYPE_LABELS[record.recordType as RecordType] || record.recordType,
      date: record.date
        ? record.date.toISOString().split('T')[0]
        : record.createdAt.toISOString().split('T')[0],
      metadata: record.metadata,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private aggregateByType(records: { recordType: string }[]): RecordsByTypeDto {
    const result: RecordsByTypeDto = {
      BEAUTY: 0,
      DIET: 0,
      SUPPLEMENT: 0,
      FASTING: 0,
      SLEEP: 0,
      ACTIVITY: 0,
    };

    records.forEach((r) => {
      if (r.recordType in result) {
        result[r.recordType as keyof RecordsByTypeDto]++;
      }
    });

    return result;
  }

  /**
   * 기록통계 내역 (운영용)
   */
  async getRecordsStats(excludeTesters: boolean = false): Promise<RecordsStatsDto> {
    const now = getNowKST();

    // 날짜 범위 계산
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 이번 주 시작 (월요일)
    const weekStart = new Date(now);
    const dayOfWeek = weekStart.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - diff);
    weekStart.setUTCHours(0, 0, 0, 0);

    // 이번 달 시작
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    // 14일 전
    const days14Ago = new Date(today);
    days14Ago.setDate(days14Ago.getDate() - 14);

    // 전체 기록 조회
    const rawRecords = await this.prisma.userRecord.findMany({
      where: excludeTesters ? { user: { isTester: false } } : {},
      select: {
        recordType: true,
        userId: true,
        createdAt: true,
        metadata: true,
      },
    });

    // 영양제는 실제 섭취(true)한 경우만 카운트
    const allRecords = rawRecords.filter((r) => {
      if (r.recordType === 'SUPPLEMENT') {
        const meta = r.metadata as any;
        return meta?.morning || meta?.afternoon || meta?.evening;
      }
      return true;
    });

    // 기간별 필터링
    const todayRecords = allRecords.filter(
      (r) => r.createdAt >= today && r.createdAt < tomorrow,
    );
    const weekRecords = allRecords.filter(
      (r) => r.createdAt >= weekStart && r.createdAt < tomorrow,
    );
    const monthRecords = allRecords.filter(
      (r) => r.createdAt >= monthStart && r.createdAt < tomorrow,
    );

    // 기록 유형별 통계
    const recordTypes = Object.values(RecordType);
    const byType: RecordTypeStatsDto[] = recordTypes.map((type) => {
      const typeRecordsAll = allRecords.filter((r) => r.recordType === type);
      const typeRecordsToday = todayRecords.filter((r) => r.recordType === type);
      const typeRecordsWeek = weekRecords.filter((r) => r.recordType === type);
      const typeRecordsMonth = monthRecords.filter((r) => r.recordType === type);

      return {
        type,
        label: RECORD_TYPE_LABELS[type],
        todayCount: typeRecordsToday.length,
        weekCount: typeRecordsWeek.length,
        monthCount: typeRecordsMonth.length,
        totalCount: typeRecordsAll.length,
        todayUsers: new Set(typeRecordsToday.map((r) => r.userId)).size,
        weekUsers: new Set(typeRecordsWeek.map((r) => r.userId)).size,
      };
    });

    // 일별 트렌드 (최근 14일)
    const trendRecords = allRecords.filter(
      (r) => r.createdAt >= days14Ago && r.createdAt < tomorrow,
    );
    const dailyTrend: DailyTrendDto[] = [];
    const current = new Date(days14Ago);
    while (current < tomorrow) {
      const dateStr = current.toISOString().split('T')[0];
      const nextDay = new Date(current);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayRecords = trendRecords.filter((r) => {
        const recordDate = r.createdAt.toISOString().split('T')[0];
        return recordDate === dateStr;
      });

      dailyTrend.push({
        date: dateStr,
        records: dayRecords.length,
        users: new Set(dayRecords.map((r) => r.userId)).size,
      });

      current.setDate(current.getDate() + 1);
    }

    return {
      totalRecords: allRecords.length,
      todayRecords: todayRecords.length,
      weekRecords: weekRecords.length,
      monthRecords: monthRecords.length,
      byType,
      dailyTrend,
    };
  }

  /**
   * 사용자별 기록통계 목록 (운영용)
   */
  async getUserRecordStatsList(
    page: number = 1,
    limit: number = 20,
    search?: string,
    challengeStatus?: string,
    excludeTesters: boolean = false,
    churnRisk: boolean = false,
  ): Promise<UserRecordStatsListDto> {
    const now = getNowKST();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 이번 주 시작 (월요일)
    const weekStart = new Date(now);
    const dayOfWeek = weekStart.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - diff);
    weekStart.setUTCHours(0, 0, 0, 0);

    // 30일 전
    const days30Ago = new Date(today);
    days30Ago.setDate(days30Ago.getDate() - 30);

    // 3일 전 (이탈 위험 기준)
    const days3Ago = new Date(today);
    days3Ago.setDate(days3Ago.getDate() - 3);

    // 사용자 조회 조건
    const userWhere: any = {};
    if (excludeTesters) {
      userWhere.isTester = false;
    }
    // 이름은 GCM 암호화되어 DB 검색 불가 → 후처리 필터링
    let nameSearchKeyword: string | null = null;
    if (search) {
      if (search.includes('@')) {
        // 이메일 검색
        userWhere.email = { contains: search, mode: 'insensitive' };
      } else {
        // 이름 검색: 후처리 필터링 필요
        nameSearchKeyword = search;
      }
    }

    // 챌린지 상태 필터
    if (challengeStatus) {
      userWhere.userChallenges = {
        some: { status: challengeStatus },
      };
    }

    // 이름 검색인 경우: 전체 조회 후 복호화 필터링
    let users: any[];
    let total: number;

    if (nameSearchKeyword) {
      // 이름 검색: 전체 조회 후 복호화 필터링
      const allUsers = await this.prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          name: true,
          email: true,
          userChallenges: {
            where: { status: { in: ['ACTIVE', 'PENDING'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              status: true,
              dailyProgress: {
                orderBy: { day: 'desc' },
                take: 1,
                select: { day: true },
              },
            },
          },
          userRecords: {
            where: { createdAt: { gte: days30Ago } },
            select: {
              recordType: true,
              createdAt: true,
              date: true,
              metadata: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // 복호화 후 이름 필터링
      const filteredUsers = allUsers.filter(user => {
        const decryptedName = CryptoUtil.decrypt(user.name);
        return decryptedName && decryptedName.includes(nameSearchKeyword);
      });

      total = filteredUsers.length;
      users = filteredUsers.slice((page - 1) * limit, page * limit);
    } else {
      // 일반 조회
      total = await this.prisma.user.count({ where: userWhere });

      users = await this.prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          name: true,
          email: true,
          userChallenges: {
            where: { status: { in: ['ACTIVE', 'PENDING'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              status: true,
              dailyProgress: {
                orderBy: { day: 'desc' },
                take: 1,
                select: { day: true },
              },
            },
          },
          userRecords: {
            where: { createdAt: { gte: days30Ago } },
            select: {
              recordType: true,
              createdAt: true,
              date: true,
              metadata: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
    }

    // 사용자별 통계 계산
    const userSummaries: UserRecordSummaryDto[] = users.map((user) => {
      const challenge = user.userChallenges[0] || null;
      const records = user.userRecords;

      // 영양제는 실제 섭취(true)한 경우만 카운트
      const validRecords = records.filter((r) => {
        if (r.recordType === 'SUPPLEMENT') {
          const meta = r.metadata as any;
          return meta?.morning || meta?.afternoon || meta?.evening;
        }
        return true;
      });

      // 이번 주 기록
      const weekRecords = validRecords.filter(
        (r) => r.createdAt >= weekStart && r.createdAt < tomorrow,
      );

      // 기록 유형별 수 (이번 주)
      const byType: Record<string, number> = {};
      for (const type of Object.values(RecordType)) {
        byType[type] = weekRecords.filter((r) => r.recordType === type).length;
      }

      // 최근 기록일시
      const lastRecordDate = validRecords.length > 0
        ? validRecords[0].createdAt.toISOString()
        : null;

      // 연속 기록 일수 계산
      const uniqueDates = [...new Set(
        validRecords.map((r) => (r.date?.toISOString() || r.createdAt.toISOString()).split('T')[0]),
      )].sort().reverse();

      let streakDays = 0;
      let checkDate = new Date(today);
      for (let i = 0; i < uniqueDates.length; i++) {
        const checkStr = checkDate.toISOString().split('T')[0];
        if (uniqueDates.includes(checkStr)) {
          streakDays++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      return {
        userId: user.id,
        nickname: CryptoUtil.decrypt(user.name) || '',
        email: user.email || '',
        challengeStatus: challenge?.status || null,
        challengeDay: challenge?.dailyProgress[0]?.day || null,
        totalRecords: validRecords.length,
        weekRecords: weekRecords.length,
        lastRecordDate,
        streakDays,
        byType,
      };
    });

    // 이탈 위험 필터: 3일 이상 미기록 사용자만
    if (churnRisk) {
      const churnRiskUsers = userSummaries.filter((user) => {
        if (!user.lastRecordDate) return true; // 기록 없음
        const lastRecord = new Date(user.lastRecordDate);
        return lastRecord < days3Ago;
      });
      return {
        users: churnRiskUsers,
        total: churnRiskUsers.length,
        page: 1,
        limit: churnRiskUsers.length,
        totalPages: 1,
      };
    }

    return {
      users: userSummaries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 기록 Row 목록 조회 (단순 조회)
   */
  async getRecordRowList(
    page: number = 1,
    limit: number = 10,
    recordType?: string,
    startDate?: string,
    endDate?: string,
    search?: string,
    excludeTesters: boolean = false,
  ): Promise<RecordRowListDto> {
    // 날짜 조건
    const dateWhere: any = {};
    if (startDate) {
      dateWhere.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      dateWhere.lt = end;
    }

    // 기본 where 조건
    const where: any = {};
    if (Object.keys(dateWhere).length > 0) {
      where.date = dateWhere;
    }
    if (recordType) {
      where.recordType = recordType;
    }
    if (excludeTesters) {
      where.user = { isTester: false };
    }

    // 검색 조건 (이메일)
    let filterUserIds: number[] | undefined;
    if (search) {
      if (search.includes('@')) {
        // 이메일 검색
        const users = await this.prisma.user.findMany({
          where: { email: { contains: search, mode: 'insensitive' } },
          select: { id: true },
        });
        filterUserIds = users.map((u: { id: number }) => u.id);
        if (filterUserIds.length === 0) {
          return { records: [], total: 0, page, limit, totalPages: 0 };
        }
        where.userId = { in: filterUserIds };
      } else {
        // 이름 검색: 전체 조회 후 후처리 필터링 필요
        // 이름은 암호화되어 있어 DB 검색 불가
      }
    }

    // 기록 조회
    const [records, total] = await Promise.all([
      this.prisma.userRecord.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.userRecord.count({ where }),
    ]);

    // 이름 검색인 경우 후처리 필터링
    let filteredRecords = records;
    if (search && !search.includes('@')) {
      filteredRecords = records.filter((r: any) => {
        const decryptedName = CryptoUtil.decrypt(r.user.name);
        return decryptedName && decryptedName.includes(search);
      });
    }

    // DTO 변환
    const recordItems: RecordRowItemDto[] = filteredRecords.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      userName: CryptoUtil.decrypt(r.user.name) || '',
      userEmail: r.user.email || '',
      recordType: r.recordType,
      recordTypeLabel: RECORD_TYPE_LABELS[r.recordType as RecordType] || r.recordType,
      date: r.date ? r.date.toISOString().split('T')[0] : r.createdAt.toISOString().split('T')[0],
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      records: recordItems,
      total: search && !search.includes('@') ? filteredRecords.length : total,
      page,
      limit,
      totalPages: Math.ceil((search && !search.includes('@') ? filteredRecords.length : total) / limit),
    };
  }
}
