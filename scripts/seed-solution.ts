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

async function main() {
  console.log('🌱 맞춤 솔루션 시드 시작...\n');

  try {
    await seedProductLineups();
    console.log('');

    await seedIngredients();
    console.log('');

    await seedHealthTypeAnimalMetadata();
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
