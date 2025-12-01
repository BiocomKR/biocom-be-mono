import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TossSuccessResponse,
  TossErrorResponse,
  TossResponse,
  TossErrorCode,
  TossCancelResponse,
} from './dto/toss-response.dto';

/**
 * 토스페이먼츠 API 서비스
 * - 결제 취소
 * - 결제 조회
 * - 재시도 로직
 */
@Injectable()
export class TossPaymentsService {
  private readonly logger = new Logger(TossPaymentsService.name);
  private readonly TOSS_API_BASE = 'https://api.tosspayments.com/v1';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1초
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('TOSS_PAYMENTS_SECRET_KEY') || '';

    if (!this.secretKey) {
      this.logger.warn('TOSS_PAYMENTS_SECRET_KEY가 설정되지 않았습니다.');
    }
  }

  /**
   * 인증 헤더 생성
   */
  private getAuthHeader(): string {
    return `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`;
  }

  /**
   * 결제 취소
   * @param paymentKey 토스페이먼츠 결제 키
   * @param cancelReason 취소 사유
   * @param cancelAmount 취소 금액 (미입력 시 전액 취소)
   * @throws Error 결제 취소 실패 시
   */
  async cancelPayment(
    paymentKey: string,
    cancelReason: string,
    cancelAmount?: number,
  ): Promise<TossCancelResponse> {
    const url = `${this.TOSS_API_BASE}/payments/${paymentKey}/cancel`;

    const body: Record<string, any> = { cancelReason };
    if (cancelAmount !== undefined) {
      body.cancelAmount = cancelAmount;
    }

    const response = await this.callWithRetry(url, 'POST', body);
    this.logger.log(`토스페이먼츠 결제 취소 성공: ${paymentKey}`);
    return response;
  }

  /**
   * 결제 조회
   * @param paymentKey 토스페이먼츠 결제 키
   */
  async getPayment(paymentKey: string): Promise<TossResponse<any>> {
    const url = `${this.TOSS_API_BASE}/payments/${paymentKey}`;

    try {
      const response = await this.callWithRetry(url, 'GET');
      return new TossSuccessResponse(response);
    } catch (error) {
      if (error instanceof TossErrorResponse) {
        return error;
      }

      this.logger.error(`결제 조회 실패: ${error.message}`, error);
      return new TossErrorResponse(
        TossErrorCode.PAYMENT_NOT_FOUND,
        '결제 정보를 찾을 수 없습니다.',
        error.message,
      );
    }
  }

  /**
   * 주문 ID로 결제 조회
   * @param orderId 주문 ID
   */
  async getPaymentByOrderId(orderId: string): Promise<TossResponse<any>> {
    const url = `${this.TOSS_API_BASE}/payments/orders/${orderId}`;

    try {
      const response = await this.callWithRetry(url, 'GET');
      return new TossSuccessResponse(response);
    } catch (error) {
      if (error instanceof TossErrorResponse) {
        return error;
      }

      this.logger.error(`주문 조회 실패: ${error.message}`, error);
      return new TossErrorResponse(
        TossErrorCode.PAYMENT_NOT_FOUND,
        '결제 정보를 찾을 수 없습니다.',
        error.message,
      );
    }
  }

  /**
   * 재시도 로직을 포함한 API 호출
   */
  private async callWithRetry(
    url: string,
    method: 'GET' | 'POST',
    body?: Record<string, any>,
    attempt = 1,
  ): Promise<any> {
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json();

        // 재시도 가능한 에러인지 확인
        if (this.shouldRetry(response.status, attempt)) {
          this.logger.warn(
            `토스 API 호출 재시도 (${attempt}/${this.MAX_RETRIES}): ${response.status}`
          );

          // 지수 백오프
          const delay = this.RETRY_DELAY * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));

          return this.callWithRetry(url, method, body, attempt + 1);
        }

        throw this.handleApiError(response.status, errorData);
      }

      return await response.json();
    } catch (error) {
      // 네트워크 에러 등
      if (!(error instanceof TossErrorResponse)) {
        if (this.shouldRetry(0, attempt)) {
          this.logger.warn(
            `토스 API 호출 재시도 (네트워크 에러) (${attempt}/${this.MAX_RETRIES}): ${error.message}`
          );

          const delay = this.RETRY_DELAY * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));

          return this.callWithRetry(url, method, body, attempt + 1);
        }

        throw new TossErrorResponse(
          TossErrorCode.NETWORK_ERROR,
          '네트워크 연결에 실패했습니다.',
          error.message,
        );
      }

      throw error;
    }
  }

  /**
   * 재시도 가능한 에러인지 판단
   */
  private shouldRetry(status: number, attempt: number): boolean {
    if (attempt >= this.MAX_RETRIES) {
      return false;
    }

    // 네트워크 에러 (status === 0)
    if (status === 0) {
      return true;
    }

    // 재시도 가능한 HTTP 상태 코드
    const retryableStatusCodes = [429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(status);
  }

  /**
   * API 에러 처리
   */
  private handleApiError(status: number, errorData: any): TossErrorResponse {
    const tossErrorCode = errorData?.code || '';
    const tossMessage = errorData?.message || '알 수 없는 오류';

    switch (status) {
      case 400:
        return new TossErrorResponse(
          TossErrorCode.API_ERROR,
          `잘못된 요청입니다: ${tossMessage}`,
          errorData,
        );
      case 401:
        return new TossErrorResponse(
          TossErrorCode.AUTH_FAILED,
          '인증에 실패했습니다. Secret Key를 확인해주세요.',
          errorData,
        );
      case 403:
        return new TossErrorResponse(
          TossErrorCode.AUTH_FAILED,
          '권한이 없습니다.',
          errorData,
        );
      case 404:
        return new TossErrorResponse(
          TossErrorCode.PAYMENT_NOT_FOUND,
          '결제 정보를 찾을 수 없습니다.',
          errorData,
        );
      case 409:
        // 이미 취소된 결제
        if (tossErrorCode === 'ALREADY_CANCELED_PAYMENT') {
          return new TossErrorResponse(
            TossErrorCode.ALREADY_CANCELED,
            '이미 취소된 결제입니다.',
            errorData,
          );
        }
        return new TossErrorResponse(
          TossErrorCode.API_ERROR,
          `요청 충돌: ${tossMessage}`,
          errorData,
        );
      case 429:
        return new TossErrorResponse(
          TossErrorCode.API_ERROR,
          '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.',
          errorData,
        );
      default:
        return new TossErrorResponse(
          TossErrorCode.API_ERROR,
          `API 요청에 실패했습니다. (${status}): ${tossMessage}`,
          errorData,
        );
    }
  }
}
