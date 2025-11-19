import { Injectable } from '@nestjs/common';
import { MemoryHealthIndicator as BaseMemoryHealthIndicator, HealthIndicatorService } from '@nestjs/terminus';
import { LoggerService } from '../../common/services/logger.service';

/**
 * 확장된 메모리 Health Indicator
 * 기본 MemoryHealthIndicator를 확장하여 로깅 기능 추가
 */
@Injectable()
export class MemoryHealthIndicator extends BaseMemoryHealthIndicator {
  constructor(
    healthIndicatorService: HealthIndicatorService,
    private readonly logger: LoggerService,
  ) {
    super(healthIndicatorService);
  }

  /**
   * 힙 메모리 사용량 체크 (로깅 추가)
   */
  async checkHeap(key: string, heapUsedThreshold: number) {
    try {
      const result = await super.checkHeap(key, heapUsedThreshold);
      
      // 메모리 사용량 로깅
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / (1024 * 1024));
      const heapTotalMB = Math.round(memoryUsage.heapTotal / (1024 * 1024));
      const thresholdMB = Math.round(heapUsedThreshold / (1024 * 1024));
      
      if (heapUsedMB > thresholdMB * 0.8) {
        this.logger.warn(
          `Heap memory usage is high: ${heapUsedMB}MB / ${heapTotalMB}MB`,
          'MemoryHealthIndicator',
          {
            heapUsed: `${heapUsedMB}MB`,
            heapTotal: `${heapTotalMB}MB`,
            threshold: `${thresholdMB}MB`,
            percentage: `${((heapUsedMB / thresholdMB) * 100).toFixed(1)}%`
          }
        );
      }
      
      return result;
    } catch (error) {
      this.logger.error(
        'Memory heap health check failed',
        error.stack,
        'MemoryHealthIndicator'
      );
      throw error;
    }
  }

  /**
   * RSS 메모리 사용량 체크 (로깅 추가)
   */
  async checkRSS(key: string, rssThreshold: number) {
    try {
      const result = await super.checkRSS(key, rssThreshold);
      
      // RSS 메모리 사용량 로깅
      const memoryUsage = process.memoryUsage();
      const rssMB = Math.round(memoryUsage.rss / (1024 * 1024));
      const thresholdMB = Math.round(rssThreshold / (1024 * 1024));
      
      if (rssMB > thresholdMB * 0.8) {
        this.logger.warn(
          `RSS memory usage is high: ${rssMB}MB`,
          'MemoryHealthIndicator',
          {
            rss: `${rssMB}MB`,
            threshold: `${thresholdMB}MB`,
            percentage: `${((rssMB / thresholdMB) * 100).toFixed(1)}%`
          }
        );
      }
      
      return result;
    } catch (error) {
      this.logger.error(
        'Memory RSS health check failed',
        error.stack,
        'MemoryHealthIndicator'
      );
      throw error;
    }
  }

  /**
   * 메모리 사용량 상세 정보
   */
  getMemoryStats() {
    const usage = process.memoryUsage();
    
    return {
      rss: `${Math.round(usage.rss / (1024 * 1024))}MB`,
      heapTotal: `${Math.round(usage.heapTotal / (1024 * 1024))}MB`,
      heapUsed: `${Math.round(usage.heapUsed / (1024 * 1024))}MB`,
      external: `${Math.round(usage.external / (1024 * 1024))}MB`,
      arrayBuffers: `${Math.round(usage.arrayBuffers / (1024 * 1024))}MB`,
    };
  }
}