-- 운동 종목 마스터 데이터 삽입 스크립트
-- 피그마 화면에서 확인한 운동 종목들을 카테고리별로 분류

-- 기존 데이터 삭제 (초기화)
DELETE FROM "exercise_types";

-- 1단계: 유산소 운동 (Cardio)
INSERT INTO "exercise_types" (name, code, category, calorie_rate, sort_order, is_active) VALUES
('걷기', 'WALKING', '유산소', 240, 1, true),
('달리기', 'RUNNING', '유산소', 600, 2, true),
('자전거', 'CYCLING', '유산소', 480, 3, true),
('수영', 'SWIMMING', '유산소', 500, 4, true),
('줄넘기', 'JUMP_ROPE', '유산소', 750, 5, true),
('등산/하이킹', 'HIKING', '유산소', 420, 6, true),
('계단 오르기', 'STAIR_CLIMBING', '유산소', 540, 7, true);

-- 2단계: 무산소 운동 (Strength Training)
INSERT INTO "exercise_types" (name, code, category, calorie_rate, sort_order, is_active) VALUES
('웨이트 트레이닝', 'WEIGHT_TRAINING', '무산소', 360, 10, true),
('스쿠트', 'SQUAT', '무산소', 400, 11, true),
('데드리프트', 'DEADLIFT', '무산소', 450, 12, true),
('벤치프레스', 'BENCH_PRESS', '무산소', 350, 13, true),
('푸시업', 'PUSH_UP', '무산소', 320, 14, true),
('풀업/턱걸이', 'PULL_UP', '무산소', 450, 15, true),
('플랭크', 'PLANK', '무산소', 210, 16, true);

-- 3단계: 스트레칭/요가 (Stretching/Yoga)
INSERT INTO "exercise_types" (name, code, category, calorie_rate, sort_order, is_active) VALUES
('요가', 'YOGA', '스트레칭', 180, 20, true),
('필라테스', 'PILATES', '스트레칭', 240, 21, true),
('스트레칭', 'STRETCHING', '스트레칭', 150, 22, true),
('명상', 'MEDITATION', '스트레칭', 60, 23, true);

-- 4단계: 그룹 운동/스포츠 (Sports/Group Activities)  
INSERT INTO "exercise_types" (name, code, category, calorie_rate, sort_order, is_active) VALUES
('축구', 'SOCCER', '스포츠', 540, 30, true),
('농구', 'BASKETBALL', '스포츠', 480, 31, true),
('배드민턴', 'BADMINTON', '스포츠', 360, 32, true),
('테니스', 'TENNIS', '스포츠', 420, 33, true),
('탁구', 'TABLE_TENNIS', '스포츠', 300, 34, true),
('볼링', 'BOWLING', '스포츠', 210, 35, true),
('골프', 'GOLF', '스포츠', 270, 36, true);

-- 5단계: 기타 활동 (Other Activities)
INSERT INTO "exercise_types" (name, code, category, calorie_rate, sort_order, is_active) VALUES
('춤/댄스', 'DANCING', '기타', 300, 40, true),
('청소', 'CLEANING', '기타', 180, 41, true),
('정원 가꾸기', 'GARDENING', '기타', 240, 42, true),
('산책', 'STROLLING', '기타', 150, 43, true),
('쇼핑', 'SHOPPING', '기타', 120, 44, true);

-- 생성된 데이터 확인용 쿼리
SELECT 
  category,
  COUNT(*) as count,
  STRING_AGG(name, ', ') as exercises
FROM "exercise_types" 
WHERE is_active = true 
GROUP BY category 
ORDER BY category;

-- 전체 운동 종목 목록 확인
SELECT id, name, code, category, calorie_rate, sort_order 
FROM "exercise_types" 
ORDER BY category, sort_order;