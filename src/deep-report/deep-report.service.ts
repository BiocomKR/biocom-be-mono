import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { DeepReportResponseDto, DeepReportContentDto, DeepReportListResponseDto, DeepReportListItemDto } from './dto/deep-report.dto';
import { YesNo, UserSubscriptionStatus, UserChallengeStatus, PointRelatedType } from '../common/enums';
import { getNowKST, calculateChallengeDay } from '../common/utils/kst-date.util';

// 포인트 지급 설정 타입
interface PointsConfig {
  afterChallengeDays?: number;     // 챌린지 종료 후 N일까지 포인트 지급 (0이면 종료 즉시 포인트 없음)
  subscriberUnlimited?: boolean;   // 구독자 무제한 여부
}

/**
 * 심층리포트 서비스
 * 주간 심층리포트 데이터를 조회하는 서비스
 */
@Injectable()
export class DeepReportService {
  private readonly logger = new Logger(DeepReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 심층리포트 목록 조회
   * 사용자의 전체 심층리포트 목록을 최신순으로 조회
   *
   * @param userId 사용자 ID
   * @returns 심층리포트 목록 응답 DTO
   */
  async getDeepReportList(userId: number): Promise<DeepReportListResponseDto> {
    this.logger.log(`[getDeepReportList] 심층리포트 목록 조회 시작 - userId: ${userId}`);

    // 0. 사용자 상태 확인
    const hasAccess = await this.checkDeepReportAccess(userId);
    if (!hasAccess) {
      throw new ForbiddenException('심층리포트는 챌린저 또는 구독자만 조회할 수 있습니다');
    }

    // 1. 현재 ACTIVE 챌린지의 activated_at 조회 (N주차 계산용)
    const activeChallenge = await this.prisma.userChallenge.findFirst({
      where: {
        userId,
        status: UserChallengeStatus.ACTIVE,
      },
      select: {
        activatedAt: true,
      },
    });

    // 2. 사용자의 전체 심층리포트 조회 (최신순)
    const reports = await this.prisma.userDeepReport.findMany({
      where: { userId },
      select: {
        id: true,
        weekNumber: true,
        isRead: true,
        createdAt: true,
        startDate: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. 응답 변환
    const data: DeepReportListItemDto[] = reports.map((report) => {
      // N주차 계산: activatedAt 기준으로 startDate와 비교하여 계산 (DB weekNumber 무시)
      let weekNum: number | null = null;
      if (activeChallenge?.activatedAt) {
        weekNum = this.calculateWeekNumber(activeChallenge.activatedAt, report.startDate);
      }

      return {
        id: report.id,
        title: weekNum ? `${weekNum}주차 심층 리포트` : '심층 리포트',
        isRead: report.isRead,
        createdAt: this.formatDateKST(report.createdAt),
      };
    });

    this.logger.log(`[getDeepReportList] 조회 완료 - 총 ${data.length}개`);

    return { success: true, data };
  }

  /**
   * 심층리포트 상세 조회
   * ID로 특정 심층리포트를 조회하고 읽음 처리
   *
   * @param userId 사용자 ID
   * @param reportDbId 리포트 DB ID (PK)
   * @returns 심층리포트 응답 DTO
   */
  async getDeepReportById(userId: number, reportDbId: number): Promise<DeepReportResponseDto> {
    this.logger.log(`[getDeepReportById] 심층리포트 상세 조회 - userId: ${userId}, reportDbId: ${reportDbId}`);

    // 0. 사용자 상태 확인
    const hasAccess = await this.checkDeepReportAccess(userId);
    if (!hasAccess) {
      throw new ForbiddenException('심층리포트는 챌린저 또는 구독자만 조회할 수 있습니다');
    }

    // 1. 리포트 조회 (본인 것만)
    const deepReport = await this.prisma.userDeepReport.findFirst({
      where: {
        id: reportDbId,
        userId, // 본인 리포트만 조회 가능
      },
      select: {
        id: true,
        reportId: true,
        provider: true,
        content: true,
        startDate: true,
        endDate: true,
        weekNumber: true,
        createdAt: true,
        isRead: true,
      },
    });

    if (!deepReport) {
      throw new NotFoundException('심층리포트를 찾을 수 없습니다');
    }

    // 2. 읽음 처리 (isRead가 false인 경우에만)
    if (!deepReport.isRead) {
      await this.markAsRead(reportDbId);
    }

    // 3. 포인트 지급 및 기록 처리 (해당 리포트에 대해 1회만)
    const pointsEarned = await this.awardPointsAndRecord(userId, deepReport.reportId);

    // 4. 응답 변환
    const data: DeepReportContentDto = {
      reportId: deepReport.reportId,
      provider: deepReport.provider,
      content: deepReport.content,
      startDate: deepReport.startDate.toISOString().split('T')[0],
      endDate: deepReport.endDate.toISOString().split('T')[0],
      weekNumber: deepReport.weekNumber ?? undefined,
      createdAt: deepReport.createdAt.toISOString(),
      pointsEarned,
    };

    return { success: true, data };
  }

  /**
   * 지난주 심층리포트 조회
   * 지난주 월요일~일요일 범위의 심층리포트를 조회
   *
   * @param userId 사용자 ID
   * @returns 심층리포트 응답 DTO
   */
  async getLastWeekDeepReport(userId: number): Promise<DeepReportResponseDto> {
    this.logger.log(`[getDeepReport] 심층리포트 조회 시작 - userId: ${userId}`);

    // 0. 사용자 상태 확인 (CHALLENGER, SUBSCRIBER, 또는 최근 챌린지 완료 NEWCOMER만 접근 가능)
    const hasAccess = await this.checkDeepReportAccess(userId);
    if (!hasAccess) {
      throw new ForbiddenException('심층리포트는 챌린저 또는 구독자만 조회할 수 있습니다');
    }

    // 1. user_charts에서 chart_id 조회
    const chartId = await this.getLatestChartId(userId);
    if (!chartId) {
      this.logger.log(`[getDeepReport] chartId 없음 - userId: ${userId}`);
      return { success: true, data: null };
    }

    this.logger.log(`[getDeepReport] chartId 조회 완료: ${chartId}`);

    // 2. 지난주 월요일~일요일 날짜 계산
    const { lastMonday, lastSunday } = this.getLastWeekRange();
    this.logger.log(`[getDeepReport] 지난주 범위: ${lastMonday.toISOString()} ~ ${lastSunday.toISOString()}`);

    // 3. user_deep_reports 조회 (endDate는 같은 날짜의 23:59:59까지 포함)
    // DB의 end_date는 일요일 23:59:59로 저장되므로 범위 비교 사용
    const lastSundayEnd = new Date(lastSunday.getTime() + 24 * 60 * 60 * 1000 - 1); // 일요일 23:59:59.999
    this.logger.log(`[getDeepReport] endDate 범위: ${lastSunday.toISOString()} ~ ${lastSundayEnd.toISOString()}`);

    const deepReport = await this.prisma.userDeepReport.findFirst({
      where: {
        userId,
        chartId,
        startDate: {
          gte: lastMonday,
        },
        endDate: {
          lte: lastSundayEnd,
        },
      },
      select: {
        id: true,
        reportId: true,
        provider: true,
        content: true,
        startDate: true,
        endDate: true,
        weekNumber: true,
        createdAt: true,
        isRead: true,
      },
    });

    if (!deepReport) {
      this.logger.log(`[getDeepReport] 심층리포트 없음 - userId: ${userId}, chartId: ${chartId}`);
      return { success: true, data: null };
    }

    this.logger.log(`[getDeepReport] 심층리포트 조회 성공 - reportId: ${deepReport.reportId}`);

    // 4. 읽음 처리 (isRead가 false인 경우에만)
    if (!deepReport.isRead) {
      await this.markAsRead(deepReport.id);
    }

    // 5. 포인트 지급 및 기록 처리 (해당 리포트에 대해 1회만)
    const pointsEarned = await this.awardPointsAndRecord(userId, deepReport.reportId);

    // 5. 응답 변환
    const data: DeepReportContentDto = {
      reportId: deepReport.reportId,
      provider: deepReport.provider,
      content: deepReport.content,
      startDate: deepReport.startDate.toISOString().split('T')[0],
      endDate: deepReport.endDate.toISOString().split('T')[0],
      weekNumber: deepReport.weekNumber ?? undefined,
      createdAt: deepReport.createdAt.toISOString(),
      pointsEarned,
    };

    return { success: true, data };
  }

  /**
   * 심층리포트 포인트 지급 및 기록 (해당 리포트에 대해 1회만)
   * - point_histories: 포인트 지급 기록
   * - user_records: 홈화면 미션 비활성화용 기록
   *
   * @param userId 사용자 ID
   * @param reportId 리포트 ID
   * @returns 지급된 포인트 (이미 지급받았으면 0)
   */
  private async awardPointsAndRecord(userId: number, reportId: string): Promise<number> {
    // 1. WEEKLY_REPORT 미션 정보 조회 (pointsConfig 포함)
    const mission = await this.prisma.mission.findFirst({
      where: {
        recordType: 'WEEKLY_REPORT',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        points: true,
        pointsConfig: true,
      },
    });

    if (!mission || mission.points <= 0) {
      this.logger.log(`[awardPoints] WEEKLY_REPORT 미션 없거나 포인트 0 - userId: ${userId}`);
      return 0;
    }

    // 2. 해당 리포트에 대해 이미 포인트 지급했는지 확인
    // relatedType: PointRelatedType.WEEKLY_REPORT, description에 reportId 포함
    const existingPointHistory = await this.prisma.pointHistory.findFirst({
      where: {
        userId,
        relatedType: PointRelatedType.WEEKLY_REPORT,
        description: { contains: reportId },
      },
    });

    if (existingPointHistory) {
      this.logger.log(`[awardPoints] 이미 포인트 지급됨 - userId: ${userId}, reportId: ${reportId}`);
      return 0;
    }

    // 3. pointsConfig 기반 포인트 지급 가능 여부 체크
    let actualPointsToAward = mission.points;

    if (mission.pointsConfig) {
      const pointsConfig = mission.pointsConfig as PointsConfig;

      // 사용자 정보 및 챌린지 정보 조회
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          status: true,
          userChallenges: {
            where: { status: UserChallengeStatus.ACTIVE },
            orderBy: { activatedAt: 'desc' },
            take: 1,
            select: { activatedAt: true },
          },
        },
      });

      if (user) {
        // 구독자인 경우
        if (user.status === UserSubscriptionStatus.SUBSCRIBER) {
          if (!pointsConfig.subscriberUnlimited) {
            this.logger.log(`[awardPoints] 포인트 지급 제한 - userId: ${userId}, 구독자 무제한 설정 없음`);
            actualPointsToAward = 0;
          }
          // subscriberUnlimited === true 이면 그대로 지급
        }
        // 챌린지 진행 중인 경우 (CHALLENGER) - 기본적으로 포인트 지급
        else if (user.status === UserSubscriptionStatus.CHALLENGER) {
          // 챌린지 진행 중에는 기본적으로 포인트 지급 (별도 제한 없음)
        }
        // NEWCOMER인 경우 (챌린지 종료 후)
        else if (user.status === UserSubscriptionStatus.NEWCOMER) {
          const afterChallengeDays = pointsConfig.afterChallengeDays;

          // afterChallengeDays가 설정되지 않았으면 포인트 없음
          if (afterChallengeDays === undefined || afterChallengeDays === null) {
            this.logger.log(`[awardPoints] 포인트 지급 제한 - userId: ${userId}, 챌린지 종료 후 설정 없음`);
            actualPointsToAward = 0;
          } else {
            // 챌린지 종료 후 경과 일수 계산
            const expiredChallenge = await this.prisma.userChallenge.findFirst({
              where: {
                userId,
                status: UserChallengeStatus.EXPIRED,
              },
              orderBy: { expiresAt: 'desc' },
              select: { expiresAt: true },
            });

            if (expiredChallenge?.expiresAt) {
              const now = getNowKST();
              const daysSinceExpired = Math.floor(
                (now.getTime() - expiredChallenge.expiresAt.getTime()) / (1000 * 60 * 60 * 24)
              );

              if (daysSinceExpired > afterChallengeDays) {
                this.logger.log(`[awardPoints] 포인트 지급 제한 - userId: ${userId}, 종료 후 ${daysSinceExpired}일 경과, 제한: ${afterChallengeDays}일`);
                actualPointsToAward = 0;
              }
            }
          }
        }
      }
    }

    // 4. 포인트 지급 (트랜잭션)
    const now = getNowKST();

    await this.prisma.$transaction(async (tx) => {
      // 포인트 지급 (조건부)
      if (actualPointsToAward > 0) {
        // 사용자 포인트 증가
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { points: { increment: actualPointsToAward } },
        });

        // 포인트 히스토리 기록
        await tx.pointHistory.create({
          data: {
            userId,
            type: 'EARNED',
            amount: actualPointsToAward,
            balance: updatedUser.points,
            description: `심층리포트 조회 (${reportId})`,
            relatedType: PointRelatedType.WEEKLY_REPORT,
            relatedId: null, // reportId는 string이므로 description에 포함
            createdAt: now,
          },
        });
      }

      // user_records 기록 (홈화면 미션 비활성화용 - 포인트와 무관하게 기록)
      await tx.userRecord.create({
        data: {
          userId,
          recordType: 'WEEKLY_REPORT',
          date: now,
          metadata: {
            reportId,
            isCompleted: true,
            pointsEarned: actualPointsToAward,
          },
          createdAt: now,
        },
      });

      this.logger.log(`[awardPoints] 처리 완료 - userId: ${userId}, points: ${actualPointsToAward}, reportId: ${reportId}`);
    });

    return actualPointsToAward;
  }

  /**
   * 심층리포트 접근 권한 확인
   * - CHALLENGER: 접근 가능
   * - SUBSCRIBER: 접근 가능
   * - NEWCOMER: 최근 7일 이내 만료된 챌린지가 있으면 접근 가능 (3주차 리포트 조회용)
   *
   * @param userId 사용자 ID
   * @returns 접근 가능 여부
   */
  private async checkDeepReportAccess(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });

    if (!user) {
      this.logger.warn(`[checkAccess] 사용자 없음 - userId: ${userId}`);
      return false;
    }

    // CHALLENGER 또는 SUBSCRIBER는 바로 접근 가능
    const allowedStatuses = [UserSubscriptionStatus.CHALLENGER, UserSubscriptionStatus.SUBSCRIBER];
    if (allowedStatuses.includes(user.status as UserSubscriptionStatus)) {
      this.logger.log(`[checkAccess] 접근 허용 - userId: ${userId}, status: ${user.status}`);
      return true;
    }

    // NEWCOMER인 경우: 최근 7일 이내 만료된 챌린지가 있는지 확인
    if (user.status === UserSubscriptionStatus.NEWCOMER) {
      const now = getNowKST();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const recentExpiredChallenge = await this.prisma.userChallenge.findFirst({
        where: {
          userId,
          status: UserChallengeStatus.EXPIRED,
          expiresAt: {
            gte: sevenDaysAgo, // 7일 이내 만료
          },
        },
        select: { id: true, expiresAt: true },
      });

      if (recentExpiredChallenge) {
        this.logger.log(
          `[checkAccess] NEWCOMER 접근 허용 (최근 챌린지 만료) - userId: ${userId}, ` +
          `expiredAt: ${recentExpiredChallenge.expiresAt?.toISOString()}`
        );
        return true;
      }
    }

    this.logger.warn(`[checkAccess] 접근 거부 - userId: ${userId}, status: ${user.status}`);
    return false;
  }

  /**
   * 사용자의 최신 chart_id 조회
   * order_code가 'D0060' 또는 'D0004'이고 result_yn='Y'인 차트 중 가장 최근 것
   *
   * @param userId 사용자 ID
   * @returns chart_id (없으면 null)
   */
  private async getLatestChartId(userId: number): Promise<string | null> {
    const userChart = await this.prisma.userChart.findFirst({
      where: {
        userId,
        orderCode: { in: ['D0004', 'D0060'] },
        resultYn: YesNo.Y,
      },
      orderBy: { receiptDate: 'desc' },
      select: { chartId: true },
    });

    return userChart?.chartId || null;
  }

  /**
   * 지난주 월요일과 일요일 날짜 계산 (KST 기준)
   * 예) 오늘이 2025-12-24(화)이면 지난주 월요일=2025-12-15, 일요일=2025-12-21
   *
   * @returns 지난주 월요일(00:00:00), 일요일(00:00:00) Date 객체
   */
  private getLastWeekRange(): { lastMonday: Date; lastSunday: Date } {
    // KST 기준 현재 시간
    const now = getNowKST();

    // 오늘의 요일 (0=일, 1=월, ..., 6=토) - UTC 메서드 사용 (KST를 UTC로 저장했으므로)
    const dayOfWeek = now.getUTCDay();

    // 이번주 월요일까지 며칠 전인지 계산
    const daysToThisMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // 이번주 월요일 날짜 계산
    const thisMondayDate = now.getUTCDate() - daysToThisMonday;

    // 지난주 월요일 = 이번주 월요일 - 7일
    const lastMondayDate = thisMondayDate - 7;

    // 지난주 일요일 = 지난주 월요일 + 6일
    const lastSundayDate = lastMondayDate + 6;

    // createKSTDate로 Date 객체 생성 (00:00:00 기준)
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;

    // 날짜 계산 (월 경계 처리)
    const lastMonday = new Date(Date.UTC(year, month - 1, lastMondayDate, 0, 0, 0));
    const lastSunday = new Date(Date.UTC(year, month - 1, lastSundayDate, 0, 0, 0));

    return { lastMonday, lastSunday };
  }

  /**
   * 심층리포트 읽음 처리
   * @param reportDbId 리포트 DB ID (PK)
   */
  private async markAsRead(reportDbId: number): Promise<void> {
    await this.prisma.userDeepReport.update({
      where: { id: reportDbId },
      data: { isRead: true },
    });
    this.logger.log(`[markAsRead] 읽음 처리 완료 - reportDbId: ${reportDbId}`);
  }

  /**
   * 챌린지 시작일 기준 주차 계산
   * @param activatedAt 챌린지 시작일 (항상 월요일)
   * @param reportCreatedAt 리포트 생성일
   * @returns 주차 번호 (1주차, 2주차, ...)
   */
  private calculateWeekNumber(activatedAt: Date, reportCreatedAt: Date): number {
    // 두 날짜 간의 차이를 일 단위로 계산
    const diffTime = reportCreatedAt.getTime() - activatedAt.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // 주차 계산 (0~6일 = 1주차, 7~13일 = 2주차, ...)
    return Math.floor(diffDays / 7) + 1;
  }

  /**
   * 날짜를 YYYY.MM.DD 형식으로 변환 (KST 기준)
   * @param date Date 객체
   * @returns YYYY.MM.DD 형식 문자열
   */
  private formatDateKST(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  }
}
