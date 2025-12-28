import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('==========================================');
  console.log('SUPPLEMENT mechanisms 데이터 현황 확인');
  console.log('==========================================\n');

  // 모든 SUPPLEMENT 타입 레코드 조회
  const supplements = await prisma.healthTypeAnimalProduct.findMany({
    where: { type: 'SUPPLEMENT' },
    include: {
      healthTypeAnimal: true,
      product: true,
    },
    orderBy: [{ healthTypeAnimalId: 'asc' }, { displayOrder: 'asc' }],
  });

  for (const supp of supplements) {
    const animalName = supp.healthTypeAnimal?.animalName || 'Unknown';
    const productName = supp.product?.name || 'Unknown';
    const mechanisms = supp.mechanisms as any;

    console.log(`\n--- ${animalName} - ${productName} ---`);
    console.log(`  healthTypeAnimalId: ${supp.healthTypeAnimalId}, productId: ${supp.productId}`);
    console.log(`  priority: ${supp.priority}, displayOrder: ${supp.displayOrder}`);

    if (mechanisms && Array.isArray(mechanisms)) {
      console.log(`  mechanisms 개수: ${mechanisms.length}`);
      mechanisms.forEach((m: any, idx: number) => {
        console.log(`    ${idx + 1}. ${m.name}`);
      });
    } else {
      console.log(`  mechanisms: 없음 또는 잘못된 형식`);
    }
  }

  console.log('\n==========================================');
  console.log('확인 완료');
  console.log('==========================================');
}

main()
  .catch((e) => {
    console.error('에러:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
