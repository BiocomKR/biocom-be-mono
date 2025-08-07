import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { QuizMasterService } from '../../quiz/quiz-master.service';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { QuizDifficulty } from '../../quiz/quiz.types';

/**
 * Management 퀴즈 관리 컨트롤러
 * 백오피스에서 퀴즈 마스터 데이터를 관리하는 API
 */
@ApiTags('management-quiz')
@Controller('management/quiz')
@UseGuards(ApiKeyGuard)
@ApiHeader({
  name: 'X-API-KEY',
  description: 'API Key for authentication',
  required: true,
})
export class ManagementQuizMasterController {
  private readonly logger = new Logger(ManagementQuizMasterController.name);

  constructor(private readonly quizMasterService: QuizMasterService) {}

  /**
   * 모든 퀴즈 목록 조회 (페이징 및 필터링)
   */
  @Get()
  @ApiOperation({
    summary: '퀴즈 목록 조회',
    description: '모든 퀴즈 목록을 페이징 처리하여 조회합니다.',
  })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호 (기본값: 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 항목 수 (기본값: 20)', example: 20 })
  @ApiQuery({ name: 'search', required: false, description: '검색어 (퀴즈 제목, 질문)' })
  @ApiQuery({ name: 'category', required: false, description: '퀴즈 카테고리' })
  @ApiQuery({ name: 'difficulty', required: false, description: '퀴즈 난이도', enum: QuizDifficulty })
  @ApiQuery({ name: 'isActive', required: false, description: '활성화 상태', type: 'boolean' })
  @ApiQuery({ name: 'sortBy', required: false, description: '정렬 기준', enum: ['createdAt', 'title', 'points', 'difficulty'] })
  @ApiQuery({ name: 'sortOrder', required: false, description: '정렬 순서', enum: ['asc', 'desc'] })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '퀴즈 목록 조회 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array' },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
        timestamp: { type: 'string' },
      },
    },
  })
  async getAllQuizzes(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('difficulty') difficulty?: string,
    @Query('isActive') isActive?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log('퀴즈 목록 조회 요청');

    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '20', 10);

      // 필터 조건 구성
      const filters = {
        search,
        category,
        difficulty,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      };

      // 정렬 조건
      const sort = {
        sortBy: sortBy || 'createdAt',
        sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
      };

      const result = await this.quizMasterService.getQuizzesWithPagination(
        pageNum,
        limitNum,
        filters,
        sort,
      );

      this.logger.log(`퀴즈 목록 조회 성공 - 총 ${result.total}개, 페이지 ${result.page}/${result.totalPages}`);

      return {
        success: true,
        message: '퀴즈 목록이 성공적으로 조회되었습니다.',
        data: result,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('퀴즈 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 새로운 퀴즈 생성
   */
  @Post()
  @ApiOperation({
    summary: '퀴즈 생성',
    description: '새로운 퀴즈를 생성합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '퀴즈 제목',
          example: '하루 권장 물 섭취량은?',
        },
        question: {
          type: 'string',
          description: '퀴즈 질문',
          example: '성인의 하루 권장 물 섭취량은 얼마일까요?',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: '선택지 목록',
          example: ['1L', '1.5L', '2L', '2.5L'],
        },
        correctAnswer: {
          type: 'number',
          description: '정답 번호 (0부터 시작)',
          example: 2,
        },
        points: {
          type: 'number',
          description: '퀴즈 포인트',
          example: 50,
        },
        category: {
          type: 'string',
          description: '퀴즈 카테고리',
          example: 'health',
        },
        difficulty: {
          type: 'string',
          description: '퀴즈 난이도',
          enum: Object.values(QuizDifficulty),
          example: QuizDifficulty.MEDIUM,
        },
      },
      required: ['title', 'question', 'options', 'correctAnswer'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '퀴즈 생성 성공',
  })
  async createQuiz(@Body() createQuizDto: any): Promise<ApiResponseDto<any>> {
    this.logger.log(`퀴즈 생성 요청 - 제목: ${createQuizDto.title}`);

    try {
      const quiz = await this.quizMasterService.createQuiz(createQuizDto);

      this.logger.log(`퀴즈 생성 성공 - ID: ${quiz.id}`);

      return {
        success: true,
        message: '퀴즈가 성공적으로 생성되었습니다.',
        data: quiz,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`퀴즈 생성 실패 - 제목: ${createQuizDto.title}`, error);
      throw error;
    }
  }

  /**
   * 퀴즈 상세 조회
   */
  @Get(':id')
  @ApiOperation({
    summary: '퀴즈 상세 조회',
    description: '특정 퀴즈의 상세 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '퀴즈 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '퀴즈 조회 성공',
  })
  async getQuiz(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto<any>> {
    this.logger.log(`퀴즈 상세 조회 요청 - ID: ${id}`);

    try {
      const quiz = await this.quizMasterService.getQuizById(id);

      this.logger.log(`퀴즈 상세 조회 성공 - ID: ${id}`);

      return {
        success: true,
        message: '퀴즈가 성공적으로 조회되었습니다.',
        data: quiz,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`퀴즈 상세 조회 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 퀴즈 수정
   */
  @Put(':id')
  @ApiOperation({
    summary: '퀴즈 수정',
    description: '기존 퀴즈를 수정합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '퀴즈 ID',
    example: 1,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '퀴즈 제목',
        },
        question: {
          type: 'string',
          description: '퀴즈 질문',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: '선택지 목록',
        },
        correctAnswer: {
          type: 'number',
          description: '정답 번호',
        },
        points: {
          type: 'number',
          description: '퀴즈 포인트',
        },
        category: {
          type: 'string',
          description: '퀴즈 카테고리',
        },
        difficulty: {
          type: 'string',
          description: '퀴즈 난이도',
          enum: Object.values(QuizDifficulty),
        },
        isActive: {
          type: 'boolean',
          description: '활성화 여부',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '퀴즈 수정 성공',
  })
  async updateQuiz(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateQuizDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`퀴즈 수정 요청 - ID: ${id}`);

    try {
      const quiz = await this.quizMasterService.updateQuiz(id, updateQuizDto);

      this.logger.log(`퀴즈 수정 성공 - ID: ${id}`);

      return {
        success: true,
        message: '퀴즈가 성공적으로 수정되었습니다.',
        data: quiz,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`퀴즈 수정 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 퀴즈 삭제
   */
  @Delete(':id')
  @ApiOperation({
    summary: '퀴즈 삭제',
    description: '퀴즈를 삭제합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '퀴즈 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '퀴즈 삭제 성공',
  })
  async deleteQuiz(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto<null>> {
    this.logger.log(`퀴즈 삭제 요청 - ID: ${id}`);

    try {
      await this.quizMasterService.deleteQuiz(id);

      this.logger.log(`퀴즈 삭제 성공 - ID: ${id}`);

      return {
        success: true,
        message: '퀴즈가 성공적으로 삭제되었습니다.',
        data: null,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`퀴즈 삭제 실패 - ID: ${id}`, error);
      throw error;
    }
  }
}