import { Injectable, Logger } from '@nestjs/common';
import { SibHealthService } from './sib-health.service';
import { SIB_API_URL } from '../constants/sib.constants';

/**
 * SIB API 헬스체크 결과
 */
export interface SibHealthCheckResult {
  status: 'success' | 'warning' | 'fail';
  message: string;
  retryCount: number;
  lastError?: string;
  responseTime?: number;
  statusCode?: number;
}

/**
 * SIB API 헬스체크 스케줄러 서비스
 *
 * ⚠️ Kubernetes CronJob 전용 - @Cron 데코레이터 사용 금지!
 * 실행 방법: node dist/main.js --run-scheduler sib-health-check
 * 실행 주기: K8s CronJob으로 1분마다 실행
 *
 * 동작:
 * 1. SIB API 서버 헬스체크 수행
 * 2. 실패 시 3회 재시도 (5초 간격)
 * 3. 결과 반환 (main.ts에서 슬랙 알림 처리)
 */
@Injectable()
export class SibHealthSchedulerService {
  private readonly logger = new Logger(SibHealthSchedulerService.name);
  private readonly maxRetries = 3;
  private readonly retryDelay = 5000; // 5초

  constructor(private readonly sibHealthService: SibHealthService) {}

  /**
   * SIB API 헬스체크 실행 (CronJob에서 호출)
   * @returns 헬스체크 결과 (main.ts에서 슬랙 알림 처리)
   */
  async handleHealthCheck(): Promise<SibHealthCheckResult> {
    this.logger.log('🩺 SIB API 헬스체크 시작...');

    let lastResult: Awaited<ReturnType<SibHealthService['check']>> | null =
      null;

    // 3회 재시도
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      this.logger.log(`헬스체크 시도 ${attempt}/${this.maxRetries}`);

      const result = await this.sibHealthService.check();
      lastResult = result;

      if (result.healthy) {
        this.logger.log(
          `✅ SIB API 정상 (시도 ${attempt}/${this.maxRetries}): ` +
            `상태코드=${result.statusCode}, 응답시간=${result.responseTime}ms`,
        );

        // 재시도에서 성공한 경우 warning 반환
        if (attempt > 1) {
          return {
            status: 'warning',
            message: `${attempt}번째 시도에서 복구됨 (이전 ${attempt - 1}회 실패)`,
            retryCount: attempt,
            responseTime: result.responseTime,
            statusCode: result.statusCode,
          };
        }

        // 첫 시도에서 성공
        return {
          status: 'success',
          message: 'SIB API 정상',
          retryCount: 1,
          responseTime: result.responseTime,
          statusCode: result.statusCode,
        };
      }

      this.logger.warn(
        `❌ SIB API 헬스체크 실패 (시도 ${attempt}/${this.maxRetries}): ${result.error}`,
      );

      // 마지막 시도가 아니면 대기 후 재시도
      if (attempt < this.maxRetries) {
        this.logger.log(`${this.retryDelay / 1000}초 후 재시도...`);
        await this.sleep(this.retryDelay);
      }
    }

    // 3회 모두 실패
    this.logger.error(
      `🚨 SIB API 헬스체크 ${this.maxRetries}회 연속 실패!`,
    );

    return {
      status: 'fail',
      message: `SIB API 서버 응답 없음 (${this.maxRetries}회 재시도 실패)\nURL: ${SIB_API_URL}\n에러: ${lastResult?.error || '알 수 없는 오류'}`,
      retryCount: this.maxRetries,
      lastError: lastResult?.error,
      responseTime: lastResult?.responseTime,
      statusCode: lastResult?.statusCode,
    };
  }

  /**
   * 비동기 대기
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
