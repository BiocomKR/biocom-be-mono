-- DailyMission 테이블 생성
-- mission_schedules 테이블을 daily_missions로 대체

BEGIN;

-- 1. 기존 mission_schedules 테이블이 있다면 백업 후 삭제
DROP TABLE IF EXISTS mission_schedules CASCADE;

-- 2. daily_missions 테이블 생성
CREATE TABLE IF NOT EXISTS daily_missions (
  id SERIAL PRIMARY KEY,
  day INTEGER NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  verify_type VARCHAR(20) NOT NULL,
  image_url VARCHAR(500),
  points INTEGER NOT NULL DEFAULT 100,
  reason TEXT,
  method TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6)
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS daily_missions_day_idx ON daily_missions(day);
CREATE INDEX IF NOT EXISTS daily_missions_is_active_idx ON daily_missions(is_active);

COMMIT;
