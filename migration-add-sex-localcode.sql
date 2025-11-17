-- 사용자 테이블에 성별, 내외국인 구분 컬럼 추가
-- 2025-11-12: 휴대폰 회원가입 시 필요한 필수 정보 추가

ALTER TABLE users
ADD COLUMN IF NOT EXISTS sex VARCHAR(2),
ADD COLUMN IF NOT EXISTS local_code VARCHAR(2);

COMMENT ON COLUMN users.sex IS '성별 코드 (01: 남자, 02: 여자)';
COMMENT ON COLUMN users.local_code IS '내외국인 구분 (01: 내국인, 02: 외국인)';
