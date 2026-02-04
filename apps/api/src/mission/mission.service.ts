import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { UserSubscriptionStatus } from '../common/enums/user-subscription-status.enum';
import { getKoreanToday, getNowKST } from '../common/utils/kst-date.util';

/**
 * 미션 노출 컨텍스트
 * 홈 화면에서 미션 필터링에 필요한 정보
 */
export interface MissionVisibilityContext {
  /** 사용자 ID */
  userId: number;
  /** 사용자 구독 상태 */
  userStatus: UserSubscriptionStatus;
  /** 현재 챌린지 일차 (챌린지 진행 중인 경우) */
  currentDay?: number;
  /** 챌린지 종료 후 경과 일수 (종료된 경우) */
  daysAfterChallengeEnd?: number;
  /** 활성 챌린지 ID */
  userChallengeId?: number;
}

/**
 * 미션 마스터 서비스
 * 재사용 가능한 미션들을 관리
 */
@Injectable()
export class MissionService {
  private readonly logger = new Logger(MissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 홈 화면용 미션 목록 조회 (정책 기반 필터링)
   *
   * 정책 정의서 기준:
   * - 뉴커머: 미션 노출 안 함
   * - 챌린저: 챌린지 기간에 맞는 미션만 노출
   * - 구독자: 일부 미션만 노출 (챌린지 전용 제외)
   *
   * @param context 미션 노출 컨텍스트 (사용자 상태, 일차 등)
   */
  async getMissionsForHome(context?: MissionVisibilityContext) {
    this.logger.log(`홈 화면용 미션 목록 조회 - context: ${JSON.stringify(context)}`);

    // 컨텍스트가 없으면 빈 배열 반환 (비로그인)
    if (!context) {
      this.logger.log('컨텍스트 없음 - 빈 배열 반환');
      return [];
    }

    const { userId, userStatus, currentDay, daysAfterChallengeEnd, userChallengeId } = context;

    // 뉴커머 처리
    if (userStatus === UserSubscriptionStatus.NEWCOMER) {
      // [3단계] 챌린지 종료 후 일주일 이내 (22~28일): A그룹만 노출, B그룹은 리스트에서 제외
      // A그룹: AFTER_SURVEY(애프터문진), WEEKLY_REPORT(심층리포트)
      // 완료된 A그룹 미션은 즉시 삭제
      if (daysAfterChallengeEnd !== undefined && daysAfterChallengeEnd <= 7) {
        this.logger.log(`뉴커머 + 챌린지 종료 후 ${daysAfterChallengeEnd}일 - A그룹만 노출`);
        const aGroupRecordTypes = ['AFTER_SURVEY', 'WEEKLY_REPORT'];

        // A그룹 미션 완료 여부 조회 (가장 최근 완료된 챌린지 기준)
        const completedAGroupRecordTypes = new Set<string>();

        if (userChallengeId) {
          // AFTER_SURVEY 완료 여부 (userChallengeId 또는 userId 기반)
          const completedAfterSurvey = await this.prisma.userRecord.findFirst({
            where: {
              userId,
              recordType: 'AFTER_SURVEY',
              OR: [
                { userChallengeId },
                { userChallengeId: null },
              ],
            },
            select: { recordType: true },
          });
          if (completedAfterSurvey) {
            completedAGroupRecordTypes.add('AFTER_SURVEY');
          }

          // WEEKLY_REPORT 완료 여부 (NEWCOMER_EXP는 전체 기간 조회)
          const completedWeeklyReport = await this.prisma.userRecord.findFirst({
            where: {
              userId,
              recordType: 'WEEKLY_REPORT',
            },
            select: { recordType: true },
          });
          if (completedWeeklyReport) {
            completedAGroupRecordTypes.add('WEEKLY_REPORT');
          }
        }

        const aGroupMissions = await this.prisma.mission.findMany({
          where: {
            isActive: true,
            recordType: { in: aGroupRecordTypes },
          },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            points: true,
            dailyLimit: true,
            maxPointsPerDay: true,
            recordType: true,
            sortOrder: true,
          },
        });

        // 완료된 A그룹 미션은 필터링 (즉시 삭제)
        const filteredAGroupMissions = aGroupMissions.filter(
          (m) => !completedAGroupRecordTypes.has(m.recordType),
        );

        this.logger.log(`A그룹 필터링: ${aGroupMissions.length}개 중 ${filteredAGroupMissions.length}개 노출 (완료: ${Array.from(completedAGroupRecordTypes).join(', ')})`);

        // A그룹 미션 모두 완료 시 → 블러 처리 + 전체 미션 목업 반환
        if (filteredAGroupMissions.length === 0) {
          this.logger.log('A그룹 미션 모두 완료 - 전체 미션 목업 반환');
          const allMissions = await this.prisma.mission.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              name: true,
              description: true,
              points: true,
              dailyLimit: true,
              maxPointsPerDay: true,
              recordType: true,
              sortOrder: true,
            },
          });

          return allMissions.map((m) => ({
            id: m.id,
            title: m.name,
            description: m.description || '',
            point: m.points,
            max: m.recordType === 'DIET' ? 3 : (m.maxPointsPerDay ?? m.dailyLimit),
            current: 0,
            executed: 0,
            recordType: m.recordType,
            sortOrder: m.sortOrder,
          }));
        }

        return filteredAGroupMissions.map((m) => ({
          id: m.id,
          title: m.name,
          description: m.description || '',
          point: m.points,
          max: m.maxPointsPerDay ?? m.dailyLimit,
          current: 0,
          executed: 0,
          recordType: m.recordType,
          sortOrder: m.sortOrder,
        }));
      }

      // [4단계] 29일차 이후 또는 챌린지 이력 없는 뉴커머: 전체 미션 목록 (목업)
      this.logger.log('뉴커머 - 전체 미션 목록 (목업)');
      const allMissions = await this.prisma.mission.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          points: true,
          dailyLimit: true,
          maxPointsPerDay: true,
          recordType: true,
          sortOrder: true,
        },
      });

      return allMissions.map((m) => ({
        id: m.id,
        title: m.name,
        description: m.description || '',
        point: m.points,
        // DIET(식단)은 포인트 기준 횟수가 3회/day이므로 하드코딩
        max: m.recordType === 'DIET' ? 3 : (m.maxPointsPerDay ?? m.dailyLimit),
        current: 0,
        executed: 0,
        recordType: m.recordType,
        sortOrder: m.sortOrder,
      }));
    }

    // 모든 활성 미션 조회
    const allMissions = await this.prisma.mission.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        points: true,
        dailyLimit: true,
        maxPointsPerDay: true,
        recordType: true,
        sortOrder: true,
        allowedUserTypes: true,
        frequency: true,
        visibleFromDay: true,
        visibleToDay: true,
        visibleAfterSettings: true,
      },
    });

    // A그룹 미션 완료 여부 조회 (완료 시 즉시 삭제 대상)
    // - ONCE 타입: DECLARATION, SELF_PRAISE, AFTER_SURVEY
    // - WEEKLY 타입: WEEKLY_REPORT (심층리포트)
    const aGroupRecordTypes = ['DECLARATION', 'SELF_PRAISE', 'AFTER_SURVEY', 'WEEKLY_REPORT'];
    let completedRecordTypes: Set<string> = new Set();
    let completedRecordDates: Map<string, string> = new Map(); // recordType → 완료 날짜 (YYYY-MM-DD)

    // 이번 주 월요일 계산 (WEEKLY_REPORT 주간 부활 체크용)
    const now = getNowKST();
    const dayOfWeek = now.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday, 0, 0, 0));

    if (userChallengeId) {
      // ONCE 타입 미션 (DECLARATION, SELF_PRAISE, AFTER_SURVEY) - 챌린지 전체 기간 조회
      const onceRecordTypes = ['DECLARATION', 'SELF_PRAISE', 'AFTER_SURVEY'];
      const completedOnceMissions = await this.prisma.userRecord.findMany({
        where: {
          userId,
          userChallengeId,
          recordType: { in: onceRecordTypes },
        },
        select: { recordType: true, date: true },
      });

      for (const m of completedOnceMissions) {
        completedRecordTypes.add(m.recordType);
        const dateStr = m.date.toISOString().split('T')[0];
        completedRecordDates.set(m.recordType, dateStr);
      }
    }

    // WEEKLY_REPORT 완료 여부 조회
    // - CHALLENGER: 전체 기간 조회 (한 번 완료하면 삭제)
    // - SUBSCRIBER: 이번 주 월요일 이후만 조회 (매주 월요일 부활)
    const weeklyReportWhere: any = {
      userId,
      recordType: 'WEEKLY_REPORT',
    };
    if (userStatus === UserSubscriptionStatus.SUBSCRIBER) {
      weeklyReportWhere.createdAt = { gte: thisMonday };
    }

    const completedWeeklyReport = await this.prisma.userRecord.findFirst({
      where: weeklyReportWhere,
      select: { recordType: true, date: true },
    });

    if (completedWeeklyReport) {
      completedRecordTypes.add('WEEKLY_REPORT');
      const dateStr = completedWeeklyReport.date.toISOString().split('T')[0];
      completedRecordDates.set('WEEKLY_REPORT', dateStr);
    }

    // 정책 기반 필터링
    const filteredMissions = allMissions.filter((mission) => {
      // 1. 사용자 타입 체크
      if (mission.allowedUserTypes && mission.allowedUserTypes.length > 0) {
        if (!mission.allowedUserTypes.includes(userStatus)) {
          return false;
        }
      }

      // 2. 일차 기반 노출 체크 (챌린저인 경우)
      if (userStatus === UserSubscriptionStatus.CHALLENGER && currentDay) {
        // visibleFromDay 체크
        if (mission.visibleFromDay && currentDay < mission.visibleFromDay) {
          return false;
        }
        // visibleToDay 체크
        if (mission.visibleToDay && currentDay > mission.visibleToDay) {
          return false;
        }
      }

      // 3. 구독자 + 챌린지 종료 후 노출 체크
      if (userStatus === UserSubscriptionStatus.SUBSCRIBER) {
        const settings = mission.visibleAfterSettings as { daysAfterChallengeEnd?: number; prerequisiteRecordType?: string } | null;

        // 챌린지 종료 후 기간 제한이 있는 경우
        if (settings?.daysAfterChallengeEnd && daysAfterChallengeEnd !== undefined) {
          if (daysAfterChallengeEnd > settings.daysAfterChallengeEnd) {
            return false;
          }
        }
      }

      // 4. 전제조건 미션 완료 체크
      const settings = mission.visibleAfterSettings as { prerequisiteRecordType?: string } | null;
      if (settings?.prerequisiteRecordType) {
        if (!completedRecordTypes.has(settings.prerequisiteRecordType)) {
          return false;
        }
      }

      // 5. A그룹 미션 완료 시 즉시 삭제
      // - WEEKLY_REPORT: 완료 즉시 삭제 (SUBSCRIBER는 매주 월요일 부활)
      // - ONCE 타입(DECLARATION, SELF_PRAISE, AFTER_SURVEY): 완료 익일부터 삭제
      if (completedRecordTypes.has(mission.recordType)) {
        // WEEKLY_REPORT는 완료 즉시 삭제
        if (mission.recordType === 'WEEKLY_REPORT') {
          return false;
        }
        // ONCE 타입은 완료 익일부터 삭제 (당일은 보임)
        if (mission.frequency === 'ONCE') {
          const completedDate = completedRecordDates.get(mission.recordType);
          const today = getKoreanToday();
          if (completedDate !== today) {
            return false;
          }
        }
      }

      return true;
    });

    this.logger.log(`필터링 결과: ${allMissions.length}개 중 ${filteredMissions.length}개 노출`);

    return filteredMissions.map((m) => ({
      id: m.id,
      title: m.name,
      description: m.description || '',
      point: m.points,
      // DIET(식단)은 포인트 기준 횟수가 3회/day이므로 하드코딩
      max: m.recordType === 'DIET' ? 3 : (m.maxPointsPerDay ?? m.dailyLimit),
      current: 0,
      executed: 0,
      recordType: m.recordType,
      sortOrder: m.sortOrder,
    }));
  }
}