import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from './base.processor';

@Processor('graph-sync-balance-game')
export class BalanceGameProcessor extends BaseProcessor {
  constructor() {
    super();
  }

  async process(job: Job): Promise<void> {
    await this.preProcess(job);

    try {
      // TODO: 실제 비즈니스 로직 구현
      this.logger.log(`BalanceGame job 처리: ${JSON.stringify(job.data)}`);

      await this.postProcess(job);
    } catch (error) {
      await this.handleError(job, error);
      throw error;
    }
  }
}
