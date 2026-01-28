import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { AnswerIssueReportDto } from './dto/answer-issue-report.dto';
import { CreateBoFeedbackDto } from './dto/create-bo-feedback.dto';
import { getNowKST } from '../common/utils/kst-date.util';

@Injectable()
export class IssueService {
  private readonly logger = new Logger(IssueService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 신고 목록 조회
   */
  async getReports(page: number = 1, limit: number = 20, isAnswered?: boolean, type?: string) {
    this.logger.log(`신고 목록 조회: page=${page}, limit=${limit}, isAnswered=${isAnswered}, type=${type}`);

    const skip = (page - 1) * limit;

    const where: any = {};
    if (isAnswered === true) {
      where.answer = { not: null };
    } else if (isAnswered === false) {
      where.answer = null;
    }
    if (type) {
      where.type = type;
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

    return {
      items: items.map((item) => ({
        id: item.id,
        content: item.content,
        answer: item.answer,
        answeredAt: item.answeredAt,
        appVersion: item.appVersion,
        deviceInfo: item.deviceInfo,
        createdAt: item.createdAt,
        isAnswered: item.answer !== null,
        type: item.type,
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
   * TODO: 스키마 변경 후 userId nullable로 변경 필요
   */
  async createBoFeedback(dto: CreateBoFeedbackDto) {
    this.logger.log('백오피스 피드백 등록');

    // TODO: 스키마 변경 전까지 userId=1로 강제 설정
    const SYSTEM_USER_ID = 1;

    // fileUrls를 content에 포함 (스키마에 fileIds가 Int[]라서 URL 직접 저장 불가)
    let content = dto.content;
    if (dto.fileUrls && dto.fileUrls.length > 0) {
      content += '\n\n[첨부파일]\n' + dto.fileUrls.join('\n');
    }

    await this.prisma.issueReport.create({
      data: {
        userId: SYSTEM_USER_ID,
        content,
        type: 'BO_FEEDBACK',
        createdAt: getNowKST(),
      },
    });

    return {
      success: true,
      message: '피드백이 등록되었습니다.',
    };
  }
}
