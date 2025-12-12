import { Controller, Get, Post, Body } from '@nestjs/common';
import { QueueService, PushNotificationType } from './queue.service';

@Controller('queue-test')
export class QueueTestController {
  constructor(private readonly queueService: QueueService) {}

  @Get('ping')
  async testConnection() {
    return this.queueService.testConnection();
  }

  @Post('app-event')
  async addAppEvent(
    @Body()
    data: {
      appId?: string;
      eventName: string;
      eventCategory?: string;
      userId?: number;
      sessionId?: string;
      platform: string;
      itemId?: string;
      itemType?: string;
      amount?: number;
      quantity?: number;
      params?: Record<string, any>;
    },
  ) {
    const job = await this.queueService.addAppEvent(data);
    return { success: true, jobId: job.id };
  }

  @Post('push-to-user')
  async pushToUser(
    @Body()
    data: {
      userId: number;
      title: string;
      body: string;
      data?: Record<string, any>;
      isTest?: boolean;
    },
  ) {
    const job = await this.queueService.addPushToUser(
      data.userId,
      { title: data.title, body: data.body, data: data.data },
      PushNotificationType.ETC,
      data.isTest ?? true,
    );
    return { success: true, jobId: job.id };
  }

  @Post('push-to-users')
  async pushToUsers(
    @Body()
    data: {
      userIds: number[];
      title: string;
      body: string;
      data?: Record<string, any>;
      isTest?: boolean;
    },
  ) {
    const job = await this.queueService.addPushToUsers(
      data.userIds,
      { title: data.title, body: data.body, data: data.data },
      PushNotificationType.ETC,
      data.isTest ?? true,
    );
    return { success: true, jobId: job.id };
  }

  @Post('order-sync')
  async orderSync(
    @Body()
    data: {
      orderId: number;
      status: string;
      carrier?: string;
      trackingNumber?: string;
    },
  ) {
    const job = await this.queueService.addOrderSync(data.orderId, {
      status: data.status,
      carrier: data.carrier,
      trackingNumber: data.trackingNumber,
    });
    return { success: true, jobId: job.id };
  }
}
