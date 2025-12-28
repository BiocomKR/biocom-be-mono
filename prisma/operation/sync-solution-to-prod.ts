/**
 * 운영 DB 맞춤솔루션 동기화 스크립트
 *
 * 실행 전 Cloud SQL Proxy 연결 필요:
 * cloud-sql-proxy --port 15432 api-prod-biocom:asia-northeast3:biocom-prod-db
 *
 * 실행 방법:
 * DATABASE_URL="postgresql://biocom:패스워드@127.0.0.1:15432/biocom" npx ts-node prisma/operation/sync-solution-to-prod.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 라인업별 제품 ID (운영 DB 기준 - 확인 필요)
// 주의: 운영 DB의 product ID가 다를 수 있으므로 실행 전 확인 필요
const LINEUP_PRODUCTS = {
  ORIGINAL: [64, 65, 66, 67, 68, 69, 70],
  SIGNATURE: [71, 72],
  SLOW_AGING: [73, 74, 75, 76, 77, 78, 79],
  LOW_FODMAP: [80, 81, 82, 83, 84, 85, 86]
};

// HealthTypeAnimal ID 매핑
const HEALTH_TYPE_IDS = {
  SKIN_HEALTH: 1,
  METABOLISM: 2,
  GUT_HEALTH: 3,
  IMMUNE_BALANCE: 4
};

// 식단 추천 정보 (priority 1 = lunch, priority 2 = dinner)
const DIET_RECOMMENDATIONS: Record<string, { lunch: string; dinner: string }> = {
  SKIN_HEALTH: { lunch: 'SLOW_AGING', dinner: 'LOW_FODMAP' },
  METABOLISM: { lunch: 'ORIGINAL', dinner: 'SIGNATURE' },
  GUT_HEALTH: { lunch: 'LOW_FODMAP', dinner: 'ORIGINAL' },
  IMMUNE_BALANCE: { lunch: 'LOW_FODMAP', dinner: 'SLOW_AGING' }
};

// Catchphrase 정보
const CATCHPHRASES: Record<string, string> = {
  GUT_HEALTH: "장속 가스 폭풍을\n잔잔 모드로 돌려야 해요.",
  METABOLISM: "저전력 모드를\n체계적으로 관리해야 해요.",
  SKIN_HEALTH: "몸속 불씨를\n진정 모드로 돌려야 해요.",
  IMMUNE_BALANCE: "면역 시스템의\n밸런스를 찾아야해요."
};

async function verifyProducts() {
  console.log('=== 1. 제품 확인 ===\n');

  for (const [lineup, productIds] of Object.entries(LINEUP_PRODUCTS)) {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true }
    });

    console.log(`[${lineup}]`);
    if (products.length !== productIds.length) {
      console.log(`  ⚠️  제품 수 불일치: 예상 ${productIds.length}개, 실제 ${products.length}개`);
      const foundIds = products.map(p => p.id);
      const missingIds = productIds.filter(id => !foundIds.includes(id));
      if (missingIds.length > 0) {
        console.log(`  ❌ 누락된 ID: ${missingIds.join(', ')}`);
      }
    }
    products.forEach(p => console.log(`  - [${p.id}] ${p.name}`));
    console.log('');
  }
}

async function updateCatchphrases() {
  console.log('=== 2. Catchphrase 업데이트 ===\n');

  for (const [healthType, catchphrase] of Object.entries(CATCHPHRASES)) {
    const result = await prisma.healthTypeAnimal.updateMany({
      where: { healthType },
      data: { catchphrase }
    });
    console.log(`✅ ${healthType}: ${result.count}개 업데이트`);
  }
  console.log('');
}

async function addDietMappings() {
  console.log('=== 3. 식단 매핑 추가 ===\n');

  let totalAdded = 0;
  let totalSkipped = 0;

  for (const [healthType, recommendation] of Object.entries(DIET_RECOMMENDATIONS)) {
    const healthTypeAnimalId = HEALTH_TYPE_IDS[healthType as keyof typeof HEALTH_TYPE_IDS];
    console.log(`[${healthType}] (ID: ${healthTypeAnimalId})`);

    // 점심 라인업 제품 추가 (priority 1)
    const lunchProducts = LINEUP_PRODUCTS[recommendation.lunch as keyof typeof LINEUP_PRODUCTS];
    console.log(`  점심(${recommendation.lunch}): ${lunchProducts.length}개 제품`);

    for (const productId of lunchProducts) {
      const existing = await prisma.healthTypeAnimalProduct.findFirst({
        where: { healthTypeAnimalId, productId, type: 'DIET' }
      });

      if (existing) {
        totalSkipped++;
        continue;
      }

      const maxOrder = await prisma.healthTypeAnimalProduct.aggregate({
        where: { healthTypeAnimalId },
        _max: { displayOrder: true }
      });
      const nextOrder = (maxOrder._max.displayOrder || 0) + 1;

      await prisma.healthTypeAnimalProduct.create({
        data: {
          healthTypeAnimalId,
          productId,
          type: 'DIET',
          priority: 1,
          displayOrder: nextOrder,
          isActive: true
        }
      });
      totalAdded++;
    }

    // 저녁 라인업 제품 추가 (priority 2)
    const dinnerProducts = LINEUP_PRODUCTS[recommendation.dinner as keyof typeof LINEUP_PRODUCTS];
    console.log(`  저녁(${recommendation.dinner}): ${dinnerProducts.length}개 제품`);

    for (const productId of dinnerProducts) {
      const existing = await prisma.healthTypeAnimalProduct.findFirst({
        where: { healthTypeAnimalId, productId, type: 'DIET' }
      });

      if (existing) {
        totalSkipped++;
        continue;
      }

      const maxOrder = await prisma.healthTypeAnimalProduct.aggregate({
        where: { healthTypeAnimalId },
        _max: { displayOrder: true }
      });
      const nextOrder = (maxOrder._max.displayOrder || 0) + 1;

      await prisma.healthTypeAnimalProduct.create({
        data: {
          healthTypeAnimalId,
          productId,
          type: 'DIET',
          priority: 2,
          displayOrder: nextOrder,
          isActive: true
        }
      });
      totalAdded++;
    }
    console.log('');
  }

  console.log(`총 ${totalAdded}개 추가, ${totalSkipped}개 스킵(이미 존재)`);
}

async function verifyResult() {
  console.log('\n=== 4. 최종 결과 확인 ===\n');

  const mappings = await prisma.healthTypeAnimalProduct.findMany({
    include: {
      product: { select: { id: true, name: true } },
      healthTypeAnimal: { select: { id: true, healthType: true, animalName: true, catchphrase: true } }
    },
    orderBy: [{ healthTypeAnimalId: 'asc' }, { type: 'asc' }, { priority: 'asc' }, { displayOrder: 'asc' }]
  });

  let currentHealth = '';
  for (const m of mappings) {
    if (m.healthTypeAnimal.healthType !== currentHealth) {
      currentHealth = m.healthTypeAnimal.healthType;
      console.log(`[${currentHealth}] ${m.healthTypeAnimal.animalName}`);
      console.log(`  Catchphrase: ${m.healthTypeAnimal.catchphrase}`);
    }
    const priorityLabel = m.priority === 1 ? '점심' : (m.priority === 2 ? '저녁' : '-');
    console.log(`  ${m.type || 'N/A'} (${priorityLabel}) - ${m.product.name}`);
  }

  console.log(`\n총 ${mappings.length}개 매핑`);
}

async function main() {
  console.log('========================================');
  console.log(' 운영 DB 맞춤솔루션 동기화 시작');
  console.log('========================================\n');

  try {
    // 1. 제품 확인
    await verifyProducts();

    // 2. Catchphrase 업데이트
    await updateCatchphrases();

    // 3. 식단 매핑 추가
    await addDietMappings();

    // 4. 결과 확인
    await verifyResult();

    console.log('\n========================================');
    console.log(' 동기화 완료!');
    console.log('========================================');
  } catch (error) {
    console.error('오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
