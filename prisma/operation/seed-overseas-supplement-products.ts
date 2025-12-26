import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 해외직구 영양제 상품 (OVERSEASUPPLEMENT 카테고리) 시드 데이터
 * 다빈치랩 제품군
 *
 * TODO: imageUrl을 GCS webp 변환 후 교체 필요
 */
const overseasSupplementProducts = [
  {
    sku: 'DVL_GLUTATHIONE',
    name: '다빈치랩 글루타치온 (Glutathione) 30일분',
    description: '글루타치온 항산화 영양제',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 99000,
    price: 49000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/02e98f6a8d00d.png',
  },
  {
    sku: 'DVL_SYNC_UP',
    name: '다빈치랩 싱크업 설포라판 (Sync Up) 60일분',
    description: '설포라판 브로콜리새싹 리포조말 영양제',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 50000,
    price: 46800,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/d96b194122f85.png',
  },
  {
    sku: 'DVL_MEGA_PROBIOTIC_ND120',
    name: '다빈치랩 메가프로바이오틱 ND120 (MEGA PROBIOTIC ND120) 40일분',
    description: '신바이오틱스 유당없는 유산균',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 78000,
    price: 61000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250430/2568060b49060.png',
  },
  {
    sku: 'DVL_ENZYME_BENEFITS',
    name: '다빈치랩 엔자임 베네핏 (ENZYME BENEFITS) 30일분',
    description: '소화효소 속편한 효소 영양제',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 66000,
    price: 46000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/ab4e57f4d1b32.png',
  },
  {
    sku: 'DVL_LIPOSOMAL_C',
    name: '다빈치랩 리포조말 비타민C (LIPOSOMAL C) 60일분',
    description: '리포솜 비타민C 1250mg 300ml',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 65000,
    price: 45900,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250430/fdcbe9ab6f69f.png',
  },
  {
    sku: 'DVL_NATURE_COLLAGEN',
    name: '다빈치랩 네이처 콜라겐 (NATURE\'S COLLAGEN) 45일분',
    description: '무릎연골 영양제',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 76000,
    price: 63000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250430/f884a0826ea15.png',
  },
  {
    sku: 'DVL_IMMUNO_BENEFITS',
    name: '다빈치랩 이뮤노 베네핏 (IMMUNO BENEFITS) 30일분',
    description: '면역글로불린G IGF-1 모노라우린 함유 면역 영양제',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 69000,
    price: 58000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250430/c8f7183e8a46d.png',
  },
  {
    sku: 'DVL_LEPTIN_BENEFITS',
    name: '다빈치랩 렙틴 베네핏 (ADIPO-LEPTIN BENEFITS) 30일분',
    description: '아디포넥틴 렙틴 식욕조절 인슐린저항성 영양제',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 67000,
    price: 51000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250430/e2f4b468db045.png',
  },
  {
    sku: 'DVL_BRAIN_BENEFITS',
    name: '다빈치랩 브레인 베네핏 (BRAIN BENEFITS) 40일분',
    description: '고함량 EPA DHA 액상 어유 오메가3',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 62000,
    price: 52000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/07fb8da99fe2e.png',
  },
  {
    sku: 'DVL_LIPOSOMAL_THEANINE',
    name: '다빈치랩 리포조말 엘테아닌 (LIPOSOMAL L-THEANINE) 50일분',
    description: '긴장완화 스트레스완화 영양제',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 60000,
    price: 49000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/58c9fb8408445.png',
  },
  {
    sku: 'DVL_COQ10_DMG',
    name: '다빈치랩 고용량 코큐텐 DMG (COQ10 DMG 300/300mg) 60일분',
    description: '혈액순환 영양제 코엔자임Q10 300mg',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 135000,
    price: 98000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/f1483fa52a6f1.png',
  },
  {
    sku: 'DVL_VITAMIN_E',
    name: '다빈치랩 네츄럴 비타민E 플러스 (NATURAL MIXED TOCOPHEROL E-400) 60일분',
    description: '항산화 자연 비타민E 혼합 토코페롤',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 49000,
    price: 43000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/21f508cd0a2a6.png',
  },
  {
    sku: 'DVL_MAITAKE_DMG',
    name: '다빈치랩 어큐트 마이타케 DMG 리퀴드 (Maitake-DMG Liquid) 30일분',
    description: '잎새버섯 마이다케 D프랙션 DMG 베타글루칸 면역력 영양제',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 104000,
    price: 89000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250430/54bd237c50f07.png',
  },
  {
    sku: 'DVL_L_GLUTAMINE',
    name: '다빈치랩 L-글루타민 파우더 (L-GLUTAMINE POWDER) 30일분',
    description: 'L-글루타민 파우더',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 50000,
    price: 42000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/005d51e3602b2.png',
  },
  {
    sku: 'DVL_VITAMIN_D3',
    name: '다빈치랩 비타민D3 10,000 IU 30일분',
    description: '비타민D 10000IU 액상 심장건강',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 30000,
    price: 25000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/8bfd8ba749b9d.png',
  },
  {
    sku: 'DVL_GRAPEFRUIT_SEED',
    name: '다빈치랩 자몽씨 추출물 (GRAPEFRUIT SEED EXTRACT) 30일분',
    description: '자몽씨추출물 노폐물배출 유해균관리',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 50000,
    price: 43000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250218/8d64d5e286155.png',
  },
  {
    sku: 'DVL_MEGA_PROBIOTIC_ND50',
    name: '다빈치랩 메가프로바이오틱 ND50 (MEGA PROBIOTIC ND50) 30일분',
    description: '속편한 유산균 과민성대장 우유없는',
    categoryCode: 'OVERSEASUPPLEMENT',
    categoryName: '해외직구영양제',
    originalPrice: 59000,
    price: 49000,
    imageUrl: 'https://cdn.imweb.me/thumbnail/20250430/06f9cba26d22d.png',
  },
];

async function main() {
  console.log('해외직구 영양제 상품 시드 시작...\n');

  let created = 0;
  let updated = 0;

  for (const product of overseasSupplementProducts) {
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
          status: 'ACTIVE',
          productType: 'SINGLE',
          shippingPolicy: 'CONDITIONAL',
          shippingFee: 9800, // 해외배송비
          freeShippingAmount: 100000, // 10만원 이상 무료배송
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

  console.log('\n해외직구 영양제 상품 시드 완료!');
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
