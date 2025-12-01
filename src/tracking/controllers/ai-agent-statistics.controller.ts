import {
  Controller,
  Get,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { StatisticsService } from '../services/statistics.service';
import { AiAgentStatisticsDto } from '../dto/statistics/ai-agent-statistics.dto';
import { AiAgentAuthGuard } from '../guards/ai-agent-auth.guard';

/**
 * AI Agent 통계 컨트롤러
 *
 * 목적: AI Agent 서버 전용 통계 API 제공
 * 인증: x-token 헤더로 암호화된 chartId 전달 (AES-GCM)
 *
 * 주의: JWT 인증 없이 별도 인증 방식 사용
 */
@ApiTags('AI-Agent')
@Controller('tracking/statistics')
export class AiAgentStatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  /**
   * AI Agent용 통합 통계 조회
   * @description AI Agent 서버에서 사용자 분석용 데이터를 조회합니다
   */
  @Get('ai-agent')
  @UseGuards(AiAgentAuthGuard) // JWT 없이 AiAgentAuthGuard만 사용
  @ApiOperation({
    summary: 'AI Agent용 통합 통계 조회',
    description: 'AI Agent 서버에서 사용자 분석에 필요한 모든 데이터를 한 번에 조회합니다. x-token 헤더에 암호화된 chartId 전달 필요',
  })
  @ApiQuery({
    name: 'day',
    required: false,
    type: Number,
    description: '조회 기간 (오늘 기준 N일 전부터 오늘까지, 기본값: 7)',
    example: 7,
  })
  @ApiResponse({
    status: 200,
    description: 'AI Agent 통계 조회 성공',
    type: AiAgentStatisticsDto,
  })
  @ApiResponse({
    status: 401,
    description: 'x-token 헤더 없음 또는 복호화 실패',
  })
  async getAiAgentStatistics(
    @Request() req: any,
    @Query('day') day?: number,
  ) {
    const chartId = req.chartId; // AiAgentAuthGuard에서 설정한 chartId
    const days = day ? Number(day) : 7; // 기본값 7일
    const data = await this.statisticsService.getAiAgentStatistics(chartId, days);
    return {
      success: true,
      data,
      message: 'AI Agent 통계 조회 성공',
    };
  }
}
