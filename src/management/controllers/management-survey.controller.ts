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
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ManagementSurveyService } from '../services/management-survey.service';
import { CreateSurveyQuestionDto } from '../../survey/dto/create-survey-question.dto';
import { CreateSurveyOptionDto } from '../../survey/dto/create-survey-option.dto';
import {
  SurveyQuestionResponseDto,
  SurveyOptionResponseDto,
  SurveyAnswerResponseDto,
} from '../../survey/dto/survey-response.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * Management 설문 관리 컨트롤러
 * 백오피스에서 설문을 관리하는 API
 */
@Controller('management/survey')
@UseGuards(ApiKeyGuard)
export class ManagementSurveyController {
  private readonly logger = new Logger(ManagementSurveyController.name);

  constructor(private readonly managementSurveyService: ManagementSurveyService) {}

  /**
   * 모든 설문 목록 조회 (페이징 및 필터링)
   */
  @Get()
                      async getAllSurveys(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log('설문 목록 조회 요청');

    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '20', 10);

      // 필터 조건 구성
      const filters = {
        search,
        type,
        category,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      };

      // 정렬 조건
      const sort = {
        sortBy: sortBy || 'createdAt',
        sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
      };

      const result = await this.managementSurveyService.getSurveysWithPagination(
        pageNum,
        limitNum,
        filters,
        sort,
      );
      
      this.logger.log(`설문 목록 조회 성공 - 총 ${result.total}개, 페이지 ${result.page}/${result.totalPages}`);
      
      return {
        success: true,
        message: '설문 목록이 성공적으로 조회되었습니다.',
        data: result,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error('설문 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 새로운 설문 생성
   */
  @Post()
        async createSurvey(
    @Body() createSurveyDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`설문 생성 요청 - 이름: ${createSurveyDto.name}`);

    try {
      const survey = await this.managementSurveyService.createSurvey(createSurveyDto);
      
      this.logger.log(`설문 생성 성공 - ID: ${survey.id}`);
      
      return {
        success: true,
        message: '설문이 성공적으로 생성되었습니다.',
        data: survey,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`설문 생성 실패 - 이름: ${createSurveyDto.name}`, error);
      throw error;
    }
  }

  /**
   * 설문 상세 조회
   */
  @Get(':id')
        async getSurvey(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`설문 상세 조회 요청 - ID: ${id}`);

    try {
      const survey = await this.managementSurveyService.getSurveyById(id);
      
      this.logger.log(`설문 상세 조회 성공 - ID: ${id}`);
      
      return {
        success: true,
        message: '설문이 성공적으로 조회되었습니다.',
        data: survey,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`설문 상세 조회 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 설문 수정
   */
  @Put(':id')
          async updateSurvey(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSurveyDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`설문 수정 요청 - ID: ${id}`);

    try {
      const survey = await this.managementSurveyService.updateSurvey(id, updateSurveyDto);
      
      this.logger.log(`설문 수정 성공 - ID: ${id}`);
      
      return {
        success: true,
        message: '설문이 성공적으로 수정되었습니다.',
        data: survey,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`설문 수정 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 설문 삭제
   */
  @Delete(':id')
        async deleteSurvey(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<null>> {
    this.logger.log(`설문 삭제 요청 - ID: ${id}`);

    try {
      await this.managementSurveyService.deleteSurvey(id);
      
      this.logger.log(`설문 삭제 성공 - ID: ${id}`);
      
      return {
        success: true,
        message: '설문이 성공적으로 삭제되었습니다.',
        data: null,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`설문 삭제 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 설문에 질문 추가
   */
  @Post(':id/questions')
          async addQuestionToSurvey(
    @Param('id', ParseIntPipe) surveyId: number,
    @Body() createQuestionDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`설문에 질문 추가 요청 - 설문 ID: ${surveyId}, 질문: ${createQuestionDto.questionText}`);

    try {
      const question = await this.managementSurveyService.addQuestionToSurvey(surveyId, createQuestionDto);
      
      this.logger.log(`설문에 질문 추가 성공 - 질문 ID: ${question.id}`);
      
      return {
        success: true,
        message: '질문이 설문에 성공적으로 추가되었습니다.',
        data: question,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`설문에 질문 추가 실패 - 설문 ID: ${surveyId}`, error);
      throw error;
    }
  }

  /**
   * 새로운 설문 질문 생성
   */
  @Post('questions')
        async createQuestion(
    @Body() createSurveyQuestionDto: CreateSurveyQuestionDto,
  ): Promise<ApiResponseDto<SurveyQuestionResponseDto>> {
    this.logger.log(`설문 질문 생성 요청 - 질문: ${createSurveyQuestionDto.questionText}`);

    try {
      const question = await this.managementSurveyService.createQuestion(createSurveyQuestionDto);
      
      this.logger.log(`설문 질문 생성 응답 성공 - ID: ${question.id}`);
      
      return {
        success: true,
        message: '설문 질문이 성공적으로 생성되었습니다.',
        data: question,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`설문 질문 생성 응답 실패 - 질문: ${createSurveyQuestionDto.questionText}`, error);
      throw error;
    }
  }

  /**
   * 새로운 설문 선택지 생성
   */
  @Post('options')
        async createOption(
    @Body() createSurveyOptionDto: CreateSurveyOptionDto,
  ): Promise<ApiResponseDto<SurveyOptionResponseDto>> {
    this.logger.log(`설문 선택지 생성 요청 - 질문 ID: ${createSurveyOptionDto.surveyQuestionId}`);

    try {
      const option = await this.managementSurveyService.createOption(createSurveyOptionDto);
      
      this.logger.log(`설문 선택지 생성 응답 성공 - ID: ${option.id}`);
      
      const responseDto = {
        id: option.id,
        surveyQuestionId: createSurveyOptionDto.surveyQuestionId,
        optionText: option.optionText,
        score: option.score,
        createdAt: option.createdAt,
        updatedAt: option.createdAt,
      };
      
      return {
        success: true,
        message: '설문 선택지가 성공적으로 생성되었습니다.',
        data: responseDto,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`설문 선택지 생성 응답 실패 - 질문 ID: ${createSurveyOptionDto.surveyQuestionId}`, error);
      throw error;
    }
  }

  /**
   * 특정 질문에 대한 모든 답변 조회
   */
  @Get('answers/question/:questionId')
          async findAnswersByQuestion(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Query('type') type?: 'before' | 'after',
  ): Promise<ApiResponseDto<SurveyAnswerResponseDto[]>> {
    this.logger.log(`질문별 설문 답변 조회 요청 - 질문 ID: ${questionId}, 타입: ${type || '전체'}`);

    try {
      const answers = await this.managementSurveyService.findAnswersByQuestion(questionId, type);
      
      this.logger.log(`질문별 설문 답변 조회 응답 성공 - 질문 ID: ${questionId}, 답변 수: ${answers.length}`);
      
      return {
        success: true,
        message: '질문에 대한 모든 답변이 성공적으로 조회되었습니다.',
        data: answers,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`질문별 설문 답변 조회 응답 실패 - 질문 ID: ${questionId}`, error);
      throw error;
    }
  }
}