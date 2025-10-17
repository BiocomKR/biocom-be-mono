-- DailyMission, Quiz 테이블에 missionId 컬럼 추가
-- Mission 테이블과 연결하여 일차별 데이터를 관리

BEGIN;

-- 1. DailyMission 테이블 수정
-- 기존 데이터 삭제 (missionId 없이 삽입된 데이터)
DELETE FROM daily_missions;

-- 기존 UNIQUE(day) 제약조건 제거
ALTER TABLE daily_missions DROP CONSTRAINT IF EXISTS daily_missions_day_key;
DROP INDEX IF EXISTS daily_missions_day_key;

-- missionId 컬럼 추가 (NOT NULL)
ALTER TABLE daily_missions ADD COLUMN IF NOT EXISTS mission_id INTEGER NOT NULL;

-- 외래키 제약조건 추가
ALTER TABLE daily_missions ADD CONSTRAINT daily_missions_mission_id_fkey
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE;

-- 새로운 UNIQUE 제약조건 추가 (missionId, day)
CREATE UNIQUE INDEX IF NOT EXISTS daily_missions_mission_id_day_key
  ON daily_missions(mission_id, day);

-- missionId 인덱스 추가
CREATE INDEX IF NOT EXISTS daily_missions_mission_id_idx ON daily_missions(mission_id);


-- 2. Quiz 테이블 수정
-- 기존 데이터 삭제 (missionId 없이 삽입된 데이터)
DELETE FROM quizzes;

-- 기존 UNIQUE(day) 제약조건 제거
ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS quizzes_day_key;
DROP INDEX IF EXISTS quizzes_day_key;

-- missionId 컬럼 추가 (NOT NULL)
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS mission_id INTEGER NOT NULL;

-- 외래키 제약조건 추가
ALTER TABLE quizzes ADD CONSTRAINT quizzes_mission_id_fkey
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE;

-- 새로운 UNIQUE 제약조건 추가 (missionId, day)
CREATE UNIQUE INDEX IF NOT EXISTS quizzes_mission_id_day_key
  ON quizzes(mission_id, day);

-- missionId 인덱스 추가
CREATE INDEX IF NOT EXISTS quizzes_mission_id_idx ON quizzes(mission_id);

COMMIT;
