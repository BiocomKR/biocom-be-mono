import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  IPaymentGateway,
  PaymentConfirmResult,
  PaymentCancelResult,
  PaymentInfo,
  RefundAccountInfo,
} from '../interfaces/payment-gateway.interface';

/**
 * 토스페이먼츠 PG Provider
 *
 * IPaymentGateway 인터페이스를 구현하여 서비스 중립적인 비즈니스 로직 지원
 * - 결제 취소, 조회 (관리자 API 주요 기능)
 * - 재시도 로직 (3회, 지수 백오프)
 *
 * @see https://docs.tosspayments.com/reference
 */
@Injectable()
export class TossPaymentsProvider implements IPaymentGateway {
  readonly name = 'TOSS';
  private readonly logger = new Logger(TossPaymentsProvider.name);
  private readonly baseUrl = 'https://api.tosspayments.com/v1';
  private readonly secretKey: string;
  private readonly maxRetries = 3;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.secretKey = this.configService.get<string>('TOSS_PAYMENTS_SECRET_KEY') || '';

    if (!this.secretKey) {
      this.logger.warn('TOSS_PAYMENTS_SECRET_KEY가 설정되지 않았습니다.');
    }
  }

  /**
   * 결제 승인 (관리자 API에서는 사용하지 않음)
   */
  async confirmPayment(
    paymentKey: string,
    orderId: string,
    amount: number,
  ): Promise<PaymentConfirmResult> {
    const endpoint = '/payments/confirm';
    const body = { paymentKey, orderId, amount };

    this.logger.log(
      `결제 승인 요청: paymentKey=${paymentKey.slice(0, 8)}***, orderId=${orderId}, amount=${amount}`,
    );

    const response = await this.callApi<any>('POST', endpoint, body);

    this.logger.log(`결제 승인 성공: ${paymentKey.slice(0, 8)}***`);

    return {
      paymentKey: response.paymentKey,
      orderId: response.orderId,
      amount: response.totalAmount,
      method: response.method,
      approvedAt: response.approvedAt,
      rawResponse: response,
    };
  }

  /**
   * 결제 취소
   */
  async cancelPayment(
    paymentKey: string,
    cancelReason: string,
    cancelAmount?: number,
    refundAccount?: RefundAccountInfo,
  ): Promise<PaymentCancelResult> {
    const endpoint = `/payments/${paymentKey}/cancel`;
    const body: any = { cancelReason };

    if (cancelAmount) {
      body.cancelAmount = cancelAmount;
    }

    if (refundAccount) {
      body.refundReceiveAccount = refundAccount;
    }

    this.logger.log(
      `결제 취소 요청: paymentKey=${paymentKey.slice(0, 8)}***, reason=${cancelReason}`,
    );

    const response = await this.callApi<any>('POST', endpoint, body);

    this.logger.log(`결제 취소 성공: ${paymentKey.slice(0, 8)}***`);

    const latestCancel = response.cancels?.[0];

    return {
      paymentKey: response.paymentKey,
      cancelAmount: latestCancel?.cancelAmount || cancelAmount || response.totalAmount,
      cancelReason: latestCancel?.cancelReason || cancelReason,
      canceledAt: latestCancel?.canceledAt || response.canceledAt,
      transactionKey: latestCancel?.transactionKey || '',
      rawResponse: response,
    };
  }

  /**
   * 결제 조회
   */
  async getPayment(paymentKey: string): Promise<PaymentInfo> {
    const endpoint = `/payments/${paymentKey}`;

    this.logger.log(`결제 조회: paymentKey=${paymentKey.slice(0, 8)}***`);

    const response = await this.callApi<any>('GET', endpoint);

    return {
      paymentKey: response.paymentKey,
      orderId: response.orderId,
      amount: response.totalAmount,
      status: response.status,
      method: response.method,
      rawResponse: response,
    };
  }

  /**
   * 빌링키 발급 (관리자 API에서는 사용하지 않음)
   */
  async issueBillingKey(authKey: string, customerKey: string): Promise<string> {
    const endpoint = '/billing/authorizations/issue';
    const body = { authKey, customerKey };

    this.logger.log(
      `빌링키 발급 요청: authKey=${authKey.slice(0, 8)}***, customerKey=${customerKey}`,
    );

    const response = await this.callApi<any>('POST', endpoint, body);

    const billingKey = response.billingKey;
    this.logger.log(`빌링키 발급 성공: billingKey=${billingKey.slice(0, 8)}***`);

    return billingKey;
  }

  /**
   * 빌링키 자동결제 (관리자 API에서는 사용하지 않음)
   */
  async chargeWithBillingKey(
    billingKey: string,
    customerKey: string,
    amount: number,
    orderName: string,
  ): Promise<PaymentConfirmResult> {
    const endpoint = `/billing/${billingKey}`;
    const body = {
      customerKey,
      amount,
      orderId: `AUTO_${Date.now()}`,
      orderName,
    };

    this.logger.log(
      `빌링키 자동결제 요청: billingKey=${billingKey.slice(0, 8)}***, amount=${amount}원`,
    );

    const response = await this.callApi<any>('POST', endpoint, body);

    this.logger.log(
      `빌링키 자동결제 성공: paymentKey=${response.paymentKey?.slice(0, 8)}***`,
    );

    return {
      paymentKey: response.paymentKey,
      orderId: response.orderId,
      amount: response.totalAmount,
      method: response.method,
      approvedAt: response.approvedAt,
      rawResponse: response,
    };
  }

  /**
   * 토스페이먼츠 API 호출 헬퍼 (재시도 로직 포함)
   */
  private async callApi<T = any>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: any,
    retryCount = 0,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      Authorization: `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    };

    try {
      let response;

      if (method === 'GET') {
        response = await firstValueFrom(
          this.httpService.get(url, { headers, timeout: 10000 }),
        );
      } else {
        response = await firstValueFrom(
          this.httpService.post(url, data, { headers, timeout: 10000 }),
        );
      }

      return response.data;
    } catch (error: any) {
      const statusCode = error.response?.status;

      // 재시도 가능한 에러인지 확인 (5xx 서버 에러, 타임아웃)
      const isRetryable =
        statusCode >= 500 || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';

      if (isRetryable && retryCount < this.maxRetries - 1) {
        const delay = 1000 * Math.pow(2, retryCount); // 지수 백오프: 1초, 2초, 4초
        this.logger.warn(
          `토스 API 재시도 (${retryCount + 1}/${this.maxRetries}): ${method} ${endpoint}, ${delay}ms 후 재시도`,
        );

        await this.delay(delay);
        return this.callApi(method, endpoint, data, retryCount + 1);
      }

      // 재시도 불가능하거나 최대 재시도 횟수 초과
      this.handleTossError(error, `${method} ${endpoint}`);
    }
  }

  /**
   * 토스페이먼츠 에러 핸들링
   */
  private handleTossError(error: any, context: string): never {
    const errorData = error.response?.data;
    const statusCode = error.response?.status;

    const tossCode = errorData?.code || 'UNKNOWN_ERROR';
    const tossMessage = errorData?.message || '알 수 없는 결제 오류가 발생했습니다';

    this.logger.error(
      `[${context}] 토스페이먼츠 에러 - status=${statusCode}, code=${tossCode}, message=${tossMessage}`,
    );

    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: tossMessage,
      tossErrorCode: tossCode,
      tossStatusCode: statusCode,
    });
  }

  /**
   * 딜레이 헬퍼
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
