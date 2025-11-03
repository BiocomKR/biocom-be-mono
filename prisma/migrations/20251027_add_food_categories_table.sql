-- 식품 카테고리 테이블 생성
-- 고포드맵 식품, 가공식품 등 식단 관련 식품 분류 정보 관리

CREATE TABLE food_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_food_categories_category_active ON food_categories(category, is_active);

-- 테이블 코멘트
COMMENT ON TABLE food_categories IS '식품 카테고리 테이블 - 고포드맵 식품, 가공식품 등 식단 관련 식품 분류 정보 관리';
COMMENT ON COLUMN food_categories.name IS '식품명';
COMMENT ON COLUMN food_categories.category IS '카테고리 (HIGH_FODMAP: 고포드맵 식품, PROCESSED: 가공식품)';
COMMENT ON COLUMN food_categories.display_order IS '정렬 순서';
COMMENT ON COLUMN food_categories.is_active IS '활성화 여부';
COMMENT ON COLUMN food_categories.created_at IS '생성일시';
COMMENT ON COLUMN food_categories.updated_at IS '수정일시';
