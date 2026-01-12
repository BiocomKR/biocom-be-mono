import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * LUNCHBOX 중복 상품 찾기 (운영 DB용)
 *
 * 이름 기반으로 구버전/신버전 매핑을 자동으로 찾아서 출력
 *
 * 실행 방법:
 * npx ts-node prisma/operation/find-duplicate-lunchbox.ts
 */

// 구버전 → 신버전 이름 매핑 (고정값)
const NAME_MAPPING = [
  { oldName: '수원 왕갈비 통 닭목살', newName: '왕갈비통 닭목살' },
  { oldName: '훈제오리 들깨 크림 리조또', newName: '훈제오리&들깨크림리조또' },
  { oldName: '저당 두부면 라자냐', newName: '저당 키토 라자냐' },
  { oldName: '우삼겹 오일 파스타', newName: '우삼겹 구이&두부면 오일 파스타' },
];

async function main() {
  console.log('🔍 LUNCHBOX 중복 상품 찾기 시작...\n');

  const foundMappings: { oldId: number; newId: number; oldName: string; newName: string }[] = [];
  const notFound: { oldName: string; newName: string; missing: string }[] = [];

  for (const mapping of NAME_MAPPING) {
    // 구버전 상품 찾기
    const oldProduct = await prisma.product.findFirst({
      where: {
        name: mapping.oldName,
        categoryCode: 'LUNCHBOX',
      },
      select: { id: true, name: true, status: true, sku: true },
    });

    // 신버전 상품 찾기
    const newProduct = await prisma.product.findFirst({
      where: {
        name: mapping.newName,
        categoryCode: 'LUNCHBOX',
      },
      select: { id: true, name: true, status: true, sku: true },
    });

    if (oldProduct && newProduct) {
      foundMappings.push({
        oldId: oldProduct.id,
        newId: newProduct.id,
        oldName: mapping.oldName,
        newName: mapping.newName,
      });
      console.log(`✅ 매핑 발견:`);
      console.log(`   구버전: ID ${oldProduct.id} | "${oldProduct.name}" | ${oldProduct.sku}`);
      console.log(`   신버전: ID ${newProduct.id} | "${newProduct.name}" | ${newProduct.sku}`);
      console.log('');
    } else {
      if (!oldProduct) {
        notFound.push({ ...mapping, missing: '구버전 없음' });
        console.log(`⚠️  구버전 없음: "${mapping.oldName}"`);
      }
      if (!newProduct) {
        notFound.push({ ...mapping, missing: '신버전 없음' });
        console.log(`⚠️  신버전 없음: "${mapping.newName}"`);
      }
    }
  }

  // 결과 출력
  console.log('\n' + '='.repeat(60));
  console.log('📋 결과 요약');
  console.log('='.repeat(60));

  if (foundMappings.length > 0) {
    console.log('\n✅ 마이그레이션 필요한 매핑:');
    console.log('\n// migrate-old-lunchbox-products.ts에 복사해서 사용');
    console.log('const PRODUCT_MAPPING = [');
    foundMappings.forEach((m) => {
      console.log(`  { oldId: ${m.oldId}, newId: ${m.newId}, oldName: '${m.oldName}', newName: '${m.newName}' },`);
    });
    console.log('];');
  } else {
    console.log('\n✅ 중복 상품 없음 - 마이그레이션 불필요');
  }

  if (notFound.length > 0) {
    console.log('\n⚠️  찾지 못한 상품:');
    notFound.forEach((n) => {
      console.log(`   - ${n.missing}: "${n.oldName}" → "${n.newName}"`);
    });
  }

  // 참조 확인
  if (foundMappings.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('🔗 구버전 상품 참조 확인');
    console.log('='.repeat(60));

    const oldIds = foundMappings.map((m) => m.oldId);

    const orderItems = await prisma.orderItem.count({ where: { productId: { in: oldIds } } });
    const cartItems = await prisma.cartItem.count({ where: { productId: { in: oldIds } } });
    const animalProducts = await prisma.healthTypeAnimalProduct.count({ where: { productId: { in: oldIds } } });
    // ProductImage 모델 삭제됨 - ProductFile로 대체
    // const productImages = await prisma.productImage.count({ where: { productId: { in: oldIds } } });
    const productFiles = await prisma.productFile.count({ where: { productId: { in: oldIds } } });

    console.log(`\n   order_items: ${orderItems}건`);
    console.log(`   cart_items: ${cartItems}건`);
    console.log(`   health_type_animal_products: ${animalProducts}건`);
    // console.log(`   product_images: ${productImages}건`);
    console.log(`   product_files: ${productFiles}건`);

    if (orderItems > 0 || cartItems > 0 || animalProducts > 0) {
      console.log('\n⚠️  참조가 있으므로 마이그레이션 스크립트에서 ID 교체 후 삭제해야 합니다.');
    } else {
      console.log('\n✅ 주요 참조 없음. 바로 삭제 가능.');
    }
  }

  console.log('\n🎉 확인 완료!');
}

main()
  .catch((e) => {
    console.error('확인 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
