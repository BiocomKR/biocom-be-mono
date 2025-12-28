import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findDuplicates() {
  // 모든 활성 상품 조회
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, lineup: { select: { id: true, key: true } } },
    orderBy: { name: 'asc' }
  });

  console.log('=== 전체 활성 상품 목록 ===');
  console.log(`총 ${products.length}개\n`);

  // 이름별로 그룹화
  const nameGroups: Record<string, typeof products> = {};
  for (const p of products) {
    const normalized = p.name.replace(/\s+/g, ' ').trim();
    if (!nameGroups[normalized]) {
      nameGroups[normalized] = [];
    }
    nameGroups[normalized].push(p);
  }

  // 중복 찾기
  console.log('=== 정확히 같은 이름 중복 ===');
  let exactDupes = 0;
  for (const [name, items] of Object.entries(nameGroups)) {
    if (items.length > 1) {
      exactDupes++;
      console.log(`${name}:`);
      for (const item of items) {
        console.log(`  - ID ${item.id} (lineup: ${item.lineup?.key || 'null'})`);
      }
    }
  }
  if (exactDupes === 0) console.log('  없음');

  // 유사 이름 찾기 (공백/특수문자 차이)
  console.log('\n=== 유사한 이름 (공백/특수문자 차이) ===');

  const simpleNames: Record<string, typeof products> = {};
  for (const p of products) {
    // 모든 공백, &, 특수문자 제거
    const simple = p.name.replace(/[\s&·\-_()[\]]/g, '').toLowerCase();
    if (!simpleNames[simple]) {
      simpleNames[simple] = [];
    }
    simpleNames[simple].push(p);
  }

  let similarDupes = 0;
  for (const [simple, items] of Object.entries(simpleNames)) {
    if (items.length > 1) {
      // 원래 이름이 다른 경우만
      const uniqueNames = new Set(items.map(i => i.name));
      if (uniqueNames.size > 1) {
        similarDupes++;
        console.log(`[${simple}]:`);
        for (const item of items) {
          console.log(`  - ID ${item.id}: "${item.name}"`);
        }
      }
    }
  }
  if (similarDupes === 0) console.log('  없음');

  await prisma.$disconnect();
}

findDuplicates();
