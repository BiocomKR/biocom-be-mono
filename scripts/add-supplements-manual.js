const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 영양제 데이터 하드코딩
const supplements = [
  {
    name: '혈당관리엔 당당케어 (120정)',
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250811/55e61c543e739.png',
    originalPrice: 100000,
    salePrice: 59800,
    description: '혈당 CUT, 슬림한 관리',
    dosageInfo: {
      frequency_per_day: 2,
      quantity_per_dose: 2,
      unit: '정',
      duration: 30,
      special_notes: '충분한 물과 함께 복용'
    }
  },
  {
    name: '바이오 밸런스 (90정)',
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250513/ab48319cb442b.jpg',
    originalPrice: 60000,
    salePrice: 39000,
    description: '종합미네랄, 바이오밸런스',
    dosageInfo: {
      frequency_per_day: 1,
      quantity_per_dose: 3,
      unit: '정',
      duration: 30,
      special_notes: '충분한 물과 함께 복용'
    }
  },
  {
    name: '클린 밸런스 (120정)',
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/ec936ed23a7f9.png',
    originalPrice: 75000,
    salePrice: 49000,
    description: '피부영양제, 클린밸런스',
    dosageInfo: {
      frequency_per_day: 2,
      quantity_per_dose: 2,
      unit: '정',
      duration: 30,
      special_notes: '충분한 물과 함께 복용'
    }
  },
  {
    name: '뉴로 마스터 (60정)',
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250513/e54bd866b9186.jpg',
    originalPrice: 60000,
    salePrice: 35000,
    description: '은행잎요오드, 뉴로마스터',
    dosageInfo: {
      frequency_per_day: 1,
      quantity_per_dose: 2,
      unit: '정',
      duration: 30,
      special_notes: '충분한 물과 함께 복용'
    }
  },
  {
    name: '영데이즈 저속노화 SOD효소 (15포)',
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250415/afad64e84f0c7.png',
    originalPrice: 45000,
    salePrice: 36000,
    description: '하루 한 포, 맛있게 항산화!',
    dosageInfo: {
      frequency_per_day: 1,
      quantity_per_dose: 1,
      unit: '포',
      duration: 15,
      special_notes: '충분한 물과 함께 복용'
    }
  },
  {
    name: '풍성 밸런스 (90정)',
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/ccd30caf7ae87.png',
    originalPrice: 65000,
    salePrice: 35000,
    description: '비오틴영양제, 풍성밸런스',
    dosageInfo: {
      frequency_per_day: 1,
      quantity_per_dose: 3,
      unit: '정',
      duration: 30,
      special_notes: '충분한 물과 함께 복용'
    }
  },
  {
    name: '다래케어 (180정)',
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/09d1891ba199c.png',
    originalPrice: 120000,
    salePrice: 68400,
    description: '면역 과민반응엔 다래케어',
    dosageInfo: {
      frequency_per_day: 2,
      quantity_per_dose: 3,
      unit: '정',
      duration: 30,
      special_notes: '충분한 물과 함께 복용'
    }
  },
  {
    name: '썬화이버 프리바이오틱스 식이섬유 (210g)',
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250814/0b6f0ad4a9b03.png',
    originalPrice: 57000,
    salePrice: 36000,
    description: '1일 1스푼으로 챙기는 장 건강',
    dosageInfo: {
      frequency_per_day: 1,
      quantity_per_dose: 7,
      unit: 'g',
      duration: 30,
      special_notes: '충분한 물과 함께 복용'
    }
  },
  {
    name: '팀키토 방탄젤리 청포도맛 (15포)',
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250430/d37b234c0db50.png',
    originalPrice: 30000,
    salePrice: 22900,
    description: '식후 혈당이 걱정이라면?',
    dosageInfo: {
      frequency_per_day: 1,
      quantity_per_dose: 1,
      unit: '포',
      duration: 15,
      special_notes: '식후 섭취 권장'
    }
  }
];

async function main() {
  try {
    console.log('🚀 영양제 데이터 추가 시작...');

    // 1. 영양제 카테고리 확인/생성
    let healthFoodCategory = await prisma.category.findFirst({
      where: { slug: 'health-food' }
    });

    if (!healthFoodCategory) {
      console.log('📂 영양제 카테고리 생성 중...');
      healthFoodCategory = await prisma.category.create({
        data: {
          name: '영양제',
          slug: 'health-food',
          path: '/health-food/',
          depth: 0,
          sortOrder: 1,
          isActive: true,
        }
      });
      console.log('✅ 영양제 카테고리 생성 완료:', healthFoodCategory.id);
    } else {
      console.log('✅ 영양제 카테고리 존재:', healthFoodCategory.id);
    }

    console.log(`📊 총 ${supplements.length}개의 영양제 데이터 처리`);

    // 2. 각 영양제 데이터 처리
    for (let i = 0; i < supplements.length; i++) {
      const supplement = supplements[i];

      console.log(`\n🔄 ${i + 1}. "${supplement.name}" 처리 중...`);

      // 중복 상품 확인
      const existingProduct = await prisma.product.findFirst({
        where: { name: supplement.name }
      });

      if (existingProduct) {
        console.log(`   ⚠️  이미 존재하는 상품입니다. 스킵.`);
        continue;
      }

      // SKU 생성 - 기존 SKU 중복 체크해서 유니크한 번호 생성
      let sku;
      let skuNum = i + 1;
      do {
        sku = `SUPP_${String(skuNum).padStart(3, '0')}`;
        const existingSku = await prisma.product.findFirst({
          where: { sku: sku }
        });
        if (!existingSku) break;
        skuNum++;
      } while (true);

      // 상품 생성
      const product = await prisma.product.create({
        data: {
          sku: sku,
          categoryId: healthFoodCategory.id,
          name: supplement.name,
          slug: supplement.name.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9\-가-힣]/g, '')
            .replace(/\-+/g, '-'),
          description: supplement.description,
          productType: 'SINGLE',
          productInfo: supplement.dosageInfo,
          status: 'ACTIVE',
          isFeatured: false,
          viewCount: 0,
        }
      });

      console.log(`   ✅ 상품 생성 완료: ID ${product.id}, SKU: ${sku}`);

      // 상품 옵션 생성 (단일 옵션)
      const optionSku = `${sku}_DEFAULT`;
      await prisma.productOption.create({
        data: {
          productId: product.id,
          sku: optionSku,
          optionName: '기본',
          optionValue: '1개',
          price: supplement.salePrice,
          maxOrderQty: 10,
          isActive: true,
          sortOrder: 1,
        }
      });

      console.log(`   ✅ 상품 옵션 생성 완료: ${optionSku}, 가격: ${supplement.salePrice}원`);

      // 상품 이미지 추가
      if (supplement.imageUrl) {
        await prisma.productImage.create({
          data: {
            productId: product.id,
            imageUrl: supplement.imageUrl,
            imageType: 'MAIN',
            sortOrder: 1,
            altText: supplement.name,
          }
        });
        console.log(`   ✅ 상품 이미지 추가 완료`);
      }
    }

    console.log('\n🎉 모든 영양제 데이터 추가 완료!');

    // 결과 확인
    const totalProducts = await prisma.product.count({
      where: { categoryId: healthFoodCategory.id }
    });
    console.log(`📊 총 ${totalProducts}개의 영양제 상품이 등록되었습니다.`);

  } catch (error) {
    console.error('❌ 에러 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();