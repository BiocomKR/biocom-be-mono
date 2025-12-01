import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushScheduleService } from './services/push-schedule.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleQueryDto } from './dto/schedule-query.dto';

/**
 * 푸시 스케줄 관리 컨트롤러
 * 백오피스 전용 스케줄 CRUD API
 */
@ApiTags('푸시 스케줄')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@SkipThrottle()
@Controller('push/schedules')
export class PushScheduleController {
  constructor(private readonly pushScheduleService: PushScheduleService) {}

  /**
   * 스케줄 생성
   */
  @Post()
  async createSchedule(@Body() dto: CreateScheduleDto) {
    return await this.pushScheduleService.createSchedule(dto);
  }

  /**
   * 스케줄 목록 조회
   */
  @Get()
  async getSchedules(@Query() query: ScheduleQueryDto) {
    return await this.pushScheduleService.getSchedules(query);
  }

  /**
   * 스케줄 상세 조회
   */
  @Get(':id')
  async getScheduleById(@Param('id', ParseIntPipe) id: number) {
    return await this.pushScheduleService.getScheduleById(id);
  }

  /**
   * 스케줄 수정
   */
  @Put(':id')
  async updateSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScheduleDto,
  ) {
    return await this.pushScheduleService.updateSchedule(id, dto);
  }

  /**
   * 스케줄 삭제
   */
  @Delete(':id')
  async deleteSchedule(@Param('id', ParseIntPipe) id: number) {
    return await this.pushScheduleService.deleteSchedule(id);
  }

  /**
   * 스케줄 활성화/비활성화 토글
   */
  @Patch(':id/toggle')
  async toggleSchedule(@Param('id', ParseIntPipe) id: number) {
    return await this.pushScheduleService.toggleSchedule(id);
  }
}
