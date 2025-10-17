-- 챌린지 일정 테이블을 user_challenges로 통합
-- challenge_schedules 테이블 삭제 및 user_challenges에 컬럼 추가

-- 1. user_challenges 테이블에 새 컬럼 추가
ALTER TABLE user_challenges
ADD COLUMN start_date DATE,
ADD COLUMN delivery_date DATE,
ADD COLUMN end_date DATE,
ADD COLUMN purchased_at TIMESTAMP NOT NULL DEFAULT NOW();

-- 2. 기존 challenge_schedules 데이터를 user_challenges로 복사 (있다면)
UPDATE user_challenges uc
SET
  start_date = cs.start_date,
  delivery_date = cs.delivery_date,
  end_date = cs.end_date,
  purchased_at = cs.purchased_at
FROM challenge_schedules cs
WHERE uc.id = cs.user_challenge_id;

-- 3. challenge_schedules 테이블 삭제
DROP TABLE IF EXISTS challenge_schedules;

-- 4. 인덱스 추가 (필요시)
CREATE INDEX IF NOT EXISTS idx_user_challenges_start_date ON user_challenges(start_date);
