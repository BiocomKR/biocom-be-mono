import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  HomeBannerLinkType,
  HomeBannerContentType,
} from './dto/home.dto';
import { AppConfigService } from '../app-config/app-config.service';
import { SurveyType } from '../common/enums';
import { getNowKST, getKoreanToday, stringToKSTDate } from '../common/utils/kst-date.util';
import { SibApiService } from '../sib/services/sib-api.service';
import { MissionService, MissionVisibilityContext } from '../mission/mission.service';
import axios from 'axios';

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
  startDateSetAt: Date | null;
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
  aiPersona: { id: number; name: string; torsoUrl: string | null } | null;
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
  private readonly aiAgentBaseUrl: string;
  private readonly aiAgentApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sibApiService: SibApiService,
    private readonly missionService: MissionService,
    private readonly appConfigService: AppConfigService,
    private readonly configService: ConfigService,
  ) {
    // AI Agent 서버 설정 로드
    this.aiAgentBaseUrl = this.configService.get<string>('AI_AGENT_BASE_URL') || 'http://localhost:8000';
    this.aiAgentApiKey = this.configService.get<string>('AI_AGENT_API_KEY') || '';
  }

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

      // 2. 검사 결과 정보 조회
      const reportInfo = await this.getReportInfo(userId, user);

      // 3. 챌린지 관련 데이터 처리
      const challenges = this.getChallengesByStatus(user.userChallenges);
      const challengeDays = this.calculateChallengeDays(challenges);

      // 4. 사전문진 완료 여부 확인
      const hasPreSurvey = await this.checkPreSurveyCompleted(userId);

      // 5. 조건별 홈 배너 조회
      // hasChallengeStart: ACTIVE 상태이거나, PENDING이면서 시작일이 오늘 이전인 경우
      // (시작일 지정만 하고 아직 시작일이 안 된 경우는 false)
      const isPendingAndStarted = challenges.pending?.activatedAt
        ? getNowKST() >= new Date(challenges.pending.activatedAt)
        : false;
      const banner = await this.getChallengeBanner({
        userId,
        userStatus: user.status as UserSubscriptionStatus,
        hasPurchase: user.userChallenges.length > 0,
        hasResult: reportInfo.resultYN === YesNo.Y,
        hasPreSurvey,
        hasChallengeStart: !!challenges.active || isPendingAndStarted,
        personaImageUrl: user.aiPersona?.torsoUrl || null,
        healthTypeAnimalId: user.health_type_animal_id,
        animalName: user.healthTypeAnimal?.animalName || null,
        currentDay: challengeDays.currentDay,
      });

      // 4. 미션 목록 조회 및 진행도 업데이트
      let missionList = await this.getMissionList(userId, user.status, challenges, challengeDays);
      // NEWCOMER가 아닌 경우 진행도 업데이트 (CHALLENGER, SUBSCRIBER 모두)
      if (user.status !== UserSubscriptionStatus.NEWCOMER) {
        missionList = await this.updateMissionProgress(userId, missionList);
      }

      // 5. 챌린지 정보 구성 (CHALLENGER만)
      const challengeInfo = await this.buildChallengeInfo(user.status, challenges.active, challengeDays.currentDay);

      // 6. 첫 방문 플래그 처리
      const firstVisitFlags = this.handleFirstVisitFlags(userId, user, reportInfo, challenges, challengeDays.currentDay);

      // 7. 날짜 정보
      const { startDate, endDate } = this.getChallengeDates(challenges);

      // 8. 사후문진 완료 여부 및 종료 후 일주일 이내 여부
      const { hasAfterSurvey, isWithinOneWeekAfterEnd } = await this.getAfterChallengeStatus(
        challenges.completed,
        challengeDays.daysAfterChallengeEnd,
      );

      // 9. 심층리포트 및 채팅요약 생성 (비동기 - 응답 대기 없음)
      // chartId가 있는 경우에만 AI Agent 호출
      if (reportInfo.chartId) {
        this.callAiAgentHomeAsync(userId, reportInfo.chartId);
      }

      return {
        userType: user.status as UserSubscriptionStatus,
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
        hasAfterSurvey,
        isWithinOneWeekAfterEnd,
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
          select: { id: true, name: true, torsoUrl: true },
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
            startDateSetAt: true,
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
      // DB에서 가져온 updatedAt은 이미 KST로 저장된 값이므로 그대로 사용
      const cacheAge = cachedChart.updatedAt
        ? now.getTime() - cachedChart.updatedAt.getTime()
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

    // 캐시 미스 - 동기적으로 SIB API 호출 (첫 호출 시 대기)
    try {
      const chartData = await this.fetchAndSaveChartDataSync(userId, user.mobile);
      if (chartData) {
        return {
          chartId: chartData.chartId,
          resultYN: chartData.resultYn as YesNo,
        };
      }
    } catch (err) {
      this.logger.warn(`차트 데이터 동기 조회 실패 - 사용자 ID: ${userId}`, err);
    }

    return { chartId: null, resultYN: YesNo.N, sibError: true };
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
      imageUrl: aiPersona.torsoUrl || '',
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
   * DB에서 가져온 날짜는 이미 KST로 저장된 값이므로 그대로 사용
   */
  private calculateChallengeDays(challenges: ChallengesByStatus): ChallengeDays {
    const today = getNowKST();

    if (challenges.active?.activatedAt) {
      // DB에서 가져온 activatedAt은 이미 KST로 저장된 값
      const activatedAt = challenges.active.activatedAt;
      const diffTime = today.getTime() - activatedAt.getTime();
      return { currentDay: Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24))) };
    }

    if (challenges.completed?.expiresAt) {
      // DB에서 가져온 expiresAt은 이미 KST로 저장된 값
      const expiresAt = challenges.completed.expiresAt;
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
   * 미션 진행도 업데이트 (CHALLENGER, SUBSCRIBER)
   * - current: 포인트 지급 횟수
   * - executed: 실행 횟수
   *
   * 데이터 소스:
   * - user_records: 6가지 기록 (BEAUTY, DIET, SUPPLEMENT, FASTING, SLEEP, ACTIVITY)
   * - user_missions: 챌린지 미션 (QUIZ, BALANCE_GAME, DAILY_MISSION, DECLARATION, SELF_PRAISE 등)
   * - point_histories: 포인트 지급 내역 (relatedType으로 구분)
   */
  private async updateMissionProgress(
    userId: number,
    missionList: MissionItemDto[],
  ): Promise<MissionItemDto[]> {
    // 오늘 날짜 (KST 기준)
    const today = getKoreanToday();
    const todayDate = stringToKSTDate(today);
    const tomorrowDate = stringToKSTDate(today, 24, 0, 0);

    // 병렬로 조회: user_records (SUPPLEMENT 별도)
    const [todayRecords, todaySupplementRecords] = await Promise.all([
      // user_records: 기록 타입 (createdAt 기준) - SUPPLEMENT 제외
      this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: { in: ['BEAUTY', 'DIET', 'FASTING', 'SLEEP', 'ACTIVITY', 'DECLARATION', 'SELF_PRAISE', 'QUIZ', 'BALANCE_GAME', 'DAILY_MISSION', 'WEEKLY_REPORT', 'AFTER_SURVEY'] },
          createdAt: {
            gte: todayDate,
            lt: tomorrowDate,
          },
        },
        select: {
          recordType: true,
          metadata: true,
        },
      }),
      // SUPPLEMENT: date 기준으로 별도 조회
      // 이유: saveSupplementRoutine에서 루틴 저장 시 미래 날짜의 기록을 미리 생성하는데,
      // 이때 createdAt은 생성 시점(루틴 저장 시점)으로 저장됨.
      // 예) 12/22에 루틴 저장 → 12/23 날짜 기록의 createdAt은 12/22
      // 따라서 createdAt 기준 조회 시 오늘 날짜 기록이 누락되는 문제 발생
      this.prisma.userRecord.findMany({
        where: {
          userId,
          recordType: 'SUPPLEMENT',
          date: todayDate,
        },
        select: {
          recordType: true,
          metadata: true,
        },
      }),
    ]);

    // recordType별 실행 횟수 계산
    const executedMap = new Map<string, number>();

    // user_records에서 실행 횟수
    for (const record of todayRecords) {
      const recordType = record.recordType;
      const currentCount = executedMap.get(recordType) || 0;
      executedMap.set(recordType, currentCount + 1);
    }

    // SUPPLEMENT 실행 횟수 (date 기준 조회 결과)
    for (const record of todaySupplementRecords) {
      const currentCount = executedMap.get('SUPPLEMENT') || 0;
      executedMap.set('SUPPLEMENT', currentCount + 1);
    }

    // recordType별 포인트 지급 횟수 계산 (metadata.pointsEarned > 0인 경우)
    const currentMap = new Map<string, number>();

    // user_records에서 포인트 지급 횟수 (metadata.pointsEarned로 확인)
    for (const record of todayRecords) {
      const pointsEarned = (record.metadata as any)?.pointsEarned || 0;
      if (pointsEarned > 0) {
        const currentCount = currentMap.get(record.recordType) || 0;
        currentMap.set(record.recordType, currentCount + 1);
      }
    }

    // SUPPLEMENT도 동일하게 처리
    for (const record of todaySupplementRecords) {
      const pointsEarned = (record.metadata as any)?.pointsEarned || 0;
      if (pointsEarned > 0) {
        const currentCount = currentMap.get('SUPPLEMENT') || 0;
        currentMap.set('SUPPLEMENT', currentCount + 1);
      }
    }

    return missionList.map((m) => ({
      ...m,
      current: currentMap.get(m.recordType) || 0,
      executed: executedMap.get(m.recordType) || 0,
    }));
  }

  /**
   * 챌린지 정보 DTO 생성 (CHALLENGER만)
   */
  private async buildChallengeInfo(
    userStatus: string,
    activeChallenge?: UserChallengeData,
    currentDay?: number,
  ): Promise<ChallengeInfoDto | null> {
    if (userStatus !== UserSubscriptionStatus.CHALLENGER || !activeChallenge || !currentDay) {
      return null;
    }

    const totalMissions = activeChallenge.product.challengeMissions.length;

    // user_records에서 완료된 미션 개수 조회
    const completedMissions = await this.prisma.userRecord.count({
      where: {
        userId: activeChallenge.id, // userChallengeId가 아님, 아래에서 수정
        userChallengeId: activeChallenge.id,
        metadata: {
          path: ['isCompleted'],
          equals: true
        }
      }
    });

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
    hasCompletedChallengeHistory: boolean;
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

    // 챌린지 이력이 있는 뉴커머 (과거 챌린지 완료했으나 현재 진행 중인 챌린지 없음)
    const hasCompletedChallengeHistory =
      user.status === UserSubscriptionStatus.NEWCOMER &&
      !!challenges.completed &&
      !challenges.active &&
      !challenges.pending;

    return {
      isFirstVisitAsNewcomer,
      isFirstVisitAfterChallengeStart,
      isFirstVisitAfterChallengeEnd,
      hasCompletedChallengeHistory,
    };
  }

  /**
   * 사전문진 완료 여부 확인
   */
  private async checkPreSurveyCompleted(userId: number): Promise<boolean> {
    const count = await this.prisma.surveyAnswer.count({
      where: {
        userId,
        type: SurveyType.BEFORE,
      },
    });
    return count > 0;
  }

  /**
   * 조건별 홈 배너 정보 조회
   *
   * 조건 우선순위:
   * 1. 구매이력/결과지/사전문진/시작일설정 중 하나라도 N → 챌린지 소개
   * 2. 모두 Y + CHALLENGER → 강의(LECTURE)
   * 3. 모두 Y + SUBSCRIBER → 추천 제품(PRODUCT)
   * 4. 모두 Y + NEWCOMER (챌린지 종료 후) → 칼럼(COLUMN)
   */
  private async getChallengeBanner(context: {
    userId: number;
    userStatus: UserSubscriptionStatus;
    hasPurchase: boolean;
    hasResult: boolean;
    hasPreSurvey: boolean;
    hasChallengeStart: boolean;
    personaImageUrl: string | null;
    healthTypeAnimalId: number | null;
    animalName: string | null;
    currentDay?: number;
  }): Promise<BannerInfoDto> {
    const {
      userStatus,
      hasPurchase,
      hasResult,
      hasPreSurvey,
      hasChallengeStart,
      personaImageUrl,
      healthTypeAnimalId,
      animalName,
      currentDay,
    } = context;

    // 기본 이미지 (페르소나 설정 전) - 메이브 상반신 이미지 사용
    const defaultImageUrl = 'https://storage.googleapis.com/api-dev-biocom-uploads/persona_torso_mave.webp';
    // 페르소나 설정 후에는 페르소나 이미지 사용
    const bannerImageUrl = personaImageUrl || defaultImageUrl;

    // 1. 4가지 조건 중 하나라도 N → 챌린지 소개
    if (!hasPurchase || !hasResult || !hasPreSurvey || !hasChallengeStart) {
      return {
        title: '미션 수행하고 30,000P 받으세요',
        description: '이너뷰티 챌린지',
        imageUrl: bannerImageUrl,
        linkType: HomeBannerLinkType.INTERNAL,
        contentType: HomeBannerContentType.CHALLENGE_INTRO,
        targetId: null,
        externalUrl: null,
      };
    }

    // 2. 챌린지 진행 중 (CHALLENGER) → 오늘 일차에 해당하는 강의
    if (userStatus === UserSubscriptionStatus.CHALLENGER) {
      const contentInfo = await this.getLectureByDay(currentDay);

      // 퀴즈 상태 계산
      const quizStatus = await this.getQuizStatusForLecture(context.userId, contentInfo?.id, currentDay);

      return {
        title: contentInfo?.title || '오늘의 강의',
        description: `Day ${currentDay || 1}`,
        imageUrl: bannerImageUrl,
        linkType: HomeBannerLinkType.INTERNAL,
        contentType: HomeBannerContentType.LECTURE,
        targetId: contentInfo?.id || null,
        externalUrl: null,
        quizStatus,
      };
    }

    // 3. 구독자 (SUBSCRIBER) → 추천 제품
    if (userStatus === UserSubscriptionStatus.SUBSCRIBER) {
      const productInfo = await this.getTopRecommendedProduct(healthTypeAnimalId);
      const displayAnimalName = animalName || '회원';
      return {
        title: `${displayAnimalName}에게 꼭 필요한`,
        description: productInfo?.name || '',
        imageUrl: bannerImageUrl,
        linkType: HomeBannerLinkType.INTERNAL,
        contentType: HomeBannerContentType.PRODUCT,
        targetId: productInfo?.id || null,
        externalUrl: null,
      };
    }

    // 4. 챌린지 종료 후 (NEWCOMER로 돌아온 경우) → 칼럼
    const contentInfo = await this.getFallbackContent('COLUMN');
    return {
      title: '오늘의 칼럼 콘텐츠',
      description: contentInfo?.title || '',
      imageUrl: bannerImageUrl,
      linkType: HomeBannerLinkType.INTERNAL,
      contentType: HomeBannerContentType.COLUMN,
      targetId: contentInfo?.id || null,
      externalUrl: null,
    };
  }

  /**
   * 사후문진 완료 여부 및 종료 후 일주일 이내 여부 조회
   */
  private async getAfterChallengeStatus(
    completedChallenge: UserChallengeData | undefined,
    daysAfterChallengeEnd: number | undefined,
  ): Promise<{ hasAfterSurvey: boolean; isWithinOneWeekAfterEnd: boolean }> {
    // 완료된 챌린지가 없으면 둘 다 false
    if (!completedChallenge) {
      return { hasAfterSurvey: false, isWithinOneWeekAfterEnd: false };
    }

    // 사후문진 완료 여부 확인
    const afterSurveyAnswer = await this.prisma.surveyAnswer.findFirst({
      where: {
        userChallengeId: completedChallenge.id,
        type: SurveyType.AFTER,
      },
      select: { id: true },
    });

    // 종료 후 일주일 이내 여부
    const isWithinOneWeekAfterEnd = daysAfterChallengeEnd !== undefined && daysAfterChallengeEnd <= 7;

    return {
      hasAfterSurvey: !!afterSurveyAnswer,
      isWithinOneWeekAfterEnd,
    };
  }

  /**
   * 챌린지 일차에 해당하는 강의 콘텐츠 조회
   * @param currentDay 챌린지 현재 일차
   * @returns 해당 일차 강의 또는 fallback 강의
   */
  private async getLectureByDay(currentDay?: number): Promise<{ id: number; title: string; type: string } | null> {
    // n일차 → day_number n인 강의 반환
    if (currentDay) {
      const lecture = await this.prisma.content.findFirst({
        where: {
          type: 'LECTURE',
          dayNumber: currentDay,
          isActive: true,
        },
        select: { id: true, title: true, type: true },
      });

      if (lecture) {
        return lecture;
      }

      // 2. 해당 일차 강의가 없으면 21일 넘은 경우 마지막 강의 반환
      if (currentDay > 21) {
        const lastLecture = await this.prisma.content.findFirst({
          where: {
            type: 'LECTURE',
            isActive: true,
          },
          orderBy: { dayNumber: 'desc' },
          select: { id: true, title: true, type: true },
        });

        if (lastLecture) {
          return lastLecture;
        }
      }
    }

    // 3. Fallback: 첫 번째 강의 반환
    return this.prisma.content.findFirst({
      where: {
        type: 'LECTURE',
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, type: true },
    });
  }

  /**
   * Fallback 콘텐츠 조회 (ID, 제목, 타입 포함)
   * @param type 콘텐츠 타입 (LECTURE, COLUMN)
   */
  private async getFallbackContent(type: string): Promise<{ id: number; title: string; type: string } | null> {
    const content = await this.prisma.content.findFirst({
      where: {
        type,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, type: true },
    });
    return content;
  }

  /**
   * 동물 유형별 1순위 추천 제품 조회 (ID, 이름)
   */
  private async getTopRecommendedProduct(healthTypeAnimalId: number | null): Promise<{ id: number; name: string } | null> {
    if (!healthTypeAnimalId) return null;

    const topProduct = await this.prisma.healthTypeAnimalProduct.findFirst({
      where: {
        healthTypeAnimalId,
        isActive: true,
      },
      orderBy: { displayOrder: 'asc' },
      select: {
        product: {
          select: { id: true, name: true },
        },
      },
    });

    return topProduct?.product || null;
  }

  /**
   * 강의에 연결된 퀴즈의 상태 조회 (배너용)
   * - alreadyCompleted만 반환, 나머지 상태는 프론트에서 currentDay와 dayNumber로 계산
   */
  private async getQuizStatusForLecture(
    userId: number,
    contentId: number | null | undefined,
    currentDay: number | undefined,
  ): Promise<{ alreadyCompleted: boolean } | null> {
    if (!contentId) return null;

    // 강의 정보 및 연결된 퀴즈 조회
    const lecture = await this.prisma.content.findUnique({
      where: { id: contentId },
      select: {
        lectureQuizzes: {
          where: { isActive: true },
          select: {
            quiz: {
              select: { id: true }
            }
          }
        }
      }
    });

    if (!lecture || lecture.lectureQuizzes.length === 0) {
      return null;
    }

    const quizId = lecture.lectureQuizzes[0].quiz.id;

    // 이미 퀴즈를 풀었는지 확인
    const existingAttempt = await this.prisma.quizAttempt.findFirst({
      where: {
        userId,
        quizId,
      },
      select: { id: true }
    });

    return { alreadyCompleted: !!existingAttempt };
  }

  /**
   * 외부 API에서 차트 데이터 조회 및 DB 저장 (동기 - 결과 반환)
   */
  private async fetchAndSaveChartDataSync(userId: number, mobile: string): Promise<{ chartId: string; resultYn: string } | null> {
    try {
      this.logger.log(`외부 API 차트 데이터 동기 조회 시작 - 사용자 ID: ${userId}`);

      const chartData = await this.sibApiService.getChartIdByMobile(mobile);

      if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
        this.logger.log(`차트 데이터 없음 - 사용자 ID: ${userId}`);
        return null;
      }

      // D0004 또는 D0060 차트만 필터링
      const targetChart = chartData.find((c) => c.orderCode === 'D0004' || c.orderCode === 'D0060');
      if (!targetChart) {
        this.logger.log(`대상 차트 데이터 없음 (D0004/D0060) - 사용자 ID: ${userId}`);
        return null;
      }

      this.logger.log(`차트 데이터 ${chartData.length}건 조회 - 사용자 ID: ${userId}`);

      // DB에 저장
      await this.prisma.userChart.createMany({
        data: chartData.map((chart) => ({
          userId,
          chartId: chart.chartID,
          receiptDate: new Date(chart.receiptDate),
          resultYn: chart.resultYN,
          orderCode: chart.orderCode,
        })),
        skipDuplicates: true,
      });

      this.logger.log(`차트 데이터 저장 완료 - 사용자 ID: ${userId}`);

      return {
        chartId: targetChart.chartID,
        resultYn: targetChart.resultYN,
      };
    } catch (error: any) {
      this.logger.warn(`차트 데이터 동기 조회 실패 - 사용자 ID: ${userId}`, error.message);
      throw error;
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

  /**
   * AI Agent /api/home 비동기 호출 (Fire-and-Forget)
   * 심층리포트 및 채팅요약 생성을 위해 AI Agent 서버에 요청
   * 응답을 기다리지 않고 백그라운드에서 처리
   *
   * @param userId 사용자 ID
   * @param chartId 차트 ID
   */
  private callAiAgentHomeAsync(userId: number, chartId: string): void {
    const url = `${this.aiAgentBaseUrl}/api/home`;

    this.logger.log(`[callAiAgentHomeAsync] AI Agent 호출 시작 - userId: ${userId}, chartId: ${chartId}`);

    // 비동기 호출 (응답 대기 없음)
    axios
      .post(
        url,
        {
          userId,
          chartId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.aiAgentApiKey,
          },
          timeout: 30000, // 30초 타임아웃
        },
      )
      .then(() => {
        this.logger.log(`[callAiAgentHomeAsync] AI Agent 호출 성공 - userId: ${userId}`);
      })
      .catch((error) => {
        // 에러 발생해도 홈 API 응답에 영향 없음
        this.logger.warn(
          `[callAiAgentHomeAsync] AI Agent 호출 실패 - userId: ${userId}, error: ${error.message}`,
        );
      });
  }
}
