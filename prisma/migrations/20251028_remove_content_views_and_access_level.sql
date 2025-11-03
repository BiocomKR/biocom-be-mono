-- ========================================
-- 컨텐츠 시스템 단순화 마이그레이션
-- 작성일: 2025-10-28
-- ========================================

-- 1. content_views 테이블 삭제
-- 삭제 사유:
--   - 컨텐츠 시청 완료 API 제거로 인해 사용처 없음
--   - 조회수 중복 카운트는 비즈니스 임팩트가 작아 허용하기로 결정
--   - 포인트 지급은 퀴즈 풀이로 이동 (시청 완료와 분리)
DROP TABLE IF EXISTS content_views CASCADE;

-- 2. ContentAccessLevel enum 타입 삭제
-- 삭제 사유:
--   - 컨텐츠 접근 권한을 사용자 구독 상태(subscriptionStatus)로 단순화
--   - 챌린저(CHALLENGER) 또는 구독자(SUBSCRIBER)만 접근 가능
-- 먼저 컬럼 삭제
ALTER TABLE contents DROP COLUMN IF EXISTS access_level;
-- 그 다음 enum 타입 삭제
DROP TYPE IF EXISTS "ContentAccessLevel" CASCADE;

-- 3. contents 테이블 포인트 기본값 변경 (50 → 300)
-- 변경 사유: 퀴즈 풀이 시 300점 지급으로 정책 변경
ALTER TABLE contents ALTER COLUMN points SET DEFAULT 300;

-- 4. access_level 관련 인덱스 삭제
DROP INDEX IF EXISTS contents_access_level_type_is_active_idx;

-- 주석 추가
COMMENT ON COLUMN contents.points IS '강의 연결 퀴즈 풀이 시 지급 포인트 (기본 300점)';
COMMENT ON COLUMN contents.view_count IS '조회수 (중복 조회 허용)';
