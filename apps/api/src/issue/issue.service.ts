import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateIssueReportDto } from './dto/create-issue-report.dto';
import { CreateAccountDeletionDto } from './dto/create-account-deletion.dto';
import { IssueReportResponseDto, IssueReportListResponseDto, FileInfoDto } from './dto/issue-report-response.dto';
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
        fileIds: dto.fileIds || [],
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

    // 모든 fileIds 수집
    const allFileIds = items.flatMap((item: any) => item.fileIds || []);

    // 파일 정보 일괄 조회
    const files = allFileIds.length > 0
      ? await this.prisma.file.findMany({
          where: { id: { in: allFileIds } },
          select: { id: true, filePath: true, originalName: true },
        })
      : [];

    // fileId -> File 매핑
    const fileMap = new Map<number, any>(files.map((f: any) => [f.id, f]));

    return {
      items: items.map((report: any) => this.toResponseDto(report, fileMap)),
      total,
    };
  }

  /**
   * 계정 삭제 요청 접수 (Public API)
   * 휴대폰 번호로 계정 삭제 요청을 받음
   */
  async createAccountDeletionRequest(dto: CreateAccountDeletionDto): Promise<{ success: boolean; message: string }> {
    this.logger.log(`계정 삭제 요청 접수: mobile=${dto.mobile}`);

    // 해당 휴대폰 번호로 가입된 사용자 조회
    const user = await this.prisma.user.findFirst({
      where: { mobile: dto.mobile, deletedAt: null },
    });

    // 사용자가 없어도 보안상 같은 응답을 반환 (존재 여부를 노출하지 않음)
    if (user) {
      await this.prisma.issueReport.create({
        data: {
          userId: user.id,
          content: dto.reason || '계정 삭제 요청',
          type: 'ACCOUNT_DELETION',
          createdAt: getNowKST(),
        },
      });
    }

    return {
      success: true,
      message: '계정 삭제 요청이 접수되었습니다. 영업일 기준 7일 이내에 처리됩니다.',
    };
  }

  /**
   * 엔티티를 응답 DTO로 변환
   */
  private toResponseDto(report: any, fileMap: Map<number, any>): IssueReportResponseDto {
    const fileInfos: FileInfoDto[] = (report.fileIds || [])
      .map((fileId: number) => {
        const file = fileMap.get(fileId);
        return file ? { id: file.id, url: file.filePath, originalName: file.originalName } : null;
      })
      .filter((f: FileInfoDto | null): f is FileInfoDto => f !== null);

    return {
      id: report.id,
      content: report.content,
      files: fileInfos,
      answer: report.answer,
      answeredAt: report.answeredAt,
      appVersion: report.appVersion,
      deviceInfo: report.deviceInfo,
      createdAt: report.createdAt,
      isAnswered: report.answer !== null,
    };
  }
}
