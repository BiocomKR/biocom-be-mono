import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { AnswerIssueReportDto } from './dto/answer-issue-report.dto';
import { CreateBoFeedbackDto } from './dto/create-bo-feedback.dto';
import { getNowKST } from '../common/utils/kst-date.util';
import { FeedbackStatus, IssueReportType } from '../common/enums';

@Injectable()
export class IssueService {
  private readonly logger = new Logger(IssueService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 신고 목록 조회
   */
  async getReports(
    page: number = 1,
    limit: number = 20,
    isAnswered?: boolean,
    type?: string,
    category?: string,
    search?: string,
    excludeType?: string,
  ) {
    this.logger.log(`신고 목록 조회: page=${page}, limit=${limit}, isAnswered=${isAnswered}, type=${type}, category=${category}, search=${search}, excludeType=${excludeType}`);

    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) {
      where.type = type;
    }
    if (excludeType) {
      where.type = { not: excludeType };
    }
    // BO_FEEDBACK은 status로, 나머지는 answer로 필터링
    if (isAnswered !== undefined) {
      if (type === IssueReportType.BO_FEEDBACK) {
        where.status = isAnswered ? FeedbackStatus.RESOLVED : { not: FeedbackStatus.RESOLVED };
      } else {
        where.answer = isAnswered ? { not: null } : null;
      }
    }
    if (category) {
      where.category = category;
    }
    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.issueReport.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              mobile: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.issueReport.count({ where }),
    ]);

    // fileIds로 파일 URL 조회
    const allFileIds = items.flatMap((item) => item.fileIds || []);
    const files = allFileIds.length > 0
      ? await this.prisma.file.findMany({
          where: { id: { in: allFileIds } },
          select: { id: true, filePath: true },
        })
      : [];
    const fileMap = new Map(files.map((f) => [f.id, f.filePath]));

    return {
      items: items.map((item) => ({
        id: item.id,
        content: item.content,
        answer: item.answer,
        answeredAt: item.answeredAt,
        appVersion: item.appVersion,
        deviceInfo: item.deviceInfo,
        createdAt: item.createdAt,
        // BO_FEEDBACK은 status로, 나머지는 answer로 판단
        isAnswered: item.type === IssueReportType.BO_FEEDBACK
          ? item.status === FeedbackStatus.RESOLVED
          : item.answer !== null,
        type: item.type,
        category: item.category,
        status: item.status,
        fileUrls: (item.fileIds || []).map((id) => fileMap.get(id)).filter(Boolean),
        user: item.user,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 신고 상세 조회
   */
  async getReport(id: number) {
    this.logger.log(`신고 상세 조회: id=${id}`);

    const report = await this.prisma.issueReport.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('신고를 찾을 수 없습니다.');
    }

    return {
      id: report.id,
      content: report.content,
      answer: report.answer,
      answeredAt: report.answeredAt,
      appVersion: report.appVersion,
      deviceInfo: report.deviceInfo,
      createdAt: report.createdAt,
      isAnswered: report.answer !== null,
      user: report.user,
    };
  }

  /**
   * 신고 답변 작성
   */
  async answerReport(id: number, dto: AnswerIssueReportDto) {
    this.logger.log(`신고 답변 작성: id=${id}`);

    const report = await this.prisma.issueReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('신고를 찾을 수 없습니다.');
    }

    await this.prisma.issueReport.update({
      where: { id },
      data: {
        answer: dto.answer,
        answeredAt: getNowKST(),
      },
    });

    return {
      success: true,
      message: '답변이 등록되었습니다.',
    };
  }

  /**
   * 백오피스 피드백 등록
   */
  async createBoFeedback(dto: CreateBoFeedbackDto) {
    this.logger.log('백오피스 피드백 등록');

    await this.prisma.issueReport.create({
      data: {
        content: dto.content,
        category: dto.category,
        fileIds: dto.fileIds || [],
        type: IssueReportType.BO_FEEDBACK,
        status: FeedbackStatus.PENDING,
        createdAt: getNowKST(),
      },
    });

    return {
      success: true,
      message: '피드백이 등록되었습니다.',
    };
  }

  /**
   * 피드백 상태 변경 (BO_FEEDBACK 전용)
   */
  async updateStatus(id: number, status: string) {
    this.logger.log(`피드백 상태 변경: id=${id}, status=${status}`);

    const report = await this.prisma.issueReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('피드백을 찾을 수 없습니다.');
    }

    if (report.type !== IssueReportType.BO_FEEDBACK) {
      throw new Error('상태 변경은 백오피스 피드백에서만 가능합니다.');
    }

    await this.prisma.issueReport.update({
      where: { id },
      data: { status },
    });

    return {
      success: true,
      message: '상태가 변경되었습니다.',
    };
  }

  /**
   * 신고/피드백 삭제
   */
  async deleteReport(id: number) {
    this.logger.log(`신고/피드백 삭제: id=${id}`);

    const report = await this.prisma.issueReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException('신고/피드백을 찾을 수 없습니다.');
    }

    await this.prisma.issueReport.delete({
      where: { id },
    });

    return {
      success: true,
      message: '삭제되었습니다.',
    };
  }
}
