/**
 * 미션 타입 enum
 */
export enum MissionType {
  DAILY = 'DAILY',          // 일반 매일 수행 미션
  WEEKLY = 'WEEKLY',        // 주간 미션
  ONETIME = 'ONETIME',      // 일회성 미션
  MILESTONE = 'MILESTONE'   // 이행률 달성시 보상 (예: 50% 달성시)
}

/**
 * 미션 카테고리 enum
 */
export enum MissionCategory {
  HEALTH = 'HEALTH',        // 건강 관련
  LIFESTYLE = 'LIFESTYLE',  // 라이프스타일
  WELLNESS = 'WELLNESS',    // 웰니스
  NUTRITION = 'NUTRITION',  // 영양
  EXERCISE = 'EXERCISE',    // 운동
  MENTAL = 'MENTAL',        // 정신건강
  DAILY = 'DAILY'          // 일상
}

/**
 * 업로드 타입 enum
 */
export enum UploadType {
  IMAGE = 'IMAGE',          // 이미지
  VIDEO = 'VIDEO',          // 비디오
  DOCUMENT = 'DOCUMENT',    // 문서
  NONE = 'NONE'            // 업로드 불필요
}