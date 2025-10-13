const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query'],
});

async function debugPrice() {
  console.log('=== 디버깅 시작 ===\n');

  // 1. ID 11번 상품 직접 조회
  const product11 = await prisma.product.findUnique({
    where: { id: 11 }
  });

  console.log('1. ID 11번 상품 전체 데이터:');
  console.log(product11);

  console.log('\n2. price 필드 상세 정보:');
  console.log('  - price 값:', product11.price);
  console.log('  - price 타입:', typeof product11.price);
  console.log('  - price constructor:', product11.price?.constructor?.name);
  console.log('  - price toString():', product11.price?.toString());
  console.log('  - Number(price.toString()):', product11.price ? Number(product11.price.toString()) : null);

  console.log('\n3. originalPrice 필드 상세 정보:');
  console.log('  - originalPrice 값:', product11.originalPrice);
  console.log('  - originalPrice 타입:', typeof product11.originalPrice);
  console.log('  - originalPrice constructor:', product11.originalPrice?.constructor?.name);
  console.log('  - originalPrice toString():', product11.originalPrice?.toString());
  console.log('  - Number(originalPrice.toString()):', product11.originalPrice ? Number(product11.originalPrice.toString()) : null);

  // 4. findMany로 같은 상품 조회
  const products = await prisma.product.findMany({
    where: { id: 11 }
  });

  console.log('\n4. findMany로 조회한 결과:');
  console.log('  - price:', products[0].price);
  console.log('  - originalPrice:', products[0].originalPrice);

  await prisma.$disconnect();
}

debugPrice();