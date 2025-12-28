/**
 * IMMUNE_BALANCE(고슴도치) DIET 매핑 수정 스크립트
 *
 * 문서 기준:
 * - 1순위: 저포드맵(LOW_FODMAP)
 * - 2순위: 저속노화(SLOW_AGING)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const IMMUNE_BALANCE_ID = 4; // 고슴도치

  console.log('=== IMMUNE_BALANCE(고슴도치) DIET 매핑 수정 ===\n');

  // 1. 현재 DIET 매핑 확인
  const currentDietMappings = await prisma.healthTypeAnimalProduct.findMany({
    where: {
      healthTypeAnimalId: IMMUNE_BALANCE_ID,
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

  // 2. 기존 DIET 매핑 전체 삭제
  await prisma.healthTypeAnimalProduct.deleteMany({
    where: {
      healthTypeAnimalId: IMMUNE_BALANCE_ID,
      type: 'DIET'
    }
  });
  console.log('\n기존 DIET 매핑 전체 삭제 완료');

  // 3. 저포드맵 상품 (1순위)
  const lowFodmapProducts = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      lineup: { key: 'LOW_FODMAP' }
    },
    select: { id: true, name: true }
  });

  // 4. 저속노화 상품 (2순위)
  const slowAgingProducts = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      lineup: { key: 'SLOW_AGING' }
    },
    select: { id: true, name: true }
  });

  console.log(`\n저포드맵 상품: ${lowFodmapProducts.length}개`);
  console.log(`저속노화 상품: ${slowAgingProducts.length}개`);

  // 5. 해당 healthTypeAnimal의 최대 displayOrder 확인 (모든 type 포함)
  const maxOrder = await prisma.healthTypeAnimalProduct.aggregate({
    where: { healthTypeAnimalId: IMMUNE_BALANCE_ID },
    _max: { displayOrder: true }
  });

  let order = (maxOrder._max.displayOrder || 0) + 1;
  console.log(`시작 displayOrder: ${order}`);

  // 6. 저포드맵 매핑 (1순위)
  console.log('\n저포드맵 매핑 (1순위):');
  for (const product of lowFodmapProducts) {
    await prisma.healthTypeAnimalProduct.create({
      data: {
        healthTypeAnimalId: IMMUNE_BALANCE_ID,
        productId: product.id,
        type: 'DIET',
        displayOrder: order
      }
    });
    console.log(`  추가: ID ${product.id} - ${product.name} (order: ${order})`);
    order++;
  }

  // 7. 저속노화 매핑 (2순위)
  console.log('\n저속노화 매핑 (2순위):');
  for (const product of slowAgingProducts) {
    await prisma.healthTypeAnimalProduct.create({
      data: {
        healthTypeAnimalId: IMMUNE_BALANCE_ID,
        productId: product.id,
        type: 'DIET',
        displayOrder: order
      }
    });
    console.log(`  추가: ID ${product.id} - ${product.name} (order: ${order})`);
    order++;
  }

  console.log(`\n총 ${lowFodmapProducts.length + slowAgingProducts.length}개 DIET 매핑 완료`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('오류:', e);
  await prisma.$disconnect();
  process.exit(1);
});
