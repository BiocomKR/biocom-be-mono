import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * point_histories 테이블의 type 컬럼에서 'EARN'을 'EARNED'로 통일
 *
 * 실행 방법:
 * npx ts-node prisma/operation/migrate-earn-to-earned.ts
 */
async function main() {
  console.log('=== EARN → EARNED 마이그레이션 시작 ===\n');

  // 현재 EARN 개수 확인
  const earnCount = await prisma.pointHistory.count({
    where: { type: 'EARN' },
  });

  const earnedCount = await prisma.pointHistory.count({
    where: { type: 'EARNED' },
  });

  console.log(`변경 전 현황:`);
  console.log(`  - EARN: ${earnCount}건`);
  console.log(`  - EARNED: ${earnedCount}건`);
  console.log('');

  if (earnCount === 0) {
    console.log('✅ 변경할 EARN 데이터가 없습니다.');
    return;
  }

  // EARN → EARNED 업데이트
  const result = await prisma.pointHistory.updateMany({
    where: { type: 'EARN' },
    data: { type: 'EARNED' },
  });

  console.log(`✅ ${result.count}건 변경 완료 (EARN → EARNED)`);

  // 변경 후 확인
  const afterEarnCount = await prisma.pointHistory.count({
    where: { type: 'EARN' },
  });

  const afterEarnedCount = await prisma.pointHistory.count({
    where: { type: 'EARNED' },
  });

  console.log('');
  console.log(`변경 후 현황:`);
  console.log(`  - EARN: ${afterEarnCount}건`);
  console.log(`  - EARNED: ${afterEarnedCount}건`);
}

main()
  .catch((e) => {
    console.error('마이그레이션 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
