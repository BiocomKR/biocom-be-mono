import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const coupons = await prisma.coupon.findMany({
    select: {
      id: true,
      name: true,
      imageUrl: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  console.log('\n=== 쿠폰 목록 ===\n');
  console.table(coupons);
  console.log(`\n총 ${coupons.length}개의 쿠폰이 조회되었습니다.\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
