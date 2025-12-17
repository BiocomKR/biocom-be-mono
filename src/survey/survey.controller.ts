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
import { getNowKST } from '../common/utils/kst-date.util';
import { SurveyType } from '../common/enums';
import {
  SurveyQuestionResponseDto,
} from './dto/survey-response.dto';
import { SurveyResultResponseDto } from './dto/survey-result-response.dto';
import { ApiResponseDto } from '../common/dto/api-response.dto';

/**
 * 설문 관리 컨트롤러
 * 설문 질문, 선택지, 답변과 관련된 모든 HTTP 요청을 처리
 *
 * 주요 엔드포인트:
 * - GET /surveys/:challengeSurveyId/questions: 챌린지 설문 질문 조회
 * - POST /surveys/:challengeSurveyId/complete: 챌린지 설문 완료
 * - GET /surveys/:challengeSurveyId/comparison: 챌린지 설문 결과 비교
 * - GET /surveys/results/me: 내 설문 결과 조회
 */
@ApiTags('챌린지-설문')
@Controller('surveys')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SurveyController {
  private readonly logger = new Logger(SurveyController.name);

  constructor(
    private readonly surveyService: SurveyService,
    private readonly prisma: PrismaService,
  ) {}

  // ==================== 설문 질문 관련 엔드포인트 ====================

  /**
   * 챌린지 설문 질문 조회 (권장)
   *
   * @param challengeSurveyId 챌린지_설문 매핑 ID (challenge_surveys.id)
   * @returns 설문 질문 목록 (선택지 포함)
   */
  @Get(':challengeSurveyId/questions')
  @ApiOperation({
    summary: '[권장] 챌린지 설문 질문 조회',
    description: `설문 질문 목록을 조회합니다. 각 질문에는 5개의 선택지(옵션)가 포함되어 있습니다.

**사용 방법:**
1. GET /api/challenges/my-active 호출
2. 응답의 surveys[].id 값 추출
3. 해당 id를 challengeSurveyId로 사용

**응답 데이터:**
- 질문 목록 (category 순서: 염증 → 대사밸런스 → 장건강 → 면역과민반응)
- 각 질문에 options 배열 포함 (id, text, score)`,
  })
  @ApiParam({
    name: 'challengeSurveyId',
    type: 'number',
    description: 'GET /api/challenges/my-active에서 받은 surveys[].id',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '설문 질문 목록이 성공적으로 조회되었습니다.',
    type: [SurveyQuestionResponseDto],
  })
  async getQuestionsByChallengeSurvey(
    @Param('challengeSurveyId', ParseIntPipe) challengeSurveyId: number,
    @Req() req: Request,
  ): Promise<ApiResponseDto<SurveyQuestionResponseDto[]>> {
    this.logger.log(`챌린지 설문 질문 조회 요청 - 사용자: ${req.user.sub}, challengeSurveyId: ${challengeSurveyId}`);

    try {
      // 1. challenge_surveys에서 surveyId 추출
      const challengeSurvey = await this.prisma.challengeSurvey.findUnique({
        where: { id: challengeSurveyId },
        select: { surveyId: true }
      });

      if (!challengeSurvey) {
        throw new Error('챌린지 설문 매핑을 찾을 수 없습니다.');
      }

      // 2. 해당 survey의 질문 목록 조회
      const questions = await this.surveyService.findQuestions(challengeSurvey.surveyId);

      this.logger.log(`챌린지 설문 질문 조회 응답 성공 - 총 ${questions.length}개`);

      return {
        success: true,
        message: '설문 질문이 성공적으로 조회되었습니다.',
        data: questions,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`챌린지 설문 질문 조회 응답 실패 - 사용자: ${req.user.sub}, challengeSurveyId: ${challengeSurveyId}`, error);
      throw error;
    }
  }

  // ==================== 설문 결과 관련 엔드포인트 ====================

  /**
   * 내 설문 결과 조회
   *
   * @param req Express Request 객체 (미들웨어에서 userId 추가됨)
   * @param type 설문 타입 (선택적: 'BEFORE' 또는 'AFTER')
   * @returns 사용자의 설문 결과 목록
   */
  @Get('results/me')
  @ApiOperation({
    summary: '[권장] 내 설문 결과 조회',
    description: `현재 사용자의 설문 결과를 조회합니다.

**사용 시점:**
- 과거 작성한 설문 결과를 다시 확인할 때
- 마이페이지에서 설문 이력을 조회할 때
- 사전/사후 설문 중 특정 시점의 결과만 필요할 때

**사용 방법:**
1. 전체 결과 조회: GET /api/surveys/results/me
2. 사전 설문만: GET /api/surveys/results/me?type=BEFORE
3. 사후 설문만: GET /api/surveys/results/me?type=AFTER

**응답 데이터:**
- 설문 결과 ID
- 설문 타입 (BEFORE/AFTER)
- 카테고리별 점수 (염증, 대사밸런스, 장건강, 면역과민반응)
- 총점
- 추천 동물 캐릭터
- 작성일시

**참고:**
- 설문 비교가 필요하면 GET /api/surveys/:challengeSurveyId/comparison 사용을 권장합니다`,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['BEFORE', 'AFTER'],
    description: '설문 타입 (BEFORE: 사전설문, AFTER: 사후설문) - 미지정 시 전체 조회',
    example: 'BEFORE',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '사용자의 설문 결과가 성공적으로 조회되었습니다.',
    type: [SurveyResultResponseDto],
  })
  async findMyResults(
    @Req() req: Request,
    @Query('type') type?: SurveyType,
  ): Promise<ApiResponseDto<SurveyResultResponseDto[]>> {
    this.logger.log(`내 설문 결과 조회 요청 - 사용자: ${req.user.sub}, 타입: ${type || '전체'}`);

    try {
      const results = await this.surveyService.findResults(req.user.sub, type);

      this.logger.log(`내 설문 결과 조회 성공 - 사용자: ${req.user.sub}, 결과 수: ${results.length}`);

      return {
        success: true,
        message: '설문 결과가 성공적으로 조회되었습니다.',
        data: results,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`내 설문 결과 조회 실패 - 사용자: ${req.user.sub}`, error);
      throw error;
    }
  }

  // ==================== 설문 완료 및 비교 엔드포인트 ====================

  /**
   * 챌린지 설문 완료 (권장)
   */
  @Post(':challengeSurveyId/complete')
  @ApiOperation({
    summary: '[권장] 챌린지 설문 완료',
    description: `설문 답변을 제출하고 분석 결과를 받습니다.

**사용 방법:**
1. GET /api/surveys/:challengeSurveyId/questions로 질문 조회
2. 모든 질문에 답변 (20개)
3. answers 배열 구성: [{ questionId, optionId }, ...]
4. POST 요청

**Request Body:**
\`\`\`json
{
  "type": "BEFORE",
  "answers": [
    { "questionId": 1, "optionId": 3 },
    { "questionId": 2, "optionId": 4 },
    ...
  ]
}
\`\`\`

**주의사항:**
- 같은 type으로 재제출 시 기존 답변이 덮어쓰기 됩니다
- 모든 질문에 답변해야 합니다 (20개)
- (수면추가 총25개)`,
  })
  @ApiParam({
    name: 'challengeSurveyId',
    type: 'number',
    description: 'GET /api/challenges/my-active에서 받은 surveys[].id',
    example: 1,
  })
  @ApiBody({
    type: CompleteSurveyDto,
    description: '설문 타입(BEFORE/AFTER)과 답변 목록',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '설문이 성공적으로 완료되었습니다.',
  })
  async completeSurveyByChallengeSurvey(
    @Param('challengeSurveyId', ParseIntPipe) challengeSurveyId: number,
    @Req() req: Request,
    @Body() completeSurveyDto: CompleteSurveyDto,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`챌린지 설문 완료 요청 - 사용자: ${req.user.sub}, challengeSurveyId: ${challengeSurveyId}, 타입: ${completeSurveyDto.type}`);

    try {
      // 1. challenge_surveys에서 surveyId 추출
      const challengeSurvey = await this.prisma.challengeSurvey.findUnique({
        where: { id: challengeSurveyId },
        select: { surveyId: true }
      });

      if (!challengeSurvey) {
        throw new Error('챌린지 설문 매핑을 찾을 수 없습니다.');
      }

      // 2. 기존 로직 실행
      const result = await this.surveyService.completeSurveyById(
        req.user.sub,
        challengeSurvey.surveyId,
        completeSurveyDto.type,
        completeSurveyDto.answers
      );

      this.logger.log(`챌린지 설문 완료 성공 - 사용자: ${req.user.sub}, 동물: ${result.animalCharacter || '미배정'}`);

      return {
        success: true,
        message: '설문이 성공적으로 완료되었습니다.',
        data: result,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`챌린지 설문 완료 실패 - 사용자: ${req.user.sub}, challengeSurveyId: ${challengeSurveyId}`, error);
      throw error;
    }
  }

  /**
   * 챌린지 설문 Before & After 비교 조회 (권장)
   */
  @Get(':challengeSurveyId/comparison')
  @ApiOperation({
    summary: '[권장] 챌린지 설문 결과 비교',
    description: `사전 설문과 사후 설문의 결과를 비교합니다.

**사용 시점:**
- 사전 설문(BEFORE)과 사후 설문(AFTER)을 모두 완료한 후
- 21일차 완료 후 결과 화면에서 사용

**사용 방법:**
1. GET /api/challenges/my-active 호출
2. 응답의 surveys[].id 값 추출
3. 해당 id를 challengeSurveyId로 사용

**응답 데이터:**
- 카테고리별 사전/사후 점수 비교 (염증, 대사밸런스, 장건강, 면역과민반응)
- 총점 변화
- 추천 동물 캐릭터 (사전/사후)

**주의사항:**
- 사전 또는 사후 설문을 완료하지 않은 경우 해당 데이터는 null로 반환됩니다`,
  })
  @ApiParam({
    name: 'challengeSurveyId',
    type: 'number',
    description: 'GET /api/challenges/my-active에서 받은 surveys[].id',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '설문 결과 비교가 성공적으로 조회되었습니다.',
  })
  async getSurveyComparisonByChallengeSurvey(
    @Param('challengeSurveyId', ParseIntPipe) challengeSurveyId: number,
    @Req() req: Request,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`챌린지 설문 결과 비교 요청 - 사용자: ${req.user.sub}, challengeSurveyId: ${challengeSurveyId}`);

    try {
      // 1. challenge_surveys에서 surveyId 추출
      const challengeSurvey = await this.prisma.challengeSurvey.findUnique({
        where: { id: challengeSurveyId },
        select: { surveyId: true }
      });

      if (!challengeSurvey) {
        throw new Error('챌린지 설문 매핑을 찾을 수 없습니다.');
      }

      // 2. 기존 로직 실행
      const comparison = await this.surveyService.getSurveyComparison(req.user.sub, challengeSurvey.surveyId);

      this.logger.log(`챌린지 설문 결과 비교 조회 성공 - 사용자: ${req.user.sub}`);

      return {
        success: true,
        message: '설문 결과 비교가 성공적으로 조회되었습니다.',
        data: comparison,
        timestamp: getNowKST(),
      };
    } catch (error) {
      this.logger.error(`챌린지 설문 결과 비교 조회 실패 - 사용자: ${req.user.sub}, challengeSurveyId: ${challengeSurveyId}`, error);
      throw error;
    }
  }
}
