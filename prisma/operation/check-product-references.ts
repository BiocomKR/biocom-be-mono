import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 삭제 예정 상품(16, 19, 21, 22)의 참조 확인
 *
 * 실행 방법:
 * npx ts-node prisma/operation/check-product-references.ts
 */

const OLD_IDS = [16, 19, 21, 22];

async function main() {
  console.log('🔍 삭제 예정 상품 참조 확인 시작...\n');
  console.log(`확인 대상 Product ID: ${OLD_IDS.join(', ')}\n`);

  // 1. order_items (주문 내역) - 가장 중요!
  console.log('=== 1. order_items (주문 내역) ===');
  const orderItems = await prisma.orderItem.findMany({
    where: { productId: { in: OLD_IDS } },
    include: {
      order: { select: { id: true, orderNumber: true, status: true, createdAt: true } },
    },
  });
  console.log(`  총 ${orderItems.length}건`);
  if (orderItems.length > 0) {
    orderItems.forEach((item) => {
      console.log(
        `  - OrderItem ID: ${item.id}, Product ID: ${item.productId}, Order: ${item.order.orderNumber} (${item.order.status})`,
      );
    });
  }

  // 2. cart_items (장바구니)
  console.log('\n=== 2. cart_items (장바구니) ===');
  const cartItems = await prisma.cartItem.findMany({
    where: { productId: { in: OLD_IDS } },
  });
  console.log(`  총 ${cartItems.length}건`);
  if (cartItems.length > 0) {
    cartItems.forEach((item) => {
      console.log(`  - CartItem ID: ${item.id}, Product ID: ${item.productId}`);
    });
  }

  // 3. health_type_animal_products (동물 타입별 상품)
  console.log('\n=== 3. health_type_animal_products (동물 타입별 상품) ===');
  const animalProducts = await prisma.healthTypeAnimalProduct.findMany({
    where: { productId: { in: OLD_IDS } },
  });
  console.log(`  총 ${animalProducts.length}건`);
  if (animalProducts.length > 0) {
    for (const item of animalProducts) {
      const animal = await prisma.healthTypeAnimal.findUnique({
        where: { id: item.healthTypeAnimalId },
        select: { id: true, animalName: true },
      });
      console.log(
        `  - Product ID: ${item.productId}, Animal: ${animal?.animalName} (ID: ${item.healthTypeAnimalId})`,
      );
    }
  }

  // 4. product_images
  console.log('\n=== 4. product_images ===');
  const productImages = await prisma.productImage.findMany({
    where: { productId: { in: OLD_IDS } },
  });
  console.log(`  총 ${productImages.length}건`);

  // 5. product_files
  console.log('\n=== 5. product_files ===');
  const productFiles = await prisma.productFile.findMany({
    where: { productId: { in: OLD_IDS } },
  });
  console.log(`  총 ${productFiles.length}건`);

  // 6. product_feedbacks
  console.log('\n=== 6. product_feedbacks ===');
  const feedbacks = await prisma.productFeedback.findMany({
    where: { productId: { in: OLD_IDS } },
  });
  console.log(`  총 ${feedbacks.length}건`);

  // 7. coupon_products
  console.log('\n=== 7. coupon_products ===');
  const couponProducts = await prisma.couponProduct.findMany({
    where: { productId: { in: OLD_IDS } },
  });
  console.log(`  총 ${couponProducts.length}건`);

  // 8. iap_products
  console.log('\n=== 8. iap_products ===');
  const iapProducts = await prisma.iAPProduct.findMany({
    where: { productId: { in: OLD_IDS } },
  });
  console.log(`  총 ${iapProducts.length}건`);

  // 9. user_supplement_routines
  console.log('\n=== 9. user_supplement_routines ===');
  const supplementRoutines = await prisma.userSupplementRoutine.findMany({
    where: { productId: { in: OLD_IDS } },
  });
  console.log(`  총 ${supplementRoutines.length}건`);

  // 10. user_supplement_routine_histories
  console.log('\n=== 10. user_supplement_routine_histories ===');
  const routineHistories = await prisma.userSupplementRoutineHistory.findMany({
    where: { productId: { in: OLD_IDS } },
  });
  console.log(`  총 ${routineHistories.length}건`);

  console.log('\n============================================');
  console.log('📊 요약: 마이그레이션 시 주의사항');
  console.log('============================================');

  const hasOrderItems = orderItems.length > 0;
  const hasCartItems = cartItems.length > 0;
  const hasAnimalProducts = animalProducts.length > 0;
  const hasProductImages = productImages.length > 0;
  const hasProductFiles = productFiles.length > 0;

  if (hasOrderItems) {
    console.log('⚠️  order_items에 참조가 있음 → 마이그레이션 스크립트에서 처리됨 (newId로 교체)');
  }
  if (hasCartItems) {
    console.log('⚠️  cart_items에 참조가 있음 → 마이그레이션 스크립트에서 처리됨 (newId로 교체)');
  }
  if (hasAnimalProducts) {
    console.log(
      '⚠️  health_type_animal_products에 참조가 있음 → 마이그레이션 전 수동 확인 필요!',
    );
  }
  if (hasProductImages) {
    console.log('⚠️  product_images에 참조가 있음 → 마이그레이션 스크립트에서 처리됨 (newId로 교체 후 삭제)');
  }
  if (hasProductFiles) {
    console.log('⚠️  product_files에 참조가 있음 → 마이그레이션 스크립트에서 처리됨 (newId로 교체 후 삭제)');
  }

  if (!hasOrderItems && !hasCartItems && !hasAnimalProducts) {
    console.log('✅ 주요 테이블에 참조 없음. 마이그레이션 안전!');
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
