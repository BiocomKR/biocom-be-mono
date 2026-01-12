import { Controller, Get, UseGuards, Request, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeepReportService } from './deep-report.service';
import { DeepReportResponseDto, DeepReportListResponseDto } from './dto/deep-report.dto';

/**
 * 심층리포트 컨트롤러
 * 주간 심층리포트 조회 API
 */
@ApiTags('Deep Report')
@Controller('deep')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DeepReportController {
  constructor(private readonly deepReportService: DeepReportService) {}

  /**
   * 심층리포트 목록 조회
   * 사용자의 전체 심층리포트 목록을 최신순으로 조회
   */
  @Get('reports')
  @ApiOperation({
    summary: '심층리포트 목록 조회',
    description: '사용자의 전체 심층리포트 목록을 최신순으로 조회합니다. N주차는 챌린지 시작일 기준으로 계산됩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '심층리포트 목록 조회 성공',
    type: DeepReportListResponseDto,
  })
  async getDeepReportList(@Request() req: any): Promise<DeepReportListResponseDto> {
    return this.deepReportService.getDeepReportList(req.user.id);
  }

  /**
   * 지난주 심층리포트 조회
   * 지난주(월~일) 범위의 심층리포트를 조회
   * 데이터가 없으면 data: null 반환
   */
  @Get('reports/last-week')
  @ApiOperation({
    summary: '지난주 심층리포트 조회',
    description: '지난주(월~일) 범위의 심층리포트를 조회합니다. 데이터가 없으면 data: null을 반환합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '지난주 심층리포트 조회 성공',
    type: DeepReportResponseDto,
  })
  async getLastWeekDeepReport(@Request() req: any): Promise<DeepReportResponseDto> {
    return this.deepReportService.getLastWeekDeepReport(req.user.id);
  }

  /**
   * 심층리포트 상세 조회
   * ID로 특정 심층리포트를 조회 (읽음 처리 포함)
   */
  @Get('reports/:id')
  @ApiOperation({
    summary: '심층리포트 상세 조회',
    description: 'ID로 특정 심층리포트를 조회합니다. 조회 시 읽음 처리됩니다.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: '심층리포트 ID (DB PK)',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: '심층리포트 상세 조회 성공',
    type: DeepReportResponseDto,
  })
  async getDeepReportById(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DeepReportResponseDto> {
    return this.deepReportService.getDeepReportById(req.user.id, id);
  }
}
