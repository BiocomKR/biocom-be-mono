-- 푸시 세그먼트 조건 시드 데이터
-- 사용법: psql -d [DB명] -f push-segment-conditions.sql

-- 기존 데이터 삭제 (필요시)
-- DELETE FROM push_segment_conditions;

-- ===== 사용자 기본 조건 =====
INSERT INTO push_segment_conditions (category, condition_key, display_name, description, value_type, field_expression, allowed_operators, sort_order, is_active, created_at)
VALUES
  ('사용자', 'status', '사용자 상태', '사용자의 현재 상태 (NEWCOMER, ACTIVE, DORMANT 등)', 'enum', 'status', '["eq", "neq", "in"]', 1, true, NOW()),
  ('사용자', 'createdAt', '가입일', '사용자 가입 날짜', 'date', 'created_at', '["days_ago", "days_ago_gte", "days_ago_lte", "between"]', 2, true, NOW()),
  ('사용자', 'points', '보유 포인트', '현재 보유 포인트', 'number', 'points', '["eq", "neq", "gt", "gte", "lt", "lte", "between"]', 3, true, NOW()),
  ('사용자', 'hasEmail', '이메일 등록 여부', '이메일 등록 여부', 'boolean', 'email IS NOT NULL', '["is_true", "is_false"]', 4, true, NOW())
ON CONFLICT (condition_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  field_expression = EXCLUDED.field_expression,
  allowed_operators = EXCLUDED.allowed_operators,
  updated_at = NOW();

-- ===== 건강 유형 조건 =====
INSERT INTO push_segment_conditions (category, condition_key, display_name, description, value_type, field_expression, allowed_operators, sort_order, is_active, created_at)
VALUES
  ('건강유형', 'healthTypeAnimalId', '건강유형 동물 ID', '건강유형 동물 ID (1~N)', 'number', 'health_type_animal_id', '["eq", "neq", "in", "is_null", "is_not_null"]', 1, true, NOW()),
  ('건강유형', 'hasHealthType', '건강유형 검사 완료', '건강유형 검사 완료 여부', 'boolean', 'health_type_animal_id IS NOT NULL', '["is_true", "is_false"]', 2, true, NOW())
ON CONFLICT (condition_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  field_expression = EXCLUDED.field_expression,
  allowed_operators = EXCLUDED.allowed_operators,
  updated_at = NOW();

-- ===== 마케팅 조건 =====
INSERT INTO push_segment_conditions (category, condition_key, display_name, description, value_type, field_expression, allowed_operators, sort_order, is_active, created_at)
VALUES
  ('마케팅', 'marketingConsent', '마케팅 수신 동의', '마케팅 푸시 수신 동의 여부 (push_tokens 테이블 기준)', 'boolean',
   'id IN (SELECT user_id FROM push_tokens WHERE is_marketing_allowed = true AND is_active = true)',
   '["is_true", "is_false"]', 1, true, NOW())
ON CONFLICT (condition_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  field_expression = EXCLUDED.field_expression,
  allowed_operators = EXCLUDED.allowed_operators,
  updated_at = NOW();

-- 결과 확인
SELECT id, category, condition_key, display_name, value_type, allowed_operators FROM push_segment_conditions ORDER BY category, sort_order;
