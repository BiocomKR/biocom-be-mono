const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createSupplementCoupons() {
  console.log('🎫 영양제별 10% 할인 쿠폰 생성 시작...');

  // 영양제 제품 목록 (API에서 확인된 데이터)
  const supplements = [
    { id: 11, name: '팀키토 방탄젤리 청포도맛 (15포)' },
    { id: 10, name: '썬화이버 프리바이오틱스 식이섬유 (210g)' },
    { id: 9, name: '다래케어 (180정)' },
    { id: 8, name: '풍성 밸런스 (90정)' },
    { id: 7, name: '영데이즈 저속노화 SOD효소 (15포)' },
    { id: 6, name: '뉴로 마스터 (60정)' },
    { id: 5, name: '클린 밸런스 (120정)' },
    { id: 4, name: '바이오 밸런스 (90정)' },
    { id: 1, name: '혈당관리엔 당당케어 (120정)' }
  ];

  try {
    const coupons = [];

    for (const supplement of supplements) {
      const coupon = await prisma.coupon.create({
        data: {
          name: `${supplement.name} 10% 할인쿠폰`,
          description: `${supplement.name} 구매 시 사용할 수 있는 10% 할인 쿠폰입니다.`,
          discountType: 'PERCENTAGE',
          discountValue: 10,
          maxDiscountAmount: 50000, // 최대 5만원 할인
          productId: supplement.id,
          validHours: 48, // 48시간 유효
          isActive: true
        }
      });

      coupons.push(coupon);
      console.log(`✅ 쿠폰 생성: ${coupon.name} (ID: ${coupon.id})`);
    }

    console.log(`\n🎉 총 ${coupons.length}개의 쿠폰이 생성되었습니다!`);

    // 생성된 쿠폰 목록 출력
    console.log('\n📋 생성된 쿠폰 목록:');
    coupons.forEach((coupon, index) => {
      console.log(`${index + 1}. ${coupon.name} (쿠폰 ID: ${coupon.id}, 상품 ID: ${coupon.productId})`);
    });

  } catch (error) {
    console.error('❌ 쿠폰 생성 중 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSupplementCoupons();