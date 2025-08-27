import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

/**
 * 토스페이먼츠 API 서비스
 */
@Injectable()
export class TossPaymentsService {
  private readonly logger = new Logger(TossPaymentsService.name);
  private readonly apiUrl = 'https://api.tosspayments.com/v1';
  private readonly secretKey: string;
  private readonly clientKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.secretKey = this.configService.get<string>('TOSS_PAYMENTS_SECRET_KEY') || '';
    this.clientKey = this.configService.get<string>('TOSS_PAYMENTS_CLIENT_KEY') || '';
    
    if (!this.secretKey || !this.clientKey) {
      this.logger.warn('토스페이먼츠 API 키가 설정되지 않았습니다');
    }
  }

  /**
   * Basic Auth 헤더 생성
   */
  private getAuthHeader(): string {
    const encodedKey = Buffer.from(`${this.secretKey}:`).toString('base64');
    return `Basic ${encodedKey}`;
  }

  /**
   * 결제 승인 요청
   */
  async confirmPayment(paymentKey: string, orderId: string, amount: number): Promise<any> {
    try {
      const response = await lastValueFrom(
        this.httpService.post(
          `${this.apiUrl}/payments/confirm`,
          {
            paymentKey,
            orderId,
            amount
          },
          {
            headers: {
              Authorization: this.getAuthHeader(),
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        )
      );

      this.logger.log(`결제 승인 성공: ${paymentKey}`);
      return response.data;
    } catch (error) {
      this.handleError(error, '결제 승인 실패');
    }
  }

  /**
   * 결제 취소 요청
   */
  async cancelPayment(
    paymentKey: string, 
    cancelReason: string,
    cancelAmount?: number,
    refundAccount?: {
      bank: string;
      accountNumber: string;
      holderName: string;
    }
  ): Promise<any> {
    try {
      const payload: any = { cancelReason };
      
      if (cancelAmount) {
        payload.cancelAmount = cancelAmount;
      }
      
      if (refundAccount) {
        payload.refundReceiveAccount = refundAccount;
      }

      const response = await lastValueFrom(
        this.httpService.post(
          `${this.apiUrl}/payments/${paymentKey}/cancel`,
          payload,
          {
            headers: {
              Authorization: this.getAuthHeader(),
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        )
      );

      this.logger.log(`결제 취소 성공: ${paymentKey}`);
      return response.data;
    } catch (error) {
      this.handleError(error, '결제 취소 실패');
    }
  }

  /**
   * 결제 정보 조회
   */
  async getPayment(paymentKey: string): Promise<any> {
    try {
      const response = await lastValueFrom(
        this.httpService.get(
          `${this.apiUrl}/payments/${paymentKey}`,
          {
            headers: {
              Authorization: this.getAuthHeader()
            },
            timeout: 10000
          }
        )
      );

      return response.data;
    } catch (error) {
      this.handleError(error, '결제 정보 조회 실패');
    }
  }

  /**
   * 주문 ID로 결제 정보 조회
   */
  async getPaymentByOrderId(orderId: string): Promise<any> {
    try {
      const response = await lastValueFrom(
        this.httpService.get(
          `${this.apiUrl}/payments/orders/${orderId}`,
          {
            headers: {
              Authorization: this.getAuthHeader()
            },
            timeout: 10000
          }
        )
      );

      return response.data;
    } catch (error) {
      this.handleError(error, '주문 결제 정보 조회 실패');
    }
  }

  /**
   * 에러 처리
   */
  private handleError(error: any, message: string): never {
    if (error instanceof AxiosError) {
      const errorData = error.response?.data;
      this.logger.error(`${message}: ${errorData?.message || error.message}`, errorData);
      
      throw new BadRequestException({
        message: errorData?.message || message,
        code: errorData?.code,
        detail: errorData
      });
    }
    
    this.logger.error(`${message}:`, error);
    throw new BadRequestException(message);
  }
}