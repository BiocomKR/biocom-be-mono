-- 푸시 템플릿 변수 시드 데이터
-- 사용법: psql -d [DB명] -f push-template-variables.sql

-- 기존 데이터 삭제 (필요시)
-- DELETE FROM push_template_variables;

-- ===== 사용자 기본 정보 =====
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

-- ===== 건강 유형 정보 =====
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

-- ===== AI 페르소나 정보 =====
INSERT INTO push_template_variables (category, variable_key, display_name, description, data_path, required_includes, default_value, sort_order, is_active, created_at)
VALUES
  ('AI페르소나', 'personaName', 'AI 페르소나 이름', '사용자의 AI 페르소나 캐릭터 이름', 'aiPersona.name', '["aiPersona"]', '바이오콤', 1, true, NOW())
ON CONFLICT (variable_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  data_path = EXCLUDED.data_path,
  required_includes = EXCLUDED.required_includes,
  updated_at = NOW();

-- 결과 확인
SELECT id, category, variable_key, display_name, data_path, default_value FROM push_template_variables ORDER BY category, sort_order;
