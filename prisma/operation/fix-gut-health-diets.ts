/**
 * GUT_HEALTH(펭귄) DIET 매핑 수정 스크립트
 *
 * 문서 기준:
 * - 1순위: 저포드맵(LOW_FODMAP)
 * - 2순위: 오리지널(ORIGINAL)
 *
 * 수정 내용:
 * - 잘못된 매핑 삭제 (영양제/챌린지 상품이 DIET로 매핑됨)
 * - 올바른 식단 상품 매핑 추가
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const GUT_HEALTH_ID = 3; // 펭귄

  console.log('=== GUT_HEALTH(펭귄) DIET 매핑 수정 ===\n');

  // 1. 현재 DIET 매핑 확인
  const currentDietMappings = await prisma.healthTypeAnimalProduct.findMany({
    where: {
      healthTypeAnimalId: GUT_HEALTH_ID,
      type: 'DIET'
    },
    include: {
      product: {
        select: { id: true, name: true, lineup: { select: { key: true } } }
      }
    }
  });

  console.log('현재 DIET 매핑:');
  for (const m of currentDietMappings) {
    console.log(`  ID ${m.product.id}: ${m.product.name} (lineup: ${m.product.lineup?.key || 'NONE'})`);
  }

  // 2. 잘못된 매핑 삭제 (lineup이 없거나 식단 라인업이 아닌 상품)
  const validLineups = ['LOW_FODMAP', 'ORIGINAL', 'SIGNATURE', 'SLOW_AGING'];
  const wrongMappings = currentDietMappings.filter(
    m => !m.product.lineup || !validLineups.includes(m.product.lineup.key)
  );

  if (wrongMappings.length > 0) {
    console.log('\n잘못된 매핑 삭제:');
    for (const m of wrongMappings) {
      await prisma.healthTypeAnimalProduct.delete({ where: { id: m.id } });
      console.log(`  삭제: ID ${m.product.id} - ${m.product.name}`);
    }
  }

  // 3. 저포드맵 상품 (1순위)
  const lowFodmapProducts = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      lineup: { key: 'LOW_FODMAP' }
    },
    select: { id: true, name: true }
  });

  // 4. 오리지널 상품 (2순위)
  const originalProducts = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      lineup: { key: 'ORIGINAL' }
    },
    select: { id: true, name: true }
  });

  console.log(`\n저포드맵 상품: ${lowFodmapProducts.length}개`);
  console.log(`오리지널 상품: ${originalProducts.length}개`);

  // 5. 기존 올바른 DIET 매핑 삭제 후 재생성 (displayOrder 정리를 위해)
  await prisma.healthTypeAnimalProduct.deleteMany({
    where: {
      healthTypeAnimalId: GUT_HEALTH_ID,
      type: 'DIET'
    }
  });
  console.log('\n기존 DIET 매핑 전체 삭제 후 재생성...');

  // 해당 healthTypeAnimal의 최대 displayOrder 확인 (모든 type 포함)
  const maxOrder = await prisma.healthTypeAnimalProduct.aggregate({
    where: { healthTypeAnimalId: GUT_HEALTH_ID },
    _max: { displayOrder: true }
  });

  let order = (maxOrder._max.displayOrder || 0) + 1;
  console.log(`시작 displayOrder: ${order}`);

  // 6. 저포드맵 매핑 (1순위)
  console.log('\n저포드맵 매핑 (1순위):');
  for (const product of lowFodmapProducts) {
    await prisma.healthTypeAnimalProduct.create({
      data: {
        healthTypeAnimalId: GUT_HEALTH_ID,
        productId: product.id,
        type: 'DIET',
        displayOrder: order
      }
    });
    console.log(`  추가: ID ${product.id} - ${product.name} (order: ${order})`);
    order++;
  }

  // 7. 오리지널 매핑 (2순위)
  console.log('\n오리지널 매핑 (2순위):');
  for (const product of originalProducts) {
    await prisma.healthTypeAnimalProduct.create({
      data: {
        healthTypeAnimalId: GUT_HEALTH_ID,
        productId: product.id,
        type: 'DIET',
        displayOrder: order
      }
    });
    console.log(`  추가: ID ${product.id} - ${product.name} (order: ${order})`);
    order++;
  }

  console.log(`\n총 ${order - 1}개 DIET 매핑 완료`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('오류:', e);
  await prisma.$disconnect();
  process.exit(1);
});
