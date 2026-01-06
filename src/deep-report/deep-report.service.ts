import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { DeepReportResponseDto, DeepReportContentDto } from './dto/deep-report.dto';
import { YesNo, UserSubscriptionStatus, UserChallengeStatus } from '../common/enums';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 심층리포트 서비스
 * 주간 심층리포트 데이터를 조회하는 서비스
 */
@Injectable()
export class DeepReportService {
  private readonly logger = new Logger(DeepReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 심층리포트 조회
   * 지난주 월요일~일요일 범위의 심층리포트를 조회
   *
   * @param userId 사용자 ID
   * @returns 심층리포트 응답 DTO
   */
  async getDeepReport(userId: number): Promise<DeepReportResponseDto> {
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
        reportId: true,
        provider: true,
        content: true,
        startDate: true,
        endDate: true,
        weekNumber: true,
        createdAt: true,
      },
    });

    if (!deepReport) {
      this.logger.log(`[getDeepReport] 심층리포트 없음 - userId: ${userId}, chartId: ${chartId}`);
      return { success: true, data: null };
    }

    this.logger.log(`[getDeepReport] 심층리포트 조회 성공 - reportId: ${deepReport.reportId}`);

    // 4. 포인트 지급 및 기록 처리 (해당 리포트에 대해 1회만)
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
    // 1. WEEKLY_REPORT 미션 정보 조회
    const mission = await this.prisma.mission.findFirst({
      where: {
        recordType: 'WEEKLY_REPORT',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        points: true,
      },
    });

    if (!mission || mission.points <= 0) {
      this.logger.log(`[awardPoints] WEEKLY_REPORT 미션 없거나 포인트 0 - userId: ${userId}`);
      return 0;
    }

    // 2. 해당 리포트에 대해 이미 포인트 지급했는지 확인
    // relatedType: 'WEEKLY_REPORT', description에 reportId 포함
    const existingPointHistory = await this.prisma.pointHistory.findFirst({
      where: {
        userId,
        relatedType: 'WEEKLY_REPORT',
        description: { contains: reportId },
      },
    });

    if (existingPointHistory) {
      this.logger.log(`[awardPoints] 이미 포인트 지급됨 - userId: ${userId}, reportId: ${reportId}`);
      return 0;
    }

    // 3. 포인트 지급 (트랜잭션)
    const pointsToAward = mission.points;
    const now = getNowKST();

    await this.prisma.$transaction(async (tx) => {
      // 사용자 포인트 증가
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { points: { increment: pointsToAward } },
      });

      // 포인트 히스토리 기록
      await tx.pointHistory.create({
        data: {
          userId,
          type: 'EARNED',
          amount: pointsToAward,
          balance: updatedUser.points,
          description: `심층리포트 조회 (${reportId})`,
          relatedType: 'WEEKLY_REPORT',
          relatedId: null, // reportId는 string이므로 description에 포함
          createdAt: now,
        },
      });

      // user_records 기록 (홈화면 미션 비활성화용)
      await tx.userRecord.create({
        data: {
          userId,
          recordType: 'WEEKLY_REPORT',
          date: now,
          metadata: {
            reportId,
            isCompleted: true,
            pointsEarned: pointsToAward,
          },
          createdAt: now,
        },
      });

      this.logger.log(`[awardPoints] 포인트 지급 완료 - userId: ${userId}, points: ${pointsToAward}, reportId: ${reportId}`);
    });

    return pointsToAward;
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
}
