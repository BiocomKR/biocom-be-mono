-- 미션 마스터 데이터 INSERT
-- 생성일: 2025-10-15
-- 설명: 21일 챌린지 미션 기초 데이터

-- 기존 데이터 삭제 (개발 환경 전용)
-- TRUNCATE TABLE missions RESTART IDENTITY CASCADE;

-- ============================================
-- DAILY 미션 (매일 반복) - sortOrder 1~10
-- ============================================

-- 1. DIET (식단 기록) - 기록형
INSERT INTO missions (
  code, name, description, points, require_upload, daily_limit,
  specific_day, total_days, category, type, record_type, sort_order, is_active
) VALUES (
  'DIET',
  '식단 기록',
  '식단을 기록해주세요 (하루 3번 기록시 완료)',
  100,
  false,
  3,
  NULL,
  21,
  'DAILY',
  'RECORD',
  'DIET',
  1,
  true
);

-- 2. FASTING (공복 시간 기록) - 기록형
INSERT INTO missions (
  code, name, description, points, require_upload, daily_limit,
  specific_day, total_days, category, type, record_type, sort_order, is_active
) VALUES (
  'FASTING',
  '공복 시간 기록',
  '공복 시작 시간과 종료 시간을 기록해주세요',
  100,
  false,
  1,
  NULL,
  21,
  'DAILY',
  'RECORD',
  'FASTING',
  2,
  true
);

-- 3. SLEEP (수면 기록) - 기록형
INSERT INTO missions (
  code, name, description, points, require_upload, daily_limit,
  specific_day, total_days, category, type, record_type, sort_order, is_active
) VALUES (
  'SLEEP',
  '수면 기록',
  '취침 시간과 기상 시간을 기록해주세요',
  100,
  false,
  1,
  NULL,
  21,
  'DAILY',
  'RECORD',
  'SLEEP',
  3,
  true
);

-- 4. SUPPLEMENT (영양제 기록) - 기록형
INSERT INTO missions (
  code, name, description, points, require_upload, daily_limit,
  specific_day, total_days, category, type, record_type, sort_order, is_active
) VALUES (
  'SUPPLEMENT',
  '영양제 기록',
  '영양제 복용을 기록해주세요',
  100,
  false,
  2,
  NULL,
  21,
  'DAILY',
  'RECORD',
  'SUPPLEMENT',
  4,
  true
);

-- 5. ROUTINE (아랑 피부 루틴) - 일반 미션 (인증샷 필수)
INSERT INTO missions (
  code, name, description, points, require_upload, daily_limit,
  specific_day, total_days, category, type, record_type, upload_type, sort_order, is_active
) VALUES (
  'ROUTINE',
  '아랑 피부 루틴',
  '피부 관리 루틴을 수행하고 인증해주세요',
  100,
  true,
  1,
  NULL,
  21,
  'DAILY',
  'MISSION',
  NULL,
  'IMAGE',
  5,
  true
);

-- 6. QUIZ (퀴즈 풀기) - 일반 미션
INSERT INTO missions (
  code, name, description, points, require_upload, daily_limit,
  specific_day, total_days, category, type, record_type, sort_order, is_active
) VALUES (
  'QUIZ',
  '퀴즈 풀기',
  '오늘의 건강 퀴즈를 풀어주세요',
  200,
  false,
  1,
  NULL,
  21,
  'DAILY',
  'MISSION',
  NULL,
  6,
  true
);

-- 7. DAILY_CONTENT (오늘의 건강 컨텐츠) - 일반 미션
INSERT INTO missions (
  code, name, description, points, require_upload, daily_limit,
  specific_day, total_days, category, type, record_type, sort_order, is_active
) VALUES (
  'DAILY_CONTENT',
  '오늘의 건강 컨텐츠',
  '매일 제공되는 건강 교육 컨텐츠를 시청하세요',
  200,
  false,
  1,
  NULL,
  21,
  'DAILY',
  'MISSION',
  NULL,
  7,
  true
);

-- ============================================
-- SPECIAL 미션 (1일 1미션) - sortOrder 10
-- ============================================

-- 8. DAILY_MISSION (1일 1미션) - 일반 미션 (인증샷 필수)
INSERT INTO missions (
  code, name, description, points, require_upload, daily_limit,
  specific_day, total_days, category, type, record_type, upload_type, sort_order, is_active
) VALUES (
  'DAILY_MISSION',
  '1일 1미션',
  '오늘의 특별 미션을 수행해주세요',
  100,
  true,
  1,
  NULL,
  21,
  'SPECIAL',
  'MISSION',
  NULL,
  'IMAGE',
  10,
  true
);

-- ============================================
-- EVENT 미션 (특정일 이벤트) - sortOrder 100~
-- ============================================

-- 9. DECLARATION (자기 선언문) - Day 1 전용
INSERT INTO missions (
  code, name, description, points, require_upload, daily_limit,
  specific_day, total_days, category, type, record_type, sort_order, is_active
) VALUES (
  'DECLARATION',
  '자기 선언문',
  '챌린지 시작을 위한 자기 선언문을 작성해주세요',
  1000,
  false,
  1,
  1,
  1,
  'EVENT',
  'MISSION',
  NULL,
  100,
  true
);

-- 10. SELF_PRAISE (자기 칭찬하기) - Day 10 전용
INSERT INTO missions (
  code, name, description, points, require_upload, daily_limit,
  specific_day, total_days, category, type, record_type, sort_order, is_active
) VALUES (
  'SELF_PRAISE',
  '자기 칭찬하기',
  '10일차를 맞아 자신을 칭찬해주세요',
  1000,
  false,
  1,
  10,
  1,
  'EVENT',
  'MISSION',
  NULL,
  101,
  true
);

-- ============================================
-- ACHIEVEMENT 미션 (이행률 보상) - sortOrder 200~
-- 실시간 체크: 미션 완료 시마다 이행률 계산
-- 계산 기준: 전체 미션 수 대비 완료 비율
-- ============================================

-- 11. ACHIEVEMENT_30 (이행률 30% 달성)
INSERT INTO missions (
  code, name, description, points, require_upload, daily_limit,
  specific_day, total_days, category, type, record_type, sort_order, is_active
) VALUES (
  'ACHIEVEMENT_30',
  '이행률 30% 달성',
  '전체 미션의 30% 이상 완료시 보상',
  5000,
  false,
  1,
  NULL,
  1,
  'ACHIEVEMENT',
  'MISSION',
  NULL,
  200,
  true
);

-- 12. ACHIEVEMENT_60 (이행률 60% 달성)
INSERT INTO missions (
  code, name, description, points, require_upload, daily_limit,
  specific_day, total_days, category, type, record_type, sort_order, is_active
) VALUES (
  'ACHIEVEMENT_60',
  '이행률 60% 달성',
  '전체 미션의 60% 이상 완료시 보상',
  5000,
  false,
  1,
  NULL,
  1,
  'ACHIEVEMENT',
  'MISSION',
  NULL,
  201,
  true
);

-- 13. ACHIEVEMENT_90 (이행률 90% 달성)
INSERT INTO missions (
  code, name, description, points, require_upload, daily_limit,
  specific_day, total_days, category, type, record_type, sort_order, is_active
) VALUES (
  'ACHIEVEMENT_90',
  '이행률 90% 달성',
  '전체 미션의 90% 이상 완료시 보상',
  10000,
  false,
  1,
  NULL,
  1,
  'ACHIEVEMENT',
  'MISSION',
  NULL,
  202,
  true
);

-- ============================================
-- 데이터 확인 쿼리
-- ============================================

-- 전체 미션 개수 확인
SELECT
  category,
  COUNT(*) as mission_count,
  SUM(points) as total_points
FROM missions
GROUP BY category
ORDER BY
  CASE category
    WHEN 'DAILY' THEN 1
    WHEN 'SPECIAL' THEN 2
    WHEN 'EVENT' THEN 3
    WHEN 'ACHIEVEMENT' THEN 4
  END;

-- 기록형 미션 확인
SELECT code, name, type, record_type
FROM missions
WHERE type = 'RECORD'
ORDER BY sort_order;

-- 인증샷 필수 미션 확인
SELECT code, name, require_upload, upload_type
FROM missions
WHERE require_upload = true
ORDER BY sort_order;

-- 특정일 미션 확인
SELECT code, name, specific_day, category
FROM missions
WHERE specific_day IS NOT NULL
ORDER BY specific_day;
