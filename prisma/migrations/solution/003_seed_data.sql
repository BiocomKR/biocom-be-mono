-- 맞춤 솔루션 마이그레이션 Phase 3: Seed 데이터 입력
-- 실행 순서: 001 → 002 → 003
-- 참고: JSON 데이터는 seed 스크립트로 입력 권장

-- =====================================================
-- 1. ProductLineup Seed
-- =====================================================
INSERT INTO `product_lineups` (`key`, `name`, `description`, `sort_order`) VALUES
('ORIGINAL', '오리지널', '정제된 탄수화물 대신 단백질과 건강한 지방 위주로 구성하여, 장내 유해균이 과도하게 증식할 수 있는 영양 공급을 자연스럽게 조절합니다. 장 점막을 느슨하게 만드는 글루텐을 배제하여 장 건강 회복을 돕습니다.', 1),
('SIGNATURE', '시그니처', '인슐린 저항성 개선에 도움을 주면서도, 엄격한 식단이 부담스러울 때 편안하게 선택할 수 있는 라인업입니다. 현미 등 건강한 탄수화물을 사용하여 급격한 혈당 변화는 막아주되, 저탄수화물 식단에 우리 몸이 서서히 적응할 수 있도록 돕습니다.', 2),
('SLOW_AGING', '저속노화', '염증 해소에 꼭 필요한 오메가-3와 다양한 항산화 성분을 풍부하게 담았습니다. 만성 염증으로 지친 몸에 ''소방관'' 역할을 하는 영양소를 공급하여, 체내 회복 시스템이 정상적으로 작동하도록 돕습니다.', 3),
('LOW_FODMAP', '저포드맵', '소장에서 쉽게 발효되어 가스를 만드는 포드맵(FODMAP) 성분을 최소화했습니다. 식사 후 복부 팽만감을 유발하는 SIBO(소장 내 세균 과다 증식)의 환경적 요인을 조절하여, 장이 편안하게 쉴 수 있는 상태를 만들어줍니다.', 4)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `sort_order` = VALUES(`sort_order`);

-- =====================================================
-- 2. Ingredient (알레르겐) Seed
--    - 검사결과에서 나오는 식품 알레르겐 목록
-- =====================================================
INSERT INTO `ingredients` (`key`, `code`, `name`, `name_en`, `category`, `sort_order`) VALUES
-- 유제품
('milk', 'MILK', '우유', 'Milk', '유제품', 1),
('cheese', 'CHEESE', '치즈', 'Cheese', '유제품', 2),
('yogurt', 'YOGURT', '요거트', 'Yogurt', '유제품', 3),
-- 콩류
('soybean', 'SOYBEAN', '대두', 'Soybean', '콩류', 10),
-- 견과류
('peanut', 'PEANUT', '땅콩', 'Peanut', '견과류', 20),
('almond', 'ALMOND', '아몬드', 'Almond', '견과류', 21),
('walnut', 'WALNUT', '호두', 'Walnut', '견과류', 22),
('cashew', 'CASHEW', '캐슈넛', 'Cashew', '견과류', 23),
-- 곡류
('wheat', 'WHEAT', '밀', 'Wheat', '곡류', 30),
('gluten', 'GLUTEN', '글루텐', 'Gluten', '곡류', 31),
('oat', 'OAT', '귀리', 'Oat', '곡류', 32),
-- 해산물
('shrimp', 'SHRIMP', '새우', 'Shrimp', '갑각류', 40),
('crab', 'CRAB', '게', 'Crab', '갑각류', 41),
('squid', 'SQUID', '오징어', 'Squid', '연체류', 42),
('mackerel', 'MACKEREL', '고등어', 'Mackerel', '생선', 43),
('salmon', 'SALMON', '연어', 'Salmon', '생선', 44),
-- 육류
('beef', 'BEEF', '소고기', 'Beef', '육류', 50),
('pork', 'PORK', '돼지고기', 'Pork', '육류', 51),
('chicken', 'CHICKEN', '닭고기', 'Chicken', '육류', 52),
-- 계란
('egg', 'EGG', '계란', 'Egg', '계란', 60),
('egg_white', 'EGG_WHITE', '계란 흰자', 'Egg White', '계란', 61),
('egg_yolk', 'EGG_YOLK', '계란 노른자', 'Egg Yolk', '계란', 62),
-- 채소/과일
('tomato', 'TOMATO', '토마토', 'Tomato', '채소', 70),
('onion', 'ONION', '양파', 'Onion', '채소', 71),
('garlic', 'GARLIC', '마늘', 'Garlic', '채소', 72),
('apple', 'APPLE', '사과', 'Apple', '과일', 73),
('banana', 'BANANA', '바나나', 'Banana', '과일', 74)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `name_en` = VALUES(`name_en`),
  `category` = VALUES(`category`),
  `sort_order` = VALUES(`sort_order`);

-- =====================================================
-- 3. IngredientAlias Seed
--    - 검사결과 표기 변형
-- =====================================================
INSERT INTO `ingredient_aliases` (`ingredient_id`, `alias`, `source`)
SELECT i.id, a.alias, a.source
FROM `ingredients` i
CROSS JOIN (
  SELECT 'soybean' AS `key`, '대두콩' AS alias, 'TEST_RESULT' AS source UNION ALL
  SELECT 'soybean', '대두(간장,두부)', 'DIET_COMPONENT' UNION ALL
  SELECT 'milk', '원유', 'TEST_RESULT' UNION ALL
  SELECT 'milk', '우유단백', 'DIET_COMPONENT' UNION ALL
  SELECT 'wheat', '소맥', 'TEST_RESULT' UNION ALL
  SELECT 'wheat', '밀가루', 'DIET_COMPONENT' UNION ALL
  SELECT 'egg', '달걀', 'TEST_RESULT' UNION ALL
  SELECT 'egg', '계란(전란)', 'DIET_COMPONENT' UNION ALL
  SELECT 'peanut', '낙화생', 'TEST_RESULT' UNION ALL
  SELECT 'shrimp', '새우류', 'TEST_RESULT' UNION ALL
  SELECT 'crab', '게류', 'TEST_RESULT'
) a
WHERE i.`key` = a.`key`
ON DUPLICATE KEY UPDATE `source` = VALUES(`source`);

-- =====================================================
-- 4. HealthTypeAnimal metadata 업데이트
--    - 복잡한 JSON은 seed 스크립트로 처리 권장
--    - 여기서는 is_active만 설정
-- =====================================================
UPDATE `health_type_animals` SET `is_active` = 1;
