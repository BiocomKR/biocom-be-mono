import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from './base.processor';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';

export interface HealthCheckJobData {
  source: string;
  requestedAt: string;
}

@Processor('health-check')
export class HealthCheckProcessor extends BaseProcessor {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<HealthCheckJobData>): Promise<void> {
    await this.preProcess(job);

    try {
      const configKey = 'MQ_HEALTH_CHECK';
      const configValue = 'biocom-mq';
      const now = getNowKST();

      await this.prisma.appConfig.upsert({
        where: { configKey },
        create: {
          configKey,
          configValue,
          description: 'MQ 서비스 헬스체크용',
          createdAt: now,
          updatedAt: now,
        },
        update: {
          configValue,
          updatedAt: now,
        },
      });

      await this.postProcess(job);
    } catch (error) {
      await this.handleError(job, error);
      throw error;
    }
  }
}
