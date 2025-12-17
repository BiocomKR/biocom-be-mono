import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { UserSubscriptionStatus } from '../common/enums/user-subscription-status.enum';
import { UserChallengeStatus, YesNo } from '../common/enums';
import {
  HomeResponseDto,
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
import { MissionService, MissionVisibilityContext } from '../mission/mission.service';

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

    // TODO: 외부 API 호출로 실제 검사 완료 여부 확인
    // 현재는 임시로 모든 사용자가 검사 완료된 것으로 처리
    return {
      isCompleted: true,
      examDate: '2025-09-15',
      message: '검사가 완료되었습니다',
    };
  }

  /**
   * 홈 화면 데이터 조회
   * - status별 분기: NEWCOMER/SUBSCRIBER는 challengeInfo null
   * - CHALLENGER만 challengeInfo 제공
   * @param userId 사용자 ID
   */
  async getHomeData(userId: number): Promise<HomeResponseDto> {
    this.logger.log(`홈 화면 데이터 조회 시작 - 사용자 ID: ${userId}`);

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
          isFirstAppEntry: true,
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
            where: { status: { in: [UserChallengeStatus.ACTIVE, UserChallengeStatus.PENDING, UserChallengeStatus.COMPLETED] } },
            orderBy: { createdAt: 'desc' },
            take: 3, // ACTIVE, PENDING, COMPLETED 모두 가져올 수 있도록
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
      const banner = await this.getHomeBanner(user.id);

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
      let missionList: MissionItemDto[] = [];

      // ACTIVE, PENDING, COMPLETED 챌린지 분리
      const activeChallenge = user.userChallenges.find(
        (uc: { status: string }) => uc.status === UserChallengeStatus.ACTIVE,
      );
      const pendingChallenge = user.userChallenges.find(
        (uc: { status: string }) => uc.status === UserChallengeStatus.PENDING,
      );
      // 종료 이후 첫 접속인 챌린지 (COMPLETED + isFirstChallengeEnd = true)
      const firstVisitAfterChallengeEnd = user.userChallenges.find(
        (uc: { status: string; isFirstChallengeEnd: boolean }) => uc.status === UserChallengeStatus.COMPLETED && uc.isFirstChallengeEnd,
      );
      // 최근 완료된 챌린지 (종료 후 기간 계산용)
      const completedChallenge = user.userChallenges.find(
        (uc: { status: string }) => uc.status === UserChallengeStatus.COMPLETED,
      );

      // 챌린지가 있으면 startDate/endDate 설정 (ACTIVE 우선, 없으면 PENDING)
      const targetChallenge = activeChallenge || pendingChallenge;
      if (targetChallenge) {
        startDate = targetChallenge.activatedAt
          ? new Date(targetChallenge.activatedAt).toISOString().split('T')[0]
          : null;
        endDate = targetChallenge.expiresAt
          ? new Date(targetChallenge.expiresAt).toISOString().split('T')[0]
          : null;
      }

      // 현재 일차 및 챌린지 종료 후 경과 일수 계산
      const today = getNowKST();
      let currentDay: number | undefined;
      let daysAfterChallengeEnd: number | undefined;

      if (activeChallenge) {
        const activatedAt = new Date(activeChallenge.activatedAt);
        const diffTime = today.getTime() - activatedAt.getTime();
        currentDay = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      } else if (completedChallenge?.expiresAt) {
        // 챌린지 종료 후 경과 일수 계산
        const expiresAt = new Date(completedChallenge.expiresAt);
        const diffTime = today.getTime() - expiresAt.getTime();
        daysAfterChallengeEnd = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      }

      // 정책 기반 미션 목록 조회 (MissionService의 새 로직 사용)
      const missionContext: MissionVisibilityContext = {
        userId,
        userStatus: user.status as UserSubscriptionStatus,
        currentDay,
        daysAfterChallengeEnd,
        userChallengeId: activeChallenge?.id || completedChallenge?.id,
      };
      missionList = await this.missionService.getMissionsForHome(missionContext);

      // status가 CHALLENGER이고 활성 챌린지가 있는 경우 챌린지 정보 및 미션 진행도 추가
      if (user.status === UserSubscriptionStatus.CHALLENGER && activeChallenge && currentDay) {
        // 오늘 미션 목록에 진행도 추가
        const todayMissions = activeChallenge.product.challengeMissions.filter(
          (cm: { day: number }) => cm.day === currentDay,
        );

        // 미션별 완료 횟수 계산하여 missionList 업데이트
        const missionProgressMap = new Map<string, number>();
        for (const cm of todayMissions) {
          const completedCount = activeChallenge.userMissions.filter(
            (um: { challengeMissionId: number; day: number }) => um.challengeMissionId === cm.id && um.day === currentDay,
          ).length;
          missionProgressMap.set(cm.mission.recordType, completedCount);
        }

        // missionList에 current 값 업데이트
        missionList = missionList.map((m) => ({
          ...m,
          current: missionProgressMap.get(m.recordType) || 0,
        }));

        // 전체 미션 수 & 완료 미션 수 계산 (진행률)
        const totalMissions = activeChallenge.product.challengeMissions.length;
        const completedMissions = activeChallenge.userMissions.filter(
          (um: { isCompleted: boolean }) => um.isCompleted,
        ).length;
        const challengePercent = totalMissions > 0
          ? Math.round((completedMissions / totalMissions) * 100)
          : 0;

        challengeInfo = {
          challengeCode: activeChallenge.product.sku,
          startDate: new Date(activeChallenge.activatedAt).toISOString().split('T')[0],
          endDate: activeChallenge.expiresAt
            ? new Date(activeChallenge.expiresAt).toISOString().split('T')[0]
            : '',
          currentDay,
          challengePercent,
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

      // 뉴커머 첫 방문 조건:
      // NEWCOMER 상태 + 결과지 없음 + isFirstAppEntry가 true
      const isFirstVisitAsNewcomer =
        user.status === UserSubscriptionStatus.NEWCOMER &&
        reportInfo.resultYN === YesNo.N &&
        user.isFirstAppEntry === true;

      // 뉴커머 첫 방문인 경우 false로 업데이트 (백그라운드)
      if (isFirstVisitAsNewcomer) {
        this.prisma.user.update({
          where: { id: userId },
          data: { isFirstAppEntry: false },
        }).catch((err: Error) => {
          this.logger.warn(`isFirstAppEntry 업데이트 실패 - User ID: ${userId}`, err);
        });
      }

      // 챌린지 시작 후 첫 방문 여부 (ACTIVE + isFirstEntry = true)
      const isFirstVisitAfterChallengeStart = !!(activeChallenge?.isFirstEntry);

      // 챌린지 종료 후 첫 방문 여부 (COMPLETED + isFirstChallengeEnd = true)
      const isFirstVisitAfterChallengeEnd = !!firstVisitAfterChallengeEnd;
      if (isFirstVisitAfterChallengeEnd) {
        // 첫 방문 후 false로 업데이트 (백그라운드)
        this.prisma.userChallenge.update({
          where: { id: firstVisitAfterChallengeEnd.id },
          data: { isFirstChallengeEnd: false },
        }).catch((err: Error) => {
          this.logger.warn(`isFirstChallengeEnd 업데이트 실패 - UserChallenge ID: ${firstVisitAfterChallengeEnd.id}`, err);
        });
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
        isFirstVisitAsNewcomer,
        isFirstVisitAfterChallengeStart,
        isFirstVisitAfterChallengeEnd,
      };
    } catch (error) {
      this.logger.error(`새 홈 화면 데이터 조회 실패 - 사용자 ID: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 홈 배너 정보 조회
   * @param userId 사용자 ID
   */
  private async getHomeBanner(userId?: number): Promise<BannerInfoDto> {
    // BannersService를 통해 HOME 타입 배너 조회 (사용자 상태 기반 필터링)
    const banners = await this.bannersService.getActiveBanners('HOME', userId);

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