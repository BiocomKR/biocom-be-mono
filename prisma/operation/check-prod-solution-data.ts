import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('==========================================');
  console.log('1. health_type_animals (동물 유형)');
  console.log('==========================================');
  const animals = await prisma.healthTypeAnimal.findMany({ orderBy: { id: 'asc' } });
  animals.forEach((a) => console.log(`  ID:${a.id} | ${a.animalName} | ${a.healthType}`));

  console.log('\n==========================================');
  console.log('2. health_type_animal_products (동물별 상품 매핑)');
  console.log('==========================================');
  for (const animal of animals) {
    console.log(`\n--- ${animal.animalName} (${animal.healthType}) ---`);

    const products = await prisma.healthTypeAnimalProduct.findMany({
      where: { healthTypeAnimalId: animal.id },
      include: { product: { select: { id: true, name: true, status: true } } },
      orderBy: [{ type: 'asc' }, { displayOrder: 'asc' }],
    });

    const byType: Record<string, typeof products> = {};
    products.forEach((p) => {
      if (!byType[p.type]) byType[p.type] = [];
      byType[p.type].push(p);
    });

    for (const [type, items] of Object.entries(byType)) {
      console.log(`  [${type}] ${items.length}개`);
      items.slice(0, 5).forEach((item) => {
        const status = item.product.status === 'ACTIVE' ? '✅' : '❌';
        console.log(
          `    ${status} ID:${item.productId} | ${item.product.name} | p:${item.priority} | k:${item.keyword || '-'}`,
        );
      });
      if (items.length > 5) console.log(`    ... 외 ${items.length - 5}개`);
    }
  }

  console.log('\n==========================================');
  console.log('3. products - LUNCHBOX 카테고리');
  console.log('==========================================');
  const lunchbox = await prisma.product.findMany({
    where: { categoryCode: 'LUNCHBOX' },
    select: { id: true, name: true, status: true, sku: true },
    orderBy: { id: 'asc' },
  });
  console.log(`총 ${lunchbox.length}개`);
  lunchbox.forEach((p) => {
    const status = p.status === 'ACTIVE' ? '✅' : '❌';
    console.log(`  ${status} ID:${p.id} | ${p.sku} | ${p.name}`);
  });

  console.log('\n==========================================');
  console.log('4. products - SUPPLEMENT 카테고리');
  console.log('==========================================');
  const supplements = await prisma.product.findMany({
    where: { categoryCode: 'SUPPLEMENT' },
    select: { id: true, name: true, status: true },
    orderBy: { id: 'asc' },
  });
  console.log(`총 ${supplements.length}개`);
  supplements.forEach((p) => {
    const status = p.status === 'ACTIVE' ? '✅' : '❌';
    console.log(`  ${status} ID:${p.id} | ${p.name}`);
  });

  console.log('\n==========================================');
  console.log('5. products - FORMULA 카테고리');
  console.log('==========================================');
  const formulas = await prisma.product.findMany({
    where: { categoryCode: 'FORMULA' },
    select: { id: true, name: true, status: true },
    orderBy: { id: 'asc' },
  });
  console.log(`총 ${formulas.length}개`);
  formulas.forEach((p) => {
    const status = p.status === 'ACTIVE' ? '✅' : '❌';
    console.log(`  ${status} ID:${p.id} | ${p.name}`);
  });

  console.log('\n==========================================');
  console.log('6. product_lineups (라인업)');
  console.log('==========================================');
  const lineups = await prisma.productLineup.findMany({
    orderBy: { id: 'asc' },
  });
  lineups.forEach((l) => {
    const status = l.isActive ? '✅' : '❌';
    console.log(`  ${status} ID:${l.id} | ${l.key} | ${l.name}`);
  });
}

main()
  .catch((e) => {
    console.error('에러:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
