-- exercise_types 테이블 구조 변경 및 데이터 업데이트
-- 1. category 컬럼 삭제
-- 2. base_minutes 컬럼 추가 (기준 시간: 10분 고정)
-- 3. 기존 데이터 전체 삭제 후 신규 18개 운동 데이터 INSERT

-- Step 1: 기존 데이터 삭제
DELETE FROM exercise_types;

-- Step 2: category 컬럼 삭제
ALTER TABLE exercise_types DROP COLUMN IF EXISTS category;

-- Step 3: base_minutes 컬럼 추가 (기준 시간: 분 단위)
ALTER TABLE exercise_types ADD COLUMN IF NOT EXISTS base_minutes INT NOT NULL DEFAULT 10;

-- Step 4: 신규 운동 데이터 INSERT (18개)
-- code, name, calorie_rate (10분당 칼로리), base_minutes, sort_order, is_active, created_at

INSERT INTO exercise_types (code, name, calorie_rate, base_minutes, sort_order, is_active, created_at) VALUES
('WALKING', '걷기', 35, 10, 1, true, NOW()),
('RUNNING', '달리기', 100, 10, 2, true, NOW()),
('WEIGHT_TRAINING', '웨이트 트레이닝', 70, 10, 3, true, NOW()),
('YOGA', '요가', 35, 10, 4, true, NOW()),
('PILATES', '필라테스', 50, 10, 5, true, NOW()),
('INDOOR_CYCLING', '실내 자전거', 70, 10, 6, true, NOW()),
('OUTDOOR_CYCLING', '야외 자전거', 90, 10, 7, true, NOW()),
('BODYWEIGHT_EXERCISE', '맨몸 운동 / 홈트', 80, 10, 8, true, NOW()),
('F45_CROSSFIT', 'F45 / 크로스핏', 110, 10, 9, true, NOW()),
('TENNIS_SQUASH', '테니스 / 스쿼시', 90, 10, 10, true, NOW()),
('ZUMBA_GX', '줌바 / GX', 80, 10, 11, true, NOW()),
('SWIMMING', '수영', 100, 10, 12, true, NOW()),
('HIKING', '등산 / 하이킹', 75, 10, 13, true, NOW()),
('BOXING', '복싱', 110, 10, 14, true, NOW()),
('CLIMBING', '클라이밍', 80, 10, 15, true, NOW()),
('JUMP_ROPE', '줄넘기', 90, 10, 16, true, NOW()),
('GOLF', '골프', 50, 10, 17, true, NOW()),
('STAIR_CLIMBING', '계단 오르기', 80, 10, 18, true, NOW());

-- Step 5: 시퀀스 리셋 (다음 ID를 19로 설정)
SELECT setval('exercise_types_id_seq', (SELECT MAX(id) FROM exercise_types));
