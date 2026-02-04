/**
 * 푸시 스케줄 타입
 */
export enum PushScheduleType {
  /** 단발성 (1회 발송) */
  ONCE = 'ONCE',

  /** 반복 (크론식 기반) */
  RECURRING = 'RECURRING',
}
