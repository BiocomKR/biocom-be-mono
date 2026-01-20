import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { BatchLogsService } from './batch-logs.service';

@ApiTags('배치-로그')
@Controller('batch-logs')
export class BatchLogsController {
  constructor(private readonly batchLogsService: BatchLogsService) {}

  @Get('jobs')
  @ApiOperation({ summary: '배치 작업 목록 조회' })
  @ApiResponse({ status: 200, description: '배치 작업 목록' })
  getJobs() {
    return this.batchLogsService.getBatchJobs();
  }

  @Get('logs')
  @ApiOperation({ summary: '배치 로그 조회' })
  @ApiQuery({ name: 'jobName', required: false, description: '작업명 (all: 전체)' })
  @ApiQuery({ name: 'limit', required: false, description: '조회 개수 (기본 100)' })
  @ApiQuery({ name: 'startTime', required: false, description: '시작 시간 (ISO)' })
  @ApiQuery({ name: 'endTime', required: false, description: '종료 시간 (ISO)' })
  @ApiQuery({ name: 'severity', required: false, description: '로그 레벨 (ALL, INFO, WARNING, ERROR)' })
  @ApiResponse({ status: 200, description: '배치 로그 목록' })
  async getLogs(
    @Query('jobName') jobName: string = 'all',
    @Query('limit') limit: string = '100',
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('severity') severity?: string,
  ) {
    return this.batchLogsService.getJobLogs(jobName, {
      limit: parseInt(limit, 10),
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      severity,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: '배치 실행 통계 조회 (최근 24시간)' })
  @ApiQuery({ name: 'jobName', required: true, description: '작업명' })
  @ApiResponse({ status: 200, description: '배치 실행 통계' })
  async getStats(@Query('jobName') jobName: string) {
    return this.batchLogsService.getJobStats(jobName);
  }
}
