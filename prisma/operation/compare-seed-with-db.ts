import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 시드 파일과 현재 DB 데이터 비교
 *
 * 실행 방법:
 * npx ts-node prisma/operation/compare-seed-with-db.ts
 */

async function main() {
  console.log('🔍 시드 파일 vs DB 데이터 비교 시작...\n');

  // 1. health_type_animal_products 조회
  console.log('=== health_type_animal_products 현황 ===\n');

  const animals = await prisma.healthTypeAnimal.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, healthType: true, animalName: true },
  });

  for (const animal of animals) {
    console.log(`\n📌 ${animal.animalName} (ID: ${animal.id}, ${animal.healthType})`);

    const products = await prisma.healthTypeAnimalProduct.findMany({
      where: { healthTypeAnimalId: animal.id },
      orderBy: [{ type: 'asc' }, { displayOrder: 'asc' }],
      include: {
        product: { select: { id: true, name: true, status: true, categoryCode: true } },
      },
    });

    if (products.length === 0) {
      console.log('   (등록된 상품 없음)');
      continue;
    }

    // 타입별 그룹핑
    const byType: Record<string, typeof products> = {};
    products.forEach((p) => {
      if (!byType[p.type]) byType[p.type] = [];
      byType[p.type].push(p);
    });

    for (const [type, items] of Object.entries(byType)) {
      console.log(`\n   [${type}]`);
      items.forEach((item) => {
        const status = item.product.status === 'ACTIVE' ? '✅' : '❌';
        console.log(
          `   ${status} ID:${item.productId} | ${item.product.name} | priority:${item.priority} | order:${item.displayOrder} | keyword:${item.keyword}`,
        );
      });
    }
  }

  // 2. 시드 파일에 있는 구버전 ID가 DB에 있는지 확인
  console.log('\n\n=== 시드 파일 내 구버전 ID(16,19,21,22) DB 존재 여부 ===\n');
  const oldIds = [16, 19, 21, 22];
  const oldProducts = await prisma.product.findMany({
    where: { id: { in: oldIds } },
    select: { id: true, name: true, status: true, categoryCode: true },
  });

  if (oldProducts.length === 0) {
    console.log('✅ 구버전 상품(16,19,21,22) 모두 DB에 없음 - 이미 마이그레이션됨');
  } else {
    console.log('⚠️  구버전 상품이 아직 DB에 존재:');
    oldProducts.forEach((p) => {
      console.log(`   ID:${p.id} | ${p.name} | ${p.status} | ${p.categoryCode}`);
    });
  }

  // 3. 신버전 ID 확인
  console.log('\n=== 신버전 ID(66,68,70,71) DB 존재 여부 ===\n');
  const newIds = [66, 68, 70, 71];
  const newProducts = await prisma.product.findMany({
    where: { id: { in: newIds } },
    select: { id: true, name: true, status: true, categoryCode: true },
  });

  newProducts.forEach((p) => {
    const status = p.status === 'ACTIVE' ? '✅' : '❌';
    console.log(`${status} ID:${p.id} | ${p.name} | ${p.status} | ${p.categoryCode}`);
  });

  // 4. health_type_animal_products에서 구버전 ID 참조 확인
  console.log('\n=== health_type_animal_products에서 구버전 ID 참조 ===\n');
  const oldRefs = await prisma.healthTypeAnimalProduct.findMany({
    where: { productId: { in: oldIds } },
  });

  if (oldRefs.length === 0) {
    console.log('✅ 구버전 ID 참조 없음');
  } else {
    console.log('⚠️  구버전 ID가 아직 참조됨:');
    oldRefs.forEach((r) => {
      console.log(`   Animal:${r.healthTypeAnimalId} → Product:${r.productId}`);
    });
  }

  // 5. LUNCHBOX 전체 상품 목록
  console.log('\n=== LUNCHBOX 전체 상품 목록 ===\n');
  const lunchboxProducts = await prisma.product.findMany({
    where: { categoryCode: 'LUNCHBOX' },
    orderBy: { id: 'asc' },
    select: { id: true, name: true, status: true, sku: true },
  });

  lunchboxProducts.forEach((p) => {
    const status = p.status === 'ACTIVE' ? '✅' : '❌';
    console.log(`${status} ID:${p.id} | ${p.sku} | ${p.name}`);
  });

  console.log(`\n총 ${lunchboxProducts.length}개`);

  console.log('\n🎉 비교 완료!');
}

main()
  .catch((e) => {
    console.error('비교 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
