import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { UserSubscriptionStatus } from '../common/enums/user-subscription-status.enum';
import { UserChallengeStatus, YesNo } from '../common/enums';
import {
  HomeResponseDto,
  AnimalTypeDto,
  PersonaInfoDto,
  ChallengeInfoDto,
  MissionItemDto,
  BannerInfoDto,
} from './dto/home.dto';
import { getNowKST, getKoreanToday } from '../common/utils/kst-date.util';
import { SibApiService } from '../sib/services/sib-api.service';
import { BannersService } from '../shop/services/banners.service';
import { MissionService, MissionVisibilityContext } from '../mission/mission.service';

/** 캐시 TTL (1분) */
const CACHE_TTL_MS = 60 * 1000;

/** 차트 캐시 정보 */
interface ReportInfo {
  chartId: string | null;
  resultYN: YesNo;
  sibError?: boolean;
}

/** 챌린지 상태별 분류 결과 */
interface ChallengesByStatus {
  active?: UserChallengeData;
  pending?: UserChallengeData;
  completed?: UserChallengeData;
  firstVisitAfterEnd?: UserChallengeData;
}

/** 챌린지 날짜 계산 결과 */
interface ChallengeDays {
  currentDay?: number;
  daysAfterChallengeEnd?: number;
}

/** UserChallenge 데이터 타입 */
interface UserChallengeData {
  id: number;
  productId: number;
  status: string;
  expiresAt: Date | null;
  activatedAt: Date | null;
  createdAt: Date;
  totalPoints: number;
  isFirstEntry: boolean;
  isFirstChallengeEnd: boolean;
  product: {
    id: number;
    sku: string;
    name: string;
    challengeMissions: ChallengeMissionData[];
  };
  userMissions: UserMissionData[];
}

interface ChallengeMissionData {
  id: number;
  day: number;
  points: number;
  sortOrder: number;
  mission: {
    id: number;
    name: string;
    description: string;
    dailyLimit: number | null;
    recordType: string;
  };
}

interface UserMissionData {
  id: number;
  challengeMissionId: number;
  day: number;
  isCompleted: boolean;
  attemptNumber: number;
}

/** 사용자 조회 결과 타입 */
interface UserData {
  id: number;
  mobile: string;
  points: number;
  status: string;
  aiPersonaId: number | null;
  health_type_animal_id: number | null;
  isFirstAppEntry: boolean;
  aiPersona: { id: number; name: string; personaUrl: string | null } | null;
  healthTypeAnimal: {
    id: number;
    animalName: string;
    catchphrase: string;
    images: { file: { filePath: string } | null }[];
  } | null;
  userChallenges: UserChallengeData[];
  userCharts: { chartId: string; resultYn: string; updatedAt: Date | null }[];
}

/**
 * 홈 화면 서비스
 * 사용자의 구독 상태에 따라 적절한 홈 화면 데이터를 제공
 */
@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sibApiService: SibApiService,
    private readonly bannersService: BannersService,
    private readonly missionService: MissionService,
  ) {}

  /**
   * 종합건강대사 검사 완료 여부 확인
   * TODO: 외부 API 연동 필요
   */
  async getHealthExamStatus(userId: number): Promise<{ isCompleted: boolean; examDate?: string; message: string }> {
    this.logger.log(`종합건강대사 검사 상태 확인 - 사용자 ID: ${userId}`);
    return {
      isCompleted: true,
      examDate: '2025-09-15',
      message: '검사가 완료되었습니다',
    };
  }

  /**
   * 홈 화면 데이터 조회
   */
  async getHomeData(userId: number): Promise<HomeResponseDto> {
    this.logger.log(`홈 화면 데이터 조회 시작 - 사용자 ID: ${userId}`);

    try {
      // 1. 사용자 정보 조회
      const user = await this.fetchUserData(userId);
      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다');
      }

      // 2. 각 데이터 구성 (병렬 처리 가능한 것은 병렬로)
      const [reportInfo, banner] = await Promise.all([
        this.getReportInfo(userId, user),
        this.getHomeBanner(user.id),
      ]);

      // 3. 챌린지 관련 데이터 처리
      const challenges = this.getChallengesByStatus(user.userChallenges);
      const challengeDays = this.calculateChallengeDays(challenges);

      // 4. 미션 목록 조회 및 진행도 업데이트
      let missionList = await this.getMissionList(userId, user.status, challenges, challengeDays);
      // NEWCOMER가 아닌 경우 진행도 업데이트 (CHALLENGER, SUBSCRIBER 모두)
      if (user.status !== UserSubscriptionStatus.NEWCOMER) {
        missionList = await this.updateMissionProgress(userId, missionList);
      }

      // 5. 챌린지 정보 구성 (CHALLENGER만)
      const challengeInfo = this.buildChallengeInfo(user.status, challenges.active, challengeDays.currentDay);

      // 6. 첫 방문 플래그 처리
      const firstVisitFlags = this.handleFirstVisitFlags(userId, user, reportInfo, challenges, challengeDays.currentDay);

      // 7. 날짜 정보
      const { startDate, endDate } = this.getChallengeDates(challenges);

      return {
        reportInfo: {
          chartId: reportInfo.chartId,
          resultYN: reportInfo.resultYN,
          sibError: reportInfo.sibError,
        },
        animalType: this.buildAnimalType(reportInfo.resultYN, user.healthTypeAnimal),
        persona: this.buildPersona(user.aiPersona),
        userPoint: user.points ?? 0,
        banner,
        challengeInfo,
        startDate,
        endDate,
        missionList,
        ...firstVisitFlags,
      };
    } catch (error) {
      this.logger.error(`홈 화면 데이터 조회 실패 - 사용자 ID: ${userId}`, error);
      throw error;
    }
  }

  // ==================== Private Methods ====================

  /**
   * 사용자 정보 조회 (관계 데이터 포함)
   */
  private async fetchUserData(userId: number): Promise<UserData | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        mobile: true,
        points: true,
        status: true,
        aiPersonaId: true,
        health_type_animal_id: true,
        isFirstAppEntry: true,
        aiPersona: {
          select: { id: true, name: true, personaUrl: true },
        },
        healthTypeAnimal: {
          select: {
            id: true,
            animalName: true,
            catchphrase: true,
            images: {
              where: { imageType: 'THUMBNAIL' },
              take: 1,
              select: { file: { select: { filePath: true } } },
            },
          },
        },
        userChallenges: {
          where: { status: { in: [UserChallengeStatus.ACTIVE, UserChallengeStatus.PENDING, UserChallengeStatus.COMPLETED] } },
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            productId: true,
            status: true,
            expiresAt: true,
            activatedAt: true,
            createdAt: true,
            totalPoints: true,
            isFirstEntry: true,
            isFirstChallengeEnd: true,
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                challengeMissions: {
                  where: { isActive: true },
                  select: {
                    id: true,
                    day: true,
                    points: true,
                    sortOrder: true,
                    mission: {
                      select: { id: true, name: true, description: true, dailyLimit: true, recordType: true },
                    },
                  },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
            userMissions: {
              select: { id: true, challengeMissionId: true, day: true, isCompleted: true, attemptNumber: true },
            },
          },
        },
        userCharts: {
          where: { orderCode: { in: ['D0004', 'D0060'] } },
          orderBy: { receiptDate: 'desc' },
          take: 1,
          select: { chartId: true, resultYn: true, updatedAt: true },
        },
      },
    }) as Promise<UserData | null>;
  }

  /**
   * 검사 결과 정보 조회 (캐시 처리 포함)
   */
  private async getReportInfo(userId: number, user: UserData): Promise<ReportInfo> {
    if (user.userCharts.length > 0) {
      const cachedChart = user.userCharts[0];
      const now = getNowKST();
      const cacheAge = cachedChart.updatedAt
        ? now.getTime() - new Date(cachedChart.updatedAt).getTime()
        : Infinity;

      // TTL 만료 시 백그라운드 갱신
      if (cacheAge > CACHE_TTL_MS) {
        this.logger.log(`캐시 TTL 만료 (${Math.round(cacheAge / 1000)}초) - 백그라운드 갱신`);
        this.refreshChartData(userId, user.mobile).catch((err) => {
          this.logger.warn(`차트 데이터 백그라운드 갱신 실패 - 사용자 ID: ${userId}`, err);
        });
      }

      return {
        chartId: cachedChart.chartId,
        resultYN: cachedChart.resultYn as YesNo,
      };
    }

    // 캐시 미스 - 백그라운드로 SIB API 호출
    this.fetchAndSaveChartData(userId, user.mobile).catch((err) => {
      this.logger.warn(`차트 데이터 백그라운드 저장 실패 - 사용자 ID: ${userId}`, err);
    });

    return { chartId: null, resultYN: YesNo.N };
  }

  /**
   * 동물 유형 DTO 생성
   */
  private buildAnimalType(resultYN: YesNo, healthTypeAnimal: UserData['healthTypeAnimal']): AnimalTypeDto | null {
    if (resultYN !== YesNo.Y || !healthTypeAnimal) {
      return null;
    }

    return {
      name: healthTypeAnimal.animalName,
      description: healthTypeAnimal.catchphrase,
      imageUrl: healthTypeAnimal.images?.[0]?.file?.filePath || '',
    };
  }

  /**
   * 페르소나 DTO 생성
   */
  private buildPersona(aiPersona: UserData['aiPersona']): PersonaInfoDto | null {
    if (!aiPersona) {
      return null;
    }

    return {
      name: aiPersona.name,
      imageUrl: aiPersona.personaUrl || '',
    };
  }

  /**
   * 챌린지 상태별 분류
   */
  private getChallengesByStatus(userChallenges: UserChallengeData[]): ChallengesByStatus {
    return {
      active: userChallenges.find((uc) => uc.status === UserChallengeStatus.ACTIVE),
      pending: userChallenges.find((uc) => uc.status === UserChallengeStatus.PENDING),
      completed: userChallenges.find((uc) => uc.status === UserChallengeStatus.COMPLETED),
      firstVisitAfterEnd: userChallenges.find(
        (uc) => uc.status === UserChallengeStatus.COMPLETED && uc.isFirstChallengeEnd,
      ),
    };
  }

  /**
   * 챌린지 일차 계산
   */
  private calculateChallengeDays(challenges: ChallengesByStatus): ChallengeDays {
    const today = getNowKST();

    if (challenges.active?.activatedAt) {
      const activatedAt = new Date(challenges.active.activatedAt);
      const diffTime = today.getTime() - activatedAt.getTime();
      return { currentDay: Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24))) };
    }

    if (challenges.completed?.expiresAt) {
      const expiresAt = new Date(challenges.completed.expiresAt);
      const diffTime = today.getTime() - expiresAt.getTime();
      return { daysAfterChallengeEnd: Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24))) };
    }

    return {};
  }

  /**
   * 챌린지 시작/종료 날짜 조회
   */
  private getChallengeDates(challenges: ChallengesByStatus): { startDate: string | null; endDate: string | null } {
    const target = challenges.active || challenges.pending;
    if (!target) {
      return { startDate: null, endDate: null };
    }

    return {
      startDate: target.activatedAt ? new Date(target.activatedAt).toISOString().split('T')[0] : null,
      endDate: target.expiresAt ? new Date(target.expiresAt).toISOString().split('T')[0] : null,
    };
  }

  /**
   * 미션 목록 조회
   */
  private async getMissionList(
    userId: number,
    userStatus: string,
    challenges: ChallengesByStatus,
    challengeDays: ChallengeDays,
  ): Promise<MissionItemDto[]> {
    const context: MissionVisibilityContext = {
      userId,
      userStatus: userStatus as UserSubscriptionStatus,
      currentDay: challengeDays.currentDay,
      daysAfterChallengeEnd: challengeDays.daysAfterChallengeEnd,
      userChallengeId: challenges.active?.id || challenges.completed?.id,
    };

    return this.missionService.getMissionsForHome(context);
  }

  /**
   * 미션 진행도 업데이트 (CHALLENGER만)
   * user_records 테이블에서 당일 기록을 조회하여 진행도 계산
   */
  private async updateMissionProgress(
    userId: number,
    missionList: MissionItemDto[],
  ): Promise<MissionItemDto[]> {
    // 오늘 날짜 (KST 기준)
    const today = getKoreanToday();
    const todayDate = new Date(today);

    // user_records에서 당일 기록 조회
    const todayRecords = await this.prisma.userRecord.findMany({
      where: {
        userId,
        date: todayDate,
      },
      select: {
        recordType: true,
        metadata: true,
      },
    });

    // recordType별 기록 횟수 계산
    const progressMap = new Map<string, number>();

    // 기록 타입별 집계
    for (const record of todayRecords) {
      const recordType = record.recordType;
      const currentCount = progressMap.get(recordType) || 0;

      // DIET는 식사 유형별로 개별 카운트 (아침, 점심, 저녁, 간식, 야식)
      if (recordType === 'DIET') {
        progressMap.set(recordType, currentCount + 1);
      } else {
        // 나머지는 1회만 완료로 처리 (BEAUTY, FASTING, SLEEP 등)
        progressMap.set(recordType, 1);
      }
    }

    // SUPPLEMENT는 실제 섭취 여부(morning/afternoon/evening) 체크
    const supplementRecords = todayRecords.filter((r: { recordType: string }) => r.recordType === 'SUPPLEMENT');
    if (supplementRecords.length > 0) {
      let supplementIntakeCount = 0;
      for (const record of supplementRecords) {
        const metadata = record.metadata as any;
        if (metadata?.morning || metadata?.afternoon || metadata?.evening) {
          supplementIntakeCount++;
        }
      }
      if (supplementIntakeCount > 0) {
        progressMap.set('SUPPLEMENT', supplementIntakeCount);
      }
    }

    // ACTIVITY는 기록 횟수 그대로 사용
    const activityCount = todayRecords.filter((r: { recordType: string }) => r.recordType === 'ACTIVITY').length;
    if (activityCount > 0) {
      progressMap.set('ACTIVITY', activityCount);
    }

    return missionList.map((m) => ({
      ...m,
      current: progressMap.get(m.recordType) || 0,
    }));
  }

  /**
   * 챌린지 정보 DTO 생성 (CHALLENGER만)
   */
  private buildChallengeInfo(
    userStatus: string,
    activeChallenge?: UserChallengeData,
    currentDay?: number,
  ): ChallengeInfoDto | null {
    if (userStatus !== UserSubscriptionStatus.CHALLENGER || !activeChallenge || !currentDay) {
      return null;
    }

    const totalMissions = activeChallenge.product.challengeMissions.length;
    const completedMissions = activeChallenge.userMissions.filter((um) => um.isCompleted).length;
    const challengePercent = totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0;

    return {
      challengeCode: activeChallenge.product.sku,
      startDate: new Date(activeChallenge.activatedAt!).toISOString().split('T')[0],
      endDate: activeChallenge.expiresAt ? new Date(activeChallenge.expiresAt).toISOString().split('T')[0] : '',
      currentDay,
      challengePercent,
    };
  }

  /**
   * 첫 방문 플래그 처리 및 백그라운드 업데이트
   * @param currentDay - CHALLENGER 상태에서 isFirstEntry 업데이트 조건에 필요
   */
  private handleFirstVisitFlags(
    userId: number,
    user: UserData,
    reportInfo: ReportInfo,
    challenges: ChallengesByStatus,
    currentDay?: number,
  ): {
    isFirstVisitAsNewcomer: boolean;
    isFirstVisitAfterChallengeStart: boolean;
    isFirstVisitAfterChallengeEnd: boolean;
  } {
    // 뉴커머 첫 방문
    const isFirstVisitAsNewcomer =
      user.status === UserSubscriptionStatus.NEWCOMER &&
      reportInfo.resultYN === YesNo.N &&
      user.isFirstAppEntry === true;

    if (isFirstVisitAsNewcomer) {
      this.prisma.user.update({
        where: { id: userId },
        data: { isFirstAppEntry: false },
      }).catch((err: Error) => {
        this.logger.warn(`isFirstAppEntry 업데이트 실패 - User ID: ${userId}`, err);
      });
    }

    // 챌린지 시작 후 첫 방문 (CHALLENGER + ACTIVE + currentDay 조건 필요)
    const isFirstVisitAfterChallengeStart = !!(challenges.active?.isFirstEntry);
    const shouldUpdateFirstEntry =
      user.status === UserSubscriptionStatus.CHALLENGER &&
      challenges.active &&
      currentDay &&
      isFirstVisitAfterChallengeStart;

    if (shouldUpdateFirstEntry) {
      this.prisma.userChallenge.update({
        where: { id: challenges.active!.id },
        data: { isFirstEntry: false },
      }).catch((err: Error) => {
        this.logger.warn(`isFirstEntry 업데이트 실패 - UserChallenge ID: ${challenges.active!.id}`, err);
      });
    }

    // 챌린지 종료 후 첫 방문
    const isFirstVisitAfterChallengeEnd = !!challenges.firstVisitAfterEnd;
    if (isFirstVisitAfterChallengeEnd) {
      this.prisma.userChallenge.update({
        where: { id: challenges.firstVisitAfterEnd!.id },
        data: { isFirstChallengeEnd: false },
      }).catch((err: Error) => {
        this.logger.warn(`isFirstChallengeEnd 업데이트 실패 - UserChallenge ID: ${challenges.firstVisitAfterEnd!.id}`, err);
      });
    }

    return {
      isFirstVisitAsNewcomer,
      isFirstVisitAfterChallengeStart,
      isFirstVisitAfterChallengeEnd,
    };
  }

  /**
   * 홈 배너 정보 조회
   */
  private async getHomeBanner(userId?: number): Promise<BannerInfoDto> {
    const banners = await this.bannersService.getActiveBanners('HOME', userId);

    if (banners.length > 0) {
      const banner = banners[0];
      return {
        title: banner.title,
        description: banner.description || undefined,
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl,
        linkType: banner.linkType,
      };
    }

    return {
      title: '오늘의 건강 콘텐츠',
      description: '건강한 하루를 시작해보세요',
      imageUrl: '',
      linkUrl: null,
      linkType: 'INTERNAL',
    };
  }

  /**
   * 외부 API에서 차트 데이터 조회 및 DB 저장
   */
  private async fetchAndSaveChartData(userId: number, mobile: string): Promise<void> {
    try {
      this.logger.log(`외부 API 차트 데이터 조회 시작 - 사용자 ID: ${userId}`);

      const chartData = await this.sibApiService.getChartIdByMobile(mobile);

      if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
        this.logger.log(`차트 데이터 없음 - 사용자 ID: ${userId}`);
        return;
      }

      this.logger.log(`차트 데이터 ${chartData.length}건 조회 - 사용자 ID: ${userId}`);

      const result = await this.prisma.userChart.createMany({
        data: chartData.map((chart) => ({
          userId,
          chartId: chart.chartID,
          receiptDate: new Date(chart.receiptDate),
          resultYn: chart.resultYN,
          orderCode: chart.orderCode,
        })),
        skipDuplicates: true,
      });

      this.logger.log(`차트 데이터 ${result.count}건 저장 완료 - 사용자 ID: ${userId}`);
    } catch (error: any) {
      this.logger.warn(`차트 데이터 조회 실패 - 사용자 ID: ${userId}`, error.message);
    }
  }

  /**
   * 캐시된 차트 데이터 갱신 (TTL 만료 시 호출)
   */
  private async refreshChartData(userId: number, mobile: string): Promise<void> {
    try {
      this.logger.log(`차트 데이터 갱신 시작 - 사용자 ID: ${userId}`);

      const chartData = await this.sibApiService.getChartIdByMobile(mobile);

      if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
        this.logger.log(`차트 데이터 없음 - 사용자 ID: ${userId}`);
        return;
      }

      const now = getNowKST();

      for (const chart of chartData) {
        await this.prisma.userChart.upsert({
          where: { chartId: chart.chartID },
          create: {
            userId,
            chartId: chart.chartID,
            receiptDate: new Date(chart.receiptDate),
            resultYn: chart.resultYN,
            orderCode: chart.orderCode,
            updatedAt: now,
          },
          update: {
            resultYn: chart.resultYN,
            updatedAt: now,
          },
        });
      }

      this.logger.log(`차트 데이터 ${chartData.length}건 갱신 완료 - 사용자 ID: ${userId}`);
    } catch (error: any) {
      this.logger.warn(`차트 데이터 갱신 실패 - 사용자 ID: ${userId}`, error.message);
    }
  }
}
