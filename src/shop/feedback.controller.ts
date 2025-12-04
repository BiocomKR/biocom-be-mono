/**
 * 상품 리뷰/문의 관리 컨트롤러 (관리자용)
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeedbackService } from './feedback.service';
import {
  ReviewListQueryDto,
  QuestionListQueryDto,
  HideReviewDto,
  AnswerQuestionDto,
  FeedbackStatus,
  ReviewType,
  QuestionType,
  FeedbackSortBy,
} from './dto/feedback.dto';

@ApiTags('리뷰/문의 관리')
@ApiBearerAuth()
@Controller('shop/feedbacks')
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /**
   * 리뷰/문의 통계 조회
   */
  @Get('stats')
  @ApiOperation({ summary: '리뷰/문의 통계 조회' })
  @ApiResponse({ status: 200, description: '통계 조회 성공' })
  async getStats() {
    return this.feedbackService.getStats();
  }

  /**
   * 리뷰 목록 조회
   */
  @Get('reviews')
  @ApiOperation({ summary: '리뷰 목록 조회' })
  @ApiResponse({ status: 200, description: '리뷰 목록 조회 성공' })
  async getReviews(@Query() query: ReviewListQueryDto) {
    return this.feedbackService.getReviews({
      search: query.search,
      status: query.status as FeedbackStatus,
      rating: query.rating,
      reviewType: query.reviewType as ReviewType,
      isBest: query.isBest === 'true' ? true : query.isBest === 'false' ? false : undefined,
      sortBy: query.sortBy as FeedbackSortBy,
      sortOrder: query.sortOrder,
      page: query.page || 1,
      limit: query.limit || 10,
    });
  }

  /**
   * 문의 목록 조회
   */
  @Get('questions')
  @ApiOperation({ summary: '문의 목록 조회' })
  @ApiResponse({ status: 200, description: '문의 목록 조회 성공' })
  async getQuestions(@Query() query: QuestionListQueryDto) {
    return this.feedbackService.getQuestions({
      search: query.search,
      status: query.status as FeedbackStatus,
      questionType: query.questionType as QuestionType,
      hasAnswer: query.hasAnswer === 'true' ? true : query.hasAnswer === 'false' ? false : undefined,
      sortBy: query.sortBy as FeedbackSortBy,
      sortOrder: query.sortOrder,
      page: query.page || 1,
      limit: query.limit || 10,
    });
  }

  /**
   * 리뷰 상세 조회
   */
  @Get('reviews/:id')
  @ApiOperation({ summary: '리뷰 상세 조회' })
  @ApiResponse({ status: 200, description: '리뷰 상세 조회 성공' })
  async getReviewById(@Param('id', ParseIntPipe) id: number) {
    return this.feedbackService.getReviewById(id);
  }

  /**
   * 문의 상세 조회
   */
  @Get('questions/:id')
  @ApiOperation({ summary: '문의 상세 조회' })
  @ApiResponse({ status: 200, description: '문의 상세 조회 성공' })
  async getQuestionById(@Param('id', ParseIntPipe) id: number) {
    return this.feedbackService.getQuestionById(id);
  }

  /**
   * 베스트 리뷰 선정/해제
   */
  @Patch('reviews/:id/best')
  @ApiOperation({ summary: '베스트 리뷰 선정/해제 토글' })
  @ApiResponse({ status: 200, description: '베스트 리뷰 선정/해제 성공' })
  async toggleBestReview(@Param('id', ParseIntPipe) id: number) {
    return this.feedbackService.toggleBestReview(id);
  }

  /**
   * 리뷰 숨김 처리
   */
  @Patch('reviews/:id/hide')
  @ApiOperation({ summary: '리뷰 숨김 처리' })
  @ApiResponse({ status: 200, description: '리뷰 숨김 처리 성공' })
  async hideReview(@Param('id', ParseIntPipe) id: number, @Body() dto: HideReviewDto) {
    return this.feedbackService.hideReview(id, dto.hiddenReason);
  }

  /**
   * 리뷰 복원 (숨김 해제)
   */
  @Patch('reviews/:id/restore')
  @ApiOperation({ summary: '리뷰 복원 (숨김 해제)' })
  @ApiResponse({ status: 200, description: '리뷰 복원 성공' })
  async restoreReview(@Param('id', ParseIntPipe) id: number) {
    return this.feedbackService.restoreReview(id);
  }

  /**
   * 문의 답변 작성
   */
  @Post('questions/:id/answer')
  @ApiOperation({ summary: '문의 답변 작성' })
  @ApiResponse({ status: 201, description: '답변 작성 성공' })
  async answerQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnswerQuestionDto,
    @Request() req: any,
  ) {
    // req.user에서 관리자 ID 추출
    const operatorId = req.user?.id || req.user?.sub;
    return this.feedbackService.answerQuestion(id, dto.content, operatorId);
  }

  /**
   * 문의 답변 수정
   */
  @Patch('questions/:id/answer')
  @ApiOperation({ summary: '문의 답변 수정' })
  @ApiResponse({ status: 200, description: '답변 수정 성공' })
  async updateAnswer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AnswerQuestionDto,
    @Request() req: any,
  ) {
    const operatorId = req.user?.id || req.user?.sub;
    return this.feedbackService.updateAnswer(id, dto.content, operatorId);
  }
}
