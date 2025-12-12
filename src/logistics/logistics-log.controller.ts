import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LogisticsLogService } from './logistics-log.service';

@ApiTags('물류 API 로그')
@ApiBearerAuth()
@Controller('logistics/logs')
@UseGuards(JwtAuthGuard)
export class LogisticsLogController {
  constructor(private readonly logisticsLogService: LogisticsLogService) {}

  /**
   * 물류 API 로그 목록 조회
   */
  @Get()
  @ApiOperation({ summary: '물류 API 로그 목록 조회' })
  @ApiQuery({ name: 'status', required: false, description: 'SUCCESS / FAILURE' })
  @ApiQuery({ name: 'orderId', required: false, description: '주문 ID' })
  @ApiQuery({ name: 'startDate', required: false, description: '시작일 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: '종료일 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호' })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 개수' })
  async findAll(
    @Query('status') status?: string,
    @Query('orderId') orderId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.logisticsLogService.findAll({
      status,
      orderId: orderId ? parseInt(orderId) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  /**
   * 실패 로그만 조회
   */
  @Get('failures')
  @ApiOperation({ summary: '실패 로그만 조회' })
  @ApiQuery({ name: 'startDate', required: false, description: '시작일 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: '종료일 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호' })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 개수' })
  async findFailures(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.logisticsLogService.findAll({
      status: 'FAILURE',
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }
}
