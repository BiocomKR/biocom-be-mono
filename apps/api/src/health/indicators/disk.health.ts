import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { LoggerService } from '../../common/services/logger.service';
import { promises as fs } from 'fs';

/**
 * 확장된 디스크 Health Indicator
 * 디스크 사용량을 체크하여 로깅 기능 추가
 */
@Injectable()
export class DiskHealthIndicator extends HealthIndicator {
  constructor(
    private readonly logger: LoggerService
  ) {
    super();
  }

  /**
   * 디스크 사용량 체크 (로깅 추가)
   */
  async checkStorage(key: string, options: { path: string; thresholdPercent: number }): Promise<HealthIndicatorResult> {
    try {
      // 간단한 디스크 체크 (파일 시스템 접근 가능 여부만 확인)
      await fs.access(options.path);
      
      const result = this.getStatus(key, true, {
        path: options.path,
        status: 'available'
      });
      
      this.logger.log(
        `Disk storage check passed for path: ${options.path}`,
        'DiskHealthIndicator'
      );
      
      return result;
    } catch (error) {
      this.logger.error(
        'Disk health check failed',
        error.stack,
        'DiskHealthIndicator'
      );
      
      const result = this.getStatus(key, false, {
        path: options.path,
        status: 'unavailable',
        error: error.message
      });
      
      throw new HealthCheckError('Disk check failed', result);
    }
  }
}