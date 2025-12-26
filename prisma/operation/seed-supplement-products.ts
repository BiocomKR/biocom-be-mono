import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 영양제 상품 (SUPPLEMENT 카테고리) 시드 데이터
 * 운영 인프라 구축 후 초기 데이터 심기용
 *
 * TODO: imageUrl을 GCS webp 변환 후 교체 필요
 */
const supplementProducts = [
  {
    sku: 'SUPP_RESET_DAY',
    name: '리셋데이 글루텐분해효소 알파CD 차전자피 K-낙산균',
    description: '글루텐분해효소, 알파CD, 차전자피, K-낙산균이 함유된 장 건강 영양제',
    categoryCode: 'SUPPLEMENT',
    categoryName: '영양제',
    originalPrice: 36000,
    price: 24900,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251215/f970b6d8ea55a.png',
  },
  {
    sku: 'SUPP_CLEAN_INNERBEAUTY_SET',
    name: '클린 이너뷰티 SET',
    description: '클린밸런스 1개 + 영데이즈 2개 세트',
    categoryCode: 'SUPPLEMENT',
    categoryName: '영양제',
    originalPrice: 165000,
    price: 99900,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251208/da71fdb22b5c8.jpg',
    productType: 'SET',
  },
  {
    sku: 'SUPP_SCALP_WINTER_SET',
    name: '두피 월동 준비 SET',
    description: '바이오밸런스 1개 + 풍성밸런스 1개 세트',
    categoryCode: 'SUPPLEMENT',
    categoryName: '영양제',
    originalPrice: 125000,
    price: 59900,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251128/2841cea4c4889.jpg',
    productType: 'SET',
  },
  {
    sku: 'SUPP_METADREAM',
    name: '메타드림 식물성 멜라토닌 함유',
    description: '식물성 멜라토닌 3mg, 테아닌, 마그네슘, 트립토판 함유 수면 영양제',
    categoryCode: 'SUPPLEMENT',
    categoryName: '영양제',
    originalPrice: 46000,
    price: 36900,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/45de9ba884bb6.jpg',
  },
  {
    sku: 'SUPP_DANGDANG_CARE',
    name: '혈당관리엔 당당케어 (120정)',
    description: '바나바잎 추출물, 가르시니아, 비타민B 함유 혈당 관리 영양제',
    categoryCode: 'SUPPLEMENT',
    categoryName: '영양제',
    originalPrice: 100000,
    price: 59800,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/b256d7483c699.png',
  },
  {
    sku: 'SUPP_BIO_BALANCE',
    name: '바이오밸런스 90정 (1개월분)',
    description: '마그네슘, 아연, 셀레늄, 망간 함유 피로회복 미네랄 영양제',
    categoryCode: 'SUPPLEMENT',
    categoryName: '영양제',
    originalPrice: 60000,
    price: 39000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/ded5eb6d3f7b7.jpg',
  },
  {
    sku: 'SUPP_CLEAN_BALANCE',
    name: '클린밸런스 120정 (1개월분)',
    description: '이너뷰티 영양제, 피부 비타민, 탄력, 클로렐라, 활성엽산 함유',
    categoryCode: 'SUPPLEMENT',
    categoryName: '영양제',
    originalPrice: 75000,
    price: 49000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/9afbfce20eec4.png',
  },
  {
    sku: 'SUPP_NEURO_MASTER',
    name: '뉴로마스터 60정 (1개월분)',
    description: '은행잎추출물, 요오드 함유 혈행 기억력 건망증 개선 영양제',
    categoryCode: 'SUPPLEMENT',
    categoryName: '영양제',
    originalPrice: 60000,
    price: 35000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/d2775c537a432.jpg',
  },
  {
    sku: 'SUPP_YOUNG_DAYS',
    name: '영데이즈 저속노화 SOD 효소 (15포)',
    description: '저속노화 SOD 효소, 리포좀 글루타치온 함유 항산화 영양제',
    categoryCode: 'SUPPLEMENT',
    categoryName: '영양제',
    originalPrice: 45000,
    price: 36000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/4937b7fd04ec2.png',
  },
  {
    sku: 'SUPP_PUNGSUNG_BALANCE',
    name: '풍성밸런스 90정 (1개월분)',
    description: '비오틴, 맥주효모, 엘시스테인 함유 모발 건강 영양제',
    categoryCode: 'SUPPLEMENT',
    categoryName: '영양제',
    originalPrice: 65000,
    price: 35000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/020f9605eda21.png',
  },
  {
    sku: 'SUPP_DARAE_CARE',
    name: '다래케어 180정 (1개월분)',
    description: '다래추출물 함유 면역력 과민 반응 케어 영양제',
    categoryCode: 'SUPPLEMENT',
    categoryName: '영양제',
    originalPrice: 120000,
    price: 68400,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251201/27b5849bec8fb.png',
  },
  {
    sku: 'SUPP_SUN_FIBER',
    name: '썬화이버 프리바이오틱스 식이섬유 210g',
    description: '구아검가수분해물 함유 저포드맵 프리바이오틱스 식이섬유',
    categoryCode: 'SUPPLEMENT',
    categoryName: '영양제',
    originalPrice: 57000,
    price: 36000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20251218/ab99a04e1c54b.jpg',
  },
  {
    sku: 'SUPP_BANGTAN_JELLY',
    name: '팀키토 방탄젤리 청포도맛 30g 15포',
    description: '식이섬유 무설탕 젤리',
    categoryCode: 'SUPPLEMENT',
    categoryName: '영양제',
    originalPrice: 30000,
    price: 22900,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250430/fe6e1b4804b95.png',
  },
];

async function main() {
  console.log('영양제 상품 시드 시작...\n');

  let created = 0;
  let updated = 0;

  for (const product of supplementProducts) {
    const existing = await prisma.product.findFirst({
      where: { sku: product.sku },
    });

    const now = new Date();
    const productType = product.productType || 'SINGLE';

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
          productType,
          status: 'ACTIVE',
          updatedAt: now,
        },
      });
      console.log(`✅ 업데이트: ${product.name} (SKU: ${product.sku})`);
      updated++;
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
          productType,
          status: 'ACTIVE',
          shippingPolicy: 'CONDITIONAL',
          shippingFee: 3000,
          createdAt: now,
        },
      });
      console.log(`✅ 생성: ${product.name} (ID: ${createdProduct.id}, SKU: ${product.sku})`);

      // 이미지 파일 등록 (File 및 ProductFile 생성)
      const file = await prisma.file.create({
        data: {
          storedName: `${product.sku}_main.png`,
          originalName: `${product.name} 메인 이미지`,
          mimeType: 'image/png',
          fileSize: 0,
          filePath: product.imageUrl,
          storageType: 'EXTERNAL',
        },
      });

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
      console.log(`   📷 이미지 등록: ${product.imageUrl}`);
      created++;
    }
  }

  console.log('\n영양제 상품 시드 완료!');
  console.log(`생성: ${created}개, 업데이트: ${updated}개`);
}

main()
  .catch((e) => {
    console.error('시드 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
