-- 식품 카테고리 초기 데이터 등록

-- 고포드맵 식품 (24개)
INSERT INTO food_categories (name, category, display_order, is_active, created_at, updated_at) VALUES
('양파', 'HIGH_FODMAP', 1, true, NOW(), NOW()),
('마늘', 'HIGH_FODMAP', 2, true, NOW(), NOW()),
('버섯', 'HIGH_FODMAP', 3, true, NOW(), NOW()),
('고구마', 'HIGH_FODMAP', 4, true, NOW(), NOW()),
('브로콜리', 'HIGH_FODMAP', 5, true, NOW(), NOW()),
('양배추', 'HIGH_FODMAP', 6, true, NOW(), NOW()),
('샐러리', 'HIGH_FODMAP', 7, true, NOW(), NOW()),
('사과', 'HIGH_FODMAP', 8, true, NOW(), NOW()),
('배', 'HIGH_FODMAP', 9, true, NOW(), NOW()),
('복숭아', 'HIGH_FODMAP', 10, true, NOW(), NOW()),
('수박', 'HIGH_FODMAP', 11, true, NOW(), NOW()),
('망고', 'HIGH_FODMAP', 12, true, NOW(), NOW()),
('체리', 'HIGH_FODMAP', 13, true, NOW(), NOW()),
('아보카도', 'HIGH_FODMAP', 14, true, NOW(), NOW()),
('밀가루', 'HIGH_FODMAP', 15, true, NOW(), NOW()),
('보리', 'HIGH_FODMAP', 16, true, NOW(), NOW()),
('호밀', 'HIGH_FODMAP', 17, true, NOW(), NOW()),
('우유', 'HIGH_FODMAP', 18, true, NOW(), NOW()),
('붉은강낭콩', 'HIGH_FODMAP', 19, true, NOW(), NOW()),
('캐슈너트', 'HIGH_FODMAP', 20, true, NOW(), NOW());

-- 가공식품 (10개)
INSERT INTO food_categories (name, category, display_order, is_active, created_at, updated_at) VALUES
('라면', 'PROCESSED', 1, true, NOW(), NOW()),
('소시지 및 햄', 'PROCESSED', 2, true, NOW(), NOW()),
('통조림 햄', 'PROCESSED', 3, true, NOW(), NOW()),
('과자', 'PROCESSED', 4, true, NOW(), NOW()),
('탄산음료', 'PROCESSED', 5, true, NOW(), NOW()),
('냉동 음식 (냉동 만두, 냉동 피자 등)', 'PROCESSED', 6, true, NOW(), NOW()),
('시리얼', 'PROCESSED', 7, true, NOW(), NOW()),
('식빵', 'PROCESSED', 8, true, NOW(), NOW()),
('아이스크림', 'PROCESSED', 9, true, NOW(), NOW()),
('케첩 / 마요네즈', 'PROCESSED', 10, true, NOW(), NOW());
