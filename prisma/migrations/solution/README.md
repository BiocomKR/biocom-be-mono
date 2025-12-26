# 맞춤 솔루션 마이그레이션

## 실행 순서

```bash
# 1. 신규 테이블 생성
mysql -u root -p biocom_dev < prisma/migrations/solution/001_create_tables.sql

# 2. 기존 테이블 확장
mysql -u root -p biocom_dev < prisma/migrations/solution/002_alter_tables.sql

# 3. Seed 데이터 (SQL 방식)
mysql -u root -p biocom_dev < prisma/migrations/solution/003_seed_data.sql

# 또는 3. Seed 데이터 (TypeScript 방식 - JSON 데이터 포함)
npx ts-node scripts/seed-solution.ts
```

## 마이그레이션 후 Prisma 동기화

```bash
# 스키마 pull (DB → schema.prisma)
npx prisma db pull

# 또는 schema.prisma 직접 수정 후
npx prisma generate
```

## 파일 목록

| 파일 | 설명 |
|------|------|
| `001_create_tables.sql` | 신규 테이블 생성 (ProductLineup, Ingredient, ProductIngredient 등) |
| `002_alter_tables.sql` | 기존 테이블 확장 (HealthTypeAnimal, HealthTypeAnimalProduct, Product) |
| `003_seed_data.sql` | 기본 Seed 데이터 (라인업, 알레르겐) |

## Seed 데이터 파일

| 파일 | 설명 |
|------|------|
| `../seed/solution/product-lineups.json` | 라인업 4종 |
| `../seed/solution/ingredients.json` | 알레르겐 마스터 |
| `../seed/solution/health-type-animals.json` | 동물유형별 메타데이터 (시너지 효과, 섭취 가이드) |

## 롤백

```sql
-- 신규 테이블 삭제
DROP TABLE IF EXISTS product_ingredients;
DROP TABLE IF EXISTS ingredient_aliases;
DROP TABLE IF EXISTS ingredients;
DROP TABLE IF EXISTS product_lineups;

-- 추가 필드 롤백 (필요시)
ALTER TABLE health_type_animals
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS solution,
  DROP COLUMN IF EXISTS image_url,
  DROP COLUMN IF EXISTS is_active;

ALTER TABLE health_type_animal_products
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS priority,
  DROP COLUMN IF EXISTS keyword,
  DROP COLUMN IF EXISTS recommend_reason,
  DROP COLUMN IF EXISTS dosage,
  DROP COLUMN IF EXISTS mechanisms;

ALTER TABLE products
  DROP FOREIGN KEY IF EXISTS products_lineup_id_fkey,
  DROP COLUMN IF EXISTS lineup_id,
  DROP COLUMN IF EXISTS calories,
  DROP COLUMN IF EXISTS net_carbs,
  DROP COLUMN IF EXISTS protein,
  DROP COLUMN IF EXISTS fat,
  DROP COLUMN IF EXISTS fiber;
```

---

* 작성일: 25/12/19
