-- Migration: Remove unique constraint on user_balance_game_histories(user_id, play_date)
-- Description: 같은 날 여러 번 밸런스게임을 할 수 있도록 unique 제약조건 제거

-- Step 1: unique 제약조건 제거
ALTER TABLE user_balance_game_histories
DROP CONSTRAINT IF EXISTS user_balance_game_histories_user_id_play_date_key;

-- Step 2: 조회 성능을 위한 일반 인덱스 추가 (unique 아님)
CREATE INDEX IF NOT EXISTS user_balance_game_histories_user_id_play_date_idx
ON user_balance_game_histories(user_id, play_date);

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE 'Successfully removed unique constraint and added index on (user_id, play_date)';
END $$;
