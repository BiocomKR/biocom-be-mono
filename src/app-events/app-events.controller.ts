import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AppEventsService } from './app-events.service';
import { GetAppEventsDto } from './dto/get-app-events.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('app-events')
@UseGuards(JwtAuthGuard)
export class AppEventsController {
  constructor(private readonly appEventsService: AppEventsService) {}

  @Get()
  async findAll(@Query() dto: GetAppEventsDto) {
    return this.appEventsService.findAll(dto);
  }

  @Get('stats')
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.appEventsService.getEventStats(startDate, endDate);
  }

  @Get('stats/platform')
  async getPlatformStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.appEventsService.getPlatformStats(startDate, endDate);
  }

  @Get('stats/summary')
  async getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.appEventsService.getSummary(startDate, endDate);
  }

  @Get('stats/hourly')
  async getHourlyStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.appEventsService.getHourlyStats(startDate, endDate);
  }

  @Get('stats/daily-trend')
  async getDailyTrend() {
    return this.appEventsService.getDailyTrend();
  }
}
