-- 테스트 데이터 설정 스크립트
-- 실행: PGPASSWORD='bico0724!@#' psql -h 43.200.68.96 -U biocom -d biocom -f test/setup-test-data.sql

-- 기존 테스트 데이터 정리
UPDATE event_periods SET is_active = false WHERE name LIKE 'TEST%';

-- 1. 테스트용 이벤트 생성
INSERT INTO event_periods (type, name, description, start_date, end_date, total_days, is_active)
VALUES (
  'CHALLENGE',
  'TEST 21일 건강 챌린지',
  '테스트용 건강 챌린지입니다',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '20 days',
  21,
  true
) ON CONFLICT DO NOTHING
RETURNING id;

-- 최신 이벤트 ID 가져오기
DO $$
DECLARE 
  test_event_id INTEGER;
  test_survey_id INTEGER;
  test_mission_water_id INTEGER;
  test_mission_exercise_id INTEGER;
BEGIN
  -- 이벤트 ID 조회
  SELECT id INTO test_event_id FROM event_periods WHERE name = 'TEST 21일 건강 챌린지' LIMIT 1;
  
  -- 2. 테스트용 설문 생성 (이미 있으면 스킵)
  INSERT INTO surveys (title, description, is_active)
  VALUES ('테스트 건강 설문', '건강 상태 체크를 위한 설문입니다', true)
  ON CONFLICT DO NOTHING;
  
  SELECT id INTO test_survey_id FROM surveys WHERE title = '테스트 건강 설문' LIMIT 1;
  
  -- 3. 이벤트-설문 연결
  INSERT INTO event_surveys (event_id, survey_id, survey_options, is_active)
  VALUES 
    (test_event_id, test_survey_id, '{"type": "before", "fromDay": 1}'::jsonb, true),
    (test_event_id, test_survey_id, '{"type": "after", "fromDay": 19}'::jsonb, true)
  ON CONFLICT DO NOTHING;
  
  -- 4. 테스트용 미션 생성
  INSERT INTO missions (code, name, description, points, category, require_upload, is_active, sort_order)
  VALUES 
    ('TEST_WATER', '물 8잔 마시기', '하루에 물을 8잔 이상 마십니다', 100, 'DAILY', false, true, 1),
    ('TEST_EXERCISE', '운동 인증', '30분 이상 운동 후 인증샷을 올려주세요', 200, 'EXERCISE', true, true, 2)
  ON CONFLICT (code) DO NOTHING;
  
  SELECT id INTO test_mission_water_id FROM missions WHERE code = 'TEST_WATER' LIMIT 1;
  SELECT id INTO test_mission_exercise_id FROM missions WHERE code = 'TEST_EXERCISE' LIMIT 1;
  
  -- 5. 이벤트-미션 연결
  INSERT INTO event_missions (event_id, mission_id, points, active_from_day, active_to_day, is_active)
  VALUES 
    (test_event_id, test_mission_water_id, 100, 1, 21, true),
    (test_event_id, test_mission_exercise_id, 200, 1, 21, true)
  ON CONFLICT DO NOTHING;
  
  -- 6. 테스트용 퀴즈 생성
  INSERT INTO event_quizzes (event_id, day, question, option1, option2, option3, option4, correct_answer, points, is_active)
  VALUES 
    (test_event_id, 1, '하루 권장 물 섭취량은?', '1L', '1.5L', '2L', '3L', 3, 50, true),
    (test_event_id, 3, '운동 후 언제 스트레칭을 해야 할까요?', '운동 전만', '운동 후만', '운동 전후 모두', '필요없음', 3, 50, true)
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE '테스트 데이터 생성 완료. Event ID: %', test_event_id;
END $$;

-- 생성된 데이터 확인
SELECT 'Active Event:' as info, id, name, start_date, end_date, is_active 
FROM event_periods 
WHERE is_active = true;

SELECT 'Event Missions:' as info, em.*, m.name 
FROM event_missions em 
JOIN missions m ON em.mission_id = m.id
WHERE em.event_id = (SELECT id FROM event_periods WHERE is_active = true LIMIT 1);

SELECT 'Event Surveys:' as info, es.*, s.title 
FROM event_surveys es 
JOIN surveys s ON es.survey_id = s.id
WHERE es.event_id = (SELECT id FROM event_periods WHERE is_active = true LIMIT 1);