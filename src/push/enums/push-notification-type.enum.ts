/**
 * 푸시 알림 타입 (비즈니스 관점 분류)
 */
export enum PushNotificationType {
  /** 시스템 알림 (점검, 업데이트, 서비스 공지) */
  SYSTEM = 'SYSTEM',

  /** 리마인더 (챌린지, 미션, 활동 독려) */
  REMIND = 'REMIND',

  /** 마케팅 (이벤트, 쿠폰, 프로모션) */
  MARKETING = 'MARKETING',

  /** 거래 알림 (주문, 배송, 결제) */
  TRANSACTIONAL = 'TRANSACTIONAL',

  /** 기타 */
  ETC = 'ETC',
}
