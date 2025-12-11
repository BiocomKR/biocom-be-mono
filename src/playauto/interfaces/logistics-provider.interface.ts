/**
 * 물류 Provider DI 토큰
 *
 * NestJS 의존성 주입 시 사용하는 토큰 상수
 * 문자열 하드코딩 방지 및 타입 안전성 확보
 *
 * @example
 * // 모듈에서 Provider 등록
 * { provide: LOGISTICS_PROVIDER_TOKEN, useClass: PlayautoProvider }
 *
 * // 서비스에서 주입
 * @Inject(LOGISTICS_PROVIDER_TOKEN) private readonly logistics: ILogisticsProvider
 */
export const LOGISTICS_PROVIDER_TOKEN = 'LOGISTICS_PROVIDER';

/**
 * 물류 주문 데이터 인터페이스
 *
 * 모든 물류 서비스에서 공통으로 사용하는 주문 구조
 */
export interface LogisticsOrderData {
  /** 주문 ID */
  id: number;

  /** 주문번호 */
  orderNumber: string;

  /** 주문일시 */
  orderedAt: Date;

  /** 수령인 이름 */
  recipientName: string;

  /** 수령인 전화번호 */
  recipientMobile: string;

  /** 우편번호 */
  postalCode: string;

  /** 주소 */
  address: string;

  /** 상세주소 */
  addressDetail?: string | null;

  /** 배송 메시지 */
  deliveryMessage?: string | null;

  /** 배송비 */
  shippingFee: number;

  /** 주문 아이템 목록 */
  OrderItems: LogisticsOrderItem[];
}

/**
 * 물류 주문 아이템 인터페이스
 */
export interface LogisticsOrderItem {
  /** 상품명 */
  productName: string;

  /** 수량 */
  quantity: number;

  /** 상품 가격 */
  productPrice: number;
}

/**
 * 물류 주문 생성 결과 인터페이스
 */
export interface LogisticsCreateOrderResult {
  /** 물류 서비스 고유 ID */
  uniq: string;

  /** 묶음 번호 */
  bundleNo: string;
}

/**
 * 배송 추적 정보 인터페이스
 */
export interface LogisticsTrackingInfo {
  /** 배송 상태 */
  status: string;

  /** 배송업체 */
  carrier?: string;

  /** 송장번호 */
  trackingNumber?: string;

  /** 추적 이력 */
  history?: LogisticsTrackingHistory[];
}

/**
 * 배송 추적 이력 인터페이스
 */
export interface LogisticsTrackingHistory {
  /** 시간 */
  time: Date;

  /** 상태 */
  status: string;

  /** 위치 */
  location?: string;

  /** 상세 설명 */
  description?: string;
}

/**
 * 물류 제공자 공통 인터페이스
 *
 * 플레이오토, 굿스플로, 스윗트래커 등 모든 물류 서비스가 구현해야 하는 인터페이스
 * Provider 패턴을 통해 서비스 교체 시 비즈니스 로직 변경 없이 확장 가능
 *
 * @example
 * ```typescript
 * // 플레이오토 Provider 구현
 * class PlayautoProvider implements ILogisticsProvider {
 *   readonly name = 'PLAYAUTO';
 *
 *   async createOrder(order) {
 *     // 플레이오토 API 호출
 *   }
 * }
 *
 * // 다른 물류 서비스로 교체 시
 * class GoodsflowProvider implements ILogisticsProvider {
 *   readonly name = 'GOODSFLOW';
 *
 *   async createOrder(order) {
 *     // 굿스플로 API 호출
 *   }
 * }
 * ```
 */
export interface ILogisticsProvider {
  /**
   * Provider 이름
   *
   * 'PLAYAUTO' | 'GOODSFLOW' | 'SWEETTRACKER' 등
   */
  readonly name: string;

  /**
   * 물류 주문 생성
   *
   * @param order - 주문 정보
   * @returns 물류 서비스 고유 ID 및 묶음 번호
   */
  createOrder(order: LogisticsOrderData): Promise<LogisticsCreateOrderResult>;

  /**
   * 배송 추적 정보 조회
   *
   * @param uniq - 물류 서비스 고유 ID
   * @returns 배송 추적 정보
   */
  getTrackingInfo(uniq: string): Promise<LogisticsTrackingInfo>;

  /**
   * 주문 취소
   *
   * @param uniq - 물류 서비스 고유 ID
   * @returns 취소 성공 여부
   */
  cancelOrder(uniq: string): Promise<boolean>;
}
