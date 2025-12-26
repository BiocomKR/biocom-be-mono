-- 맞춤 솔루션 마이그레이션 Phase 1: 신규 테이블 생성 (PostgreSQL)
-- 실행 순서: 001 → 002 → 003

-- =====================================================
-- 1. ProductLineup (라인업)
-- =====================================================
CREATE TABLE IF NOT EXISTS "product_lineups" (
  "id" SERIAL PRIMARY KEY,
  "key" VARCHAR(50) NOT NULL UNIQUE,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "sort_order" INT NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. Ingredient (알레르겐 마스터)
-- =====================================================
CREATE TABLE IF NOT EXISTS "ingredients" (
  "id" SERIAL PRIMARY KEY,
  "key" VARCHAR(50) NOT NULL UNIQUE,
  "code" VARCHAR(50) NOT NULL UNIQUE,
  "name" VARCHAR(100) NOT NULL,
  "name_en" VARCHAR(100),
  "category" VARCHAR(50),
  "sort_order" INT NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 3. IngredientAlias (알레르겐명 표기 변형)
-- =====================================================
CREATE TABLE IF NOT EXISTS "ingredient_aliases" (
  "id" SERIAL PRIMARY KEY,
  "ingredient_id" INT NOT NULL,
  "alias" VARCHAR(100) NOT NULL UNIQUE,
  "source" VARCHAR(50),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ingredient_aliases_ingredient_id_fkey"
    FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ingredient_aliases_ingredient_id_idx" ON "ingredient_aliases" ("ingredient_id");

-- =====================================================
-- 4. ProductIngredient (상품-알레르겐 연결)
-- =====================================================
CREATE TABLE IF NOT EXISTS "product_ingredients" (
  "id" SERIAL PRIMARY KEY,
  "product_id" INT NOT NULL,
  "ingredient_id" INT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "product_ingredients_product_ingredient_key" UNIQUE ("product_id", "ingredient_id"),
  CONSTRAINT "product_ingredients_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_ingredients_ingredient_id_fkey"
    FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "product_ingredients_product_id_idx" ON "product_ingredients" ("product_id");
CREATE INDEX IF NOT EXISTS "product_ingredients_ingredient_id_idx" ON "product_ingredients" ("ingredient_id");

-- 조건부 추천 (메타드림, 리셋데이): 코드 상수로 관리 (테이블 불필요)
