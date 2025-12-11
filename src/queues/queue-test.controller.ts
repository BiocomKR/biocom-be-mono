import { Controller, Get, Post, Body } from '@nestjs/common';
import { QueueService } from './queue.service';

@Controller('queue-test')
export class QueueTestController {
  constructor(private readonly queueService: QueueService) {}

  @Get('ping')
  async testConnection() {
    return this.queueService.testConnection();
  }

  @Post('app-event')
  async addAppEvent(@Body() data: { eventType: string; userId?: string; payload?: Record<string, any> }) {
    const job = await this.queueService.addAppEvent(data);
    return { success: true, jobId: job.id };
  }
}
