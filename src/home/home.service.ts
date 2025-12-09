import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { UserSubscriptionStatus } from '../common/enums/user-subscription-status.enum';
import { UserChallengeStatus } from '../common/enums';
import {
  NewcomerHomeDataDto,
  ChallengerHomeDataDto,
  SubscriberHomeDataDto,
} from './dto/home.dto';
import { getNowKST } from '../common/utils/kst-date.util';
import { SibApiService } from '../sib/services/sib-api.service';

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

      // 각 차트 데이터를 DB에 저장 (중복 제외)
      for (const chart of chartData) {
        const { chartId, receiptDate, resultYN, examType } = chart;

        // 이미 존재하는 chartId인지 확인
        const existingChart = await this.prisma.userChart.findUnique({
          where: { chartId },
        });

        if (existingChart) {
          this.logger.log(`이미 존재하는 차트 ID: ${chartId} - 스킵`);
          continue;
        }

        // 새 차트 데이터 저장
        await this.prisma.userChart.create({
          data: {
            userId,
            chartId,
            receiptDate: new Date(receiptDate),
            resultYn: resultYN,
            orderCode: examType,
          },
        });

        this.logger.log(`차트 데이터 저장 완료 - 차트 ID: ${chartId}`);
      }

      this.logger.log(`차트 데이터 처리 완료 - 사용자 ID: ${userId}`);
    } catch (error) {
      // 외부 API 호출 실패는 치명적이지 않으므로 로그만 남기고 계속 진행
      this.logger.warn(`차트 데이터 조회 실패 - 사용자 ID: ${userId}`, error.message);
    }
  }
}