-- Migration: Change user_balance_game_histories.play_date from VARCHAR to DATE
-- Description: playDate 컬럼을 String에서 DateTime(Date)으로 변경

-- Step 1: 기존 데이터가 있는지 확인
DO $$
BEGIN
    -- Step 2: play_date 컬럼 타입 변경 (VARCHAR → DATE)
    -- 기존 'YYYY-MM-DD' 형식의 문자열이 자동으로 DATE로 변환됨
    ALTER TABLE user_balance_game_histories
    ALTER COLUMN play_date TYPE DATE USING play_date::DATE;

    RAISE NOTICE 'Successfully changed play_date column type from VARCHAR to DATE';
END $$;
