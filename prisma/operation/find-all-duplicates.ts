import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 모든 활성 상품의 이름을 정규화하여 비교
  const products = await prisma.product.findMany({
    // 모든 상품 (비활성 포함)
    select: {
      id: true,
      name: true,
      status: true,
      productType: true,
      lineup: { select: { id: true, key: true } }
    },
    orderBy: { id: 'asc' }
  });

  // 공백/특수문자 제거 후 그룹화
  const normalized: Record<string, typeof products> = {};
  for (const p of products) {
    const key = p.name.replace(/[\s&·\-_()[\]]/g, '').toLowerCase();
    if (!normalized[key]) normalized[key] = [];
    normalized[key].push(p);
  }

  console.log('=== 모든 유사/동일 이름 중복 상품 ===\n');
  let count = 0;
  for (const [key, items] of Object.entries(normalized)) {
    if (items.length > 1) {
      count++;
      console.log(`[${count}] 정규화: ${key}`);
      for (const item of items) {
        console.log(`  ID ${item.id}: "${item.name}" / status: ${item.status} / lineup: ${item.lineup?.key || 'null'}`);
      }
      console.log('');
    }
  }

  console.log(`총 ${count}개 그룹`)

  await prisma.$disconnect();
}

main();
