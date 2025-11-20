/**
 * 푸시 알림 타입 (비즈니스 관점 분류)
 *
 * 통계 및 분석을 위한 대분류 타입입니다.
 * 세부 타입은 message.data 내에 별도로 저장하세요.
 *
 * @example
 * // 챌린지 시작 알림
 * type: PushNotificationType.REMIND
 * data: { subType: 'CHALLENGE_START', challengeId: 123 }
 *
 * // 이벤트 마케팅 푸시
 * type: PushNotificationType.MARKETING
 * data: { subType: 'EVENT', eventId: 456 }
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
