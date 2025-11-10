-- 2025-11-10: users 테이블의 subscription_status 컬럼명을 status로 변경
-- 목적: 컬럼명 가독성 개선 (일반사용자/구독자/챌린저 구분 용도)

ALTER TABLE users RENAME COLUMN subscription_status TO status;
