-- 2025-10-27 (일요일) - 3개 기록 (걷기, 요가, 필라테스)
INSERT INTO public.user_records
(user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/walking-1027.jpg", "activityTime": "00:45:00", "activityType": {"code": "WALKING", "name": "걷기", "base_minutes": 10, "calorie_rate": 35}, "totalDuration": 45, "durationInMinutes": 45, "estimatedCalories": 158}'::jsonb, '2025-10-27 08:30:00.000', '2025-10-27 08:30:00.000', '2025-10-27'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/yoga-1027.jpg", "activityTime": "01:00:00", "activityType": {"code": "YOGA", "name": "요가", "base_minutes": 10, "calorie_rate": 35}, "totalDuration": 60, "durationInMinutes": 60, "estimatedCalories": 210}'::jsonb, '2025-10-27 14:00:00.000', '2025-10-27 14:00:00.000', '2025-10-27'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/pilates-1027.jpg", "activityTime": "00:30:00", "activityType": {"code": "PILATES", "name": "필라테스", "base_minutes": 10, "calorie_rate": 50}, "totalDuration": 30, "durationInMinutes": 30, "estimatedCalories": 150}'::jsonb, '2025-10-27 19:00:00.000', '2025-10-27 19:00:00.000', '2025-10-27');

-- 2025-10-28 (월요일) - 2개 기록 (달리기, 웨이트)
INSERT INTO public.user_records
(user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/running-1028.jpg", "activityTime": "00:40:00", "activityType": {"code": "RUNNING", "name": "달리기", "base_minutes": 10, "calorie_rate": 100}, "totalDuration": 40, "durationInMinutes": 40, "estimatedCalories": 400}'::jsonb, '2025-10-28 06:30:00.000', '2025-10-28 06:30:00.000', '2025-10-28'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/weight-1028.jpg", "activityTime": "01:30:00", "activityType": {"code": "WEIGHT_TRAINING", "name": "웨이트 트레이닝", "base_minutes": 10, "calorie_rate": 70}, "totalDuration": 90, "durationInMinutes": 90, "estimatedCalories": 630}'::jsonb, '2025-10-28 19:00:00.000', '2025-10-28 19:00:00.000', '2025-10-28');

-- 2025-10-29 (화요일) - 4개 기록 (실내자전거, 수영, 걷기, 줄넘기)
INSERT INTO public.user_records
(user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/indoor-cycling-1029.jpg", "activityTime": "00:50:00", "activityType": {"code": "INDOOR_CYCLING", "name": "실내 자전거", "base_minutes": 10, "calorie_rate": 70}, "totalDuration": 50, "durationInMinutes": 50, "estimatedCalories": 350}'::jsonb, '2025-10-29 07:00:00.000', '2025-10-29 07:00:00.000', '2025-10-29'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/swimming-1029.jpg", "activityTime": "01:00:00", "activityType": {"code": "SWIMMING", "name": "수영", "base_minutes": 10, "calorie_rate": 100}, "totalDuration": 60, "durationInMinutes": 60, "estimatedCalories": 600}'::jsonb, '2025-10-29 12:00:00.000', '2025-10-29 12:00:00.000', '2025-10-29'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/walking-1029.jpg", "activityTime": "00:30:00", "activityType": {"code": "WALKING", "name": "걷기", "base_minutes": 10, "calorie_rate": 35}, "totalDuration": 30, "durationInMinutes": 30, "estimatedCalories": 105}'::jsonb, '2025-10-29 16:00:00.000', '2025-10-29 16:00:00.000', '2025-10-29'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/jumprope-1029.jpg", "activityTime": "00:20:00", "activityType": {"code": "JUMP_ROPE", "name": "줄넘기", "base_minutes": 10, "calorie_rate": 90}, "totalDuration": 20, "durationInMinutes": 20, "estimatedCalories": 180}'::jsonb, '2025-10-29 20:00:00.000', '2025-10-29 20:00:00.000', '2025-10-29');

-- 2025-10-30 (수요일) - 5개 기록 (최대 횟수)
INSERT INTO public.user_records
(user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/running-1030-1.jpg", "activityTime": "00:30:00", "activityType": {"code": "RUNNING", "name": "달리기", "base_minutes": 10, "calorie_rate": 100}, "totalDuration": 30, "durationInMinutes": 30, "estimatedCalories": 300}'::jsonb, '2025-10-30 06:00:00.000', '2025-10-30 06:00:00.000', '2025-10-30'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/bodyweight-1030.jpg", "activityTime": "00:40:00", "activityType": {"code": "BODYWEIGHT_EXERCISE", "name": "맨몸 운동 / 홈트", "base_minutes": 10, "calorie_rate": 80}, "totalDuration": 40, "durationInMinutes": 40, "estimatedCalories": 320}'::jsonb, '2025-10-30 09:00:00.000', '2025-10-30 09:00:00.000', '2025-10-30'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/walking-1030.jpg", "activityTime": "00:25:00", "activityType": {"code": "WALKING", "name": "걷기", "base_minutes": 10, "calorie_rate": 35}, "totalDuration": 25, "durationInMinutes": 25, "estimatedCalories": 88}'::jsonb, '2025-10-30 12:30:00.000', '2025-10-30 12:30:00.000', '2025-10-30'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/cycling-1030.jpg", "activityTime": "01:00:00", "activityType": {"code": "OUTDOOR_CYCLING", "name": "야외 자전거", "base_minutes": 10, "calorie_rate": 90}, "totalDuration": 60, "durationInMinutes": 60, "estimatedCalories": 540}'::jsonb, '2025-10-30 16:00:00.000', '2025-10-30 16:00:00.000', '2025-10-30'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/yoga-1030.jpg", "activityTime": "00:45:00", "activityType": {"code": "YOGA", "name": "요가", "base_minutes": 10, "calorie_rate": 35}, "totalDuration": 45, "durationInMinutes": 45, "estimatedCalories": 158}'::jsonb, '2025-10-30 20:00:00.000', '2025-10-30 20:00:00.000', '2025-10-30');

-- 2025-10-31 (목요일) - 3개 기록 (복싱, 클라이밍, 등산)
INSERT INTO public.user_records
(user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/boxing-1031.jpg", "activityTime": "01:00:00", "activityType": {"code": "BOXING", "name": "복싱", "base_minutes": 10, "calorie_rate": 110}, "totalDuration": 60, "durationInMinutes": 60, "estimatedCalories": 660}'::jsonb, '2025-10-31 07:00:00.000', '2025-10-31 07:00:00.000', '2025-10-31'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/climbing-1031.jpg", "activityTime": "01:30:00", "activityType": {"code": "CLIMBING", "name": "클라이밍", "base_minutes": 10, "calorie_rate": 80}, "totalDuration": 90, "durationInMinutes": 90, "estimatedCalories": 720}'::jsonb, '2025-10-31 14:00:00.000', '2025-10-31 14:00:00.000', '2025-10-31'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/hiking-1031.jpg", "activityTime": "02:00:00", "activityType": {"code": "HIKING", "name": "등산 / 하이킹", "base_minutes": 10, "calorie_rate": 75}, "totalDuration": 120, "durationInMinutes": 120, "estimatedCalories": 900}'::jsonb, '2025-10-31 16:00:00.000', '2025-10-31 16:00:00.000', '2025-10-31');

-- 2025-11-01 (금요일) - 2개 기록 (F45, 테니스)
INSERT INTO public.user_records
(user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/f45-1101.jpg", "activityTime": "01:00:00", "activityType": {"code": "F45_CROSSFIT", "name": "F45 / 크로스핏", "base_minutes": 10, "calorie_rate": 110}, "totalDuration": 60, "durationInMinutes": 60, "estimatedCalories": 660}'::jsonb, '2025-11-01 06:30:00.000', '2025-11-01 06:30:00.000', '2025-11-01'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/tennis-1101.jpg", "activityTime": "01:30:00", "activityType": {"code": "TENNIS_SQUASH", "name": "테니스 / 스쿼시", "base_minutes": 10, "calorie_rate": 90}, "totalDuration": 90, "durationInMinutes": 90, "estimatedCalories": 810}'::jsonb, '2025-11-01 18:00:00.000', '2025-11-01 18:00:00.000', '2025-11-01');

-- 2025-11-02 (토요일) - 4개 기록 (줌바, 골프, 계단오르기, 걷기)
INSERT INTO public.user_records
(user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/zumba-1102.jpg", "activityTime": "00:50:00", "activityType": {"code": "ZUMBA_GX", "name": "줌바 / GX", "base_minutes": 10, "calorie_rate": 80}, "totalDuration": 50, "durationInMinutes": 50, "estimatedCalories": 400}'::jsonb, '2025-11-02 10:00:00.000', '2025-11-02 10:00:00.000', '2025-11-02'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/golf-1102.jpg", "activityTime": "02:30:00", "activityType": {"code": "GOLF", "name": "골프", "base_minutes": 10, "calorie_rate": 50}, "totalDuration": 150, "durationInMinutes": 150, "estimatedCalories": 750}'::jsonb, '2025-11-02 13:00:00.000', '2025-11-02 13:00:00.000', '2025-11-02'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/stairs-1102.jpg", "activityTime": "00:30:00", "activityType": {"code": "STAIR_CLIMBING", "name": "계단 오르기", "base_minutes": 10, "calorie_rate": 80}, "totalDuration": 30, "durationInMinutes": 30, "estimatedCalories": 240}'::jsonb, '2025-11-02 17:00:00.000', '2025-11-02 17:00:00.000', '2025-11-02'),
(1, 8, 'ACTIVITY', '{"imageUrl": "https://example.com/walking-1102.jpg", "activityTime": "00:40:00", "activityType": {"code": "WALKING", "name": "걷기", "base_minutes": 10, "calorie_rate": 35}, "totalDuration": 40, "durationInMinutes": 40, "estimatedCalories": 140}'::jsonb, '2025-11-02 19:30:00.000', '2025-11-02 19:30:00.000', '2025-11-02');
