/**
 * 푸시 알림 타입
 */
export enum PushNotificationType {
  /** 수동 발송 (관리자가 직접 특정 유저에게) */
  MANUAL = 'MANUAL',

  /** 전체 발송 (공지사항 등) */
  BROADCAST = 'BROADCAST',

  /** 자동 발송 (시스템 트리거) */
  AUTO = 'AUTO',

  /** 마케팅 */
  MARKETING = 'MARKETING',

  /** 챌린지 관련 */
  CHALLENGE = 'CHALLENGE',

  /** 미션 관련 */
  MISSION = 'MISSION',

  /** 알림 */
  NOTIFICATION = 'NOTIFICATION',

  /** 테스트 */
  TEST = 'TEST',
}
