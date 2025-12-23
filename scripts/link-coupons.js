const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. 필요한 30% 쿠폰 생성 (없는 것만)
  const couponsToCreate = [
    { productName: '영데이즈', productId: 7, discount: 30 },
    { productName: '당당케어', productId: 1, discount: 30 },
    { productName: '클린 밸런스', productId: 5, discount: 30 },
    { productName: '뉴로 마스터', productId: 6, discount: 30 },
    { productName: '종합 대사기능 분석', productId: 32, discount: 30 },
    { productName: '풍성 밸런스', productId: 8, discount: 30 },
    { productName: '썬화이버', productId: 10, discount: 30 },
    { productName: '바이오 밸런스', productId: 4, discount: 30 },
    { productName: '리셋데이', productId: 42, discount: 30 },
    { productName: '다래케어', productId: 9, discount: 30 },
    { productName: '메타드림', productId: 41, discount: 30 },
  ];

  const createdCoupons = [];
  for (const c of couponsToCreate) {
    // 이미 30% 쿠폰이 있는지 확인
    const existing = await prisma.coupon.findFirst({
      where: { productId: c.productId, discountValue: 30 }
    });

    if (existing) {
      console.log(`이미 존재: ${c.productName} 30% 쿠폰 (ID: ${existing.id})`);
      createdCoupons.push({ ...c, couponId: existing.id });
    } else {
      const coupon = await prisma.coupon.create({
        data: {
          name: `${c.productName} 30% 할인쿠폰`,
          description: `${c.productName} 구매 시 사용할 수 있는 30% 할인 쿠폰입니다.`,
          discountType: 'PERCENTAGE',
          discountValue: 30,
          maxDiscountAmount: 100000,
          productId: c.productId,
          validHours: 48,
          isActive: true,
          createdAt: new Date()
        }
      });
      console.log(`생성: ${c.productName} 30% 쿠폰 (ID: ${coupon.id})`);
      createdCoupons.push({ ...c, couponId: coupon.id });
    }
  }

  // 2. 쿠폰-step 매핑 정의
  const couponMapping = {
    '영데이즈 30% 할인 쿠폰': 7,
    '당당케어 30% 할인 쿠폰': 1,
    '당당케어 30% 할인 받기': 1,
    '클린 밸런스 30% 할인 쿠폰': 5,
    '클린밸런스 30% 할인 쿠폰': 5,
    '뉴로마스터 30% 할인 쿠폰': 6,
    '종합 대사기능 분석 검사 30% 할인 쿠폰': 32,
    '종합 호르몬균형 분석 검사 30% 할인 쿠폰': 62,
    '풍성 밸런스 30% 할인 쿠폰': 8,
    '풍성 밸런스 30% 할인 쿠폰 받기': 8,
    '썬화이버 30% 할인 쿠폰': 10,
    '바이오 밸런스 30% 할인 쿠폰': 4,
    '리셋 데이 30% 할인 쿠폰': 42,
    '다래 케어 30% 할인 쿠폰': 9,
    '다래케어 30% 할인 쿠폰': 9,
    '메타 드림 30% 할인 쿠폰': 41,
    '메타 그림 30% 할인 쿠폰': 41, // 오타로 추정
  };

  // 3. 모든 RESULT step 조회
  const resultSteps = await prisma.balanceGameStep.findMany({
    where: { stepType: 'RESULT', isActive: true },
    select: { id: true, content: true, couponId: true }
  });

  // 4. step에 쿠폰 연결
  let updatedCount = 0;
  for (const step of resultSteps) {
    const firstLine = step.content.split('\n')[0].trim();
    const productId = couponMapping[firstLine];

    if (productId) {
      // 해당 상품의 30% 쿠폰 찾기
      const coupon = await prisma.coupon.findFirst({
        where: { productId, discountValue: 30 }
      });

      if (coupon && step.couponId !== coupon.id) {
        await prisma.balanceGameStep.update({
          where: { id: step.id },
          data: { couponId: coupon.id }
        });
        updatedCount++;
      }
    }
  }

  console.log(`\n총 ${updatedCount}개 step에 쿠폰 연결 완료`);

  // 5. 결과 확인
  const connectedSteps = await prisma.balanceGameStep.count({
    where: { stepType: 'RESULT', couponId: { not: null } }
  });
  const totalResultSteps = await prisma.balanceGameStep.count({
    where: { stepType: 'RESULT', isActive: true }
  });

  console.log(`\n쿠폰 연결된 RESULT step: ${connectedSteps}/${totalResultSteps}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
