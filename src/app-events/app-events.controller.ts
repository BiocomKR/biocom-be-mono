import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AppEventsService } from './app-events.service';
import { CreateAppEventDto } from './dto/create-app-event.dto';

@Controller('app-events')
export class AppEventsController {
  constructor(private readonly appEventsService: AppEventsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateAppEventDto) {
    await this.appEventsService.create(dto);
    return { success: true };
  }
}
