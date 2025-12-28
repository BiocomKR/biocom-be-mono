/**
 * 맞춤솔루션 관련 데이터 Export 스크립트
 *
 * 개발 서버의 데이터를 JSON 파일로 추출하여
 * 운영 서버 시딩에 사용할 수 있도록 합니다.
 *
 * 사용법:
 *   npx ts-node prisma/operation/export-solution-data.ts
 *
 * 출력 파일:
 *   - prisma/seed/solution/product-lineups.json (덮어쓰기)
 *   - prisma/seed/solution/health-type-animals.json (덮어쓰기)
 *   - prisma/seed/solution/health-type-animal-products.json (덮어쓰기)
 */

import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

const EXPORT_DIR = path.resolve(__dirname, '../seed/solution');

async function exportProductLineups() {
  console.log('\n📌 1. ProductLineup 추출 중...');

  const lineups = await prisma.productLineup.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      key: true,
      name: true,
      description: true,
      sortOrder: true,
    },
  });

  const filePath = path.join(EXPORT_DIR, 'product-lineups.json');
  fs.writeFileSync(filePath, JSON.stringify(lineups, null, 2), 'utf-8');
  console.log(`  ✅ ${lineups.length}개 추출 완료 → ${filePath}`);

  return lineups;
}

async function exportHealthTypeAnimals() {
  console.log('\n📌 2. HealthTypeAnimal 추출 중...');

  const animals = await prisma.healthTypeAnimal.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
    select: {
      healthType: true,
      typeName: true,
      animalName: true,
      description: true,
      solution: true,
      metadata: true,
      catchphrase: true,
      symptoms: true,
    },
  });

  // catchphrase, symptoms가 빈 문자열이면 제외 (JSON 크기 줄이기)
  const cleanedAnimals = animals.map((animal) => {
    const result: Record<string, unknown> = {
      healthType: animal.healthType,
      typeName: animal.typeName,
      animalName: animal.animalName,
    };

    if (animal.description) result.description = animal.description;
    if (animal.solution) result.solution = animal.solution;
    if (animal.metadata) result.metadata = animal.metadata;
    if (animal.catchphrase && animal.catchphrase.trim()) result.catchphrase = animal.catchphrase;
    if (animal.symptoms && animal.symptoms.trim()) result.symptoms = animal.symptoms;

    return result;
  });

  const filePath = path.join(EXPORT_DIR, 'health-type-animals.json');
  fs.writeFileSync(filePath, JSON.stringify(cleanedAnimals, null, 2), 'utf-8');
  console.log(`  ✅ ${cleanedAnimals.length}개 추출 완료 → ${filePath}`);

  return animals;
}

async function exportHealthTypeAnimalProducts() {
  console.log('\n📌 3. HealthTypeAnimalProduct 추출 중...');

  // healthType 별로 그룹화
  const animals = await prisma.healthTypeAnimal.findMany({
    where: { isActive: true },
    select: {
      id: true,
      healthType: true,
    },
  });

  const result: Array<{
    healthType: string;
    products: Array<{
      productId: number;
      type: string | null;
      priority: number | null;
      keyword: string | null;
      recommendReason: string | null;
      dosage: string | null;
      mechanisms: unknown;
    }>;
  }> = [];

  for (const animal of animals) {
    const products = await prisma.healthTypeAnimalProduct.findMany({
      where: {
        healthTypeAnimalId: animal.id,
        isActive: true,
      },
      orderBy: [{ type: 'asc' }, { priority: 'asc' }, { displayOrder: 'asc' }],
      select: {
        productId: true,
        type: true,
        priority: true,
        keyword: true,
        recommendReason: true,
        dosage: true,
        mechanisms: true,
      },
    });

    result.push({
      healthType: animal.healthType,
      products: products.map((p) => ({
        productId: p.productId,
        type: p.type,
        priority: p.priority,
        keyword: p.keyword,
        recommendReason: p.recommendReason,
        dosage: p.dosage,
        mechanisms: p.mechanisms || [],
      })),
    });

    console.log(`  📦 ${animal.healthType}: ${products.length}개 상품`);
  }

  const filePath = path.join(EXPORT_DIR, 'health-type-animal-products.json');
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`  ✅ 추출 완료 → ${filePath}`);

  return result;
}

async function exportHealthTypeAnimalFiles() {
  console.log('\n📌 4. HealthTypeAnimalFile 추출 중...');

  const files = await prisma.healthTypeAnimalFile.findMany({
    include: {
      healthTypeAnimal: {
        select: { healthType: true },
      },
      file: {
        select: {
          originalName: true,
          storedName: true,
          filePath: true,
          mimeType: true,
          fileSize: true,
          storageType: true,
        },
      },
    },
    orderBy: [{ healthTypeAnimalId: 'asc' }, { imageType: 'asc' }, { sortOrder: 'asc' }],
  });

  const result = files.map((f) => ({
    healthType: f.healthTypeAnimal.healthType,
    imageType: f.imageType,
    sortOrder: f.sortOrder,
    file: {
      originalName: f.file.originalName,
      storedName: f.file.storedName,
      filePath: f.file.filePath,
      mimeType: f.file.mimeType,
      fileSize: f.file.fileSize,
      storageType: f.file.storageType,
    },
  }));

  const filePath = path.join(EXPORT_DIR, 'health-type-animal-files.json');
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`  ✅ ${result.length}개 추출 완료 → ${filePath}`);

  return result;
}

async function main() {
  console.log('🚀 맞춤솔루션 데이터 Export 시작...');
  console.log(`📁 출력 디렉토리: ${EXPORT_DIR}\n`);

  // 출력 디렉토리 확인
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  try {
    // 1. ProductLineup
    await exportProductLineups();

    // 2. HealthTypeAnimal
    await exportHealthTypeAnimals();

    // 3. HealthTypeAnimalProduct
    await exportHealthTypeAnimalProducts();

    // 4. HealthTypeAnimalFile (이미지 매핑)
    await exportHealthTypeAnimalFiles();

    console.log('\n🎉 모든 데이터 Export 완료!');
    console.log('\n📋 사용 방법:');
    console.log('  1. 운영 서버에 prisma/seed/solution/*.json 파일 복사');
    console.log('  2. npx ts-node prisma/seed-solution.ts 실행');

  } catch (error) {
    console.error('❌ Export 중 오류:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ 에러 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
