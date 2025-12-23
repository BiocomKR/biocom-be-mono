import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 검사 상품 (HEALTH_CHECK 카테고리) 시드 데이터
 * 운영 인프라 구축 후 초기 데이터 심기용
 */
const healthCheckProducts = [
  {
    sku: 'HC_FOOD_INTOLERANCE',
    name: '음식물 과민증 분석',
    description: '90종 음식물에 대한 IgG 항체 검사를 통해 음식물 과민증을 분석합니다.',
    categoryCode: 'HEALTH_CHECK',
    categoryName: '건강검진',
    originalPrice: 350000,
    price: 260000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20241106/3e7d61161bfa3.png',
  },
  {
    sku: 'HC_NUTRITION_HEAVY_METAL',
    name: '영양 중금속 분석',
    description: '모발 검사를 통해 영양소와 중금속 수치를 분석합니다.',
    categoryCode: 'HEALTH_CHECK',
    categoryName: '건강검진',
    originalPrice: 180000,
    price: 109000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20241106/526aa0988f333.png',
  },
  {
    sku: 'HC_GUT_BACTERIA',
    name: '장내세균 분석',
    description: '장내 미생물 균형을 분석하여 장 건강 상태를 확인합니다.',
    categoryCode: 'HEALTH_CHECK',
    categoryName: '건강검진',
    originalPrice: 300000,
    price: 169000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20241004/b4a6b8cfe8e70.png',
  },
  {
    sku: 'HC_STRESS_AGING',
    name: '스트레스 노화 분석',
    description: '스트레스 호르몬과 노화 지표를 분석합니다.',
    categoryCode: 'HEALTH_CHECK',
    categoryName: '건강검진',
    originalPrice: 220000,
    price: 159000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20241004/674a75f1a1cba.png',
  },
  {
    sku: 'HC_HORMONE_BALANCE',
    name: '종합 호르몬균형 분석',
    description: '주요 호르몬 균형 상태를 종합적으로 분석합니다.',
    categoryCode: 'HEALTH_CHECK',
    categoryName: '건강검진',
    originalPrice: 340000,
    price: 249000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20241105/961476b6413cf.png',
  },
  {
    sku: 'HC_METABOLISM',
    name: '종합 대사기능 분석',
    description: '유기산 검사를 통해 대사 기능 상태를 종합적으로 분석합니다.',
    categoryCode: 'HEALTH_CHECK',
    categoryName: '건강검진',
    originalPrice: 450000,
    price: 298000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20241118/2b7ed31e38587.jpg',
  },
];

async function main() {
  console.log('검사 상품 시드 시작...');

  for (const product of healthCheckProducts) {
    const existing = await prisma.product.findFirst({
      where: { sku: product.sku },
    });

    const now = new Date();

    if (existing) {
      // 기존 데이터 업데이트
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: product.name,
          description: product.description,
          categoryCode: product.categoryCode,
          categoryName: product.categoryName,
          originalPrice: product.originalPrice,
          price: product.price,
          status: 'ACTIVE',
          updatedAt: now,
        },
      });
      console.log(`✅ 업데이트: ${product.name} (SKU: ${product.sku})`);
    } else {
      // 신규 생성
      const createdProduct = await prisma.product.create({
        data: {
          sku: product.sku,
          name: product.name,
          description: product.description,
          categoryCode: product.categoryCode,
          categoryName: product.categoryName,
          originalPrice: product.originalPrice,
          price: product.price,
          status: 'ACTIVE',
          productType: 'SINGLE',
          shippingPolicy: 'FREE', // 검사 상품은 배송 없음
          shippingFee: 0,
          createdAt: now,
        },
      });
      console.log(`✅ 생성: ${product.name} (ID: ${createdProduct.id}, SKU: ${product.sku})`);

      // 이미지 파일 등록 (File 및 ProductFile 생성)
      // 먼저 File 레코드 생성
      const file = await prisma.file.create({
        data: {
          storedName: `${product.sku}-main.png`,
          originalName: `${product.name} 메인 이미지`,
          mimeType: 'image/png',
          fileSize: 0, // 외부 URL이므로 0
          filePath: product.imageUrl,
          storageType: 'EXTERNAL',
        },
      });

      // ProductFile 연결
      await prisma.productFile.create({
        data: {
          productId: createdProduct.id,
          fileId: file.id,
          imageType: 'MAIN',
          sortOrder: 0,
          createdAt: now,
          altText: product.name,
        },
      });
      console.log(`  📷 이미지 등록 완료: ${product.imageUrl}`);
    }
  }

  console.log('\n검사 상품 시드 완료!');
  console.log(`총 ${healthCheckProducts.length}개 상품 처리됨`);
}

main()
  .catch((e) => {
    console.error('시드 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
