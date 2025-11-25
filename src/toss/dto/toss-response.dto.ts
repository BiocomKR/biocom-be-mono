/**
 * 토스페이먼츠 API 응답 DTO
 */
import { getNowKST } from '../../common/utils/kst-date.util';

export class TossSuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: Date;

  constructor(data: T) {
    this.success = true;
    this.data = data;
    this.timestamp = getNowKST();
  }
}

export class TossErrorResponse {
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

export type TossResponse<T = any> = TossSuccessResponse<T> | TossErrorResponse;

// 토스페이먼츠 에러 코드
export enum TossErrorCode {
  // 인증 관련
  AUTH_FAILED = 'TOSS_AUTH_FAILED',
  INVALID_SECRET_KEY = 'TOSS_INVALID_SECRET_KEY',

  // API 호출 관련
  API_ERROR = 'TOSS_API_ERROR',
  NETWORK_ERROR = 'TOSS_NETWORK_ERROR',
  TIMEOUT_ERROR = 'TOSS_TIMEOUT_ERROR',

  // 결제 관련
  PAYMENT_NOT_FOUND = 'TOSS_PAYMENT_NOT_FOUND',
  CANCEL_FAILED = 'TOSS_CANCEL_FAILED',
  ALREADY_CANCELED = 'TOSS_ALREADY_CANCELED',

  // 시스템 관련
  INTERNAL_ERROR = 'TOSS_INTERNAL_ERROR',
  CONFIG_NOT_FOUND = 'TOSS_CONFIG_NOT_FOUND',
}

// 토스페이먼츠 취소 응답 타입
export interface TossCancelResponse {
  mId: string;
  version: string;
  paymentKey: string;
  orderId: string;
  orderName: string;
  currency: string;
  method: string;
  status: string;
  requestedAt: string;
  approvedAt: string;
  useEscrow: boolean;
  cultureExpense: boolean;
  cancels: TossCancelInfo[] | null;
  card: any;
  virtualAccount: any;
  transfer: any;
  mobilePhone: any;
  giftCertificate: any;
  cashReceipt: any;
  discount: any;
  totalAmount: number;
  balanceAmount: number;
  suppliedAmount: number;
  vat: number;
}

export interface TossCancelInfo {
  cancelAmount: number;
  cancelReason: string;
  taxFreeAmount: number;
  taxExemptionAmount: number;
  refundableAmount: number;
  easyPayDiscountAmount: number;
  canceledAt: string;
  transactionKey: string;
  receiptKey: string | null;
}
