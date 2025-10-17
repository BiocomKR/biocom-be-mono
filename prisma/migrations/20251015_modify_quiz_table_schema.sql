-- Quiz 테이블 스키마 수정
-- 1. title, category, difficulty 컬럼 제거
-- 2. explanation 컬럼 추가 (정답 해설용)

BEGIN;

-- 1. 불필요한 컬럼 제거
ALTER TABLE quizzes DROP COLUMN IF EXISTS title;
ALTER TABLE quizzes DROP COLUMN IF EXISTS category;
ALTER TABLE quizzes DROP COLUMN IF EXISTS difficulty;

-- 2. explanation 컬럼 추가
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS explanation TEXT;

COMMIT;
