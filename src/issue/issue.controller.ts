import { Controller, Post, Get, Body, UseGuards, Req, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IssueService } from './issue.service';
import { CreateIssueReportDto } from './dto/create-issue-report.dto';
import { IssueReportListResponseDto } from './dto/issue-report-response.dto';

@ApiTags('문제 신고')
@Controller('issues')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IssueController {
  private readonly logger = new Logger(IssueController.name);

  constructor(private readonly issueService: IssueService) {}

  /**
   * 문제 신고 접수
   */
  @Post()
  @ApiOperation({
    summary: '문제 신고 접수',
    description: '앱 버그/오류를 신고합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '신고 접수 성공',
    schema: {
      example: {
        success: true,
        message: '문제가 접수되었습니다.',
        reportId: 1,
      },
    },
  })
  async createReport(@Req() req: any, @Body() dto: CreateIssueReportDto) {
    const userId = req.user.id;
    this.logger.log(`문제 신고 요청: userId=${userId}`);
    return this.issueService.createReport(userId, dto);
  }

  /**
   * 내 신고 목록 조회
   */
  @Get('my')
  @ApiOperation({
    summary: '내 신고 목록 조회',
    description: '내가 접수한 문제 신고 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '목록 조회 성공',
    type: IssueReportListResponseDto,
  })
  async getMyReports(@Req() req: any) {
    const userId = req.user.id;
    this.logger.log(`내 신고 목록 조회 요청: userId=${userId}`);
    return this.issueService.getMyReports(userId);
  }
}
