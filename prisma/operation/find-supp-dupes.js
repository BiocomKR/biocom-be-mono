const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, productType: true, lineup: { select: { key: true } } },
    orderBy: { id: 'asc' }
  });

  // 영양제만 필터
  const supplements = products.filter(p =>
    (p.lineup && p.lineup.key && p.lineup.key.startsWith('SUPP_')) ||
    p.productType === 'SUPPLEMENT'
  );

  console.log('=== 활성 영양제 목록 ===\n');
  for (const p of supplements) {
    const lineupKey = p.lineup ? p.lineup.key : 'null';
    console.log('ID ' + p.id + ': "' + p.name + '" / lineup: ' + lineupKey + ' / type: ' + (p.productType || 'null'));
  }
  console.log('\n총 ' + supplements.length + '개');

  // 정규화해서 중복 찾기
  console.log('\n=== 유사 이름 중복 ===\n');
  const normalized = {};
  for (const p of supplements) {
    const key = p.name.replace(/[\s&·\-_()\[\]]/g, '').toLowerCase();
    if (!normalized[key]) normalized[key] = [];
    normalized[key].push(p);
  }

  let found = false;
  for (const key of Object.keys(normalized)) {
    const items = normalized[key];
    if (items.length > 1) {
      found = true;
      console.log('정규화: ' + key);
      for (const item of items) {
        const lk = item.lineup ? item.lineup.key : 'null';
        console.log('  ID ' + item.id + ': "' + item.name + '" / lineup: ' + lk);
      }
      console.log('');
    }
  }
  if (!found) console.log('없음');

  await prisma.$disconnect();
}
main();
