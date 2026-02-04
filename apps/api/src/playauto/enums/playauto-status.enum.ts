/**
 * 플레이오토 주문 상태 enum
 *
 * @see https://developers.playauto.io/doc
 */
export enum PlayautoOrderStatus {
  // 주문 처리 단계
  결제완료 = '결제완료',
  신규주문 = '신규주문',
  출고대기 = '출고대기',
  출고보류 = '출고보류',
  주문재확인 = '주문재확인',
  주문보류 = '주문보류',

  // 출고/배송 단계
  운송장출력 = '운송장출력',
  출고완료 = '출고완료',
  배송중 = '배송중',
  배송완료 = '배송완료',
  구매결정 = '구매결정',
  판매완료 = '판매완료',

  // 취소
  취소요청 = '취소요청',
  취소완료 = '취소완료',

  // 반품
  반품요청 = '반품요청',
  반품접수 = '반품접수',
  반품회수완료 = '반품회수완료',
  반품교환요청 = '반품교환요청',
  반품완료 = '반품완료',

  // 교환
  교환요청 = '교환요청',
  교환접수 = '교환접수',
  교환회수완료 = '교환회수완료',
  교환완료 = '교환완료',

  // 맞교환
  맞교환요청 = '맞교환요청',
  맞교환완료 = '맞교환완료',
}

/**
 * 동기화 대상 상태 (최종 상태 제외)
 *
 * 최종 상태(취소완료, 반품완료, 교환완료, 맞교환완료, 판매완료)는
 * 더 이상 상태 변경이 없으므로 조회 대상에서 제외
 */
export const SYNC_TARGET_STATUSES: PlayautoOrderStatus[] = [
  // 주문 처리 단계
  PlayautoOrderStatus.결제완료,
  PlayautoOrderStatus.신규주문,
  PlayautoOrderStatus.출고대기,
  PlayautoOrderStatus.출고보류,
  PlayautoOrderStatus.주문재확인,
  PlayautoOrderStatus.주문보류,

  // 출고/배송 단계
  PlayautoOrderStatus.운송장출력,
  PlayautoOrderStatus.출고완료,
  PlayautoOrderStatus.배송중,
  PlayautoOrderStatus.배송완료,
  PlayautoOrderStatus.구매결정,

  // 취소/반품/교환 진행 중
  PlayautoOrderStatus.취소요청,
  PlayautoOrderStatus.반품요청,
  PlayautoOrderStatus.반품접수,
  PlayautoOrderStatus.반품회수완료,
  PlayautoOrderStatus.반품교환요청,
  PlayautoOrderStatus.교환요청,
  PlayautoOrderStatus.교환접수,
  PlayautoOrderStatus.교환회수완료,
  PlayautoOrderStatus.맞교환요청,
];

/**
 * 최종 상태 (동기화 제외 대상)
 */
export const FINAL_STATUSES: PlayautoOrderStatus[] = [
  PlayautoOrderStatus.취소완료,
  PlayautoOrderStatus.반품완료,
  PlayautoOrderStatus.교환완료,
  PlayautoOrderStatus.맞교환완료,
  PlayautoOrderStatus.판매완료,
];

/**
 * 플레이오토 상태 → DB 상태 매핑 타입
 */
export interface PlayautoStatusMapping {
  orderStatus?: string;
  shippingStatus?: string;
}

/**
 * 플레이오토 상태 → 우리 DB 상태 매핑
 */
export const PLAYAUTO_STATUS_MAP: Record<PlayautoOrderStatus, PlayautoStatusMapping> = {
  // 주문 처리 중
  [PlayautoOrderStatus.신규주문]: { orderStatus: 'PAID', shippingStatus: 'PENDING' },
  [PlayautoOrderStatus.결제완료]: { orderStatus: 'PAID', shippingStatus: 'PENDING' },
  [PlayautoOrderStatus.출고대기]: { orderStatus: 'PAID', shippingStatus: 'PENDING' },
  [PlayautoOrderStatus.출고보류]: { orderStatus: 'PAID', shippingStatus: 'PENDING' },
  [PlayautoOrderStatus.주문재확인]: { orderStatus: 'PAID', shippingStatus: 'PENDING' },
  [PlayautoOrderStatus.주문보류]: { orderStatus: 'PAID', shippingStatus: 'PENDING' },

  // 출고/배송 단계
  [PlayautoOrderStatus.운송장출력]: { orderStatus: 'SHIPPING', shippingStatus: 'READY_FOR_SHIPMENT' },
  [PlayautoOrderStatus.출고완료]: { orderStatus: 'SHIPPING', shippingStatus: 'IN_TRANSIT' },
  [PlayautoOrderStatus.배송중]: { orderStatus: 'SHIPPING', shippingStatus: 'IN_TRANSIT' },

  // 배송 완료
  [PlayautoOrderStatus.배송완료]: { orderStatus: 'DELIVERED', shippingStatus: 'DELIVERED' },
  [PlayautoOrderStatus.구매결정]: { orderStatus: 'COMPLETED', shippingStatus: 'DELIVERED' },
  [PlayautoOrderStatus.판매완료]: { orderStatus: 'COMPLETED', shippingStatus: 'DELIVERED' },

  // 취소
  [PlayautoOrderStatus.취소요청]: { orderStatus: 'CANCEL_REQUESTED' },
  [PlayautoOrderStatus.취소완료]: { orderStatus: 'CANCELLED' },

  // 반품
  [PlayautoOrderStatus.반품요청]: { orderStatus: 'RETURN_REQUESTED' },
  [PlayautoOrderStatus.반품접수]: { orderStatus: 'RETURN_REQUESTED' },
  [PlayautoOrderStatus.반품회수완료]: { orderStatus: 'RETURN_REQUESTED' },
  [PlayautoOrderStatus.반품교환요청]: { orderStatus: 'RETURN_REQUESTED' },
  [PlayautoOrderStatus.반품완료]: { orderStatus: 'RETURNED' },

  // 교환
  [PlayautoOrderStatus.교환요청]: { orderStatus: 'EXCHANGE_REQUESTED' },
  [PlayautoOrderStatus.교환접수]: { orderStatus: 'EXCHANGE_REQUESTED' },
  [PlayautoOrderStatus.교환회수완료]: { orderStatus: 'EXCHANGE_REQUESTED' },
  [PlayautoOrderStatus.교환완료]: { orderStatus: 'EXCHANGED' },

  // 맞교환
  [PlayautoOrderStatus.맞교환요청]: { orderStatus: 'EXCHANGE_REQUESTED' },
  [PlayautoOrderStatus.맞교환완료]: { orderStatus: 'EXCHANGED' },
};
