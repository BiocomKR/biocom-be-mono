import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { DeepReportResponseDto, DeepReportContentDto } from './dto/deep-report.dto';
import { YesNo } from '../common/enums';
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
        startDate: lastMonday,
        endDate: {
          gte: lastSunday,
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

    // 4. 응답 변환
    const data: DeepReportContentDto = {
      reportId: deepReport.reportId,
      provider: deepReport.provider,
      content: deepReport.content,
      startDate: deepReport.startDate.toISOString().split('T')[0],
      endDate: deepReport.endDate.toISOString().split('T')[0],
      weekNumber: deepReport.weekNumber ?? undefined,
      createdAt: deepReport.createdAt.toISOString(),
    };

    return { success: true, data };
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
