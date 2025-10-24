-- 챌린지 티켓 상태값 통일 마이그레이션
-- 작성일: 2025-10-23
-- 목적: ACTIVE → PURCHASED 상태값 통일

-- ================================================
-- 1. 문제 상황
-- ================================================
-- payment.service.ts에서 챌린지 구매 시 status를 'ACTIVE'로 잘못 설정
-- 올바른 상태: PURCHASED (구매만 함), ACTIVATED (시작일 설정 완료)

-- ================================================
-- 2. 데이터 정리
-- ================================================

-- UserChallenge가 없는 ACTIVE 티켓 → PURCHASED로 변경
-- (구매만 하고 아직 시작하지 않은 티켓)
UPDATE challenge_tickets
SET status = 'PURCHASED', updated_at = NOW()
WHERE status = 'ACTIVE'
AND id NOT IN (
  SELECT DISTINCT ticket_id
  FROM user_challenges
  WHERE ticket_id IS NOT NULL
);

-- ================================================
-- 3. 검증 쿼리 (실행 후 확인용)
-- ================================================
-- SELECT status, COUNT(*) as count
-- FROM challenge_tickets
-- GROUP BY status
-- ORDER BY count DESC;

-- 예상 결과:
-- ACTIVATED: 챌린지를 시작한 티켓들
-- PURCHASED: 구매만 하고 아직 시작하지 않은 티켓들
