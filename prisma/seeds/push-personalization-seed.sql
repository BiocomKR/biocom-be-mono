-- =====================================================
-- 푸시 개인화 시스템 시드 데이터
-- =====================================================
-- 실행: psql -d [DB명] -f push-personalization-seed.sql
-- 또는: npx prisma db execute --file prisma/seeds/push-personalization-seed.sql
-- =====================================================

BEGIN;

-- =====================================================
-- 1. 템플릿 변수 (push_template_variables)
-- =====================================================

-- 사용자 기본 정보
INSERT INTO push_template_variables (category, variable_key, display_name, description, data_path, required_includes, default_value, sort_order, is_active, created_at)
VALUES
  ('사용자', 'userName', '사용자 이름', '사용자의 이름', 'name', NULL, '고객', 1, true, NOW()),
  ('사용자', 'mobile', '휴대폰 번호', '사용자의 휴대폰 번호', 'mobile', NULL, '', 2, true, NOW()),
  ('사용자', 'email', '이메일', '사용자의 이메일 주소', 'email', NULL, '', 3, true, NOW()),
  ('사용자', 'points', '보유 포인트', '현재 보유 포인트', 'points', NULL, '0', 4, true, NOW())
ON CONFLICT (variable_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  data_path = EXCLUDED.data_path,
  updated_at = NOW();

-- 건강 유형 정보
INSERT INTO push_template_variables (category, variable_key, display_name, description, data_path, required_includes, default_value, sort_order, is_active, created_at)
VALUES
  ('건강유형', 'healthAnimal', '건강유형 동물', '사용자의 건강유형 동물 이름 (예: 곰, 호랑이)', 'healthTypeAnimal.animalName', '["healthTypeAnimal"]', '', 1, true, NOW()),
  ('건강유형', 'healthType', '건강유형 코드', '건강유형 코드 (예: TYPE_A)', 'healthTypeAnimal.healthType', '["healthTypeAnimal"]', '', 2, true, NOW()),
  ('건강유형', 'healthTypeName', '건강유형 이름', '건강유형 전체 이름', 'healthTypeAnimal.typeName', '["healthTypeAnimal"]', '', 3, true, NOW())
ON CONFLICT (variable_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  data_path = EXCLUDED.data_path,
  required_includes = EXCLUDED.required_includes,
  updated_at = NOW();

-- AI 페르소나 정보
INSERT INTO push_template_variables (category, variable_key, display_name, description, data_path, required_includes, default_value, sort_order, is_active, created_at)
VALUES
  ('AI페르소나', 'personaName', 'AI 페르소나 이름', '사용자의 AI 페르소나 캐릭터 이름', 'aiPersona.name', '["aiPersona"]', '바이오콤', 1, true, NOW())
ON CONFLICT (variable_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  data_path = EXCLUDED.data_path,
  required_includes = EXCLUDED.required_includes,
  updated_at = NOW();


-- =====================================================
-- 2. 세그먼트 조건 (push_segment_conditions)
-- =====================================================

-- 사용자 기본 조건
INSERT INTO push_segment_conditions (category, condition_key, display_name, description, value_type, field_expression, allowed_operators, sort_order, is_active, created_at)
VALUES
  ('사용자', 'status', '사용자 상태', '사용자의 현재 상태 (NEWCOMER, ACTIVE, DORMANT 등)', 'enum', 'status', '["eq", "neq", "in"]', 1, true, NOW()),
  ('사용자', 'createdAt', '가입일', '사용자 가입 날짜', 'date', 'created_at', '["days_ago", "days_ago_gte", "days_ago_lte", "between"]', 2, true, NOW()),
  ('사용자', 'points', '보유 포인트', '현재 보유 포인트', 'number', 'points', '["eq", "neq", "gt", "gte", "lt", "lte", "between"]', 3, true, NOW()),
  ('사용자', 'hasEmail', '이메일 등록 여부', '이메일이 등록되어 있는지', 'boolean', 'email IS NOT NULL', '["is_true", "is_false"]', 4, true, NOW())
ON CONFLICT (condition_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  field_expression = EXCLUDED.field_expression,
  allowed_operators = EXCLUDED.allowed_operators,
  updated_at = NOW();

-- 건강 유형 조건
INSERT INTO push_segment_conditions (category, condition_key, display_name, description, value_type, field_expression, allowed_operators, sort_order, is_active, created_at)
VALUES
  ('건강유형', 'healthTypeAnimalId', '건강유형 동물 ID', '건강유형 동물 ID (1~N)', 'number', 'health_type_animal_id', '["eq", "neq", "in", "is_null", "is_not_null"]', 1, true, NOW()),
  ('건강유형', 'hasHealthType', '건강유형 검사 완료', '건강유형 검사를 완료했는지', 'boolean', 'health_type_animal_id IS NOT NULL', '["is_true", "is_false"]', 2, true, NOW())
ON CONFLICT (condition_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  field_expression = EXCLUDED.field_expression,
  allowed_operators = EXCLUDED.allowed_operators,
  updated_at = NOW();

-- 마케팅 조건
INSERT INTO push_segment_conditions (category, condition_key, display_name, description, value_type, field_expression, allowed_operators, sort_order, is_active, created_at)
VALUES
  ('마케팅', 'marketingConsent', '마케팅 수신 동의', '마케팅 푸시 수신에 동의했는지', 'boolean',
   'id IN (SELECT user_id FROM push_tokens WHERE is_marketing_allowed = true AND is_active = true)',
   '["is_true", "is_false"]', 1, true, NOW())
ON CONFLICT (condition_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  value_type = EXCLUDED.value_type,
  field_expression = EXCLUDED.field_expression,
  allowed_operators = EXCLUDED.allowed_operators,
  updated_at = NOW();

COMMIT;

-- =====================================================
-- 결과 확인
-- =====================================================
SELECT '=== 템플릿 변수 ===' as info;
SELECT id, category, variable_key, display_name, default_value FROM push_template_variables WHERE is_active = true ORDER BY category, sort_order;

SELECT '=== 세그먼트 조건 ===' as info;
SELECT id, category, condition_key, display_name, value_type FROM push_segment_conditions WHERE is_active = true ORDER BY category, sort_order;
