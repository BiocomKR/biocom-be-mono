import {
  Controller,
  Get,
  UseGuards,
  Request,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { StatisticsService } from '../services/statistics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RecordAccessGuard } from '../guards/record-access.guard'; // 동일한 권한 사용
import {
  BeautyStatisticsResponseDto,
  DietStatisticsResponseDto,
  SupplementStatisticsResponseDto,
  FastingStatisticsResponseDto,
  SleepStatisticsResponseDto,
  ActivityStatisticsResponseDto,
  StatisticsSummaryResponseDto,
} from '../dto/statistics/statistics.dto';

/**
 * 통계 컨트롤러
 * 사용자의 6가지 기록 유형별 1주일 통계 제공
 * 
 * 권한: 구독사용자 또는 챌린지활성자만 접근 가능 (Records와 동일)
 * 기간: 1주일 고정 (기획 변경 시 확장 가능)
 */
@ApiTags('헬스케어-기록')
@Controller('tracking/statistics')
@UseGuards(JwtAuthGuard, RecordAccessGuard)
@ApiBearerAuth()
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  /**
   * 통계 목록 (요약) 조회
   * @description 6가지 기록 유형의 1주일 요약 통계를 조회합니다
   */
  @Get('summary')
  @ApiOperation({
    summary: '통계 목록 (요약) 조회',
    description: '6가지 기록 유형(이너뷰티, 식단, 영양제, 간헐적단식, 수면, 활동)의 1주일 요약 통계를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '통계 목록 조회 성공',
    type: StatisticsSummaryResponseDto,
  })
  async getStatisticsSummary(@Request() req: any) {
    const data = await this.statisticsService.getStatisticsSummary(req.user.id);
    return {
      success: true,
      data,
      message: '통계 목록 조회 성공',
    };
  }

  /**
   * 이너뷰티 상세 통계 조회
   * @description 이너뷰티 + 아우터뷰티 1주일 상세 통계를 조회합니다
   */
  @Get('beauty')
  @ApiOperation({
    summary: '이너뷰티 상세 통계 조회',
    description: '이너뷰티와 아우터뷰티의 1주일 상세 통계(평균점수, 일별추이, 세부분석)를 조회합니다.',
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: '시작일 (YYYY-MM-DD)',
    example: '2025-10-27',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: '종료일 (YYYY-MM-DD)',
    example: '2025-11-02',
  })
  @ApiResponse({
    status: 200,
    description: '이너뷰티 통계 조회 성공',
    type: BeautyStatisticsResponseDto,
  })
  async getBeautyStatistics(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const data = await this.statisticsService.getBeautyStatistics(req.user.id, startDate, endDate);
    return {
      success: true,
      data,
      message: '이너뷰티 통계 조회 성공',
    };
  }

  /**
   * 식단 상세 통계 조회
   * @description 식품 분류별(과민식품, 고포드맵, 가공식품) 1주일 상세 통계를 조회합니다
   */
  @Get('diet')
  @ApiOperation({
    summary: '식단 상세 통계 조회',
    description: '음식물과민식품, 고포드맵식품, 가공식품 섭취 현황과 식단점수 1주일 통계를 조회합니다.',
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: '시작일 (YYYY-MM-DD)',
    example: '2025-10-27',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: '종료일 (YYYY-MM-DD)',
    example: '2025-11-02',
  })
  @ApiResponse({
    status: 200,
    description: '식단 통계 조회 성공',
    type: DietStatisticsResponseDto,
  })
  async getDietStatistics(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const data = await this.statisticsService.getDietStatistics(req.user.id, startDate, endDate);
    return {
      success: true,
      data,
      message: '식단 통계 조회 성공',
    };
  }

  /**
   * 영양제 상세 통계 조회
   * @description 영양제 섭취 준수율과 일별 섭취 패턴 1주일 통계를 조회합니다
   */
  @Get('supplement')
  @ApiOperation({
    summary: '영양제 상세 통계 조회',
    description: '영양제 섭취 준수율과 일별 섭취 패턴의 1주일 통계를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '영양제 통계 조회 성공',
    type: SupplementStatisticsResponseDto,
  })
  async getSupplementStatistics(@Request() req: any) {
    const data = await this.statisticsService.getSupplementStatistics(req.user.id);
    return {
      success: true,
      data,
      message: '영양제 통계 조회 성공',
    };
  }

  /**
   * 간헐적단식 상세 통계 조회
   * @description 간헐적단식 시간과 16시간 목표 달성률 1주일 통계를 조회합니다
   */
  @Get('fasting')
  @ApiOperation({
    summary: '간헐적단식 상세 통계 조회',
    description: '간헐적단식 평균시간, 일별 단식시간, 16시간 목표 달성률의 1주일 통계를 조회합니다.',
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: '시작일 (YYYY-MM-DD)',
    example: '2025-10-27',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: '종료일 (YYYY-MM-DD)',
    example: '2025-11-02',
  })
  @ApiResponse({
    status: 200,
    description: '간헐적단식 통계 조회 성공',
    type: FastingStatisticsResponseDto,
  })
  async getFastingStatistics(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const data = await this.statisticsService.getFastingStatistics(req.user.id, startDate, endDate);
    return {
      success: true,
      data,
      message: '간헐적단식 통계 조회 성공',
    };
  }

  /**
   * 수면 상세 통계 조회
   * @description 수면 시간과 8시간 목표 달성률 1주일 통계를 조회합니다
   */
  @Get('sleep')
  @ApiOperation({
    summary: '수면 상세 통계 조회',
    description: '수면 평균시간, 일별 수면시간, 8시간 목표 달성률의 1주일 통계를 조회합니다.',
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: '시작일 (YYYY-MM-DD)',
    example: '2025-10-27',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: '종료일 (YYYY-MM-DD)',
    example: '2025-11-02',
  })
  @ApiResponse({
    status: 200,
    description: '수면 통계 조회 성공',
    type: SleepStatisticsResponseDto,
  })
  async getSleepStatistics(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const data = await this.statisticsService.getSleepStatistics(req.user.id, startDate, endDate);
    return {
      success: true,
      data,
      message: '수면 통계 조회 성공',
    };
  }

  /**
   * 활동 상세 통계 조회
   * @description 활동별 칼로리 소모량과 전일 대비 증감률 1주일 통계를 조회합니다
   */
  @Get('activity')
  @ApiOperation({
    summary: '활동 상세 통계 조회',
    description: '활동별 칼로리 소모량, 운동별 분석, 전일 대비 증감률의 1주일 통계를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '활동 통계 조회 성공',
    type: ActivityStatisticsResponseDto,
  })
  async getActivityStatistics(@Request() req: any) {
    const data = await this.statisticsService.getActivityStatistics(req.user.id);
    return {
      success: true,
      data,
      message: '활동 통계 조회 성공',
    };
  }

  // ========================================
  // 🔮 향후 확장 가능한 엔드포인트들 (주석 처리)
  // ========================================

  /**
   * 특정 기간 통계 조회 (향후 확장용)
   * @description 1일/1주일/1개월 등 다양한 기간의 통계를 조회합니다
   */
  // @Get(':type/:period')
  // @ApiParam({
  //   name: 'type',
  //   enum: ['beauty', 'diet', 'supplement', 'fasting', 'sleep', 'activity'],
  //   description: '통계 유형'
  // })
  // @ApiParam({
  //   name: 'period',
  //   enum: ['1day', '1week', '1month'],
  //   description: '통계 기간'
  // })
  // @ApiOperation({
  //   summary: '특정 기간 통계 조회',
  //   description: '지정된 유형과 기간의 통계를 조회합니다 (향후 기획 변경 시 활성화)',
  // })
  // async getStatisticsByPeriod(
  //   @Request() req: any,
  //   @Param('type') type: string,
  //   @Param('period') period: string,
  // ) {
  //   // TODO: 기획 변경 시 구현
  //   throw new Error('향후 구현 예정');
  // }
}