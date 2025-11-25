import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig, AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { ImwebAuthService } from './imweb-auth.service';
import { 
  ImwebSuccessResponse, 
  ImwebErrorResponse, 
  ImwebResponse,
  ImwebErrorCode 
} from './dto/imweb-response.dto';

/**
 * 아임웹 API 호출 서비스
 * - API 호출 시 자동 인증
 * - 재시도 로직
 * - 에러 처리
 */
@Injectable()
export class ImwebApiService {
  private readonly logger = new Logger(ImwebApiService.name);
  private readonly IMWEB_API_BASE = 'https://openapi.imweb.me';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1초

  constructor(
    private readonly httpService: HttpService,
    private readonly imwebAuthService: ImwebAuthService,
  ) {}

  /**
   * 아임웹 API 호출
   * @param siteCode 사이트 코드
   * @param endpoint API 엔드포인트 (예: /v1/members)
   * @param options 요청 옵션
   */
  async call<T = any>(
    siteCode: string,
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      params?: Record<string, any>;
      data?: any;
      headers?: Record<string, string>;
    } = {},
  ): Promise<ImwebResponse<T>> {
    const { method = 'GET', params, data, headers = {} } = options;

    try {
      // 유효한 토큰 가져오기 (필요시 자동 갱신)
      const accessToken = await this.imwebAuthService.getValidAccessToken(siteCode);

      // API 호출 설정
      const config: AxiosRequestConfig = {
        method,
        url: `${this.IMWEB_API_BASE}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...headers,
        },
        params,
        data,
        timeout: 30000, // 30초
      };

      // 재시도 로직과 함께 API 호출
      const response = await this.callWithRetry(config, siteCode);
      
      return new ImwebSuccessResponse<T>(response.data);
    } catch (error) {
      // 이미 ImwebErrorResponse인 경우 그대로 전달
      if (error instanceof ImwebErrorResponse) {
        return error;
      }

      // 예상치 못한 에러
      this.logger.error(`API 호출 실패: ${error.message}`, error);
      return new ImwebErrorResponse(
        ImwebErrorCode.INTERNAL_ERROR,
        '예상치 못한 오류가 발생했습니다.',
        error.message,
      );
    }
  }

  /**
   * 재시도 로직을 포함한 API 호출
   */
  private async callWithRetry(
    config: AxiosRequestConfig,
    siteCode: string,
    attempt = 1,
  ): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.request(config)
      );
      
      this.logger.log(`API 호출 성공: ${config.method} ${config.url}`);
      return response;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      // 재시도 가능한 에러인지 확인
      if (this.shouldRetry(axiosError, attempt)) {
        this.logger.warn(
          `API 호출 재시도 (${attempt}/${this.MAX_RETRIES}): ${axiosError.message}`
        );
        
        // 지수 백오프
        const delay = this.RETRY_DELAY * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // 401 에러인 경우 토큰 갱신 후 재시도
        if (axiosError.response?.status === 401) {
          const newToken = await this.imwebAuthService.getValidAccessToken(siteCode);
          config.headers['Authorization'] = `Bearer ${newToken}`;
        }
        
        return this.callWithRetry(config, siteCode, attempt + 1);
      } 
      
      // 재시도 불가능한 에러
      throw this.handleApiError(axiosError);
    }
  }

  /**
   * 재시도 가능한 에러인지 판단
   */
  private shouldRetry(error: AxiosError, attempt: number): boolean {
    if (attempt >= this.MAX_RETRIES) {
      return false;
    }

    // 네트워크 에러
    if (!error.response) {
      return true;
    }

    // 재시도 가능한 HTTP 상태 코드
    const retryableStatusCodes = [401, 429, 500, 502, 503, 504];
    return retryableStatusCodes.includes(error.response.status);
  }

  /**
   * API 에러 처리
   */
  private handleApiError(error: AxiosError): ImwebErrorResponse {
    // 네트워크 에러
    if (!error.response) {
      return new ImwebErrorResponse(
        ImwebErrorCode.NETWORK_ERROR,
        '네트워크 연결에 실패했습니다.',
        error.message,
      );
    }

    // 타임아웃
    if (error.code === 'ECONNABORTED') {
      return new ImwebErrorResponse(
        ImwebErrorCode.TIMEOUT_ERROR,
        '요청 시간이 초과되었습니다.',
      );
    }

    // HTTP 상태 코드별 처리
    const status = error.response.status;
    const errorData = error.response.data;

    switch (status) {
      case 401:
        return new ImwebErrorResponse(
          ImwebErrorCode.TOKEN_EXPIRED,
          '인증이 만료되었습니다.',
          errorData,
        );
      case 403:
        return new ImwebErrorResponse(
          ImwebErrorCode.AUTH_FAILED,
          '권한이 없습니다.',
          errorData,
        );
      case 404:
        return new ImwebErrorResponse(
          ImwebErrorCode.API_ERROR,
          '요청한 리소스를 찾을 수 없습니다.',
          errorData,
        );
      case 429:
        return new ImwebErrorResponse(
          ImwebErrorCode.API_ERROR,
          '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.',
          errorData,
        );
      default:
        return new ImwebErrorResponse(
          ImwebErrorCode.API_ERROR,
          `API 요청에 실패했습니다. (${status})`,
          errorData,
        );
    }
  }

  /**
   * 편의 메서드들
   */
  async get<T = any>(
    siteCode: string,
    endpoint: string,
    params?: Record<string, any>,
  ): Promise<ImwebResponse<T>> {
    return this.call<T>(siteCode, endpoint, { method: 'GET', params });
  }

  async post<T = any>(
    siteCode: string,
    endpoint: string,
    data?: any,
    params?: Record<string, any>,
  ): Promise<ImwebResponse<T>> {
    return this.call<T>(siteCode, endpoint, { method: 'POST', data, params });
  }

  async put<T = any>(
    siteCode: string,
    endpoint: string,
    data?: any,
    params?: Record<string, any>,
  ): Promise<ImwebResponse<T>> {
    return this.call<T>(siteCode, endpoint, { method: 'PUT', data, params });
  }

  async delete<T = any>(
    siteCode: string,
    endpoint: string,
    params?: Record<string, any>,
  ): Promise<ImwebResponse<T>> {
    return this.call<T>(siteCode, endpoint, { method: 'DELETE', params });
  }

  async patch<T = any>(
    siteCode: string,
    endpoint: string,
    data?: any,
    params?: Record<string, any>,
  ): Promise<ImwebResponse<T>> {
    return this.call<T>(siteCode, endpoint, { method: 'PATCH', data, params });
  }

  /**
   * 아임웹 회원 검색 (전화번호)
   * @param phone 전화번호
   * @returns 회원 목록
   */
  async searchMembersByPhone(phone: string): Promise<any> {
    const siteCode = 'S20190715619285c855898'; // 바이오컴 사이트코드
    
    try {
      // 액세스 토큰 가져오기 (필요시 자동 갱신)
      const accessToken = await this.imwebAuthService.getValidAccessToken(siteCode);
      
      // 토큰에서 unitCode 추출
      const decodedToken = this.decodeToken(accessToken);
      const unitCode = decodedToken.unitCode[0]; // 첫 번째 unitCode 사용
      
      this.logger.log(`회원 검색 시작 - phone: ${phone}, unitCode: ${unitCode}`);
      
      // 1. 회원 목록 조회
      const listResponse = await this.get(siteCode, '/member-info/members', {
        page: 1,
        limit: 10,
        unitCode,
        callnum: phone,
      });
      
      if (!listResponse.success) {
        throw new ImwebErrorResponse(
          ImwebErrorCode.API_ERROR,
          '회원 목록 조회에 실패했습니다.',
          (listResponse as ImwebErrorResponse).error.details,
        );
      }
      
      const members = listResponse.data.data.list || [];
      
      if (members.length === 0) {
        throw new ImwebErrorResponse(
          ImwebErrorCode.API_ERROR,
          '해당 전화번호로 등록된 회원을 찾을 수 없습니다.',
        );
      }
      
      this.logger.log(`회원 ${members.length}명 검색됨`);
      this.logger.log(`회원 목록:`, JSON.stringify(members, null, 2));
      
      // 2. 각 회원의 상세 정보 조회
      const detailPromises = members.map(async (member: any) => {
        this.logger.log(`회원 상세 조회 시작 - memberUid: ${member.uid}`);
        const detailResponse = await this.get(
          siteCode,
          `/member-info/members/${member.uid}`,
          { unitCode }
        );
        
        if (!detailResponse.success) {
          this.logger.error(`회원 상세 조회 실패 - memberUid: ${member.uid}`);
          return null;
        }
        
        return detailResponse.data;
      });
      
      const memberDetails = await Promise.all(detailPromises);
      const validDetails = memberDetails.filter(detail => detail !== null);
      
      this.logger.log(`회원 상세 정보 ${validDetails.length}개 조회 완료`);
      
      return validDetails;
    } catch (error) {
      this.logger.error(`회원 검색 실패: ${error.message}`, error);
      
      if (error instanceof ImwebErrorResponse) {
        throw error;
      }
      
      throw new ImwebErrorResponse(
        ImwebErrorCode.INTERNAL_ERROR,
        '회원 검색 중 오류가 발생했습니다.',
        error.message,
      );
    }
  }

  /**
   * JWT 토큰 디코드
   */
  private decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      return JSON.parse(jsonPayload);
    } catch (error) {
      this.logger.error('토큰 디코드 실패', error);
      throw new Error('Invalid token');
    }
  }
}