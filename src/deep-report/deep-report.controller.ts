import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeepReportService } from './deep-report.service';
import { DeepReportResponseDto } from './dto/deep-report.dto';

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
   * 심층리포트 조회
   * 지난주(월~일) 범위의 심층리포트를 조회
   * 데이터가 없으면 data: null 반환
   */
  @Get('report')
  @ApiOperation({
    summary: '심층리포트 조회',
    description: '지난주(월~일) 범위의 심층리포트를 조회합니다. 데이터가 없으면 data: null을 반환합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '심층리포트 조회 성공',
    type: DeepReportResponseDto,
  })
  async getDeepReport(@Request() req: any): Promise<DeepReportResponseDto> {
    return this.deepReportService.getDeepReport(req.user.id);
  }
}
