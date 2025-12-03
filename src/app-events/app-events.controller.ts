import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppEventsService } from './app-events.service';
import { CreateAppEventDto } from './dto/create-app-event.dto';

/**
 * 앱 이벤트 컨트롤러
 *
 * 앱에서 발생하는 이벤트를 기록하는 API
 * 인증 없이 호출 가능 (앱 시작 시점 등 로그인 전에도 이벤트 기록 필요)
 */
@ApiTags('앱 이벤트')
@SkipThrottle()
@Controller('app-events')
export class AppEventsController {
  constructor(private readonly appEventsService: AppEventsService) {}

  /**
   * 앱 이벤트 기록
   */
  @Post()
  @ApiOperation({ summary: '앱 이벤트 기록' })
  @ApiResponse({ status: 201, description: '이벤트 기록 성공' })
  async create(@Body() dto: CreateAppEventDto) {
    const event = await this.appEventsService.create(dto);
    return {
      success: true,
      data: { id: event.id },
    };
  }
}
