import { PointRelatedType } from '../enums/point-related-type.enum';

/**
 * 포인트 내역 description 생성 유틸
 * relatedType과 recordType을 기반으로 고정된 표시 텍스트 반환
 */

// recordType별 한글 매핑 (RECORD_COMPLETION용)
const RECORD_TYPE_LABELS: Record<string, string> = {
  BEAUTY: '뷰티 점수 평가',
  DIET: '식단 기록',
  SUPPLEMENT: '영양제 기록',
  FASTING: '공복 시간 기록',
  SLEEP: '수면 시간 기록',
  ACTIVITY: '활동 기록',
};

// relatedType별 기본 한글 매핑
const RELATED_TYPE_LABELS: Record<string, string> = {
  [PointRelatedType.WEEKLY_REPORT]: '심층 리포트 확인',
  [PointRelatedType.QUIZ]: '강의 시청 후 퀴즈',
  [PointRelatedType.BALANCE_GAME]: '밸런스 게임 참여',
  [PointRelatedType.REVIEW]: '리뷰 작성',
  [PointRelatedType.IMWEB_TRANSFER]: '포인트 이관',
  [PointRelatedType.MANUAL]: '수동 지급',
};

// MISSION_COMPLETION의 recordType별 매핑
const MISSION_COMPLETION_LABELS: Record<string, string> = {
  AFTER_SURVEY: '사후 문진 완료',
};

/**
 * 포인트 내역 description 생성
 * @param relatedType 포인트 관련 타입
 * @param recordType 기록 타입 (optional)
 * @param type 포인트 타입 (EARNED, SPEND, REFUND 등)
 * @returns 표시할 description 텍스트
 */
export function getPointDescription(
  relatedType: PointRelatedType | string,
  recordType?: string,
  type?: string,
): string {
  // ORDER 타입은 type에 따라 다르게 표시
  if (relatedType === PointRelatedType.ORDER) {
    if (type === 'USE' || type === 'SPEND') {
      return '제품 구매';
    }
    if (type === 'REFUND') {
      return '포인트 환급';
    }
    if (type === 'PURCHASE_REWARD') {
      return '구매 적립';
    }
    if (type === 'PURCHASE_REWARD_CANCEL') {
      return '구매 적립 회수';
    }
    return '주문';
  }

  // RECORD_COMPLETION은 recordType으로 구분
  if (relatedType === PointRelatedType.RECORD_COMPLETION && recordType) {
    return RECORD_TYPE_LABELS[recordType] || `${recordType} 기록`;
  }

  // MISSION_COMPLETION은 recordType으로 구분
  if (relatedType === PointRelatedType.MISSION_COMPLETION && recordType) {
    return MISSION_COMPLETION_LABELS[recordType] || '미션 완료';
  }

  // CHALLENGE_MISSION은 미션명으로 구분해야 하지만, 여기서는 기본값 반환
  // 실제로는 미션명을 알아야 하므로 호출하는 곳에서 처리
  if (relatedType === PointRelatedType.CHALLENGE_MISSION) {
    return '챌린지 미션 완료';
  }

  // 기본 매핑
  return RELATED_TYPE_LABELS[relatedType] || relatedType;
}

/**
 * 포인트 내역 description에서 ID 부분 제거
 * 예: "심층리포트 조회 (report_abc123)" → "심층리포트 조회"
 * @param description 원본 description
 * @returns ID가 제거된 description
 */
export function cleanPointDescription(description: string | null): string {
  if (!description) return '';
  return description.replace(/\s*\([a-zA-Z0-9_-]+\)\s*$/, '').trim();
}
