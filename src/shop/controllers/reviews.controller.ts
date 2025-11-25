import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
  Req
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiQuery
} from '@nestjs/swagger';
import { ReviewsService } from '../services/reviews.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewQueryDto,
  ReviewResponseDto,
  ReviewPaginatedResponseDto,
  ReviewHelpfulResponseDto,
  CreateReviewCommentDto,
  UpdateReviewCommentDto,
  ReviewCommentResponseDto,
  ReviewCommentPaginatedResponseDto
} from '../dto/reviews/review.dto';

@ApiTags('쇼핑몰 - 상품리뷰')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shop/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * 리뷰 작성
   */
  @Post()
  @ApiOperation({
    summary: '리뷰 작성',
    description: '상품에 대해 리뷰를 작성합니다. 로그인한 사용자 누구나 작성 가능합니다.'
  })
  @ApiBody({ type: CreateReviewDto })
  @ApiResponse({ status: 201, description: '리뷰 작성 성공', type: ReviewResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 요청 (이미 리뷰 작성, 상품 없음 등)' })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없음' })
  async createReview(
    @Req() req: any,
    @Body(ValidationPipe) dto: CreateReviewDto
  ): Promise<ReviewResponseDto> {
    const userId = req.user.id;
    return this.reviewsService.createReview(userId, dto);
  }

  /**
   * 리뷰 목록 조회 (댓글 포함)
   */
  @Get()
  @ApiOperation({
    summary: '리뷰 목록 조회',
    description: '리뷰 목록을 페이지네이션하여 조회합니다. 각 리뷰의 댓글도 함께 조회됩니다. 상품별, 별점별, 타입별 필터링 및 정렬이 가능합니다.'
  })
  @ApiQuery({ name: 'productId', required: false, description: '상품 ID' })
  @ApiQuery({ name: 'rating', required: false, description: '별점 필터 (1-5)' })
  @ApiQuery({ name: 'reviewType', required: false, description: '리뷰 타입 필터' })
  @ApiQuery({ name: 'isBest', required: false, description: '베스트 리뷰만 조회' })
  @ApiQuery({ name: 'sort', required: false, description: '정렬 기준' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호' })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 항목 수' })
  @ApiResponse({ status: 200, description: '성공', type: ReviewPaginatedResponseDto })
  async findReviews(
    @Query(ValidationPipe) query: ReviewQueryDto
  ): Promise<ReviewPaginatedResponseDto> {
    return this.reviewsService.findReviews(query);
  }

  /**
   * 리뷰 수정
   */
  @Patch(':id')
  @ApiOperation({
    summary: '리뷰 수정',
    description: '본인이 작성한 리뷰를 수정합니다.'
  })
  @ApiParam({ name: 'id', description: '리뷰 ID' })
  @ApiBody({ type: UpdateReviewDto })
  @ApiResponse({ status: 200, description: '리뷰 수정 성공', type: ReviewResponseDto })
  @ApiResponse({ status: 403, description: '권한 없음 (본인 리뷰 아님)' })
  @ApiResponse({ status: 404, description: '리뷰를 찾을 수 없음' })
  async updateReview(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: UpdateReviewDto
  ): Promise<ReviewResponseDto> {
    const userId = req.user.id;
    return this.reviewsService.updateReview(userId, id, dto);
  }

  /**
   * 리뷰 삭제
   */
  @Delete(':id')
  @ApiOperation({
    summary: '리뷰 삭제',
    description: '본인이 작성한 리뷰를 삭제합니다.'
  })
  @ApiParam({ name: 'id', description: '리뷰 ID' })
  @ApiResponse({ status: 200, description: '리뷰 삭제 성공', example: { success: true, message: '리뷰가 삭제되었습니다' } })
  @ApiResponse({ status: 403, description: '권한 없음 (본인 리뷰 아님)' })
  @ApiResponse({ status: 404, description: '리뷰를 찾을 수 없음' })
  async deleteReview(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user.id;
    return this.reviewsService.deleteReview(userId, id);
  }

  /**
   * 리뷰 도움됨 토글
   */
  @Post(':id/helpful')
  @ApiOperation({
    summary: '리뷰 도움됨 토글',
    description: '리뷰에 도움됨을 표시하거나 해제합니다. 본인이 작성한 리뷰에는 표시할 수 없습니다.'
  })
  @ApiParam({ name: 'id', description: '리뷰 ID' })
  @ApiResponse({ status: 200, description: '성공', type: ReviewHelpfulResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 요청 (본인 리뷰)' })
  @ApiResponse({ status: 404, description: '리뷰를 찾을 수 없음' })
  async toggleHelpful(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number
  ): Promise<ReviewHelpfulResponseDto> {
    const userId = req.user.id;
    return this.reviewsService.toggleHelpful(userId, id);
  }

  /**
   * 상품의 리뷰 목록 조회 (편의 메서드)
   */
  @Get('products/:productId')
  @ApiOperation({
    summary: '상품별 리뷰 목록 조회',
    description: '특정 상품의 리뷰 목록을 조회합니다.'
  })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiQuery({ name: 'rating', required: false, description: '별점 필터 (1-5)' })
  @ApiQuery({ name: 'reviewType', required: false, description: '리뷰 타입 필터' })
  @ApiQuery({ name: 'isBest', required: false, description: '베스트 리뷰만 조회' })
  @ApiQuery({ name: 'sort', required: false, description: '정렬 기준' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호' })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 항목 수' })
  @ApiResponse({ status: 200, description: '성공', type: ReviewPaginatedResponseDto })
  async findProductReviews(
    @Param('productId', ParseIntPipe) productId: number,
    @Query(ValidationPipe) query: ReviewQueryDto
  ): Promise<ReviewPaginatedResponseDto> {
    // 상품 ID를 쿼리에 추가
    query.productId = productId;
    return this.reviewsService.findReviews(query);
  }

  /**
   * 상품의 별점 통계 조회
   */
  @Get('products/:productId/stats')
  @ApiOperation({
    summary: '상품 별점 통계 조회',
    description: '특정 상품의 평균 별점 및 별점별 리뷰 수를 조회합니다.'
  })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiResponse({
    status: 200,
    description: '성공',
    example: {
      averageRating: 4.2,
      totalCount: 150,
      rating1Count: 5,
      rating2Count: 8,
      rating3Count: 20,
      rating4Count: 45,
      rating5Count: 72
    }
  })
  async getProductRatingStats(
    @Param('productId', ParseIntPipe) productId: number
  ) {
    return this.reviewsService.getProductRatingStats(productId);
  }

  /**
   * 리뷰 댓글 작성
   */
  @Post(':reviewId/comments')
  @ApiOperation({
    summary: '리뷰 댓글 작성',
    description: '리뷰에 댓글을 작성합니다. 사진 첨부 가능합니다 (최대 3장).'
  })
  @ApiParam({ name: 'reviewId', description: '리뷰 ID' })
  @ApiBody({ type: CreateReviewCommentDto })
  @ApiResponse({ status: 201, description: '댓글 작성 성공', type: ReviewCommentResponseDto })
  @ApiResponse({ status: 404, description: '리뷰를 찾을 수 없음' })
  async createReviewComment(
    @Req() req: any,
    @Param('reviewId', ParseIntPipe) reviewId: number,
    @Body(ValidationPipe) dto: CreateReviewCommentDto
  ): Promise<ReviewCommentResponseDto> {
    const userId = req.user.id;
    return this.reviewsService.createReviewComment(userId, reviewId, dto);
  }

  /**
   * 리뷰 댓글 목록 조회
   */
  @Get(':reviewId/comments')
  @ApiOperation({
    summary: '리뷰 댓글 목록 조회',
    description: '특정 리뷰의 댓글 목록을 조회합니다.'
  })
  @ApiParam({ name: 'reviewId', description: '리뷰 ID' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 항목 수', example: 20 })
  @ApiResponse({ status: 200, description: '성공', type: ReviewCommentPaginatedResponseDto })
  @ApiResponse({ status: 404, description: '리뷰를 찾을 수 없음' })
  async findReviewComments(
    @Param('reviewId', ParseIntPipe) reviewId: number,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number
  ): Promise<ReviewCommentPaginatedResponseDto> {
    return this.reviewsService.findReviewComments(reviewId, page, limit);
  }

  /**
   * 리뷰 댓글 수정
   */
  @Patch('comments/:commentId')
  @ApiOperation({
    summary: '리뷰 댓글 수정',
    description: '본인이 작성한 댓글을 수정합니다.'
  })
  @ApiParam({ name: 'commentId', description: '댓글 ID' })
  @ApiBody({ type: UpdateReviewCommentDto })
  @ApiResponse({ status: 200, description: '댓글 수정 성공', type: ReviewCommentResponseDto })
  @ApiResponse({ status: 403, description: '권한 없음 (본인 댓글 아님)' })
  @ApiResponse({ status: 404, description: '댓글을 찾을 수 없음' })
  async updateReviewComment(
    @Req() req: any,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body(ValidationPipe) dto: UpdateReviewCommentDto
  ): Promise<ReviewCommentResponseDto> {
    const userId = req.user.id;
    return this.reviewsService.updateReviewComment(userId, commentId, dto);
  }

  /**
   * 리뷰 댓글 삭제
   */
  @Delete('comments/:commentId')
  @ApiOperation({
    summary: '리뷰 댓글 삭제',
    description: '본인이 작성한 댓글을 삭제합니다.'
  })
  @ApiParam({ name: 'commentId', description: '댓글 ID' })
  @ApiResponse({ status: 200, description: '댓글 삭제 성공', example: { success: true, message: '댓글이 삭제되었습니다' } })
  @ApiResponse({ status: 403, description: '권한 없음 (본인 댓글 아님)' })
  @ApiResponse({ status: 404, description: '댓글을 찾을 수 없음' })
  async deleteReviewComment(
    @Req() req: any,
    @Param('commentId', ParseIntPipe) commentId: number
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user.id;
    return this.reviewsService.deleteReviewComment(userId, commentId);
  }
}