import { Logger } from '@nestjs/common';
import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

/**
 * Base Processor
 * 모든 Processor의 공통 로직을 담당하는 추상 클래스
 */
export abstract class BaseProcessor extends WorkerHost {
  protected readonly logger: Logger;

  constructor() {
    super();
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Job 처리 전 공통 로직
   */
  protected async preProcess(job: Job): Promise<void> {
    this.logger.log(
      `🔄 Job 시작: ${job.id} | 시도: ${job.attemptsMade + 1}/${job.opts.attempts}`,
    );
    this.logger.debug(`Job 데이터: ${JSON.stringify(job.data)}`);
  }

  /**
   * Job 처리 후 공통 로직
   */
  protected async postProcess(job: Job): Promise<void> {
    this.logger.log(`✅ Job 완료: ${job.id}`);
  }

  /**
   * 에러 처리 공통 로직
   */
  protected async handleError(job: Job, error: Error): Promise<void> {
    this.logger.error(`❌ Job 실패: ${job.id}`, error.stack);

    // 최종 시도에서도 실패한 경우
    if (job.attemptsMade >= (job.opts.attempts || 3)) {
      this.logger.error(`🚨 Job 최종 실패: ${job.id} (재시도 ${job.attemptsMade}회 모두 실패)`);
      // TODO: Slack 알람 또는 Dead Letter Queue 처리
    }
  }

  /**
   * Job 데이터 검증
   */
  protected validateJobData<T>(job: Job<T>, requiredFields: (keyof T)[]): void {
    const missingFields = requiredFields.filter((field) => !job.data[field]);

    if (missingFields.length > 0) {
      throw new Error(`필수 필드 누락: ${missingFields.join(', ')}`);
    }
  }
}
