import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 개발 DB에서 content_id 2,3,4,5,6,7,8과 product_id 1,4,5,6,7,8,9 조회
  const contentIds = [2, 3, 4, 5, 6, 7, 8];
  const productIds = [1, 4, 5, 6, 7, 8, 9];

  console.log('=== 개발 DB Contents ===');
  const contents = await prisma.content.findMany({
    where: { id: { in: contentIds } },
    select: { id: true, title: true, type: true },
    orderBy: { id: 'asc' }
  });
  contents.forEach(c => console.log(`content_id=${c.id}: ${c.title} (${c.type})`));

  console.log('\n=== 개발 DB Products ===');
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, categoryCode: true },
    orderBy: { id: 'asc' }
  });
  products.forEach(p => console.log(`product_id=${p.id}: ${p.name} (${p.categoryCode})`));

  console.log('\n=== 매핑 정보 ===');
  console.log('content_id=2 + product_id=1');
  console.log('content_id=3 + product_id=4');
  console.log('content_id=4 + product_id=5');
  console.log('content_id=5 + product_id=6');
  console.log('content_id=6 + product_id=7');
  console.log('content_id=7 + product_id=8');
  console.log('content_id=8 + product_id=9');

  await prisma.$disconnect();
}

main().catch(console.error);
