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
  Logger,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuizService, QuizDifficulty } from './quiz.service';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * Management 퀴즈 관리 컨트롤러
 * 백오피스에서 퀴즈 마스터 데이터를 관리하는 API
 */
@Controller('management/quiz')
@UseGuards(JwtAuthGuard)
export class QuizMasterController {
  private readonly logger = new Logger(QuizMasterController.name);

  constructor(private readonly quizService: QuizService) {}

  /**
   * 모든 퀴즈 목록 조회 (페이징 및 필터링)
   */
  @Get()
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

      const filters = {
        search,
        category,
        difficulty,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      };

      const sort = {
        sortBy: sortBy || 'createdAt',
        sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
      };

      const result = await this.quizService.getQuizzesWithPagination(
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
        timestamp: getNowKST(),
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
  async createQuiz(
    @Body() createQuizDto: {
      title: string;
      question: string;
      options: string[];
      correctAnswer: number;
      points?: number;
      category?: string;
      difficulty?: QuizDifficulty;
    }
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`퀴즈 생성 요청 - 제목: ${createQuizDto.title}`);

    try {
      const quiz = await this.quizService.createQuiz(createQuizDto);

      this.logger.log(`퀴즈 생성 성공 - ID: ${quiz.id}`);

      return {
        success: true,
        message: '퀴즈가 성공적으로 생성되었습니다.',
        data: quiz,
        timestamp: getNowKST(),
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
  async getQuiz(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto<any>> {
    this.logger.log(`퀴즈 상세 조회 요청 - ID: ${id}`);

    try {
      const quiz = await this.quizService.getQuizById(id);

      this.logger.log(`퀴즈 상세 조회 성공 - ID: ${id}`);

      return {
        success: true,
        message: '퀴즈가 성공적으로 조회되었습니다.',
        data: quiz,
        timestamp: getNowKST(),
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
  async updateQuiz(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateQuizDto: Partial<{
      title: string;
      question: string;
      options: string[];
      correctAnswer: number;
      points: number;
      category: string;
      difficulty: QuizDifficulty;
      isActive: boolean;
    }>,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`퀴즈 수정 요청 - ID: ${id}`);

    try {
      const quiz = await this.quizService.updateQuiz(id, updateQuizDto);

      this.logger.log(`퀴즈 수정 성공 - ID: ${id}`);

      return {
        success: true,
        message: '퀴즈가 성공적으로 수정되었습니다.',
        data: quiz,
        timestamp: getNowKST(),
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
  async deleteQuiz(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto<null>> {
    this.logger.log(`퀴즈 삭제 요청 - ID: ${id}`);

    try {
      await this.quizService.deleteQuiz(id);

      this.logger.log(`퀴즈 삭제 성공 - ID: ${id}`);

      return {
        success: true,
        message: '퀴즈가 성공적으로 삭제되었습니다.',
        data: null,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`퀴즈 삭제 실패 - ID: ${id}`, error);
      throw error;
    }
  }
}
