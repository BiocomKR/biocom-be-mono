import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Decimal } from '@prisma/client/runtime/library';
import { BaseProcessor } from './base.processor';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';

export interface AppEventJobData {
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
}

@Processor('app-event')
export class AppEventProcessor extends BaseProcessor {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<AppEventJobData>): Promise<void> {
    await this.preProcess(job);

    try {
      const data = job.data;

      await this.prisma.appEvent.create({
        data: {
          appId: data.appId || 'challenge',
          eventName: data.eventName,
          eventCategory: data.eventCategory,
          userId: data.userId,
          sessionId: data.sessionId,
          platform: data.platform,
          itemId: data.itemId,
          itemType: data.itemType,
          amount: data.amount ? new Decimal(data.amount) : null,
          quantity: data.quantity,
          params: data.params || {},
          createdAt: getNowKST(),
        },
      });

      await this.postProcess(job);
    } catch (error) {
      await this.handleError(job, error);
      throw error;
    }
  }
}
