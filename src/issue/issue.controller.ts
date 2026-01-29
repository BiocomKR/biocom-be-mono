import { Controller, Get, Post, Patch, Delete, Param, Body, Query, ParseIntPipe, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IssueService } from './issue.service';
import { AnswerIssueReportDto } from './dto/answer-issue-report.dto';
import { CreateBoFeedbackDto } from './dto/create-bo-feedback.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@ApiTags('문제 신고 관리')
@Controller('issues')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IssueController {
  private readonly logger = new Logger(IssueController.name);

  constructor(private readonly issueService: IssueService) {}

  /**
   * 신고 목록 조회
   */
  @Get()
  @ApiOperation({
    summary: '신고 목록 조회',
    description: '문제 신고 목록을 조회합니다. 답변 여부, 카테고리, 검색어로 필터링 가능합니다.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '페이지 번호 (기본: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지당 개수 (기본: 20)' })
  @ApiQuery({ name: 'isAnswered', required: false, type: Boolean, description: '답변 여부 필터' })
  @ApiQuery({ name: 'type', required: false, type: String, description: '유형 필터 (ISSUE, ACCOUNT_DELETION, BO_FEEDBACK)' })
  @ApiQuery({ name: 'category', required: false, type: String, description: '카테고리 필터 (BUG, FEATURE, UI, OTHER)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: '내용 검색어' })
  @ApiResponse({ status: 200, description: '목록 조회 성공' })
  async getReports(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isAnswered') isAnswered?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    this.logger.log(`신고 목록 조회 요청`);
    return this.issueService.getReports(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      isAnswered === 'true' ? true : isAnswered === 'false' ? false : undefined,
      type,
      category,
      search,
    );
  }

  /**
   * 신고 상세 조회
   */
  @Get(':id')
  @ApiOperation({
    summary: '신고 상세 조회',
    description: '특정 문제 신고의 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '신고 ID' })
  @ApiResponse({ status: 200, description: '상세 조회 성공' })
  async getReport(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`신고 상세 조회 요청: id=${id}`);
    return this.issueService.getReport(id);
  }

  /**
   * 신고 답변 작성
   */
  @Patch(':id/answer')
  @ApiOperation({
    summary: '신고 답변 작성',
    description: '문제 신고에 답변을 작성합니다.',
  })
  @ApiParam({ name: 'id', description: '신고 ID' })
  @ApiResponse({ status: 200, description: '답변 작성 성공' })
  async answerReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnswerIssueReportDto,
  ) {
    this.logger.log(`신고 답변 작성 요청: id=${id}`);
    return this.issueService.answerReport(id, dto);
  }

  /**
   * 백오피스 피드백 등록
   */
  @Post('bo-feedback')
  @ApiOperation({
    summary: '백오피스 피드백 등록',
    description: '백오피스 사용 중 발견한 불편사항을 등록합니다.',
  })
  @ApiResponse({ status: 201, description: '피드백 등록 성공' })
  async createBoFeedback(@Body() dto: CreateBoFeedbackDto) {
    this.logger.log('백오피스 피드백 등록 요청');
    return this.issueService.createBoFeedback(dto);
  }

  /**
   * 피드백 상태 변경
   */
  @Patch(':id/status')
  @ApiOperation({
    summary: '피드백 상태 변경',
    description: '백오피스 피드백의 처리 상태를 변경합니다. (PENDING, IN_PROGRESS, RESOLVED)',
  })
  @ApiParam({ name: 'id', description: '피드백 ID' })
  @ApiResponse({ status: 200, description: '상태 변경 성공' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
  ) {
    this.logger.log(`피드백 상태 변경 요청: id=${id}, status=${dto.status}`);
    return this.issueService.updateStatus(id, dto.status);
  }

  /**
   * 신고/피드백 삭제
   */
  @Delete(':id')
  @ApiOperation({
    summary: '신고/피드백 삭제',
    description: '신고 또는 피드백을 삭제합니다.',
  })
  @ApiParam({ name: 'id', description: '신고/피드백 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async deleteReport(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`신고/피드백 삭제 요청: id=${id}`);
    return this.issueService.deleteReport(id);
  }
}
