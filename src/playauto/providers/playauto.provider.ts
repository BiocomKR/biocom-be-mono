import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../common/services/prisma.service';
import { firstValueFrom } from 'rxjs';
import { getNowKST } from '../../common/utils/kst-date.util';
import {
  ILogisticsProvider,
  LogisticsOrderData,
  LogisticsCreateOrderResult,
  LogisticsTrackingInfo,
} from '../interfaces/logistics-provider.interface';

/**
 * 플레이오토 물류 Provider
 *
 * ILogisticsProvider 인터페이스를 구현하여 서비스 중립적인 비즈니스 로직 지원
 * - 인증 토큰 자동 관리 (24시간 유효, DB 캐싱)
 * - 주문 생성, 송장 조회 등 물류/배송 API 호출
 */
@Injectable()
export class PlayautoProvider implements ILogisticsProvider {
  readonly name = 'PLAYAUTO';
  private readonly logger = new Logger(PlayautoProvider.name);
  private readonly baseUrl = process.env.PLAYAUTO_BASE_URL;
  private readonly apiKey = process.env.PLAYAUTO_API_KEY;
  private readonly email = process.env.PLAYAUTO_EMAIL;
  private readonly password = process.env.PLAYAUTO_PASSWORD;

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 물류 주문 생성
   *
   * @param order 주문 정보 (OrderItems 포함)
   * @returns { uniq: string, bundleNo: string }
   */
  async createOrder(order: LogisticsOrderData): Promise<LogisticsCreateOrderResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`플레이오토 주문 생성 시작: 주문번호 ${order.orderNumber}`);

      // 상품명 생성 (첫 번째 상품 + 외 N건)
      const firstItem = order.items[0];
      const shopSaleName =
        order.items.length > 1
          ? `${firstItem.productName} 외 ${order.items.length - 1}건`
          : firstItem.productName;

      // 주문 아이템을 opts 배열로 변환
      const opts = order.items.map((item) => ({
        shop_sale_name: item.productName,
        sale_cnt: item.quantity,
        sale_price: item.productPrice,
      }));

      // 플레이오토 API 요청 바디 (OpenAPI 스펙 기준)
      const requestData = {
        shop_cd: process.env.PLAYAUTO_SHOP_CD,
        shop_id: process.env.PLAYAUTO_SHOP_ID,
        shop_ord_no: order.orderNumber,
        ord_date: new Date(order.orderedAt).toISOString().split('T')[0],
        // 주문자 정보
        order_name: order.recipientName,
        order_htel: order.recipientMobile,
        // 수령자 정보
        to_name: order.recipientName,
        to_htel: order.recipientMobile,
        to_zipcd: order.postalCode,
        to_addr1: order.address,
        to_addr2: order.addressDetail || '',
        // 상품 정보
        shop_sale_name: shopSaleName,
        opts,
        // 배송 정보
        ship_method: '택배',
        ship_cost: Number(order.shippingFee) || 0,
        ship_msg: order.deliveryMessage || '',
      };

      // API 호출
      const response = await this.callApi<any>('POST', '/order/add', requestData);

      // 디버그: 응답 구조 확인
      this.logger.log(`플레이오토 응답: ${JSON.stringify(response)}`);

      // 응답이 배열인 경우 첫 번째 요소 사용 (토큰 발급과 동일한 패턴)
      const data = Array.isArray(response) ? response[0] : response;
      this.logger.log(`플레이오토 파싱된 데이터: ${JSON.stringify(data)}`);

      const { uniq, bundle_no } = data || {};

      if (!uniq || !bundle_no) {
        throw new Error('플레이오토 응답에 uniq 또는 bundle_no가 없습니다');
      }

      // 성공 로그 기록
      await this.prisma.logisticsApiLog.create({
        data: {
          orderId: order.id,
          endpoint: '/order/add',
          method: 'POST',
          requestData,
          responseData: response,
          status: 'SUCCESS',
          errorMessage: null,
          retryCount: 0,
          createdAt: getNowKST(),
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `플레이오토 주문 생성 성공: 주문번호 ${order.orderNumber}, uniq=${uniq}, bundle_no=${bundle_no} (${duration}ms)`,
      );

      return { uniq, bundleNo: bundle_no };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error.response?.data?.message || error.message || '알 수 없는 오류';

      // 실패 로그 기록
      await this.prisma.logisticsApiLog.create({
        data: {
          orderId: order.id,
          endpoint: '/order/add',
          method: 'POST',
          requestData: {
            shop_cd: process.env.PLAYAUTO_SHOP_CD,
            shop_id: process.env.PLAYAUTO_SHOP_ID,
            shop_ord_no: '__AUTO__',
            ord_date: new Date(order.orderedAt).toISOString().split('T')[0],
            ord_nm: order.recipientName,
          },
          responseData: error.response?.data || null,
          status: 'FAILURE',
          errorMessage,
          retryCount: 3,
          createdAt: getNowKST(),
        },
      });

      this.logger.error(
        `플레이오토 주문 생성 최종 실패: 주문번호 ${order.orderNumber}, 오류=${errorMessage} (${duration}ms)`,
      );

      throw new Error(
        `플레이오토 주문 생성 실패 (주문번호: ${order.orderNumber}): ${errorMessage}`,
      );
    }
  }

  /**
   * 배송 추적 정보 조회
   *
   * @param uniq - 플레이오토 고유 ID
   * @returns 배송 추적 정보
   */
  async getTrackingInfo(uniq: string): Promise<LogisticsTrackingInfo> {
    try {
      this.logger.log(`배송 추적 조회: uniq=${uniq}`);

      const response = await this.callApi<any>('GET', `/order/tracking/${uniq}`);

      return {
        status: response.status || 'UNKNOWN',
        carrier: response.carrier,
        trackingNumber: response.tracking_no,
        history: response.history?.map((h: any) => ({
          time: new Date(h.time),
          status: h.status,
          location: h.location,
          description: h.description,
        })),
      };
    } catch (error: any) {
      this.logger.error(`배송 추적 조회 실패: uniq=${uniq}`, error.message);
      throw error;
    }
  }

  /**
   * 주문 취소
   *
   * @param uniq - 플레이오토 고유 ID
   * @returns 취소 성공 여부
   */
  async cancelOrder(uniq: string): Promise<boolean> {
    try {
      this.logger.log(`플레이오토 주문 취소: uniq=${uniq}`);

      await this.callApi<any>('DELETE', `/order/${uniq}`);

      this.logger.log(`플레이오토 주문 취소 성공: uniq=${uniq}`);
      return true;
    } catch (error: any) {
      this.logger.error(`플레이오토 주문 취소 실패: uniq=${uniq}`, error.message);
      return false;
    }
  }

  /**
   * 유효한 토큰 가져오기
   * - DB에서 토큰 조회
   * - 없거나 만료 1시간 전이면 재발급
   * - 유효한 토큰 반환
   */
  private async getValidToken(): Promise<string> {
    try {
      const tokenRecord = await this.prisma.logisticsToken.findFirst({
        where: { id: 1 },
      });

      const now = getNowKST();
      const needsRefresh =
        !tokenRecord ||
        tokenRecord.expiresAt <= new Date(now.getTime() + 60 * 60 * 1000);

      if (needsRefresh) {
        this.logger.log('토큰 재발급 필요');
        return await this.issueToken();
      }

      this.logger.log('기존 토큰 사용');
      return tokenRecord.token;
    } catch (error) {
      this.logger.error('토큰 조회 실패:', error);
      return await this.issueToken();
    }
  }

  /**
   * 인증 토큰 발급
   */
  private async issueToken(retryCount = 0): Promise<string> {
    const maxRetries = 3;

    try {
      this.logger.log(`토큰 발급 시도 (${retryCount + 1}/${maxRetries})`);

      const url = `${this.baseUrl}/auth`;
      const headers = {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json; charset=UTF-8',
      };

      const body = {
        email: this.email,
        password: this.password,
      };

      const response = await firstValueFrom(
        this.httpService.post(url, body, { headers, timeout: 10000 }),
      );

      // 응답이 배열인 경우 첫 번째 요소 사용
      const data = Array.isArray(response.data) ? response.data[0] : response.data;
      const { token, sol_no } = data;

      if (!token) {
        throw new Error('토큰이 응답에 없습니다');
      }

      const now = getNowKST();
      const expiresAt = new Date(now.getTime() + 23 * 60 * 60 * 1000);

      await this.prisma.logisticsToken.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          token,
          solNo: sol_no,
          expiresAt,
          createdAt: now,
        },
        update: {
          token,
          solNo: sol_no,
          expiresAt,
          updatedAt: now,
        },
      });

      this.logger.log(`토큰 발급 성공 (sol_no: ${sol_no})`);
      return token;
    } catch (error: any) {
      this.logger.error(
        `토큰 발급 실패 (시도 ${retryCount + 1}/${maxRetries}):`,
        error.response?.data || error.message,
      );

      if (retryCount < maxRetries - 1) {
        await this.delay(1000 * (retryCount + 1));
        return this.issueToken(retryCount + 1);
      }

      throw new Error(
        `플레이오토 토큰 발급 실패 (${maxRetries}회 시도): ${error.message}`,
      );
    }
  }

  /**
   * 플레이오토 API 호출 헬퍼
   */
  private async callApi<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    retryCount = 0,
  ): Promise<T> {
    const maxRetries = 3;

    try {
      const token = await this.getValidToken();

      const url = `${this.baseUrl}${endpoint}`;
      const headers = {
        'x-api-key': this.apiKey,
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
      };

      this.logger.log(`플레이오토 API 호출: ${method} ${endpoint}`);

      let response;
      if (method === 'GET') {
        response = await firstValueFrom(
          this.httpService.get(url, { headers, timeout: 10000 }),
        );
      } else if (method === 'POST') {
        response = await firstValueFrom(
          this.httpService.post(url, data, { headers, timeout: 10000 }),
        );
      } else if (method === 'PUT') {
        response = await firstValueFrom(
          this.httpService.put(url, data, { headers, timeout: 10000 }),
        );
      } else if (method === 'DELETE') {
        response = await firstValueFrom(
          this.httpService.delete(url, { headers, timeout: 10000 }),
        );
      }

      this.logger.log(`플레이오토 API 성공: ${method} ${endpoint}`);
      this.logger.log(`플레이오토 API 응답 상세: status=${response.status}, data=${JSON.stringify(response.data)}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `플레이오토 API 실패 (시도 ${retryCount + 1}/${maxRetries}): ${method} ${endpoint}`,
      );
      this.logger.error(
        `플레이오토 API 에러 상세: status=${error.response?.status}, data=${JSON.stringify(error.response?.data)}, message=${error.message}`,
      );

      if (retryCount < maxRetries - 1) {
        await this.delay(1000 * (retryCount + 1));
        return this.callApi(method, endpoint, data, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * 딜레이 헬퍼
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
