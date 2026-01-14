import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { UserSubscriptionStatus } from '../common/enums/user-subscription-status.enum';
import { getKoreanToday } from '../common/utils/kst-date.util';

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
      if (daysAfterChallengeEnd !== undefined && daysAfterChallengeEnd <= 7) {
        this.logger.log(`뉴커머 + 챌린지 종료 후 ${daysAfterChallengeEnd}일 - A그룹만 노출`);
        const aGroupRecordTypes = ['AFTER_SURVEY', 'WEEKLY_REPORT'];
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

        return aGroupMissions.map((m) => ({
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

    // ONCE 타입 미션 완료 여부 및 완료 날짜 조회 (DECLARATION, SELF_PRAISE, AFTER_SURVEY)
    const onceRecordTypes = ['DECLARATION', 'SELF_PRAISE', 'AFTER_SURVEY'];
    let completedRecordTypes: Set<string> = new Set();
    let completedRecordDates: Map<string, string> = new Map(); // recordType → 완료 날짜 (YYYY-MM-DD)

    if (userChallengeId) {
      const completedMissions = await this.prisma.userRecord.findMany({
        where: {
          userId,
          userChallengeId,
          recordType: { in: onceRecordTypes },
        },
        select: { recordType: true, date: true },
      });
      completedRecordTypes = new Set(completedMissions.map((m) => m.recordType));
      // 완료 날짜 저장 (KST 날짜 문자열로 변환)
      for (const m of completedMissions) {
        const dateStr = m.date.toISOString().split('T')[0];
        completedRecordDates.set(m.recordType, dateStr);
      }
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

      // 5. ONCE 타입 미션은 완료한 익일부터 숨김
      if (mission.frequency === 'ONCE' && completedRecordTypes.has(mission.recordType)) {
        const completedDate = completedRecordDates.get(mission.recordType);
        const today = getKoreanToday();
        // 완료 날짜와 오늘이 같으면 노출 (당일은 보임), 다르면 숨김 (익일부터 삭제)
        if (completedDate !== today) {
          return false;
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