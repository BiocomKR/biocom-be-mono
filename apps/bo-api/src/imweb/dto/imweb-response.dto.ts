/**
 * 아임웹 API 응답 DTO
 */
import { getNowKST } from '../../common/utils/kst-date.util';

export class ImwebSuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: Date;

  constructor(data: T) {
    this.success = true;
    this.data = data;
    this.timestamp = getNowKST();
  }
}

export class ImwebErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;

  constructor(code: string, message: string, details?: any) {
    this.success = false;
    this.error = {
      code,
      message,
      details,
    };
    this.timestamp = getNowKST();
  }
}

export type ImwebResponse<T = any> = ImwebSuccessResponse<T> | ImwebErrorResponse;

// 아임웹 에러 코드
export enum ImwebErrorCode {
  // 인증 관련
  AUTH_FAILED = 'IMWEB_AUTH_FAILED',
  TOKEN_EXPIRED = 'IMWEB_TOKEN_EXPIRED',
  TOKEN_REFRESH_FAILED = 'IMWEB_TOKEN_REFRESH_FAILED',
  INVALID_SITE_CODE = 'IMWEB_INVALID_SITE_CODE',
  
  // API 호출 관련
  API_ERROR = 'IMWEB_API_ERROR',
  NETWORK_ERROR = 'IMWEB_NETWORK_ERROR',
  TIMEOUT_ERROR = 'IMWEB_TIMEOUT_ERROR',
  
  // 시스템 관련
  INTERNAL_ERROR = 'IMWEB_INTERNAL_ERROR',
  CONFIG_NOT_FOUND = 'IMWEB_CONFIG_NOT_FOUND',
}