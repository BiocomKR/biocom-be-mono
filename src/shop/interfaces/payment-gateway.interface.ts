/**
 * PG사 Provider DI 토큰
 *
 * NestJS 의존성 주입 시 사용하는 토큰 상수
 * 문자열 하드코딩 방지 및 타입 안전성 확보
 *
 * @example
 * // 모듈에서 Provider 등록
 * { provide: PAYMENT_GATEWAY_TOKEN, useClass: TossPaymentsProvider }
 *
 * // 서비스에서 주입
 * @Inject(PAYMENT_GATEWAY_TOKEN) private readonly paymentGateway: IPaymentGateway
 */
export const PAYMENT_GATEWAY_TOKEN = 'PAYMENT_GATEWAY';

/**
 * 결제 승인 결과 인터페이스
 */
export interface PaymentConfirmResult {
  /** PG사 결제 키 */
  paymentKey: string;

  /** 주문 ID */
  orderId: string;

  /** 결제 금액 */
  amount: number;

  /** 결제 수단 (카드, 가상계좌 등) */
  method: string;

  /** 승인 일시 (ISO 8601) */
  approvedAt: string;

  /** PG사 원본 응답 */
  rawResponse: any;
}

/**
 * 결제 취소 결과 인터페이스
 */
export interface PaymentCancelResult {
  /** PG사 결제 키 */
  paymentKey: string;

  /** 취소 금액 */
  cancelAmount: number;

  /** 취소 사유 */
  cancelReason: string;

  /** 취소 일시 (ISO 8601) */
  canceledAt: string;

  /** 취소 거래 키 */
  transactionKey: string;

  /** PG사 원본 응답 */
  rawResponse: any;
}

/**
 * 결제 조회 결과 인터페이스
 */
export interface PaymentInfo {
  /** PG사 결제 키 */
  paymentKey: string;

  /** 주문 ID */
  orderId: string;

  /** 결제 금액 */
  amount: number;

  /** 결제 상태 */
  status: string;

  /** 결제 수단 */
  method: string;

  /** PG사 원본 응답 */
  rawResponse: any;
}

/**
 * 환불 계좌 정보 인터페이스
 */
export interface RefundAccountInfo {
  /** 은행 코드 */
  bank: string;

  /** 계좌번호 */
  accountNumber: string;

  /** 예금주명 */
  holderName: string;
}

/**
 * PG사 공통 인터페이스
 *
 * 토스페이먼츠, 이니시스, KG이니시스 등 모든 PG사가 구현해야 하는 인터페이스
 * Provider 패턴을 통해 PG사 교체 시 비즈니스 로직 변경 없이 확장 가능
 *
 * @example
 * ```typescript
 * // 토스 Provider 구현
 * class TossPaymentsProvider implements IPaymentGateway {
 *   readonly name = 'TOSS';
 *
 *   async confirmPayment(paymentKey, orderId, amount) {
 *     // 토스 API 호출
 *   }
 * }
 *
 * // 다른 PG사로 교체 시
 * class InicisProvider implements IPaymentGateway {
 *   readonly name = 'INICIS';
 *
 *   async confirmPayment(paymentKey, orderId, amount) {
 *     // 이니시스 API 호출
 *   }
 * }
 * ```
 */
export interface IPaymentGateway {
  /**
   * Provider 이름
   *
   * 'TOSS' | 'INICIS' | 'KAKAOPAY' 등
   */
  readonly name: string;

  /**
   * 결제 승인
   *
   * @param paymentKey - PG사 결제 키
   * @param orderId - 주문 ID (주문번호)
   * @param amount - 결제 금액
   * @returns 결제 승인 결과
   */
  confirmPayment(
    paymentKey: string,
    orderId: string,
    amount: number,
  ): Promise<PaymentConfirmResult>;

  /**
   * 결제 취소
   *
   * @param paymentKey - PG사 결제 키
   * @param cancelReason - 취소 사유
   * @param cancelAmount - 부분 취소 금액 (선택)
   * @param refundAccount - 환불 계좌 정보 (선택, 가상계좌 환불 시)
   * @returns 결제 취소 결과
   */
  cancelPayment(
    paymentKey: string,
    cancelReason: string,
    cancelAmount?: number,
    refundAccount?: RefundAccountInfo,
  ): Promise<PaymentCancelResult>;

  /**
   * 결제 조회
   *
   * @param paymentKey - PG사 결제 키
   * @returns 결제 정보
   */
  getPayment(paymentKey: string): Promise<PaymentInfo>;

  /**
   * 빌링키 발급 (정기결제용)
   *
   * @param authKey - 인증 키 (PG사 결제창에서 발급)
   * @param customerKey - 고객 식별 키
   * @returns 빌링키
   */
  issueBillingKey(authKey: string, customerKey: string): Promise<string>;

  /**
   * 빌링키 자동결제 (정기결제)
   *
   * @param billingKey - 빌링키
   * @param customerKey - 고객 식별 키
   * @param amount - 결제 금액
   * @param orderName - 주문명
   * @returns 결제 결과
   */
  chargeWithBillingKey(
    billingKey: string,
    customerKey: string,
    amount: number,
    orderName: string,
  ): Promise<PaymentConfirmResult>;
}
