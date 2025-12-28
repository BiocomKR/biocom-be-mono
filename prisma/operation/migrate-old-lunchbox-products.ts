import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 구버전 LUNCHBOX 상품 → 신버전으로 통합 마이그레이션
 *
 * ⚠️ 이름 기반으로 자동 매핑 - 어떤 DB에서든 실행 가능
 *
 * 1. 이름으로 구버전/신버전 상품 ID 자동 탐색
 * 2. 신버전 상품 이름을 구버전 이름으로 변경
 * 3. 구버전 product_id를 참조하는 곳을 신버전 product_id로 교체
 * 4. 구버전 상품 삭제
 *
 * 실행 방법:
 * npx ts-node prisma/operation/migrate-old-lunchbox-products.ts
 */

// 구버전 → 신버전 이름 매핑 (고정값, ID는 런타임에 탐색)
const NAME_MAPPING = [
  { oldName: '수원 왕갈비 통 닭목살', newName: '왕갈비통 닭목살' },
  { oldName: '훈제오리 들깨 크림 리조또', newName: '훈제오리&들깨크림리조또' },
  { oldName: '저당 두부면 라자냐', newName: '저당 키토 라자냐' },
  { oldName: '우삼겹 오일 파스타', newName: '우삼겹 구이&두부면 오일 파스타' },
];

interface ProductMapping {
  oldId: number;
  newId: number;
  oldName: string;
  newName: string;
}

async function findProductMappings(): Promise<ProductMapping[]> {
  const mappings: ProductMapping[] = [];

  console.log('🔍 이름 기반으로 상품 매핑 탐색...\n');

  for (const nameMap of NAME_MAPPING) {
    const oldProduct = await prisma.product.findFirst({
      where: { name: nameMap.oldName, categoryCode: 'LUNCHBOX' },
      select: { id: true, name: true },
    });

    const newProduct = await prisma.product.findFirst({
      where: { name: nameMap.newName, categoryCode: 'LUNCHBOX' },
      select: { id: true, name: true },
    });

    if (oldProduct && newProduct) {
      mappings.push({
        oldId: oldProduct.id,
        newId: newProduct.id,
        oldName: nameMap.oldName,
        newName: nameMap.newName,
      });
      console.log(`  ✅ "${nameMap.oldName}" (ID:${oldProduct.id}) → "${nameMap.newName}" (ID:${newProduct.id})`);
    } else {
      if (!oldProduct) {
        console.log(`  ⏭️  구버전 없음 (이미 마이그레이션됨?): "${nameMap.oldName}"`);
      }
      if (!newProduct) {
        console.log(`  ⏭️  신버전 없음: "${nameMap.newName}"`);
      }
    }
  }

  return mappings;
}

async function main() {
  console.log('🔄 구버전 LUNCHBOX 상품 마이그레이션 시작...\n');

  // === 0. 이름 기반으로 매핑 탐색 ===
  const PRODUCT_MAPPING = await findProductMappings();

  if (PRODUCT_MAPPING.length === 0) {
    console.log('\n✅ 마이그레이션할 중복 상품이 없습니다. 이미 완료되었거나 중복이 없습니다.');
    return;
  }

  console.log(`\n📋 마이그레이션 대상: ${PRODUCT_MAPPING.length}개 매핑\n`);

  // === 1. 신버전 이름을 구버전 이름으로 변경 ===
  console.log('📝 Step 1: 신버전 상품 이름을 구버전 이름으로 변경');
  for (const mapping of PRODUCT_MAPPING) {
    await prisma.product.update({
      where: { id: mapping.newId },
      data: { name: mapping.oldName },
    });
    console.log(`  ✅ ID ${mapping.newId}: "${mapping.newName}" → "${mapping.oldName}"`);
  }

  // === 2. 구버전 product_id를 참조하는 곳을 신버전으로 교체 ===
  console.log('\n📝 Step 2: 참조 테이블의 product_id 교체');

  for (const mapping of PRODUCT_MAPPING) {
    // product_images
    const imgResult = await prisma.productImage.updateMany({
      where: { productId: mapping.oldId },
      data: { productId: mapping.newId },
    });
    if (imgResult.count > 0) {
      console.log(`  ✅ product_images: ${mapping.oldId} → ${mapping.newId} (${imgResult.count}건)`);
    }

    // product_files
    const fileResult = await prisma.productFile.updateMany({
      where: { productId: mapping.oldId },
      data: { productId: mapping.newId },
    });
    if (fileResult.count > 0) {
      console.log(`  ✅ product_files: ${mapping.oldId} → ${mapping.newId} (${fileResult.count}건)`);
    }

    // cart_items
    const cartResult = await prisma.cartItem.updateMany({
      where: { productId: mapping.oldId },
      data: { productId: mapping.newId },
    });
    if (cartResult.count > 0) {
      console.log(`  ✅ cart_items: ${mapping.oldId} → ${mapping.newId} (${cartResult.count}건)`);
    }

    // order_items
    const orderResult = await prisma.orderItem.updateMany({
      where: { productId: mapping.oldId },
      data: { productId: mapping.newId },
    });
    if (orderResult.count > 0) {
      console.log(`  ✅ order_items: ${mapping.oldId} → ${mapping.newId} (${orderResult.count}건)`);
    }

    // health_type_animal_products
    const animalResult = await prisma.healthTypeAnimalProduct.updateMany({
      where: { productId: mapping.oldId },
      data: { productId: mapping.newId },
    });
    if (animalResult.count > 0) {
      console.log(`  ✅ health_type_animal_products: ${mapping.oldId} → ${mapping.newId} (${animalResult.count}건)`);
    }
  }

  // === 3. 구버전 상품 삭제 ===
  console.log('\n📝 Step 3: 구버전 상품 삭제');

  const mappedOldIds = PRODUCT_MAPPING.map((m) => m.oldId);
  console.log(`  삭제 대상 ID: ${mappedOldIds.join(', ')}`);

  // 먼저 관련 데이터 삭제 (FK 제약) - 이미 이동했지만 혹시 남아있을 수 있음
  await prisma.productImage.deleteMany({
    where: { productId: { in: mappedOldIds } },
  });
  await prisma.productFile.deleteMany({
    where: { productId: { in: mappedOldIds } },
  });
  await prisma.cartItem.deleteMany({
    where: { productId: { in: mappedOldIds } },
  });
  await prisma.healthTypeAnimalProduct.deleteMany({
    where: { productId: { in: mappedOldIds } },
  });

  const deleteResult = await prisma.product.deleteMany({
    where: { id: { in: mappedOldIds } },
  });
  console.log(`  ✅ ${deleteResult.count}개 삭제 완료`);

  // === 결과 확인 ===
  console.log('\n📊 마이그레이션 결과:');
  const remainingProducts = await prisma.product.findMany({
    where: { categoryCode: 'LUNCHBOX' },
    select: { id: true, name: true, sku: true },
    orderBy: { id: 'asc' },
  });
  console.log(`  현재 LUNCHBOX 상품 수: ${remainingProducts.length}개`);
  remainingProducts.forEach((p) => {
    console.log(`    ID: ${p.id} | SKU: ${p.sku} | Name: ${p.name}`);
  });

  console.log('\n🎉 마이그레이션 완료!');
}

main()
  .catch((e) => {
    console.error('마이그레이션 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
