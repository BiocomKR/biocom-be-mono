-- 뷰티 기록 테스트 데이터 (2025-10-27 ~ 2025-11-02)
-- 사용자 ID: 1, 챌린지 ID: 8

-- 2025-10-27 (월)
INSERT INTO public.user_records
(user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES(1, 8, 'BEAUTY', '{"totalScore": 150, "innerBeauty": [{"no": 1, "score": 25}, {"no": 2, "score": 15}, {"no": 3, "score": 15}, {"no": 4, "score": 25}], "outerBeauty": [{"no": 1, "score": 15}, {"no": 2, "score": 20}, {"no": 3, "score": 10}, {"no": 4, "score": 25}], "innerBeautyScore": 80, "outerBeautyScore": 70}'::jsonb, '2025-10-27 12:00:00.000', '2025-10-27 12:00:00.000', '2025-10-27');

-- 2025-10-28 (화)
INSERT INTO public.user_records
(user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES(1, 8, 'BEAUTY', '{"totalScore": 140, "innerBeauty": [{"no": 1, "score": 20}, {"no": 2, "score": 15}, {"no": 3, "score": 20}, {"no": 4, "score": 20}], "outerBeauty": [{"no": 1, "score": 15}, {"no": 2, "score": 15}, {"no": 3, "score": 10}, {"no": 4, "score": 25}], "innerBeautyScore": 75, "outerBeautyScore": 65}'::jsonb, '2025-10-28 12:00:00.000', '2025-10-28 12:00:00.000', '2025-10-28');

-- 2025-10-29 (수)
INSERT INTO public.user_records
(user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES(1, 8, 'BEAUTY', '{"totalScore": 130, "innerBeauty": [{"no": 1, "score": 15}, {"no": 2, "score": 15}, {"no": 3, "score": 20}, {"no": 4, "score": 15}], "outerBeauty": [{"no": 1, "score": 15}, {"no": 2, "score": 15}, {"no": 3, "score": 15}, {"no": 4, "score": 20}], "innerBeautyScore": 65, "outerBeautyScore": 65}'::jsonb, '2025-10-29 12:00:00.000', '2025-10-29 12:00:00.000', '2025-10-29');

-- 2025-10-30 (목)
INSERT INTO public.user_records
(user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES(1, 8, 'BEAUTY', '{"totalScore": 125, "innerBeauty": [{"no": 1, "score": 15}, {"no": 2, "score": 15}, {"no": 3, "score": 15}, {"no": 4, "score": 15}], "outerBeauty": [{"no": 1, "score": 15}, {"no": 2, "score": 15}, {"no": 3, "score": 15}, {"no": 4, "score": 20}], "innerBeautyScore": 60, "outerBeautyScore": 65}'::jsonb, '2025-10-30 12:00:00.000', '2025-10-30 12:00:00.000', '2025-10-30');

-- 2025-10-31 (금)
INSERT INTO public.user_records
(user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES(1, 8, 'BEAUTY', '{"totalScore": 120, "innerBeauty": [{"no": 1, "score": 15}, {"no": 2, "score": 10}, {"no": 3, "score": 15}, {"no": 4, "score": 15}], "outerBeauty": [{"no": 1, "score": 15}, {"no": 2, "score": 15}, {"no": 3, "score": 15}, {"no": 4, "score": 15}], "innerBeautyScore": 55, "outerBeautyScore": 60}'::jsonb, '2025-10-31 12:00:00.000', '2025-10-31 12:00:00.000', '2025-10-31');

-- 2025-11-01 (토)
INSERT INTO public.user_records
(user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES(1, 8, 'BEAUTY', '{"totalScore": 110, "innerBeauty": [{"no": 1, "score": 10}, {"no": 2, "score": 10}, {"no": 3, "score": 15}, {"no": 4, "score": 15}], "outerBeauty": [{"no": 1, "score": 15}, {"no": 2, "score": 15}, {"no": 3, "score": 10}, {"no": 4, "score": 15}], "innerBeautyScore": 50, "outerBeautyScore": 55}'::jsonb, '2025-11-01 12:00:00.000', '2025-11-01 12:00:00.000', '2025-11-01');

-- 2025-11-02 (일)
INSERT INTO public.user_records
(user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES(1, 8, 'BEAUTY', '{"totalScore": 100, "innerBeauty": [{"no": 1, "score": 10}, {"no": 2, "score": 10}, {"no": 3, "score": 10}, {"no": 4, "score": 15}], "outerBeauty": [{"no": 1, "score": 10}, {"no": 2, "score": 15}, {"no": 3, "score": 10}, {"no": 4, "score": 15}], "innerBeautyScore": 45, "outerBeautyScore": 50}'::jsonb, '2025-11-02 12:00:00.000', '2025-11-02 12:00:00.000', '2025-11-02');
