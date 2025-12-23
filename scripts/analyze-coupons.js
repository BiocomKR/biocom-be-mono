const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // RESULT step들의 content 확인
  const resultSteps = await prisma.balanceGameStep.findMany({
    where: { stepType: 'RESULT', isActive: true },
    select: { id: true, content: true, couponId: true }
  });

  console.log('=== RESULT step content 분석 ===');
  const contentMap = new Map();
  resultSteps.forEach(step => {
    // content에서 쿠폰명 추출 (첫 줄)
    const firstLine = step.content.split('\n')[0].trim();
    if (!contentMap.has(firstLine)) {
      contentMap.set(firstLine, []);
    }
    contentMap.get(firstLine).push(step.id);
  });

  contentMap.forEach((ids, content) => {
    console.log('\n쿠폰명:', content);
    console.log('step IDs:', ids.join(', '));
  });

  // 현재 쿠폰 목록
  console.log('\n\n=== 현재 쿠폰 목록 ===');
  const coupons = await prisma.coupon.findMany({
    include: { product: { select: { name: true } } }
  });
  coupons.forEach(c => {
    console.log('ID:', c.id, '| 상품:', c.product.name, '| 할인:', c.discountValue + '%');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
