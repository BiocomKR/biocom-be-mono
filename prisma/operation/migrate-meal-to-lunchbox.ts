import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * MEAL → LUNCHBOX categoryCode 마이그레이션
 *
 * 실행 방법:
 * npx ts-node prisma/operation/migrate-meal-to-lunchbox.ts
 */
async function main() {
  console.log('🔄 MEAL → LUNCHBOX 마이그레이션 시작...\n');

  // 현재 MEAL 상품 수 확인
  const mealCount = await prisma.product.count({
    where: { categoryCode: 'MEAL' },
  });
  console.log(`📊 기존 MEAL 상품 수: ${mealCount}개`);

  if (mealCount === 0) {
    console.log('✅ 마이그레이션할 MEAL 상품이 없습니다.');
    return;
  }

  // categoryCode 변경
  const result = await prisma.product.updateMany({
    where: { categoryCode: 'MEAL' },
    data: { categoryCode: 'LUNCHBOX' },
  });

  console.log(`✅ ${result.count}개 상품의 categoryCode를 LUNCHBOX로 변경 완료!`);

  // 결과 확인
  const lunchboxCount = await prisma.product.count({
    where: { categoryCode: 'LUNCHBOX' },
  });
  console.log(`📊 현재 LUNCHBOX 상품 수: ${lunchboxCount}개`);
}

main()
  .catch((e) => {
    console.error('마이그레이션 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
