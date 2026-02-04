import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as https from 'https';
import { SIB_API_URL } from '../constants/sib.constants';

/**
 * SIB API 헬스체크 서비스
 *
 * 외부 SIB API 서버 (https://sib.codns.com:3001)의 상태를 확인합니다.
 *
 * 오류 판단 기준:
 * - 정상: HTTP 2xx, 304, 3xx (연결 성공)
 * - 오류: HTTP 5xx, 연결 실패, 타임아웃
 */
@Injectable()
export class SibHealthService {
  private readonly logger = new Logger(SibHealthService.name);
  private readonly sibApiUrl = SIB_API_URL;

  constructor(private readonly httpService: HttpService) {}

  /**
   * SIB API 서버 헬스체크 수행
   * @returns 헬스체크 결과 (healthy, responseTime, statusCode, error)
   */
  async check(): Promise<{
    healthy: boolean;
    responseTime: number;
    statusCode?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const response = await firstValueFrom(
        this.httpService.get(this.sibApiUrl, {
          timeout: 10000, // 10초 타임아웃
          maxRedirects: 0, // 리다이렉트 따라가지 않음
          validateStatus: (status) => status < 500, // 5xx만 실패로 처리
          httpsAgent: new https.Agent({
            rejectUnauthorized: true,
          }),
        }),
      );

      const responseTime = Date.now() - startTime;
      this.logger.log(
        `SIB API 헬스체크 성공: ${response.status} (${responseTime}ms)`,
      );

      return {
        healthy: true,
        responseTime,
        statusCode: response.status,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      // 3xx 리다이렉트 응답도 서버가 살아있다는 의미
      if (error.response?.status >= 300 && error.response?.status < 400) {
        this.logger.log(
          `SIB API 리다이렉트 응답: ${error.response.status} (${responseTime}ms)`,
        );
        return {
          healthy: true,
          responseTime,
          statusCode: error.response.status,
        };
      }

      // 5xx 서버 에러
      if (error.response?.status >= 500) {
        this.logger.warn(
          `SIB API 서버 에러: ${error.response.status} (${responseTime}ms)`,
        );
        return {
          healthy: false,
          responseTime,
          statusCode: error.response.status,
          error: `HTTP ${error.response.status}: ${error.response.statusText || 'Server Error'}`,
        };
      }

      // 연결 실패, 타임아웃 등
      const errorMessage = this.parseErrorMessage(error);
      this.logger.error(
        `SIB API 헬스체크 실패: ${errorMessage} (${responseTime}ms)`,
      );

      return {
        healthy: false,
        responseTime,
        error: errorMessage,
      };
    }
  }

  /**
   * 에러 메시지 파싱
   */
  private parseErrorMessage(error: any): string {
    if (error.code === 'ECONNREFUSED') {
      return '연결 거부됨 (Connection refused)';
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return '연결 시간 초과 (Timeout)';
    }
    if (error.code === 'ENOTFOUND') {
      return 'DNS 조회 실패 (Host not found)';
    }
    if (error.code === 'CERT_HAS_EXPIRED') {
      return 'SSL 인증서 만료';
    }
    if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      return 'SSL 인증서 검증 실패';
    }
    return error.message || '알 수 없는 오류';
  }
}
