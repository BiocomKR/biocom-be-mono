/**
 * 맞춤솔루션(FORMULA) 상품을 HealthTypeAnimalProduct에 매핑
 * 
 * 매핑:
 * - 건강유형 1 (SKIN_HEALTH, 불여우) → 상품 48
 * - 건강유형 2 (METABOLISM, 북극곰) → 상품 49
 * - 건강유형 3 (GUT_HEALTH, 펭귄) → 상품 50
 * - 건강유형 4 (IMMUNE_BALANCE, 고슴도치) → 상품 51
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FORMULA_MAPPING = [
  { healthTypeAnimalId: 1, productId: 48, description: 'SKIN_HEALTH - 불여우' },
  { healthTypeAnimalId: 2, productId: 49, description: 'METABOLISM - 북극곰' },
  { healthTypeAnimalId: 3, productId: 50, description: 'GUT_HEALTH - 펭귄' },
  { healthTypeAnimalId: 4, productId: 51, description: 'IMMUNE_BALANCE - 고슴도치' },
];

async function main() {
  console.log('========================================');
  console.log(' FORMULA 상품 매핑 시작');
  console.log('========================================\n');

  for (const mapping of FORMULA_MAPPING) {
    // 이미 존재하는지 확인
    const existing = await prisma.healthTypeAnimalProduct.findFirst({
      where: {
        healthTypeAnimalId: mapping.healthTypeAnimalId,
        productId: mapping.productId,
      },
    });

    if (existing) {
      console.log(`[${mapping.description}] 이미 존재 (ID: ${existing.id})`);
      continue;
    }

    // 새로 생성
    const created = await prisma.healthTypeAnimalProduct.create({
      data: {
        healthTypeAnimalId: mapping.healthTypeAnimalId,
        productId: mapping.productId,
        type: 'FORMULA',
        displayOrder: 0, // 맨 앞에 표시
      },
    });

    console.log(`[${mapping.description}] 생성 완료 (ID: ${created.id})`);
  }

  console.log('\n========================================');
  console.log(' FORMULA 상품 매핑 완료!');
  console.log('========================================');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('오류 발생:', e);
  await prisma.$disconnect();
  process.exit(1);
});
