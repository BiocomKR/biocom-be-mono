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
import { SurveyService } from '../../survey/survey.service';
import { CreateSurveyQuestionDto } from '../../survey/dto/create-survey-question.dto';
import { CreateSurveyOptionDto } from '../../survey/dto/create-survey-option.dto';
import {
  SurveyQuestionResponseDto,
  SurveyOptionResponseDto,
  SurveyAnswerResponseDto,
} from '../../survey/dto/survey-response.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * Management 설문 관리 컨트롤러
 * 백오피스에서 설문을 관리하는 API
 */
@ApiTags('management-survey')
@Controller('management/survey')
@UseGuards(ApiKeyGuard)
@ApiHeader({
  name: 'X-API-KEY',
  description: 'API Key for authentication',
  required: true,
})
export class ManagementSurveyController {
  private readonly logger = new Logger(ManagementSurveyController.name);

  constructor(private readonly surveyService: SurveyService) {}

  /**
   * 모든 설문 목록 조회 (페이징 및 필터링)
   */
  @Get()
  @ApiOperation({
    summary: '설문 목록 조회',
    description: '모든 설문 목록을 페이징 처리하여 조회합니다.',
  })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호 (기본값: 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 항목 수 (기본값: 20)', example: 20 })
  @ApiQuery({ name: 'search', required: false, description: '검색어 (설문명, 설명)' })
  @ApiQuery({ name: 'type', required: false, description: '설문 타입' })
  @ApiQuery({ name: 'category', required: false, description: '설문 카테고리' })
  @ApiQuery({ name: 'isActive', required: false, description: '활성화 상태', type: 'boolean' })
  @ApiQuery({ name: 'sortBy', required: false, description: '정렬 기준', enum: ['createdAt', 'name', 'type'] })
  @ApiQuery({ name: 'sortOrder', required: false, description: '정렬 순서', enum: ['asc', 'desc'] })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '설문 목록 조회 성공',
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

      const result = await this.surveyService.getSurveysWithPagination(
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
        timestamp: new Date(),
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
  @ApiOperation({
    summary: '설문 생성',
    description: '새로운 설문을 생성합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '설문 제목',
          example: '21일 챌린지 사전 설문',
        },
        description: {
          type: 'string',
          description: '설문 설명',
          example: '챌린지 시작 전 건강 상태를 파악하는 설문입니다',
        },
        type: {
          type: 'string',
          description: '설문 타입',
          example: 'health',
        },
        category: {
          type: 'string',
          description: '설문 카테고리',
          example: 'before',
        },
        isActive: {
          type: 'boolean',
          description: '활성화 여부',
          example: true,
        },
      },
      required: ['title', 'type'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '설문 생성 성공',
  })
  async createSurvey(
    @Body() createSurveyDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`설문 생성 요청 - 제목: ${createSurveyDto.title}`);

    try {
      const survey = await this.surveyService.createSurvey(createSurveyDto);
      
      this.logger.log(`설문 생성 성공 - ID: ${survey.id}`);
      
      return {
        success: true,
        message: '설문이 성공적으로 생성되었습니다.',
        data: survey,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`설문 생성 실패 - 제목: ${createSurveyDto.title}`, error);
      throw error;
    }
  }

  /**
   * 설문 상세 조회
   */
  @Get(':id')
  @ApiOperation({
    summary: '설문 상세 조회',
    description: '특정 설문의 상세 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '설문 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '설문 조회 성공',
  })
  async getSurvey(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`설문 상세 조회 요청 - ID: ${id}`);

    try {
      const survey = await this.surveyService.getSurveyById(id);
      
      this.logger.log(`설문 상세 조회 성공 - ID: ${id}`);
      
      return {
        success: true,
        message: '설문이 성공적으로 조회되었습니다.',
        data: survey,
        timestamp: new Date(),
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
  @ApiOperation({
    summary: '설문 수정',
    description: '기존 설문을 수정합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '설문 ID',
    example: 1,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '설문 제목',
        },
        description: {
          type: 'string',
          description: '설문 설명',
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
    description: '설문 수정 성공',
  })
  async updateSurvey(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSurveyDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`설문 수정 요청 - ID: ${id}`);

    try {
      const survey = await this.surveyService.updateSurvey(id, updateSurveyDto);
      
      this.logger.log(`설문 수정 성공 - ID: ${id}`);
      
      return {
        success: true,
        message: '설문이 성공적으로 수정되었습니다.',
        data: survey,
        timestamp: new Date(),
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
  @ApiOperation({
    summary: '설문 삭제',
    description: '설문을 삭제합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '설문 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '설문 삭제 성공',
  })
  async deleteSurvey(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<null>> {
    this.logger.log(`설문 삭제 요청 - ID: ${id}`);

    try {
      await this.surveyService.deleteSurvey(id);
      
      this.logger.log(`설문 삭제 성공 - ID: ${id}`);
      
      return {
        success: true,
        message: '설문이 성공적으로 삭제되었습니다.',
        data: null,
        timestamp: new Date(),
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
  @ApiOperation({
    summary: '설문에 질문 추가',
    description: '특정 설문에 새로운 질문을 추가합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '설문 ID',
    example: 1,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        categoryCode: {
          type: 'string',
          description: '카테고리 코드',
          example: 'HEALTH',
        },
        categoryName: {
          type: 'string',
          description: '카테고리 이름',
          example: '건강 상태',
        },
        questionText: {
          type: 'string',
          description: '질문 내용',
          example: '현재 건강 상태는 어떠신가요?',
        },
        questionType: {
          type: 'string',
          description: '질문 타입',
          enum: ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TEXT', 'SCALE'],
          example: 'SINGLE_CHOICE',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: '선택지 목록',
          example: ['매우 좋음', '좋음', '보통', '나쁨', '매우 나쁨'],
        },
        sortOrder: {
          type: 'number',
          description: '정렬 순서',
          example: 1,
        },
        isRequired: {
          type: 'boolean',
          description: '필수 여부',
          example: true,
        },
      },
      required: ['categoryCode', 'categoryName', 'questionText', 'questionType'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '질문 추가 성공',
  })
  async addQuestionToSurvey(
    @Param('id', ParseIntPipe) surveyId: number,
    @Body() createQuestionDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`설문에 질문 추가 요청 - 설문 ID: ${surveyId}, 질문: ${createQuestionDto.questionText}`);

    try {
      const question = await this.surveyService.addQuestionToSurvey(surveyId, createQuestionDto);
      
      this.logger.log(`설문에 질문 추가 성공 - 질문 ID: ${question.id}`);
      
      return {
        success: true,
        message: '질문이 설문에 성공적으로 추가되었습니다.',
        data: question,
        timestamp: new Date(),
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
  @ApiOperation({
    summary: '설문 질문 생성',
    description: '새로운 설문 질문을 생성합니다.',
  })
  @ApiBody({
    type: CreateSurveyQuestionDto,
    description: '설문 질문 생성에 필요한 정보',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '설문 질문이 성공적으로 생성되었습니다.',
    type: SurveyQuestionResponseDto,
  })
  async createQuestion(
    @Body() createSurveyQuestionDto: CreateSurveyQuestionDto,
  ): Promise<ApiResponseDto<SurveyQuestionResponseDto>> {
    this.logger.log(`설문 질문 생성 요청 - 질문: ${createSurveyQuestionDto.questionText}`);

    try {
      const question = await this.surveyService.createQuestion(createSurveyQuestionDto);
      
      this.logger.log(`설문 질문 생성 응답 성공 - ID: ${question.id}`);
      
      return {
        success: true,
        message: '설문 질문이 성공적으로 생성되었습니다.',
        data: question,
        timestamp: new Date(),
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
  @ApiOperation({
    summary: '설문 선택지 생성',
    description: '특정 설문 질문에 대한 새로운 선택지를 생성합니다.',
  })
  @ApiBody({
    type: CreateSurveyOptionDto,
    description: '설문 선택지 생성에 필요한 정보',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '설문 선택지가 성공적으로 생성되었습니다.',
    type: SurveyOptionResponseDto,
  })
  async createOption(
    @Body() createSurveyOptionDto: CreateSurveyOptionDto,
  ): Promise<ApiResponseDto<SurveyOptionResponseDto>> {
    this.logger.log(`설문 선택지 생성 요청 - 질문 ID: ${createSurveyOptionDto.surveyQuestionId}`);

    try {
      const option = await this.surveyService.createOption(createSurveyOptionDto);
      
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
        timestamp: new Date(),
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
  @ApiOperation({
    summary: '질문별 설문 답변 조회',
    description: '특정 질문에 대한 모든 사용자의 답변을 조회합니다. 타입을 지정하면 사전/사후 설문을 구분해서 조회할 수 있습니다.',
  })
  @ApiParam({
    name: 'questionId',
    type: 'number',
    description: '조회할 질문의 ID',
    example: 1,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['before', 'after'],
    description: '설문 타입 (before: 사전설문, after: 사후설문)',
    example: 'before',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '질문에 대한 모든 답변이 성공적으로 조회되었습니다.',
    type: [SurveyAnswerResponseDto],
  })
  async findAnswersByQuestion(
    @Param('questionId', ParseIntPipe) questionId: number,
    @Query('type') type?: 'before' | 'after',
  ): Promise<ApiResponseDto<SurveyAnswerResponseDto[]>> {
    this.logger.log(`질문별 설문 답변 조회 요청 - 질문 ID: ${questionId}, 타입: ${type || '전체'}`);

    try {
      const answers = await this.surveyService.findAnswersByQuestion(questionId, type);
      
      this.logger.log(`질문별 설문 답변 조회 응답 성공 - 질문 ID: ${questionId}, 답변 수: ${answers.length}`);
      
      return {
        success: true,
        message: '질문에 대한 모든 답변이 성공적으로 조회되었습니다.',
        data: answers,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`질문별 설문 답변 조회 응답 실패 - 질문 ID: ${questionId}`, error);
      throw error;
    }
  }
}