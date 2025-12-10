import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExamService } from './exam.service';

/**
 * 검사 결과 컨트롤러
 * - SIB 검사 결과 조회 엔드포인트
 */
@ApiTags('검사')
@Controller('exam')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  /**
   * 식품 레벨 조회 (IgG Levels)
   * - JWT 토큰으로 유저 식별
   * - D0004(구), D0060(신) 중 최신 검사 결과 반환
   */
  @Get('report/food-levels')
  @ApiOperation({
    summary: '식품 레벨 조회',
    description:
      '지연성 알러지 검사 결과(IgG Levels)를 조회합니다. chartId 파라미터가 없으면 최신 결과, 있으면 해당 검사 결과를 반환합니다.',
  })
  @ApiQuery({
    name: 'chartId',
    required: false,
    description: '특정 검사 chartId (없으면 최신 검사 결과 반환)',
    example: 'BA2516182',
  })
  @ApiResponse({
    status: 200,
    description: '식품 레벨 조회 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            orderCode: { type: 'string', example: 'D0060' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userName: { type: 'string', example: '홍길동' },
                  chartId: { type: 'string', example: 'BA2516182' },
                  level1: { type: 'string', example: '메밀, 밀, 보리...' },
                  level2: { type: 'string', example: '글루텐, 돼지고기...' },
                  level3: { type: 'string', example: '고등어, 청어...' },
                  level4: { type: 'string', example: '참치, 산양유...' },
                  level5: { type: 'string', example: '계란흰자...' },
                },
              },
            },
            hasChallenge: {
              type: 'boolean',
              example: true,
              description: '활성 챌린지 유무',
            },
            hasAnimal: {
              type: 'boolean',
              example: true,
              description: '동물 유형 유무 (사전문진 완료 여부)',
            },
            hasStartDate: {
              type: 'boolean',
              example: false,
              description: '챌린지 시작일 지정 여부',
            },
          },
        },
        message: { type: 'string', example: '식품 레벨 조회 성공' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '검사 결과 없음',
  })
  async getFoodLevels(
    @Request() req: any,
    @Query('chartId') chartId?: string,
  ) {
    const data = await this.examService.getFoodLevels(req.user.id, chartId);
    return {
      success: true,
      data,
      message: '식품 레벨 조회 성공',
    };
  }

  /**
   * 검사 결과 목록 조회
   * - 지연성 알러지(D0004, D0060) 검사 목록 반환
   */
  @Get('report/list')
  @ApiOperation({
    summary: '검사 결과 목록 조회',
    description: '지연성 알러지 검사 결과 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '검사 결과 목록 조회 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              chartId: { type: 'string', example: 'BA2516182' },
              examName: { type: 'string', example: '음식물과민증 분석' },
              orderCode: { type: 'string', example: 'D0060' },
              receiptDate: { type: 'string', example: '2025.09.08' },
              status: { type: 'string', example: '완료' },
              resultYN: { type: 'string', example: 'Y' },
            },
          },
        },
        message: { type: 'string', example: '검사 결과 목록 조회 성공' },
      },
    },
  })
  async getExamList(@Request() req: any) {
    const data = await this.examService.getExamList(req.user.id);
    return {
      success: true,
      data,
      message: '검사 결과 목록 조회 성공',
    };
  }
}
