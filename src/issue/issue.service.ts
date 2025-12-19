import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateIssueReportDto } from './dto/create-issue-report.dto';
import { IssueReportResponseDto, IssueReportListResponseDto } from './dto/issue-report-response.dto';
import { getNowKST } from '../common/utils/kst-date.util';

@Injectable()
export class IssueService {
  private readonly logger = new Logger(IssueService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 문제 신고 접수
   */
  async createReport(userId: number, dto: CreateIssueReportDto): Promise<{ success: boolean; message: string; reportId: number }> {
    this.logger.log(`문제 신고 접수: userId=${userId}`);

    const report = await this.prisma.issueReport.create({
      data: {
        userId,
        content: dto.content,
        appVersion: dto.appVersion,
        deviceInfo: dto.deviceInfo,
        createdAt: getNowKST(),
      },
    });

    return {
      success: true,
      message: '문제가 접수되었습니다.',
      reportId: report.id,
    };
  }

  /**
   * 내 신고 목록 조회
   */
  async getMyReports(userId: number): Promise<IssueReportListResponseDto> {
    this.logger.log(`내 신고 목록 조회: userId=${userId}`);

    const [items, total] = await Promise.all([
      this.prisma.issueReport.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.issueReport.count({
        where: { userId },
      }),
    ]);

    return {
      items: items.map(this.toResponseDto),
      total,
    };
  }

  /**
   * 엔티티를 응답 DTO로 변환
   */
  private toResponseDto(report: any): IssueReportResponseDto {
    return {
      id: report.id,
      content: report.content,
      answer: report.answer,
      answeredAt: report.answeredAt,
      appVersion: report.appVersion,
      deviceInfo: report.deviceInfo,
      createdAt: report.createdAt,
      isAnswered: report.answer !== null,
    };
  }
}
