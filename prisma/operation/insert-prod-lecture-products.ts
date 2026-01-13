import { PrismaClient } from '@prisma/client';

// 운영 DB URL 사용
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom'
    }
  }
});

async function main() {
  // 개발 DB 매핑 → 운영 DB 매핑
  // 개발: content_id=2 + product_id=1 (당당케어) → 운영: content_id=2 + product_id=89
  // 개발: content_id=3 + product_id=4 (바이오밸런스) → 운영: 없음
  // 개발: content_id=4 + product_id=5 (클린밸런스) → 운영: 없음
  // 개발: content_id=5 + product_id=6 (뉴로마스터) → 운영: content_id=5 + product_id=92
  // 개발: content_id=6 + product_id=7 (영데이즈) → 운영: content_id=6 + product_id=93
  // 개발: content_id=7 + product_id=8 (풍성밸런스) → 운영: 없음
  // 개발: content_id=8 + product_id=9 (다래케어) → 운영: content_id=8 + product_id=95

  const dataToInsert = [
    { contentId: 2, productId: 89, sortOrder: 1 },  // 당당케어
    { contentId: 5, productId: 92, sortOrder: 4 },  // 뉴로마스터
    { contentId: 6, productId: 93, sortOrder: 5 },  // 영데이즈
    { contentId: 8, productId: 95, sortOrder: 7 },  // 다래케어
  ];

  console.log('=== 운영 DB lecture_products INSERT ===');
  console.log('삽입할 데이터:', dataToInsert);

  for (const data of dataToInsert) {
    try {
      const result = await prisma.lectureProduct.create({
        data: {
          contentId: data.contentId,
          productId: data.productId,
          sortOrder: data.sortOrder,
          isActive: true,
        }
      });
      console.log(`✅ 삽입 완료: id=${result.id}, content_id=${result.contentId}, product_id=${result.productId}`);
    } catch (error: any) {
      console.error(`❌ 삽입 실패: content_id=${data.contentId}, product_id=${data.productId}`, error.message);
    }
  }

  console.log('\n=== 삽입 후 lecture_products 확인 ===');
  const all = await prisma.lectureProduct.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      content: { select: { id: true, title: true } },
      product: { select: { id: true, name: true } }
    }
  });

  all.forEach(lp => {
    console.log(`id=${lp.id}: "${lp.content.title.substring(0, 30)}..." + ${lp.product.name}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
