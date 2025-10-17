-- Quiz 테이블에 day 컬럼 추가
-- 일차별 퀴즈 조회를 위해 필요

BEGIN;

-- 1. 기존 퀴즈 데이터 삭제 (day 컬럼 없이 삽입된 데이터)
DELETE FROM quizzes;

-- 2. day 컬럼 추가
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS day INTEGER UNIQUE;

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS quizzes_day_idx ON quizzes(day);

COMMIT;
