import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { UserSubscriptionStatus } from '../common/enums/user-subscription-status.enum';
import { UserChallengeStatus, YesNo } from '../common/enums';
import {
  NewcomerHomeDataDto,
  ChallengerHomeDataDto,
  SubscriberHomeDataDto,
  NewHomeResponseDto,
  ReportInfoDto,
  AnimalTypeDto,
  PersonaInfoDto,
  ChallengeInfoDto,
  MissionItemDto,
  BannerInfoDto,
} from './dto/home.dto';
import { getNowKST } from '../common/utils/kst-date.util';
import { SibApiService } from '../sib/services/sib-api.service';
import { BannersService } from '../shop/services/banners.service';
import { MissionService } from '../mission/mission.service';

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
   * 사용자 구독 상태에 따른 홈 화면 데이터 조회
   * @param userId 사용자 ID
   * @returns 구독 상태별 홈 화면 데이터
   */
  async getHomeData(userId: number): Promise<NewcomerHomeDataDto | ChallengerHomeDataDto | SubscriberHomeDataDto> {
    this.logger.log(`홈 화면 데이터 조회 시작 - 사용자 ID: ${userId}`);

    try {
      // 사용자 정보 조회
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          // email: true,
          mobile: true,
          name: true,
          status: true,
          userChallenges: {
            where: { status: UserChallengeStatus.ACTIVE },
            select: {
              id: true,
              productId: true,
              activatedAt: true,
              expiresAt: true,
              status: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  metadata: true
                }
              }
            },
          },
        },
      });

      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다');
      }

      // 공통 처리: 외부 API에서 차트 데이터 조회 및 저장 (백그라운드 실행)
      this.fetchAndSaveChartData(userId, user.mobile).catch(err => {
        this.logger.warn(`차트 데이터 백그라운드 저장 실패 - 사용자 ID: ${userId}`, err);
      });

      const baseData = {
        status: user.status,
        userName: user.name, // TODO: 실제 이름 필드가 있으면 변경
        welcomeMessage: `안녕하세요, ${user.name}님!`,
      };

      // 구독 상태에 따른 홈 화면 데이터 반환
      switch (user.status) {
        case UserSubscriptionStatus.NEWCOMER:
          return await this.getNewcomerHomeData(userId, baseData);

        case UserSubscriptionStatus.CHALLENGER:
          return await this.getChallengerHomeData(userId, baseData, user.userChallenges[0]);

        case UserSubscriptionStatus.SUBSCRIBER:
          return await this.getSubscriberHomeData(userId, baseData);

        default:
          // 기본적으로 신규 사용자로 처리
          return await this.getNewcomerHomeData(userId, baseData);
      }
    } catch (error) {
      this.logger.error(`홈 화면 데이터 조회 실패 - 사용자 ID: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 신규 사용자(NEWCOMER) 홈 화면 데이터 생성
   */
  private async getNewcomerHomeData(userId: number, baseData: any): Promise<NewcomerHomeDataDto> {
    this.logger.log(`신규 사용자 홈 화면 데이터 생성 - 사용자 ID: ${userId}`);

    // TODO: 실제 챌린지 상품 정보 조회 (현재는 하드코딩)
    const challengeProduct = {
      id: 1,
      name: '21일 건강 챌린지',
      price: 29000,
      description: '21일간의 체계적인 건강 관리 프로그램',
      imageUrl: null,
    };

    // 종합건강대사 검사 완료 여부 확인
    const healthExamCompleted = await this.getHealthExamStatus(userId);

    return {
      ...baseData,
      homeType: 'newcomer',
      challengeProduct,
      healthExamCompleted: healthExamCompleted.isCompleted,
      canPurchaseChallenge: healthExamCompleted.isCompleted,
      guideMessage: healthExamCompleted.isCompleted
        ? '21일 챌린지로 건강한 변화를 시작해보세요!'
        : '먼저 종합건강대사 검사를 완료해주세요.',
    };
  }

  /**
   * 챌린저(CHALLENGER) 홈 화면 데이터 생성
   */
  private async getChallengerHomeData(userId: number, baseData: any, activeChallenge: any): Promise<ChallengerHomeDataDto> {
    this.logger.log(`챌린저 홈 화면 데이터 생성 - 사용자 ID: ${userId}`);

    const today = getNowKST();
    const endDate = new Date(activeChallenge.expiresAt);
    const startDate = new Date(activeChallenge.activatedAt);
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    const totalDays = 21; // 21일 챌린지
    const progress = Math.round(((totalDays - daysRemaining) / totalDays) * 100);

    // TODO: 실제 미션 데이터 조회
    const todayMissions = [
      {
        id: 1,
        title: '아침 물 마시기',
        description: '기상 후 물 500ml 마시기',
        isCompleted: false,
        type: 'WATER',
      },
      {
        id: 2,
        title: '이너뷰티 기록',
        description: '오늘의 컨디션 기록하기',
        isCompleted: false,
        type: 'BEAUTY',
      },
    ];

    // 주간 통계 조회
    const weeklyStats = await this.getWeeklyStats(userId);

    return {
      ...baseData,
      homeType: 'challenger',
      currentChallenge: {
        id: activeChallenge.id,
        challengeType: (activeChallenge.product?.metadata as any)?.challengeName || activeChallenge.product?.name || '21일 챌린지',
        startDate: activeChallenge.activatedAt.toISOString().split('T')[0],
        endDate: activeChallenge.expiresAt.toISOString().split('T')[0],
        daysRemaining,
        progress,
      },
      todayMissions,
      weeklyStats,
    };
  }

  /**
   * 구독자(SUBSCRIBER) 홈 화면 데이터 생성
   */
  private async getSubscriberHomeData(userId: number, baseData: any): Promise<SubscriberHomeDataDto> {
    this.logger.log(`구독자 홈 화면 데이터 생성 - 사용자 ID: ${userId}`);

    // TODO: 실제 구독 정보 조회
    const subscription = {
      plan: '월간 구독',
      startDate: '2025-09-01',
      nextBillingDate: '2025-10-01',
      status: 'ACTIVE',
    };

    // 최근 기록 요약 조회
    const recentRecords = await this.getRecentRecordsSummary(userId);

    // TODO: 추천 컨텐츠 조회
    const recommendedContent = [
      {
        id: 1,
        title: '건강한 아침 루틴 만들기',
        type: 'VIDEO',
        thumbnailUrl: null,
      },
      {
        id: 2,
        title: '효과적인 수면 관리법',
        type: 'ARTICLE',
        thumbnailUrl: null,
      },
    ];

    return {
      ...baseData,
      homeType: 'subscriber',
      subscription,
      recentRecords,
      recommendedContent,
    };
  }

  /**
   * 종합건강대사 검사 완료 여부 확인
   * TODO: 외부 API 연동 필요
   */
  async getHealthExamStatus(userId: number): Promise<{ isCompleted: boolean; examDate?: string; message: string }> {
    this.logger.log(`종합건강대사 검사 상태 확인 - 사용자 ID: ${userId}`);

    // TODO: 외부 API 호출로 실제 검사 완료 여부 확인
    // 현재는 임시로 모든 사용자가 검사 완료된 것으로 처리
    return {
      isCompleted: true,
      examDate: '2025-09-15',
      message: '검사가 완료되었습니다',
    };
  }

  /**
   * 주간 통계 요약 조회
   */
  private async getWeeklyStats(userId: number): Promise<{ recordsThisWeek: number; completedMissions: number; totalMissions: number }> {
    const startOfWeek = getNowKST();
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = getNowKST();
    endOfWeek.setHours(23, 59, 59, 999);

    // 이번 주 기록 수 조회
    const recordsCount = await this.prisma.userRecord.count({
      where: {
        userId,
        createdAt: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
      },
    });

    // TODO: 실제 미션 완료도 조회
    return {
      recordsThisWeek: recordsCount,
      completedMissions: 8, // 임시 데이터
      totalMissions: 14, // 임시 데이터
    };
  }

  /**
   * 최근 기록 요약 조회
   */
  private async getRecentRecordsSummary(userId: number): Promise<{
    beauty: number;
    diet: number;
    supplement: number;
    fasting: number;
    sleep: number;
    activity: number;
  }> {
    const recentDate = getNowKST();
    recentDate.setDate(recentDate.getDate() - 7); // 최근 7일

    const records = await this.prisma.userRecord.groupBy({
      by: ['recordType'],
      where: {
        userId,
        createdAt: {
          gte: recentDate,
        },
      },
      _count: {
        id: true,
      },
    });

    const summary = {
      beauty: 0,
      diet: 0,
      supplement: 0,
      fasting: 0,
      sleep: 0,
      activity: 0,
    };

    records.forEach((record) => {
      switch (record.recordType) {
        case 'BEAUTY':
          summary.beauty = record._count.id;
          break;
        case 'DIET':
          summary.diet = record._count.id;
          break;
        case 'SUPPLEMENT':
          summary.supplement = record._count.id;
          break;
        case 'FASTING':
          summary.fasting = record._count.id;
          break;
        case 'SLEEP':
          summary.sleep = record._count.id;
          break;
        case 'ACTIVITY':
          summary.activity = record._count.id;
          break;
      }
    });

    return summary;
  }

  /**
   * 새 홈 화면 데이터 조회 (v2 스펙)
   * - status별 분기: NEWCOMER/SUBSCRIBER는 challengeInfo null
   * - CHALLENGER만 challengeInfo 제공
   * @param userId 사용자 ID
   */
  async getNewHomeData(userId: number): Promise<NewHomeResponseDto> {
    this.logger.log(`새 홈 화면 데이터 조회 시작 - 사용자 ID: ${userId}`);

    try {
      // 1. 사용자 정보 조회 (페르소나, 동물유형, 포인트, 활성 챌린지, 차트정보 포함)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          mobile: true,
          points: true,
          status: true,
          aiPersonaId: true,
          health_type_animal_id: true,
          aiPersona: {
            select: {
              id: true,
              name: true,
              personaUrl: true,
            },
          },
          healthTypeAnimal: {
            select: {
              id: true,
              animalName: true,
              catchphrase: true,
              images: {
                where: { imageType: 'THUMBNAIL' },
                take: 1,
                select: {
                  file: {
                    select: {
                      filePath: true,
                    },
                  },
                },
              },
            },
          },
          userChallenges: {
            where: { status: { in: [UserChallengeStatus.ACTIVE, UserChallengeStatus.PENDING] } },
            orderBy: { createdAt: 'desc' },
            take: 2, // ACTIVE와 PENDING 둘 다 가져올 수 있도록
            select: {
              id: true,
              productId: true,
              status: true,
              startDate: true,
              endDate: true,
              activatedAt: true,
              createdAt: true,
              totalPoints: true,
              isFirstEntry: true,
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
                        select: {
                          id: true,
                          name: true,
                          description: true,
                          dailyLimit: true,
                          recordType: true,
                        },
                      },
                    },
                    orderBy: { sortOrder: 'asc' },
                  },
                },
              },
              userMissions: {
                select: {
                  id: true,
                  challengeMissionId: true,
                  day: true,
                  isCompleted: true,
                  attemptNumber: true,
                },
              },
            },
          },
          // 차트 정보 (D0004, D0060만 필터링하여 최신순 1개)
          userCharts: {
            where: {
              orderCode: { in: ['D0004', 'D0060'] },
            },
            orderBy: { receiptDate: 'desc' },
            take: 1,
            select: {
              chartId: true,
              resultYn: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다');
      }

      // 2. DB 캐시에서 검사 정보 조회 (TTL 1분, 만료 시 백그라운드 갱신)
      const CACHE_TTL_MS = 60 * 1000; // 1분
      let reportInfo: { chartId: string | null; resultYN: YesNo; sibError?: boolean };

      if (user.userCharts.length > 0) {
        const cachedChart = user.userCharts[0];
        const now = getNowKST();
        const cacheAge = cachedChart.updatedAt
          ? now.getTime() - new Date(cachedChart.updatedAt).getTime()
          : Infinity;

        // 캐시 히트 - 현재 값 반환
        reportInfo = {
          chartId: cachedChart.chartId,
          resultYN: cachedChart.resultYn as YesNo,
        };

        // TTL 만료 시 백그라운드로 갱신
        if (cacheAge > CACHE_TTL_MS) {
          this.logger.log(`캐시 TTL 만료 (${Math.round(cacheAge / 1000)}초) - 백그라운드 갱신`);
          this.refreshChartData(userId, user.mobile).catch((err) => {
            this.logger.warn(`차트 데이터 백그라운드 갱신 실패 - 사용자 ID: ${userId}`, err);
          });
        }
      } else {
        // 캐시 미스 - 백그라운드로 SIB API 호출 후 기본값 반환
        this.fetchAndSaveChartData(userId, user.mobile).catch((err) => {
          this.logger.warn(`차트 데이터 백그라운드 저장 실패 - 사용자 ID: ${userId}`, err);
        });
        reportInfo = { chartId: null, resultYN: YesNo.N };
      }

      // 3. 배너 조회
      const banner = await this.getHomeBanner(user.status);

      // 4. 동물 유형 (resultYN이 Y일 때만 제공)
      let animalType: AnimalTypeDto | null = null;
      if (reportInfo.resultYN === YesNo.Y && user.healthTypeAnimal) {
        const thumbnailImage = user.healthTypeAnimal.images?.[0]?.file?.filePath || '';
        animalType = {
          name: user.healthTypeAnimal.animalName,
          description: user.healthTypeAnimal.catchphrase,
          imageUrl: thumbnailImage,
        };
      }

      // 5. 페르소나 정보
      let persona: PersonaInfoDto | null = null;
      if (user.aiPersona) {
        persona = {
          name: user.aiPersona.name,
          imageUrl: user.aiPersona.personaUrl || '',
        };
      }

      // 6. 챌린지 정보 (CHALLENGER만) & 미션 목록 (최상위)
      let challengeInfo: ChallengeInfoDto | null = null;
      let startDate: string | null = null;
      let endDate: string | null = null;
      let missionList: MissionItemDto[] = await this.missionService.getMissionsForHome(); // DB에서 조회

      // ACTIVE와 PENDING 챌린지 분리
      const activeChallenge = user.userChallenges.find(
        (uc) => uc.status === UserChallengeStatus.ACTIVE,
      );
      const pendingChallenge = user.userChallenges.find(
        (uc) => uc.status === UserChallengeStatus.PENDING,
      );

      // 챌린지가 있으면 startDate/endDate 설정 (ACTIVE 우선, 없으면 PENDING)
      const targetChallenge = activeChallenge || pendingChallenge;
      if (targetChallenge) {
        startDate = targetChallenge.startDate
          ? new Date(targetChallenge.startDate).toISOString().split('T')[0]
          : null;
        endDate = targetChallenge.endDate
          ? new Date(targetChallenge.endDate).toISOString().split('T')[0]
          : null;
      }

      // status가 CHALLENGER이고 활성 챌린지가 있는 경우만 챌린지 정보 제공
      if (user.status === UserSubscriptionStatus.CHALLENGER && activeChallenge) {
        const today = getNowKST();
        const startDate = activeChallenge.startDate
          ? new Date(activeChallenge.startDate)
          : new Date(activeChallenge.activatedAt);

        // 현재 일차 계산
        const diffTime = today.getTime() - startDate.getTime();
        const currentDay = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

        // 오늘 미션 목록 조회
        const todayMissions = activeChallenge.product.challengeMissions.filter(
          (cm) => cm.day === currentDay,
        );

        // 미션별 완료 횟수 계산
        const challengeMissionList: MissionItemDto[] = todayMissions.map((cm) => {
          const completedCount = activeChallenge.userMissions.filter(
            (um) => um.challengeMissionId === cm.id && um.day === currentDay,
          ).length;

          return {
            id: cm.id,
            title: cm.mission.name,
            description: cm.mission.description || '',
            point: cm.points,
            max: cm.mission.dailyLimit,
            current: completedCount,
            recordType: cm.mission.recordType,
            sortOrder: cm.sortOrder,
          };
        });

        // 챌린지에 미션 데이터가 있으면 사용, 없으면 목업
        if (challengeMissionList.length > 0) {
          missionList = challengeMissionList;
        }

        // 전체 미션 수 & 완료 미션 수 계산 (진행률)
        const totalMissions = activeChallenge.product.challengeMissions.length;
        const completedMissions = activeChallenge.userMissions.filter(
          (um) => um.isCompleted,
        ).length;
        const challengePercent = totalMissions > 0
          ? Math.round((completedMissions / totalMissions) * 100)
          : 0;

        challengeInfo = {
          challengeCode: activeChallenge.product.sku,
          startDate: startDate.toISOString().split('T')[0],
          endDate: activeChallenge.endDate
            ? new Date(activeChallenge.endDate).toISOString().split('T')[0]
            : '',
          currentDay,
          challengePercent,
          isFirstEntry: activeChallenge.isFirstEntry,
        };

        // 최초 진입인 경우 false로 업데이트 (백그라운드)
        if (activeChallenge.isFirstEntry) {
          this.prisma.userChallenge.update({
            where: { id: activeChallenge.id },
            data: { isFirstEntry: false },
          }).catch((err: Error) => {
            this.logger.warn(`isFirstEntry 업데이트 실패 - UserChallenge ID: ${activeChallenge.id}`, err);
          });
        }
      }

      return {
        reportInfo: {
          chartId: reportInfo.chartId,
          resultYN: reportInfo.resultYN,
          sibError: reportInfo.sibError,
        },
        animalType,
        persona,
        userPoint: user.points ?? 0,
        banner,
        challengeInfo,
        startDate,
        endDate,
        missionList,
      };
    } catch (error) {
      this.logger.error(`새 홈 화면 데이터 조회 실패 - 사용자 ID: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 홈 배너 정보 조회
   * @param userStatus 사용자 상태 (NEWCOMER, CHALLENGER, SUBSCRIBER)
   */
  private async getHomeBanner(userStatus?: string): Promise<BannerInfoDto> {
    // BannersService를 통해 HOME 타입 배너 조회 (사용자 상태 기반 필터링)
    const banners = await this.bannersService.getActiveBanners('HOME', userStatus);

    if (banners.length > 0) {
      const banner = banners[0]; // 첫 번째 배너 (sortOrder 기준 정렬됨)
      return {
        title: banner.title,
        description: banner.description || undefined,
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl,
        linkType: banner.linkType,
      };
    }

    // 기본 배너
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
   * @param userId 사용자 ID
   * @param mobile 휴대폰 번호
   */
  private async fetchAndSaveChartData(userId: number, mobile: string): Promise<void> {
    try {
      this.logger.log(`외부 API 차트 데이터 조회 시작 - 사용자 ID: ${userId}, 휴대폰: ${mobile}`);

      // SibApiService를 통해 외부 API 호출
      const chartData = await this.sibApiService.getChartIdByMobile(mobile);

      // 데이터가 없으면 종료
      if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
        this.logger.log(`차트 데이터 없음 - 사용자 ID: ${userId}`);
        return;
      }

      this.logger.log(`차트 데이터 ${chartData.length}건 조회 - 사용자 ID: ${userId}`);

      // createMany + skipDuplicates로 한 번에 저장 (중복 자동 스킵)
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
      // 외부 API 호출 실패는 치명적이지 않으므로 로그만 남기고 계속 진행
      this.logger.warn(`차트 데이터 조회 실패 - 사용자 ID: ${userId}`, error.message);
    }
  }

  /**
   * 캐시된 차트 데이터 갱신 (TTL 만료 시 호출)
   * - SIB API에서 최신 데이터 조회
   * - 기존 데이터 upsert (새 데이터 추가 + 기존 데이터 updatedAt 갱신)
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

      // upsert로 새 데이터 추가 + 기존 데이터 updatedAt 갱신
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