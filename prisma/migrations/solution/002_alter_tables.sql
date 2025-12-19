-- 맞춤 솔루션 마이그레이션 Phase 2: 기존 테이블 확장 (PostgreSQL)
-- 실행 순서: 001 → 002 → 003

-- =====================================================
-- 1. HealthTypeAnimal 확장
--    - metadata JSON 필드 추가
--    - description, solution 필드 추가
--    - imageUrl 필드 추가
-- =====================================================
ALTER TABLE "health_type_animals"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "solution" TEXT,
  ADD COLUMN IF NOT EXISTS "image_url" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT TRUE;

-- =====================================================
-- 2. HealthTypeAnimalProduct 확장
--    - type, priority, keyword, recommendReason, dosage, mechanisms 추가
-- =====================================================
ALTER TABLE "health_type_animal_products"
  ADD COLUMN IF NOT EXISTS "type" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "priority" INT,
  ADD COLUMN IF NOT EXISTS "keyword" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "recommend_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "dosage" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "mechanisms" JSONB;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS "health_type_animal_products_type_idx"
  ON "health_type_animal_products" ("health_type_animal_id", "type");

CREATE INDEX IF NOT EXISTS "health_type_animal_products_type_priority_idx"
  ON "health_type_animal_products" ("health_type_animal_id", "type", "priority");

-- =====================================================
-- 3. Product 확장
--    - lineupId FK 추가
--    - 영양성분 필드 추가 (식단용)
-- =====================================================
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "lineup_id" INT,
  ADD COLUMN IF NOT EXISTS "calories" DECIMAL(6,1),
  ADD COLUMN IF NOT EXISTS "net_carbs" DECIMAL(5,1),
  ADD COLUMN IF NOT EXISTS "protein" DECIMAL(5,1),
  ADD COLUMN IF NOT EXISTS "fat" DECIMAL(5,1),
  ADD COLUMN IF NOT EXISTS "fiber" DECIMAL(5,1);

-- lineup FK 추가 (이미 존재하면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'products_lineup_id_fkey'
  ) THEN
    ALTER TABLE "products"
      ADD CONSTRAINT "products_lineup_id_fkey"
        FOREIGN KEY ("lineup_id") REFERENCES "product_lineups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- lineup 인덱스 추가
CREATE INDEX IF NOT EXISTS "products_lineup_id_idx" ON "products" ("lineup_id");
