/**
 * SKIN_HEALTH(불여우) DIET 매핑 추가 스크립트
 *
 * 문서 기준:
 * - 1순위: 저속노화(SLOW_AGING)
 * - 2순위: 저포드맵(LOW_FODMAP)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const SKIN_HEALTH_ID = 1; // 불여우

  console.log('=== SKIN_HEALTH(불여우) DIET 매핑 추가 ===\n');

  // 저속노화 상품 (1순위)
  const slowAgingProducts = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      lineup: { key: 'SLOW_AGING' }
    },
    select: { id: true, name: true }
  });

  // 저포드맵 상품 (2순위)
  const lowFodmapProducts = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      lineup: { key: 'LOW_FODMAP' }
    },
    select: { id: true, name: true }
  });

  console.log(`저속노화 상품: ${slowAgingProducts.length}개`);
  console.log(`저포드맵 상품: ${lowFodmapProducts.length}개\n`);

  // 기존 SKIN_HEALTH 매핑의 최대 displayOrder 확인
  const maxOrder = await prisma.healthTypeAnimalProduct.aggregate({
    where: { healthTypeAnimalId: SKIN_HEALTH_ID },
    _max: { displayOrder: true }
  });

  let order = (maxOrder._max.displayOrder || 0) + 1;
  console.log(`시작 displayOrder: ${order}\n`);

  // 저속노화 매핑 (1순위)
  for (const product of slowAgingProducts) {
    // 기존 매핑 확인
    const existing = await prisma.healthTypeAnimalProduct.findFirst({
      where: {
        healthTypeAnimalId: SKIN_HEALTH_ID,
        productId: product.id,
        type: 'DIET'
      }
    });

    if (existing) {
      await prisma.healthTypeAnimalProduct.update({
        where: { id: existing.id },
        data: { displayOrder: order }
      });
    } else {
      await prisma.healthTypeAnimalProduct.create({
        data: {
          healthTypeAnimalId: SKIN_HEALTH_ID,
          productId: product.id,
          type: 'DIET',
          displayOrder: order
        }
      });
    }
    console.log(`추가: ID ${product.id} - ${product.name} (order: ${order})`);
    order++;
  }

  // 저포드맵 매핑 (2순위)
  for (const product of lowFodmapProducts) {
    const existing = await prisma.healthTypeAnimalProduct.findFirst({
      where: {
        healthTypeAnimalId: SKIN_HEALTH_ID,
        productId: product.id,
        type: 'DIET'
      }
    });

    if (existing) {
      await prisma.healthTypeAnimalProduct.update({
        where: { id: existing.id },
        data: { displayOrder: order }
      });
    } else {
      await prisma.healthTypeAnimalProduct.create({
        data: {
          healthTypeAnimalId: SKIN_HEALTH_ID,
          productId: product.id,
          type: 'DIET',
          displayOrder: order
        }
      });
    }
    console.log(`추가: ID ${product.id} - ${product.name} (order: ${order})`);
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
