-- 식단 기록 테스트 데이터 (2025-10-27 ~ 2025-11-02)
-- 아침/점심/저녁 필수, 간식/야식 옵션

-- 2025-10-27 (일요일)
INSERT INTO public.user_records (user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES
(1, 8, 'DIET', '{"diet": "BREAKFAST", "foodName": "무화과 샐러드", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [{"name": "오징어", "level": 4}], "allergyScore": 1, "processedCount": 0, "processedFoods": [], "highFodmapCount": 1, "highFodmapFoods": ["사과"]}'::jsonb, '2025-10-27 08:00:00.000', '2025-10-27 08:00:00.000', '2025-10-27'),
(1, 8, 'DIET', '{"diet": "LUNCH", "foodName": "닭가슴살 샐러드", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 0, "processedFoods": [], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-10-27 12:30:00.000', '2025-10-27 12:30:00.000', '2025-10-27'),
(1, 8, 'DIET', '{"diet": "DINNER", "foodName": "연어 구이", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 0, "processedFoods": [], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-10-27 19:00:00.000', '2025-10-27 19:00:00.000', '2025-10-27'),
(1, 8, 'DIET', '{"diet": "SNACK", "foodName": "사과", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 0, "processedFoods": [], "highFodmapCount": 1, "highFodmapFoods": ["사과"]}'::jsonb, '2025-10-27 15:00:00.000', '2025-10-27 15:00:00.000', '2025-10-27'),
(1, 8, 'DIET', '{"diet": "MIDNIGHT_SNACK", "foodName": "치킨", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 1, "processedFoods": ["튀김옷"], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-10-27 23:00:00.000', '2025-10-27 23:00:00.000', '2025-10-27');

-- 2025-10-28 (월요일)
INSERT INTO public.user_records (user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES
(1, 8, 'DIET', '{"diet": "BREAKFAST", "foodName": "오트밀", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 0, "processedFoods": [], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-10-28 07:30:00.000', '2025-10-28 07:30:00.000', '2025-10-28'),
(1, 8, 'DIET', '{"diet": "LUNCH", "foodName": "현미밥 정식", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [{"name": "밀가루", "level": 2}], "allergyScore": 1, "processedCount": 0, "processedFoods": [], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-10-28 12:00:00.000', '2025-10-28 12:00:00.000', '2025-10-28'),
(1, 8, 'DIET', '{"diet": "DINNER", "foodName": "스테이크", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 0, "processedFoods": [], "highFodmapCount": 1, "highFodmapFoods": ["양파"]}'::jsonb, '2025-10-28 18:30:00.000', '2025-10-28 18:30:00.000', '2025-10-28'),
(1, 8, 'DIET', '{"diet": "SNACK", "foodName": "견과류", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 0, "processedFoods": [], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-10-28 10:30:00.000', '2025-10-28 10:30:00.000', '2025-10-28'),
(1, 8, 'DIET', '{"diet": "SNACK", "foodName": "요거트", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 0, "processedFoods": [], "highFodmapCount": 1, "highFodmapFoods": ["우유"]}'::jsonb, '2025-10-28 15:30:00.000', '2025-10-28 15:30:00.000', '2025-10-28');

-- 2025-10-29 (화요일)
INSERT INTO public.user_records (user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES
(1, 8, 'DIET', '{"diet": "BREAKFAST", "foodName": "계란후라이", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 0, "processedFoods": [], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-10-29 08:00:00.000', '2025-10-29 08:00:00.000', '2025-10-29'),
(1, 8, 'DIET', '{"diet": "LUNCH", "foodName": "참치김밥", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [{"name": "참치", "level": 3}], "allergyScore": 1, "processedCount": 1, "processedFoods": ["김"], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-10-29 12:30:00.000', '2025-10-29 12:30:00.000', '2025-10-29'),
(1, 8, 'DIET', '{"diet": "DINNER", "foodName": "된장찌개", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 0, "processedFoods": [], "highFodmapCount": 2, "highFodmapFoods": ["마늘", "양파"]}'::jsonb, '2025-10-29 19:00:00.000', '2025-10-29 19:00:00.000', '2025-10-29'),
(1, 8, 'DIET', '{"diet": "SNACK", "foodName": "바나나", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 0, "processedFoods": [], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-10-29 16:00:00.000', '2025-10-29 16:00:00.000', '2025-10-29'),
(1, 8, 'DIET', '{"diet": "MIDNIGHT_SNACK", "foodName": "라면", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [{"name": "밀가루", "level": 4}], "allergyScore": 1, "processedCount": 2, "processedFoods": ["면", "스프"], "highFodmapCount": 1, "highFodmapFoods": ["마늘"]}'::jsonb, '2025-10-29 23:30:00.000', '2025-10-29 23:30:00.000', '2025-10-29'),
(1, 8, 'DIET', '{"diet": "MIDNIGHT_SNACK", "foodName": "과자", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 1, "processedFoods": ["과자"], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-10-29 23:45:00.000', '2025-10-29 23:45:00.000', '2025-10-29');

-- 2025-10-30 (수요일)
INSERT INTO public.user_records (user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES
(1, 8, 'DIET', '{"diet": "BREAKFAST", "foodName": "토스트", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [{"name": "밀가루", "level": 2}], "allergyScore": 1, "processedCount": 1, "processedFoods": ["식빵"], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-10-30 07:00:00.000', '2025-10-30 07:00:00.000', '2025-10-30'),
(1, 8, 'DIET', '{"diet": "LUNCH", "foodName": "파스타", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [{"name": "밀가루", "level": 3}], "allergyScore": 1, "processedCount": 1, "processedFoods": ["면"], "highFodmapCount": 2, "highFodmapFoods": ["마늘", "양파"]}'::jsonb, '2025-10-30 13:00:00.000', '2025-10-30 13:00:00.000', '2025-10-30'),
(1, 8, 'DIET', '{"diet": "DINNER", "foodName": "삼겹살", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 0, "processedFoods": [], "highFodmapCount": 1, "highFodmapFoods": ["마늘"]}'::jsonb, '2025-10-30 19:30:00.000', '2025-10-30 19:30:00.000', '2025-10-30'),
(1, 8, 'DIET', '{"diet": "SNACK", "foodName": "초콜릿", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 1, "processedFoods": ["초콜릿"], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-10-30 15:00:00.000', '2025-10-30 15:00:00.000', '2025-10-30'),
(1, 8, 'DIET', '{"diet": "SNACK", "foodName": "커피", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 0, "processedFoods": [], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-10-30 16:00:00.000', '2025-10-30 16:00:00.000', '2025-10-30'),
(1, 8, 'DIET', '{"diet": "SNACK", "foodName": "쿠키", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 1, "processedFoods": ["쿠키"], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-10-30 17:00:00.000', '2025-10-30 17:00:00.000', '2025-10-30');

-- 2025-10-31 (목요일)
INSERT INTO public.user_records (user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES
(1, 8, 'DIET', '{"diet": "BREAKFAST", "foodName": "샌드위치", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [{"name": "밀가루", "level": 2}], "allergyScore": 1, "processedCount": 1, "processedFoods": ["빵"], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-10-31 07:30:00.000', '2025-10-31 07:30:00.000', '2025-10-31'),
(1, 8, 'DIET', '{"diet": "LUNCH", "foodName": "비빔밥", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 1, "processedFoods": ["고추장"], "highFodmapCount": 1, "highFodmapFoods": ["마늘"]}'::jsonb, '2025-10-31 12:00:00.000', '2025-10-31 12:00:00.000', '2025-10-31'),
(1, 8, 'DIET', '{"diet": "DINNER", "foodName": "김치찌개", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 0, "processedFoods": [], "highFodmapCount": 2, "highFodmapFoods": ["마늘", "양파"]}'::jsonb, '2025-10-31 19:00:00.000', '2025-10-31 19:00:00.000', '2025-10-31'),
(1, 8, 'DIET', '{"diet": "MIDNIGHT_SNACK", "foodName": "피자", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [{"name": "밀가루", "level": 3}, {"name": "치즈", "level": 2}], "allergyScore": 2, "processedCount": 2, "processedFoods": ["도우", "치즈"], "highFodmapCount": 1, "highFodmapFoods": ["마늘"]}'::jsonb, '2025-10-31 23:00:00.000', '2025-10-31 23:00:00.000', '2025-10-31');

-- 2025-11-01 (금요일)
INSERT INTO public.user_records (user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES
(1, 8, 'DIET', '{"diet": "BREAKFAST", "foodName": "시리얼", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 1, "processedFoods": ["시리얼"], "highFodmapCount": 1, "highFodmapFoods": ["우유"]}'::jsonb, '2025-11-01 08:00:00.000', '2025-11-01 08:00:00.000', '2025-11-01'),
(1, 8, 'DIET', '{"diet": "LUNCH", "foodName": "초밥", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [{"name": "생선", "level": 3}], "allergyScore": 1, "processedCount": 0, "processedFoods": [], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-11-01 13:00:00.000', '2025-11-01 13:00:00.000', '2025-11-01'),
(1, 8, 'DIET', '{"diet": "DINNER", "foodName": "부대찌개", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 3, "processedFoods": ["햄", "소시지", "라면"], "highFodmapCount": 2, "highFodmapFoods": ["마늘", "양파"]}'::jsonb, '2025-11-01 19:30:00.000', '2025-11-01 19:30:00.000', '2025-11-01'),
(1, 8, 'DIET', '{"diet": "SNACK", "foodName": "아이스크림", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 1, "processedFoods": ["아이스크림"], "highFodmapCount": 1, "highFodmapFoods": ["우유"]}'::jsonb, '2025-11-01 15:30:00.000', '2025-11-01 15:30:00.000', '2025-11-01'),
(1, 8, 'DIET', '{"diet": "MIDNIGHT_SNACK", "foodName": "떡볶이", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 2, "processedFoods": ["떡", "어묵"], "highFodmapCount": 1, "highFodmapFoods": ["마늘"]}'::jsonb, '2025-11-01 23:00:00.000', '2025-11-01 23:00:00.000', '2025-11-01'),
(1, 8, 'DIET', '{"diet": "MIDNIGHT_SNACK", "foodName": "순대", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 1, "processedFoods": ["순대"], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-11-01 23:30:00.000', '2025-11-01 23:30:00.000', '2025-11-01');

-- 2025-11-02 (토요일)
INSERT INTO public.user_records (user_id, user_challenge_id, record_type, metadata, created_at, updated_at, "date")
VALUES
(1, 8, 'DIET', '{"diet": "BREAKFAST", "foodName": "팬케이크", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [{"name": "밀가루", "level": 3}], "allergyScore": 1, "processedCount": 1, "processedFoods": ["시럽"], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-11-02 09:00:00.000', '2025-11-02 09:00:00.000', '2025-11-02'),
(1, 8, 'DIET', '{"diet": "LUNCH", "foodName": "햄버거", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [{"name": "밀가루", "level": 3}], "allergyScore": 1, "processedCount": 3, "processedFoods": ["빵", "패티", "소스"], "highFodmapCount": 1, "highFodmapFoods": ["양파"]}'::jsonb, '2025-11-02 13:00:00.000', '2025-11-02 13:00:00.000', '2025-11-02'),
(1, 8, 'DIET', '{"diet": "DINNER", "foodName": "회", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [{"name": "생선", "level": 4}], "allergyScore": 1, "processedCount": 0, "processedFoods": [], "highFodmapCount": 1, "highFodmapFoods": ["마늘"]}'::jsonb, '2025-11-02 19:00:00.000', '2025-11-02 19:00:00.000', '2025-11-02'),
(1, 8, 'DIET', '{"diet": "SNACK", "foodName": "팝콘", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 1, "processedFoods": ["팝콘"], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-11-02 16:00:00.000', '2025-11-02 16:00:00.000', '2025-11-02'),
(1, 8, 'DIET', '{"diet": "SNACK", "foodName": "탄산음료", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 1, "processedFoods": ["탄산음료"], "highFodmapCount": 0, "highFodmapFoods": []}'::jsonb, '2025-11-02 17:00:00.000', '2025-11-02 17:00:00.000', '2025-11-02'),
(1, 8, 'DIET', '{"diet": "MIDNIGHT_SNACK", "foodName": "치맥", "imageUrl": "https://example.com/image.jpg", "allergyFoods": [], "allergyScore": 0, "processedCount": 2, "processedFoods": ["튀김옷", "소스"], "highFodmapCount": 1, "highFodmapFoods": ["마늘"]}'::jsonb, '2025-11-02 23:00:00.000', '2025-11-02 23:00:00.000', '2025-11-02');
