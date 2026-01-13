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
  // 개발 DB에서 확인한 콘텐츠 제목들
  const contentTitles = [
    '오늘부터 이 음식만 끊어도 10살 어려 보입니다.',
    '피부 트러블이 난다면 지금 당장 \'ㄷㄹㅊㅊㅁ\' 드세요.',
    '염증에서 벗어나는 유일한 방법입니다.',
    '화장실 못 가는 분들은 꼭 보세요. 피부가 눈에 띄게 환해집니다.',
    '탄력 저하, 노화, 홍조, 여드름. 결국 원인은 하나입니다.',
    '이런 분들은 샐러드 먹지 마세요. 다음 날 피부 뒤집어집니다.',
    '자기 전 클렌징 보다 중요한 습관. 밥 먹을 때 이것 하나만 지키세요.'
  ];

  // 개발 DB에서 확인한 상품 이름들
  const productNames = [
    '당당케어',
    '바이오밸런스',
    '클린밸런스',
    '뉴로마스터',
    '영데이즈',
    '풍성밸런스',
    '다래케어'
  ];

  console.log('=== 운영 DB Contents 검색 ===');
  for (const title of contentTitles) {
    const content = await prisma.content.findFirst({
      where: { title: { contains: title.substring(0, 20) } },
      select: { id: true, title: true, type: true }
    });
    if (content) {
      console.log(`content_id=${content.id}: ${content.title}`);
    } else {
      console.log(`NOT FOUND: ${title.substring(0, 30)}...`);
    }
  }

  console.log('\n=== 운영 DB Products 검색 ===');
  for (const name of productNames) {
    const product = await prisma.product.findFirst({
      where: { name },
      select: { id: true, name: true, categoryCode: true }
    });
    if (product) {
      console.log(`product_id=${product.id}: ${product.name} (${product.categoryCode})`);
    } else {
      console.log(`NOT FOUND: ${name}`);
    }
  }

  console.log('\n=== 기존 lecture_products 확인 ===');
  const existing = await prisma.lectureProduct.findMany({
    orderBy: { id: 'asc' }
  });
  console.log(`현재 ${existing.length}개 존재`);
  existing.forEach(lp => console.log(`id=${lp.id}: content_id=${lp.contentId}, product_id=${lp.productId}`));

  await prisma.$disconnect();
}

main().catch(console.error);
