-- food_categories 테이블 생성 (없으면)
CREATE TABLE IF NOT EXISTS food_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 인덱스 생성 (없으면)
CREATE INDEX IF NOT EXISTS idx_food_categories_category_is_active ON food_categories(category, is_active);

-- 기존 데이터 삭제
DELETE FROM food_categories;

-- 고포드맵 식품 (18개)
INSERT INTO food_categories (name, category, display_order, is_active, created_at, updated_at) VALUES
('마늘', 'HIGH_FODMAP', 1, true, NOW(), NOW()),
('양파', 'HIGH_FODMAP', 2, true, NOW(), NOW()),
('김치', 'HIGH_FODMAP', 3, true, NOW(), NOW()),
('밀', 'HIGH_FODMAP', 4, true, NOW(), NOW()),
('보리 / 호밀', 'HIGH_FODMAP', 5, true, NOW(), NOW()),
('우유', 'HIGH_FODMAP', 6, true, NOW(), NOW()),
('꿀', 'HIGH_FODMAP', 7, true, NOW(), NOW()),
('사과', 'HIGH_FODMAP', 8, true, NOW(), NOW()),
('콩류 & 렌틸콩', 'HIGH_FODMAP', 9, true, NOW(), NOW()),
('망고', 'HIGH_FODMAP', 10, true, NOW(), NOW()),
('수박', 'HIGH_FODMAP', 11, true, NOW(), NOW()),
('버섯', 'HIGH_FODMAP', 12, true, NOW(), NOW()),
('캐슈넛', 'HIGH_FODMAP', 13, true, NOW(), NOW()),
('당알코올', 'HIGH_FODMAP', 14, true, NOW(), NOW()),
('두유', 'HIGH_FODMAP', 15, true, NOW(), NOW()),
('가공육 (소시지, 햄)', 'HIGH_FODMAP', 16, true, NOW(), NOW()),
('고추장 / 된장', 'HIGH_FODMAP', 17, true, NOW(), NOW());

-- 가공식품 (20개)
INSERT INTO food_categories (name, category, display_order, is_active, created_at, updated_at) VALUES
('치킨', 'PROCESSED', 1, true, NOW(), NOW()),
('피자', 'PROCESSED', 2, true, NOW(), NOW()),
('빵류', 'PROCESSED', 3, true, NOW(), NOW()),
('짜장면 등 면류', 'PROCESSED', 4, true, NOW(), NOW()),
('튀김류', 'PROCESSED', 5, true, NOW(), NOW()),
('떡볶이', 'PROCESSED', 6, true, NOW(), NOW()),
('햄버거', 'PROCESSED', 7, true, NOW(), NOW()),
('마라탕 / 마라샹궈', 'PROCESSED', 8, true, NOW(), NOW()),
('라면', 'PROCESSED', 9, true, NOW(), NOW()),
('냉동 식품', 'PROCESSED', 10, true, NOW(), NOW()),
('햄 / 소시지 / 베이컨', 'PROCESSED', 11, true, NOW(), NOW()),
('어묵 / 맛살', 'PROCESSED', 12, true, NOW(), NOW()),
('통조림', 'PROCESSED', 13, true, NOW(), NOW()),
('과자, 초콜릿, 사탕, 젤리', 'PROCESSED', 14, true, NOW(), NOW()),
('아이스크림', 'PROCESSED', 15, true, NOW(), NOW()),
('에너지바 / 단백질바', 'PROCESSED', 16, true, NOW(), NOW()),
('팝콘', 'PROCESSED', 17, true, NOW(), NOW()),
('음료수', 'PROCESSED', 18, true, NOW(), NOW()),
('커피 믹스 / 가당 커피 음료', 'PROCESSED', 19, true, NOW(), NOW()),
('케첩 / 마요네즈', 'PROCESSED', 20, true, NOW(), NOW());

COMMENT ON TABLE food_categories IS '식품 카테고리 테이블 (고포드맵 식품, 가공식품 등 식단 관련 식품 분류 정보 관리)';
COMMENT ON COLUMN food_categories.name IS '식품명';
COMMENT ON COLUMN food_categories.category IS '카테고리 (HIGH_FODMAP: 고포드맵 식품, PROCESSED: 가공식품)';
COMMENT ON COLUMN food_categories.display_order IS '정렬 순서';
COMMENT ON COLUMN food_categories.is_active IS '활성화 여부';
