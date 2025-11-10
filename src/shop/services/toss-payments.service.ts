import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * 토스페이먼츠 API 연동 서비스
 * 결제 승인, 취소 등의 기능을 제공
 */
@Injectable()
export class TossPaymentsService {
  private readonly logger = new Logger(TossPaymentsService.name);
  private readonly baseUrl = 'https://api.tosspayments.com/v1';
  private readonly secretKey = process.env.TOSS_PAYMENTS_SECRET_KEY;

  constructor(private readonly httpService: HttpService) {}

  /**
   * 결제 승인
   */
  async confirmPayment(paymentKey: string, orderId: string, amount: number): Promise<any> {
    try {
      const url = `${this.baseUrl}/payments/${paymentKey}`;
      const headers = {
        'Authorization': `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      };

      const body = {
        orderId,
        amount
      };

      const response = await firstValueFrom(
        this.httpService.post(url, body, { headers, timeout: 10000 })
      );

      this.logger.log(`결제 승인 성공: ${paymentKey}`);
      return response.data;
    } catch (error) {
      this.logger.error(`결제 승인 실패: ${paymentKey}`, error.response?.data);
      throw error;
    }
  }

  /**
   * 결제 취소
   */
  async cancelPayment(
    paymentKey: string,
    cancelReason: string,
    cancelAmount?: number,
    refundAccount?: any
  ): Promise<any> {
    try {
      const url = `${this.baseUrl}/payments/${paymentKey}/cancel`;
      const headers = {
        'Authorization': `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      };

      const body: any = {
        cancelReason
      };

      if (cancelAmount) {
        body.cancelAmount = cancelAmount;
      }

      if (refundAccount) {
        body.refundReceiveAccount = refundAccount;
      }

      const response = await firstValueFrom(
        this.httpService.post(url, body, { headers, timeout: 10000 })
      );

      this.logger.log(`결제 취소 성공: ${paymentKey}`);
      return response.data;
    } catch (error) {
      this.logger.error(`결제 취소 실패: ${paymentKey}`, error.response?.data);
      throw error;
    }
  }

  /**
   * 결제 조회
   */
  async getPayment(paymentKey: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/payments/${paymentKey}`;
      const headers = {
        'Authorization': `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      };

      const response = await firstValueFrom(
        this.httpService.get(url, { headers, timeout: 10000 })
      );

      return response.data;
    } catch (error) {
      this.logger.error(`결제 조회 실패: ${paymentKey}`, error.response?.data);
      throw error;
    }
  }

  /**
   * authKey로 빌링키 발급
   *
   * @param authKey - 토스 결제창에서 발급받은 인증키
   * @param customerKey - 고객 식별 키
   * @returns billingKey
   */
  async issueBillingKey(
    authKey: string,
    customerKey: string,
  ): Promise<string> {
    try {
      const url = `${this.baseUrl}/billing/authorizations/issue`;
      const headers = {
        'Authorization': `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      };

      const body = {
        authKey,
        customerKey,
      };

      this.logger.log(`빌링키 발급 요청: authKey=${authKey}, customerKey=${customerKey}`);

      const response = await firstValueFrom(
        this.httpService.post(url, body, { headers, timeout: 10000 })
      );

      const billingKey = response.data.billingKey;
      this.logger.log(`빌링키 발급 성공: billingKey=${billingKey}`);

      return billingKey;
    } catch (error: any) {
      this.logger.error(`빌링키 발급 실패: authKey=${authKey}`, error.response?.data);
      throw error;
    }
  }

  /**
   * 빌링키로 자동결제 (정기결제)
   *
   * @param billingKey - 토스페이먼츠 빌링키
   * @param customerKey - 고객 식별 키
   * @param amount - 결제 금액
   * @param orderName - 주문명
   * @returns 결제 결과
   */
  async chargeWithBillingKey(
    billingKey: string,
    customerKey: string,
    amount: number,
    orderName: string,
  ): Promise<any> {
    try {
      const url = `${this.baseUrl}/billing/${billingKey}`;
      const headers = {
        'Authorization': `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      };

      const body = {
        customerKey,
        amount,
        orderId: `AUTO_${Date.now()}`, // 자동결제 주문 ID
        orderName,
      };

      this.logger.log(`빌링키 자동결제 요청: billingKey=${billingKey}, amount=${amount}원`);

      const response = await firstValueFrom(
        this.httpService.post(url, body, { headers, timeout: 10000 })
      );

      this.logger.log(`빌링키 자동결제 성공: paymentKey=${response.data.paymentKey}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`빌링키 자동결제 실패: ${billingKey}`, error.response?.data);
      throw error;
    }
  }
}