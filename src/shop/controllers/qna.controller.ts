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
import { QnaService } from '../services/qna.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CreateQnaDto,
  UpdateQnaDto,
  CreateQnaAnswerDto,
  QnaQueryDto,
  QnaResponseDto,
  QnaPaginatedResponseDto
} from '../dto/qna/qna.dto';

/**
 * 상품 Q&A 컨트롤러
 * 상품에 대한 질문과 답변을 관리합니다
 */
@ApiTags('쇼핑몰 - 상품 Q&A')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shop/qna')
export class QnaController {
  constructor(private readonly qnaService: QnaService) {}

  /**
   * Q&A 작성
   */
  @Post()
  @ApiOperation({
    summary: 'Q&A 작성',
    description: '상품에 대해 질문을 작성합니다. 로그인한 사용자 누구나 작성 가능합니다.'
  })
  @ApiBody({ type: CreateQnaDto })
  @ApiResponse({ status: 201, description: 'Q&A 작성 성공', type: QnaResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없음' })
  async createQuestion(
    @Req() req: any,
    @Body(ValidationPipe) dto: CreateQnaDto
  ): Promise<QnaResponseDto> {
    const userId = req.user.id;
    return this.qnaService.createQuestion(userId, dto);
  }

  /**
   * Q&A 목록 조회
   */
  @Get()
  @ApiOperation({
    summary: 'Q&A 목록 조회',
    description: 'Q&A 목록을 페이지네이션하여 조회합니다. 상품별, 문의타입별, 답변여부별 필터링 및 정렬이 가능합니다.'
  })
  @ApiQuery({ name: 'productId', required: false, description: '상품 ID' })
  @ApiQuery({ name: 'questionType', required: false, description: '문의 타입 필터' })
  @ApiQuery({ name: 'filter', required: false, description: '답변 여부 필터 (all, answered, unanswered)' })
  @ApiQuery({ name: 'sort', required: false, description: '정렬 기준 (latest, oldest, answered, unanswered)' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호' })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 항목 수' })
  @ApiResponse({ status: 200, description: '성공', type: QnaPaginatedResponseDto })
  async findQuestions(
    @Query(ValidationPipe) query: QnaQueryDto
  ): Promise<QnaPaginatedResponseDto> {
    return this.qnaService.findQuestions(query);
  }

  /**
   * Q&A 상세 조회
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Q&A 상세 조회',
    description: '특정 Q&A의 상세 정보를 조회합니다. 비밀글인 경우 작성자만 조회할 수 있습니다.'
  })
  @ApiParam({ name: 'id', description: 'Q&A ID' })
  @ApiResponse({ status: 200, description: '성공', type: QnaResponseDto })
  @ApiResponse({ status: 403, description: '권한 없음 (비밀글)' })
  @ApiResponse({ status: 404, description: 'Q&A를 찾을 수 없음' })
  async findQuestionById(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number
  ): Promise<QnaResponseDto> {
    const userId = req.user.id;
    return this.qnaService.findQuestionById(id, userId);
  }

  /**
   * Q&A 수정
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Q&A 수정',
    description: '본인이 작성한 Q&A를 수정합니다. 답변이 달린 질문은 수정할 수 없습니다.'
  })
  @ApiParam({ name: 'id', description: 'Q&A ID' })
  @ApiBody({ type: UpdateQnaDto })
  @ApiResponse({ status: 200, description: 'Q&A 수정 성공', type: QnaResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 요청 (답변이 달린 질문)' })
  @ApiResponse({ status: 403, description: '권한 없음 (본인 질문 아님)' })
  @ApiResponse({ status: 404, description: 'Q&A를 찾을 수 없음' })
  async updateQuestion(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: UpdateQnaDto
  ): Promise<QnaResponseDto> {
    const userId = req.user.id;
    return this.qnaService.updateQuestion(userId, id, dto);
  }

  /**
   * Q&A 삭제
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Q&A 삭제',
    description: '본인이 작성한 Q&A를 삭제합니다.'
  })
  @ApiParam({ name: 'id', description: 'Q&A ID' })
  @ApiResponse({ status: 200, description: 'Q&A 삭제 성공', example: { success: true, message: 'Q&A가 삭제되었습니다' } })
  @ApiResponse({ status: 403, description: '권한 없음 (본인 질문 아님)' })
  @ApiResponse({ status: 404, description: 'Q&A를 찾을 수 없음' })
  async deleteQuestion(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user.id;
    return this.qnaService.deleteQuestion(userId, id);
  }

  /**
   * Q&A 답변 작성 (관리자용)
   */
  @Post(':id/answer')
  @ApiOperation({
    summary: 'Q&A 답변 작성 (관리자)',
    description: 'Q&A에 답변을 작성합니다. 관리자만 사용 가능합니다.'
  })
  @ApiParam({ name: 'id', description: 'Q&A ID' })
  @ApiBody({ type: CreateQnaAnswerDto })
  @ApiResponse({ status: 201, description: '답변 작성 성공', type: QnaResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 요청 (이미 답변 존재)' })
  @ApiResponse({ status: 404, description: 'Q&A를 찾을 수 없음' })
  async createAnswer(
    @Req() req: any,
    @Param('id', ParseIntPipe) questionId: number,
    @Body(ValidationPipe) dto: CreateQnaAnswerDto
  ): Promise<QnaResponseDto> {
    const adminId = req.user.id;
    return this.qnaService.createAnswer(adminId, questionId, dto);
  }

  /**
   * Q&A 답변 수정 (관리자용)
   */
  @Patch(':id/answer')
  @ApiOperation({
    summary: 'Q&A 답변 수정 (관리자)',
    description: 'Q&A 답변을 수정합니다. 관리자만 사용 가능합니다.'
  })
  @ApiParam({ name: 'id', description: 'Q&A ID' })
  @ApiBody({ type: CreateQnaAnswerDto })
  @ApiResponse({ status: 200, description: '답변 수정 성공', type: QnaResponseDto })
  @ApiResponse({ status: 404, description: 'Q&A 또는 답변을 찾을 수 없음' })
  async updateAnswer(
    @Req() req: any,
    @Param('id', ParseIntPipe) questionId: number,
    @Body(ValidationPipe) dto: CreateQnaAnswerDto
  ): Promise<QnaResponseDto> {
    const adminId = req.user.id;
    return this.qnaService.updateAnswer(adminId, questionId, dto);
  }

  /**
   * Q&A 답변 삭제 (관리자용)
   */
  @Delete(':id/answer')
  @ApiOperation({
    summary: 'Q&A 답변 삭제 (관리자)',
    description: 'Q&A 답변을 삭제합니다. 관리자만 사용 가능합니다.'
  })
  @ApiParam({ name: 'id', description: 'Q&A ID' })
  @ApiResponse({ status: 200, description: '답변 삭제 성공', example: { success: true, message: 'Q&A 답변이 삭제되었습니다' } })
  @ApiResponse({ status: 404, description: 'Q&A 또는 답변을 찾을 수 없음' })
  async deleteAnswer(
    @Req() req: any,
    @Param('id', ParseIntPipe) questionId: number
  ): Promise<{ success: boolean; message: string }> {
    const adminId = req.user.id;
    return this.qnaService.deleteAnswer(adminId, questionId);
  }

  /**
   * 상품별 Q&A 목록 조회 (편의 메서드)
   */
  @Get('products/:productId')
  @ApiOperation({
    summary: '상품별 Q&A 목록 조회',
    description: '특정 상품의 Q&A 목록을 조회합니다.'
  })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiQuery({ name: 'questionType', required: false, description: '문의 타입 필터' })
  @ApiQuery({ name: 'filter', required: false, description: '답변 여부 필터' })
  @ApiQuery({ name: 'sort', required: false, description: '정렬 기준' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호' })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 항목 수' })
  @ApiResponse({ status: 200, description: '성공', type: QnaPaginatedResponseDto })
  async findProductQuestions(
    @Param('productId', ParseIntPipe) productId: number,
    @Query(ValidationPipe) query: QnaQueryDto
  ): Promise<QnaPaginatedResponseDto> {
    // 상품 ID를 쿼리에 추가
    query.productId = productId;
    return this.qnaService.findQuestions(query);
  }
}
