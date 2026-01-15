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
    @Query('appId') appId?: string,
    @Query('eventCategory') eventCategory?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    return this.appEventsService.getEventStats({
      appId,
      eventCategory,
      startDate,
      endDate,
      excludeTesters: excludeTesters === 'true',
    });
  }

  @Get('stats/platform')
  async getPlatformStats(
    @Query('appId') appId?: string,
    @Query('eventCategory') eventCategory?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    return this.appEventsService.getPlatformStats({
      appId,
      eventCategory,
      startDate,
      endDate,
      excludeTesters: excludeTesters === 'true',
    });
  }

  @Get('stats/category')
  async getCategoryStats(
    @Query('appId') appId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    return this.appEventsService.getCategoryStats({
      appId,
      startDate,
      endDate,
      excludeTesters: excludeTesters === 'true',
    });
  }

  @Get('stats/ecommerce')
  async getEcommerceStats(
    @Query('appId') appId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    return this.appEventsService.getEcommerceStats({
      appId,
      startDate,
      endDate,
      excludeTesters: excludeTesters === 'true',
    });
  }

  @Get('stats/summary')
  async getSummary(
    @Query('appId') appId?: string,
    @Query('eventCategory') eventCategory?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    return this.appEventsService.getSummary({
      appId,
      eventCategory,
      startDate,
      endDate,
      excludeTesters: excludeTesters === 'true',
    });
  }

  @Get('stats/hourly')
  async getHourlyStats(
    @Query('appId') appId?: string,
    @Query('eventCategory') eventCategory?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    return this.appEventsService.getHourlyStats({
      appId,
      eventCategory,
      startDate,
      endDate,
      excludeTesters: excludeTesters === 'true',
    });
  }

  @Get('stats/daily-trend')
  async getDailyTrend(
    @Query('appId') appId?: string,
    @Query('eventCategory') eventCategory?: string,
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    return this.appEventsService.getDailyTrend({
      appId,
      eventCategory,
      excludeTesters: excludeTesters === 'true',
    });
  }
}
