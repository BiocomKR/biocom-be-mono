/**
 * 맞춤 솔루션 시드 데이터 (PostgreSQL)
 * - ProductLineup
 * - Ingredient (알레르겐)
 * - IngredientAlias
 * - HealthTypeAnimal metadata 업데이트
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// JSON 파일 로드 헬퍼
function loadJson<T>(filename: string): T {
  const filePath = path.join(__dirname, '../prisma/seed/solution', filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

async function seedProductLineups() {
  console.log('📦 ProductLineup 시드 시작...');

  const lineups = loadJson<
    Array<{
      key: string;
      name: string;
      description: string;
      sortOrder: number;
    }>
  >('product-lineups.json');

  for (const lineup of lineups) {
    await prisma.$executeRaw`
      INSERT INTO "product_lineups" ("key", "name", "description", "sort_order")
      VALUES (${lineup.key}, ${lineup.name}, ${lineup.description}, ${lineup.sortOrder})
      ON CONFLICT ("key") DO UPDATE SET
        "name" = EXCLUDED."name",
        "description" = EXCLUDED."description",
        "sort_order" = EXCLUDED."sort_order"
    `;
    console.log(`  ✅ ${lineup.name} (${lineup.key})`);
  }
}

async function seedIngredients() {
  console.log('🧪 Ingredient (알레르겐) 시드 시작...');

  const ingredients = loadJson<
    Array<{
      key: string;
      code: string;
      name: string;
      nameEn?: string;
      category: string;
      sortOrder: number;
      aliases?: string[];
    }>
  >('ingredients.json');

  for (const ing of ingredients) {
    // Ingredient upsert
    await prisma.$executeRaw`
      INSERT INTO "ingredients" ("key", "code", "name", "name_en", "category", "sort_order")
      VALUES (${ing.key}, ${ing.code}, ${ing.name}, ${ing.nameEn || null}, ${ing.category}, ${ing.sortOrder})
      ON CONFLICT ("key") DO UPDATE SET
        "name" = EXCLUDED."name",
        "name_en" = EXCLUDED."name_en",
        "category" = EXCLUDED."category",
        "sort_order" = EXCLUDED."sort_order"
    `;

    // Aliases 처리
    if (ing.aliases && ing.aliases.length > 0) {
      // ingredient id 조회
      const [ingredient] = await prisma.$queryRaw<[{ id: number }]>`
        SELECT "id" FROM "ingredients" WHERE "key" = ${ing.key}
      `;

      for (const alias of ing.aliases) {
        await prisma.$executeRaw`
          INSERT INTO "ingredient_aliases" ("ingredient_id", "alias", "source")
          VALUES (${ingredient.id}, ${alias}, 'TEST_RESULT')
          ON CONFLICT ("alias") DO UPDATE SET "source" = EXCLUDED."source"
        `;
      }
    }

    console.log(`  ✅ ${ing.name} (${ing.key})`);
  }
}

async function seedHealthTypeAnimalMetadata() {
  console.log('🐾 HealthTypeAnimal metadata 업데이트 시작...');

  const animals = loadJson<
    Array<{
      healthType: string;
      typeName: string;
      animalName: string;
      description?: string;
      solution?: string;
      metadata: object;
    }>
  >('health-type-animals.json');

  for (const animal of animals) {
    const metadataJson = JSON.stringify(animal.metadata);

    await prisma.$executeRaw`
      UPDATE "health_type_animals"
      SET
        "description" = ${animal.description || null},
        "solution" = ${animal.solution || null},
        "metadata" = ${metadataJson}::jsonb,
        "is_active" = true
      WHERE "health_type" = ${animal.healthType}
    `;

    console.log(`  ✅ ${animal.animalName} (${animal.healthType})`);
  }
}

async function seedHealthTypeAnimalProducts() {
  console.log('💊 HealthTypeAnimalProduct (영양제 추천) 시드 시작...');

  const data = loadJson<
    Array<{
      healthType: string;
      products: Array<{
        productId: number;
        type: string;
        priority: number;
        keyword: string;
        recommendReason: string;
        dosage: string;
        mechanisms: object[];
      }>;
    }>
  >('health-type-animal-products.json');

  for (const healthTypeData of data) {
    // healthTypeAnimalId 조회
    const [animal] = await prisma.$queryRaw<[{ id: number }]>`
      SELECT "id" FROM "health_type_animals" WHERE "health_type" = ${healthTypeData.healthType}
    `;

    if (!animal) {
      console.log(`  ⚠️ ${healthTypeData.healthType} 건강유형을 찾을 수 없습니다.`);
      continue;
    }

    // displayOrder 카운터 (type별로 구분)
    let supplementOrder = 0;
    let dietOrder = 100;

    for (const product of healthTypeData.products) {
      const mechanismsJson = JSON.stringify(product.mechanisms);

      // SUPPLEMENT는 1~99, DIET는 100~199
      const displayOrder = product.type === 'DIET'
        ? ++dietOrder
        : ++supplementOrder;

      await prisma.$executeRaw`
        INSERT INTO "health_type_animal_products" (
          "health_type_animal_id", "product_id", "type", "priority",
          "keyword", "recommend_reason", "dosage", "mechanisms", "display_order", "is_active"
        )
        VALUES (
          ${animal.id}, ${product.productId}, ${product.type}, ${product.priority},
          ${product.keyword}, ${product.recommendReason}, ${product.dosage}, ${mechanismsJson}::jsonb, ${displayOrder}, true
        )
        ON CONFLICT ("health_type_animal_id", "product_id") DO UPDATE SET
          "type" = EXCLUDED."type",
          "priority" = EXCLUDED."priority",
          "keyword" = EXCLUDED."keyword",
          "recommend_reason" = EXCLUDED."recommend_reason",
          "dosage" = EXCLUDED."dosage",
          "mechanisms" = EXCLUDED."mechanisms",
          "display_order" = EXCLUDED."display_order",
          "is_active" = EXCLUDED."is_active"
      `;

      console.log(`  ✅ ${healthTypeData.healthType} - Product ID ${product.productId} (${product.keyword})`);
    }
  }
}

async function seedLunchboxIngredients() {
  console.log('🍱 도시락 식재료 시드 시작...');

  const lunchboxes = loadJson<
    Array<{
      productId: number;
      name: string;
      ingredients: string[];
    }>
  >('lunchbox-ingredients.json');

  for (const lunchbox of lunchboxes) {
    const metadata = JSON.stringify({ ingredients: lunchbox.ingredients });

    await prisma.$executeRaw`
      UPDATE "products"
      SET "metadata" = ${metadata}::jsonb
      WHERE "id" = ${lunchbox.productId}
    `;

    console.log(`  ✅ ${lunchbox.name} (${lunchbox.ingredients.length}개 식재료)`);
  }
}

async function main() {
  console.log('🌱 맞춤 솔루션 시드 시작...\n');

  try {
    await seedProductLineups();
    console.log('');

    await seedIngredients();
    console.log('');

    await seedHealthTypeAnimalMetadata();
    console.log('');

    await seedHealthTypeAnimalProducts();
    console.log('');

    await seedLunchboxIngredients();
    console.log('');

    console.log('🎉 맞춤 솔루션 시드 완료!');
  } catch (error) {
    console.error('❌ 시드 실행 중 오류 발생:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
