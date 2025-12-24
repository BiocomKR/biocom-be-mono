import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { DeepReportResponseDto, DeepReportContentDto } from './dto/deep-report.dto';
import { YesNo } from '../common/enums';

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

    // 3. user_deep_reports 조회
    const deepReport = await this.prisma.userDeepReport.findFirst({
      where: {
        userId,
        chartId,
        startDate: lastMonday,
        endDate: lastSunday,
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
   * 예) 오늘이 2025-12-10(수)이면 지난주 월요일=2025-12-01, 일요일=2025-12-07
   *
   * @returns 지난주 월요일(00:00:00), 일요일(00:00:00) Date 객체
   */
  private getLastWeekRange(): { lastMonday: Date; lastSunday: Date } {
    // 현재 KST 시간 구하기
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000; // UTC+9
    const kstNow = new Date(now.getTime() + kstOffset);

    // 오늘의 요일 (0=일, 1=월, ..., 6=토)
    const dayOfWeek = kstNow.getUTCDay();

    // 이번주 월요일까지 며칠 전인지 계산
    // 일요일(0) -> 6일 전이 월요일
    // 월요일(1) -> 0일 전
    // 화요일(2) -> 1일 전
    // ...
    const daysToThisMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // 이번주 월요일
    const thisMonday = new Date(kstNow);
    thisMonday.setUTCDate(thisMonday.getUTCDate() - daysToThisMonday);
    thisMonday.setUTCHours(0, 0, 0, 0);

    // 지난주 월요일 = 이번주 월요일 - 7일
    const lastMonday = new Date(thisMonday);
    lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);

    // 지난주 일요일 = 지난주 월요일 + 6일
    const lastSunday = new Date(lastMonday);
    lastSunday.setUTCDate(lastSunday.getUTCDate() + 6);

    // UTC로 저장된 DB와 비교를 위해 KST offset 제거
    // DB에 저장된 날짜가 KST 기준이라면 그대로 사용
    // DB에 저장된 날짜가 UTC라면 offset 조정 필요
    // 여기서는 DB가 KST 기준으로 저장되어 있다고 가정

    return {
      lastMonday: new Date(lastMonday.getTime() - kstOffset),
      lastSunday: new Date(lastSunday.getTime() - kstOffset),
    };
  }
}
