import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpStatus,
  Logger,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SurveyService } from './survey.service';
import { PrismaService } from '../common/services/prisma.service';
import { CompleteSurveyDto } from './dto/complete-survey.dto';
import {
  SurveyQuestionResponseDto,
  SurveyOptionResponseDto,
  SurveyAnswerResponseDto,
} from './dto/survey-response.dto';
import { SurveyResultResponseDto, SurveyComparisonResponseDto } from './dto/survey-result-response.dto';
import { SurveyStatusResponseDto } from './dto/survey-status-response.dto';
import { ApiResponseDto } from '../common/dto/api-response.dto';

/**
 * 설문 관리 컨트롤러
 * 설문 질문, 선택지, 답변과 관련된 모든 HTTP 요청을 처리
 * 
 * 주요 엔드포인트:
 * - GET /survey/questions: 모든 설문 질문 조회
 * - GET /survey/questions/:id: 특정 설문 질문 조회
 * - GET /survey/options: 설문 선택지 조회
 * - POST /survey/answers: 설문 답변 생성
 * - GET /survey/answers/user/:userId: 사용자별 답변 조회
 * - GET /survey/answers/question/:questionId: 질문별 답변 조회
 * - POST /survey/complete: 설문 완료 및 결과 계산
 * - GET /survey/results/me: 내 설문 결과 조회  
 * - GET /survey/results/compare: 전후 비교 결과 조회
 */
@ApiTags('챌린지-survey')
@Controller('survey')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class SurveyController {
  private readonly logger = new Logger(SurveyController.name);

  constructor(
    private readonly surveyService: SurveyService,
    private readonly prisma: PrismaService,
  ) {}

  // ==================== 설문 상태 확인 엔드포인트 ====================

  /**
   * 사용자 설문 상태 확인
   * 서비스 진입시 호출하여 어떤 화면을 보여줄지 결정
   * 
   * @param req Express Request 객체 (미들웨어에서 userId 추가됨)
   * @returns 사용자의 설문 상태 정보
   */
  @Get('status')
  @ApiOperation({
    summary: '사용자 설문 상태 확인',
    description: '사용자의 설문 완료 여부와 다음 필요한 액션을 확인합니다. 서비스 진입시 이 API를 호출하여 적절한 화면으로 라우팅하세요.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '사용자 설문 상태가 성공적으로 조회되었습니다.',
    type: SurveyStatusResponseDto,
  })
  async getSurveyStatus(
    @Req() req: Request,
      ): Promise<ApiResponseDto<SurveyStatusResponseDto>> {
    this.logger.log(`사용자 설문 상태 확인 요청 - 사용자: ${req.user.sub}`);

    try {
      const status = await this.surveyService.getSurveyStatus(req.user.sub);
      
      this.logger.log(`사용자 설문 상태 확인 완료 - 사용자: ${req.user.sub}, 다음 액션: ${status.nextAction}`);
      
      return {
        success: true,
        message: '사용자 설문 상태가 성공적으로 조회되었습니다.',
        data: status,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`사용자 설문 상태 확인 실패 - 사용자: ${req.user.sub}`, error);
      throw error;
    }
  }

  // ==================== 설문 질문 관련 엔드포인트 ====================


  /**
   * 설문 질문 조회 (카테고리 필터링 가능)
   * 
   * @param categoryCode 카테고리 코드 (선택사항)
   * @param email 사용자 이메일 (필수)
   * @returns 설문 질문 목록 (선택지 포함)
   */
  @Get('questions')
  @ApiOperation({
    summary: '설문 질문 조회',
    description: '설문 질문과 선택지를 조회합니다. categoryCode로 특정 카테고리만 필터링 가능합니다.',
  })
  @ApiQuery({
    name: 'categoryCode',
    type: 'string',
    description: '카테고리 코드 (선택사항) - SKIN_HEALTH, METABOLISM, IMMUNE_BALANCE, GUT_HEALTH',
    example: 'SKIN_HEALTH',
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '설문 질문 목록이 성공적으로 조회되었습니다.',
    type: [SurveyQuestionResponseDto],
  })
  async findQuestions(
    @Req() req: Request,
    @Query('categoryCode') categoryCode?: string,
  ): Promise<ApiResponseDto<SurveyQuestionResponseDto[]>> {
    this.logger.log(`설문 질문 조회 요청 - 사용자: ${req.user.sub}, 카테고리: ${categoryCode || '전체'}`);

    try {
      const questions = await this.surveyService.findQuestions(categoryCode);
      
      this.logger.log(`설문 질문 조회 응답 성공 - 총 ${questions.length}개`);
      
      return {
        success: true,
        message: categoryCode 
          ? `${categoryCode} 카테고리 설문 질문이 성공적으로 조회되었습니다.`
          : '모든 설문 질문이 성공적으로 조회되었습니다.',
        data: questions,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`설문 질문 조회 응답 실패 - 사용자: ${req.user.sub}, 카테고리: ${categoryCode}`, error);
      throw error;
    }
  }

  /**
   * 특정 설문 질문 조회
   * 
   * @param id 설문 질문 ID
   * @returns 설문 질문 정보 (선택지 포함)
   */
  @Get('questions/:id')
  @ApiOperation({
    summary: '특정 설문 질문 조회',
    description: '설문 질문 ID를 기준으로 특정 질문과 선택지를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '조회할 설문 질문의 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '설문 질문 정보가 성공적으로 조회되었습니다.',
    type: SurveyQuestionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '해당 ID의 설문 질문을 찾을 수 없습니다.',
  })
  async findOneQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ): Promise<ApiResponseDto<SurveyQuestionResponseDto>> {
    this.logger.log(`특정 설문 질문 조회 요청 - 사용자: ${req.user.sub}, ID: ${id}`);

    try {
      const question = await this.surveyService.findOneQuestion(id);
      
      this.logger.log(`특정 설문 질문 조회 응답 성공 - ID: ${question.id}`);
      
      return {
        success: true,
        message: '설문 질문 정보가 성공적으로 조회되었습니다.',
        data: question,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`특정 설문 질문 조회 응답 실패 - 사용자: ${req.user.sub}, ID: ${id}`, error);
      throw error;
    }
  }

  // ==================== 설문 선택지 관련 엔드포인트 ====================

  /**
   * 설문 선택지 전체 조회
   * 
   * @returns 설문 선택지 목록 (5개 공통 선택지)
   */
  @Get('options')
  @ApiOperation({
    summary: '설문 선택지 조회',
    description: `모든 설문에서 사용하는 공통 선택지 5개를 조회합니다.
    
    선택지 ID와 점수:
    - ID 1: 그렇지 않다 (0점)
    - ID 2: 약간 그렇지 않다 (-3점)
    - ID 3: 보통이다 (-7점)
    - ID 4: 약간 그렇다 (-10점)
    - ID 5: 그렇다 (-14점)
    
    점수가 낮을수록 해당 증상이 심한 것을 의미합니다.`,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '설문 선택지 목록이 성공적으로 조회되었습니다.',
    type: [SurveyOptionResponseDto],
  })
  async getOptions(
    @Req() req: Request,
  ): Promise<ApiResponseDto<SurveyOptionResponseDto[]>> {
    this.logger.log(`설문 선택지 조회 요청 - 사용자: ${req.user.sub}`);

    try {
      const options = await this.prisma.surveyOption.findMany({
        orderBy: { score: 'desc' },
      });
      
      const formattedOptions = options.map(option => ({
        id: option.id,
        surveyQuestionId: 0, // 호환성을 위해 기본값 제공
        optionText: option.optionText,
        score: option.score,
        createdAt: option.createdAt,
        updatedAt: option.createdAt,
      }));
      
      this.logger.log(`설문 선택지 조회 응답 성공 - 총 ${options.length}개`);
      
      return {
        success: true,
        message: '설문 선택지 목록이 성공적으로 조회되었습니다.',
        data: formattedOptions,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`설문 선택지 조회 응답 실패 - 사용자: ${req.user.sub}`, error);
      throw error;
    }
  }


  // ==================== 설문 답변 관련 엔드포인트 ====================

  // 개별 답변 저장 API는 비활성화 (complete API로 통합)
  // @Post('answers') - deprecated


  /**
   * 특정 사용자의 설문 답변 조회 (이메일 기반)
   * 
   * @param req Express Request 객체 (미들웨어에서 userId 추가됨)
   * @param email 사용자 이메일 (미들웨어에서 처리)
   * @param type 설문 타입 (선택적: 'before' 또는 'after')
   * @returns 사용자의 설문 답변 목록
   */
  @Get('answers/me')
  @ApiOperation({
    summary: '내 설문 답변 조회',
    description: '현재 사용자의 설문 답변을 조회합니다. 이메일 기반으로 사용자를 식별하며, 타입을 지정하면 사전/사후 설문을 구분해서 조회할 수 있습니다.',
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
    description: '사용자의 설문 답변이 성공적으로 조회되었습니다.',
    type: [SurveyAnswerResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '사용자 이메일이 필요합니다.',
  })
  async findMyAnswers(
    @Req() req: Request,
    @Query('type') type?: 'before' | 'after',
  ): Promise<ApiResponseDto<SurveyAnswerResponseDto[]>> {
    this.logger.log(`내 설문 답변 조회 요청 - 사용자: ${req.user.sub}, 타입: ${type || '전체'}`);

    try {
      const answers = await this.surveyService.findAnswersByUser(req.user.sub, type);
      
      this.logger.log(`내 설문 답변 조회 응답 성공 - 사용자: ${req.user.sub}, 답변 수: ${answers.length}`);
      
      return {
        success: true,
        message: '사용자의 설문 답변이 성공적으로 조회되었습니다.',
        data: answers,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`내 설문 답변 조회 응답 실패 - 사용자: ${req.user.sub}`, error);
      throw error;
    }
  }

  /**
   * 특정 질문에 대한 모든 답변 조회
   * 
   * @param questionId 질문 ID
   * @param type 설문 타입 (선택적: 'before' 또는 'after')
   * @returns 질문에 대한 모든 답변 목록
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
    @Req() req: Request,
    @Query('type') type?: 'before' | 'after',
  ): Promise<ApiResponseDto<SurveyAnswerResponseDto[]>> {
    this.logger.log(`질문별 설문 답변 조회 요청 - 사용자: ${req.user.sub}, 질문 ID: ${questionId}, 타입: ${type || '전체'}`);

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
      this.logger.error(`질문별 설문 답변 조회 응답 실패 - 사용자: ${req.user.sub}, 질문 ID: ${questionId}`, error);
      throw error;
    }
  }

  // ==================== 설문 결과 관련 엔드포인트 ====================

  /**
   * 설문 완료 및 결과 계산
   * 모든 질문에 답변 완료 후 호출하여 결과를 계산하고 저장
   * 
   * @param req Express Request 객체 (미들웨어에서 userId 추가됨)
   * @param type 설문 타입 ('before' 또는 'after')
   * @returns 계산된 설문 결과
   */
  @Post('complete')
  @ApiOperation({
    summary: '설문 완료 및 결과 계산',
    description: '모든 설문 답변 완료 후 결과를 계산하고 저장합니다. 카테고리별 점수와 전체 평균을 반환합니다.',
  })
  @ApiBody({
    type: CompleteSurveyDto,
    description: '설문 완료 데이터',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '설문 결과가 성공적으로 계산되고 저장되었습니다.',
    type: SurveyResultResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '사용자의 설문 답변을 찾을 수 없습니다.',
  })
  async completeAndCalculate(
    @Req() req: Request,
    @Body() completeSurveyDto: CompleteSurveyDto,
  ): Promise<ApiResponseDto<SurveyResultResponseDto>> {
    this.logger.log(`설문 완료 및 결과 계산 요청 - 사용자: ${req.user.sub}, 타입: ${completeSurveyDto.type}, 답변 수: ${completeSurveyDto.answers.length}`);

    try {
      const result = await this.surveyService.completeWithAnswers(req.user.sub, completeSurveyDto.type, completeSurveyDto.answers);
      
      this.logger.log(`설문 결과 계산 완료 - 사용자: ${req.user.sub}, 총점: ${result.totalScore}`);
      
      return {
        success: true,
        message: '설문이 완료되었고 결과가 계산되었습니다.',
        data: result,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`설문 결과 계산 실패 - 사용자: ${req.user.sub}`, error);
      throw error;
    }
  }

  /**
   * 내 설문 결과 조회
   * 
   * @param req Express Request 객체 (미들웨어에서 userId 추가됨)
   * @param email 사용자 이메일 (미들웨어에서 처리)
   * @param type 설문 타입 (선택적: 'before' 또는 'after')
   * @returns 사용자의 설문 결과 목록
   */
  @Get('results/me')
  @ApiOperation({
    summary: '내 설문 결과 조회',
    description: '현재 사용자의 설문 결과를 조회합니다. 타입을 지정하면 특정 시점의 결과만 조회할 수 있습니다.',
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
    description: '사용자의 설문 결과가 성공적으로 조회되었습니다.',
    type: [SurveyResultResponseDto],
  })
  async findMyResults(
    @Req() req: Request,
    @Query('type') type?: 'before' | 'after',
  ): Promise<ApiResponseDto<SurveyResultResponseDto[]>> {
    this.logger.log(`내 설문 결과 조회 요청 - 사용자: ${req.user.sub}, 타입: ${type || '전체'}`);

    try {
      const results = await this.surveyService.findResults(req.user.sub, type);
      
      this.logger.log(`내 설문 결과 조회 성공 - 사용자: ${req.user.sub}, 결과 수: ${results.length}`);
      
      return {
        success: true,
        message: '설문 결과가 성공적으로 조회되었습니다.',
        data: results,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`내 설문 결과 조회 실패 - 사용자: ${req.user.sub}`, error);
      throw error;
    }
  }

  /**
   * 내 설문 전후 비교 결과 조회
   * 
   * @param req Express Request 객체 (미들웨어에서 userId 추가됨)
   * @param email 사용자 이메일 (미들웨어에서 처리)
   * @returns 사용자의 before/after 비교 결과
   */
  @Get('results/compare')
  @ApiOperation({
    summary: '설문 전후 비교 결과 조회',
    description: '사용자의 사전/사후 설문 결과를 비교하여 개선 정도를 확인합니다.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '전후 비교 결과가 성공적으로 조회되었습니다.',
    type: SurveyComparisonResponseDto,
  })
  async compareMyResults(
    @Req() req: Request,
  ): Promise<ApiResponseDto<SurveyComparisonResponseDto>> {
    this.logger.log(`설문 전후 비교 요청 - 사용자: ${req.user.sub}`);

    try {
      const comparison = await this.surveyService.compareResults(req.user.sub);
      
      this.logger.log(`설문 전후 비교 조회 성공 - 사용자: ${req.user.sub}`);
      
      return {
        success: true,
        message: '설문 전후 비교 결과가 성공적으로 조회되었습니다.',
        data: comparison,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`설문 전후 비교 조회 실패 - 사용자: ${req.user.sub}`, error);
      throw error;
    }
  }
}