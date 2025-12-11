import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../common/services/prisma.service';
import { firstValueFrom } from 'rxjs';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * 플레이오토 API 연동 서비스
 * - 인증 토큰 자동 관리 (24시간 유효, DB 캐싱)
 * - 주문 생성, 송장 조회 등 물류/배송 API 호출
 */
@Injectable()
export class PlayautoService {
  private readonly logger = new Logger(PlayautoService.name);
  private readonly baseUrl = process.env.PLAYAUTO_BASE_URL;
  private readonly apiKey = process.env.PLAYAUTO_API_KEY;
  private readonly email = process.env.PLAYAUTO_EMAIL;
  private readonly password = process.env.PLAYAUTO_PASSWORD;

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 유효한 토큰 가져오기
   * - DB에서 토큰 조회
   * - 없거나 만료 1시간 전이면 재발급
   * - 유효한 토큰 반환
   */
  async getValidToken(): Promise<string> {
    try {
      // 1. DB에서 토큰 조회
      const tokenRecord = await this.prisma.logisticsToken.findFirst({
        where: { id: 1 },
      });

      // 2. 토큰 없거나 만료 1시간 전이면 재발급
      const now = getNowKST();
      const needsRefresh =
        !tokenRecord ||
        tokenRecord.expiresAt <= new Date(now.getTime() + 60 * 60 * 1000); // 1시간 버퍼

      if (needsRefresh) {
        this.logger.log('토큰 재발급 필요');
        return await this.issueToken();
      }

      // 3. 유효한 토큰 반환
      this.logger.log('기존 토큰 사용');
      return tokenRecord.token;
    } catch (error) {
      this.logger.error('토큰 조회 실패:', error);
      // 에러 발생 시 재발급 시도
      return await this.issueToken();
    }
  }

  /**
   * 인증 토큰 발급
   * - 플레이오토 API에 인증 요청
   * - 발급받은 토큰을 DB에 저장 (UPSERT)
   * - 실패 시 3회 재시도
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

      const { token, sol_no } = response.data;

      if (!token) {
        throw new Error('토큰이 응답에 없습니다');
      }

      // 만료시각: 현재시각 + 23시간 (1시간 버퍼)
      const now = getNowKST();
      const expiresAt = new Date(now.getTime() + 23 * 60 * 60 * 1000);

      // DB에 저장 (UPSERT)
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

      // 재시도
      if (retryCount < maxRetries - 1) {
        await this.delay(1000 * (retryCount + 1)); // 지수 백오프
        return this.issueToken(retryCount + 1);
      }

      // 최종 실패
      throw new Error(
        `플레이오토 토큰 발급 실패 (${maxRetries}회 시도): ${error.message}`,
      );
    }
  }

  /**
   * 플레이오토 API 호출 헬퍼
   * - 자동으로 유효한 토큰 헤더에 추가
   * - 3회 재시도 로직 포함
   */
  async callApi<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    retryCount = 0,
  ): Promise<T> {
    const maxRetries = 3;

    try {
      // 유효한 토큰 가져오기
      const token = await this.getValidToken();

      const url = `${this.baseUrl}${endpoint}`;
      const headers = {
        'x-api-key': this.apiKey,
        'Authorization': `Token ${token}`,
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
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `플레이오토 API 실패 (시도 ${retryCount + 1}/${maxRetries}): ${method} ${endpoint}`,
        error.response?.data || error.message,
      );

      // 재시도
      if (retryCount < maxRetries - 1) {
        await this.delay(1000 * (retryCount + 1));
        return this.callApi(method, endpoint, data, retryCount + 1);
      }

      // 최종 실패
      throw error;
    }
  }

  /**
   * 플레이오토 주문 생성
   * - 결제 승인 후 호출
   * - 주문 정보를 플레이오토에 전달
   * - 성공 시 uniq, bundle_no 반환
   *
   * @param order 주문 정보 (OrderItems 포함)
   * @returns { uniq: string, bundleNo: string }
   */
  async createOrder(order: any): Promise<{ uniq: string; bundleNo: string }> {
    const startTime = Date.now();

    try {
      this.logger.log(`플레이오토 주문 생성 시작: 주문번호 ${order.orderNumber}`);

      // 주문 아이템을 opts 배열로 변환
      const opts = order.OrderItems.map((item: any) => ({
        opt_nm: item.productName,
        opt_qty: item.quantity,
        opt_price: item.productPrice,
      }));

      // 배송비 0이면 "무료배송", 아니면 "선결제"
      const shipMethod = order.shippingFee === 0 ? '무료배송' : '선결제';

      // 플레이오토 API 요청 바디
      const requestData = {
        shop_cd: process.env.PLAYAUTO_SHOP_CD, // "UVP2"
        shop_id: process.env.PLAYAUTO_SHOP_ID, // "biocom@biocom.kr"
        shop_ord_no: '__AUTO__', // 플레이오토가 주문번호 생성
        ord_date: new Date(order.orderedAt).toISOString().split('T')[0], // YYYY-MM-DD
        ord_nm: order.recipientName,
        ord_tel: order.recipientMobile,
        ord_mobile: order.recipientMobile,
        ord_post: order.postalCode,
        ord_addr: order.address,
        ord_addr_dtl: order.addressDetail || '',
        memo: order.deliveryMessage || '',
        opts,
        ship_method: shipMethod,
        ship_price: order.shippingFee,
      };

      // API 호출
      const response = await this.callApi<any>(
        'POST',
        '/order/add',
        requestData,
      );

      const { uniq, bundle_no } = response;

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
          retryCount: 3, // callApi에서 3회 재시도 후 실패
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
   * 딜레이 헬퍼
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
