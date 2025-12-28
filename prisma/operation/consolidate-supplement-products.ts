import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 중복 상품 매핑: [삭제할 짧은 이름 ID, 유지할 긴 이름 ID]
const duplicatePairs = [
  { deleteId: 1, keepId: 89, shortName: '당당케어', longName: '혈당관리엔 당당케어 (120정)' },
  { deleteId: 4, keepId: 90, shortName: '바이오 밸런스', longName: '바이오밸런스 90정 (1개월분)' },
  { deleteId: 5, keepId: 91, shortName: '클린 밸런스', longName: '클린밸런스 120정 (1개월분)' },
  { deleteId: 6, keepId: 92, shortName: '뉴로 마스터', longName: '뉴로마스터 60정 (1개월분)' },
  { deleteId: 7, keepId: 93, shortName: '영데이즈', longName: '영데이즈 저속노화 SOD 효소 (15포)' },
  { deleteId: 8, keepId: 94, shortName: '풍성 밸런스', longName: '풍성밸런스 90정 (1개월분)' },
  { deleteId: 9, keepId: 95, shortName: '다래케어', longName: '다래케어 180정 (1개월분)' },
  { deleteId: 10, keepId: 96, shortName: '썬화이버', longName: '썬화이버 프리바이오틱스 식이섬유 210g' },
  { deleteId: 11, keepId: 97, shortName: '방탄젤리', longName: '팀키토 방탄젤리 청포도맛 30g 15포' },
  { deleteId: 41, keepId: 88, shortName: '메타드림', longName: '메타드림 식물성 멜라토닌 함유' },
  { deleteId: 42, keepId: 87, shortName: '리셋데이', longName: '리셋데이 글루텐분해효소 알파CD 차전자피 K-낙산균' },
];

async function main() {
  console.log('==========================================');
  console.log('SUPPLEMENT 상품 중복 정리 (긴 이름으로 통합)');
  console.log('==========================================\n');

  for (const pair of duplicatePairs) {
    console.log(`\n--- ${pair.shortName} (ID:${pair.deleteId}) → ${pair.longName} (ID:${pair.keepId}) ---`);

    // 1. health_type_animal_products 이전
    const htapUpdated = await prisma.healthTypeAnimalProduct.updateMany({
      where: { productId: pair.deleteId },
      data: { productId: pair.keepId },
    });
    if (htapUpdated.count > 0) {
      console.log(`  ✅ health_type_animal_products: ${htapUpdated.count}건 이전`);
    }

    // 2. order_items 이전
    const orderItemsUpdated = await prisma.orderItem.updateMany({
      where: { productId: pair.deleteId },
      data: { productId: pair.keepId },
    });
    if (orderItemsUpdated.count > 0) {
      console.log(`  ✅ order_items: ${orderItemsUpdated.count}건 이전`);
    }

    // 3. cart_items 이전
    const cartItemsUpdated = await prisma.cartItem.updateMany({
      where: { productId: pair.deleteId },
      data: { productId: pair.keepId },
    });
    if (cartItemsUpdated.count > 0) {
      console.log(`  ✅ cart_items: ${cartItemsUpdated.count}건 이전`);
    }

    // 4. product_images 이전 (기존 keepId 이미지 삭제 후 이전)
    await prisma.productImage.deleteMany({ where: { productId: pair.keepId } });
    const imagesUpdated = await prisma.productImage.updateMany({
      where: { productId: pair.deleteId },
      data: { productId: pair.keepId },
    });
    if (imagesUpdated.count > 0) {
      console.log(`  ✅ product_images: ${imagesUpdated.count}건 이전`);
    }

    // 5. supplement_nutrients 이전 (기존 keepId 영양정보 삭제 후 이전)
    await prisma.supplementNutrient.deleteMany({ where: { productId: pair.keepId } });
    const nutrientsUpdated = await prisma.supplementNutrient.updateMany({
      where: { productId: pair.deleteId },
      data: { productId: pair.keepId },
    });
    if (nutrientsUpdated.count > 0) {
      console.log(`  ✅ supplement_nutrients: ${nutrientsUpdated.count}건 이전`);
    }

    // 6. product_files - 둘 다 있으므로 deleteId 것만 삭제
    const filesDeleted = await prisma.productFile.deleteMany({
      where: { productId: pair.deleteId },
    });
    if (filesDeleted.count > 0) {
      console.log(`  🗑️ product_files: ${filesDeleted.count}건 삭제 (keepId 파일 유지)`);
    }

    // 7. recently_viewed 이전
    try {
      const recentUpdated = await prisma.recentlyViewed.updateMany({
        where: { productId: pair.deleteId },
        data: { productId: pair.keepId },
      });
      if (recentUpdated.count > 0) {
        console.log(`  ✅ recently_viewed: ${recentUpdated.count}건 이전`);
      }
    } catch (e) {}

    // 8. product_feedback 이전
    try {
      const feedbackUpdated = await prisma.productFeedback.updateMany({
        where: { productId: pair.deleteId },
        data: { productId: pair.keepId },
      });
      if (feedbackUpdated.count > 0) {
        console.log(`  ✅ product_feedback: ${feedbackUpdated.count}건 이전`);
      }
    } catch (e) {}

    // 9. user_challenges (productId) 이전
    try {
      const challengesUpdated = await prisma.userChallenge.updateMany({
        where: { productId: pair.deleteId },
        data: { productId: pair.keepId },
      });
      if (challengesUpdated.count > 0) {
        console.log(`  ✅ user_challenges: ${challengesUpdated.count}건 이전`);
      }
    } catch (e) {}

    // 11. 짧은 이름 상품 삭제
    try {
      await prisma.product.delete({ where: { id: pair.deleteId } });
      console.log(`  🗑️ 상품 ID:${pair.deleteId} (${pair.shortName}) 삭제 완료`);
    } catch (e: any) {
      console.log(`  ❌ 상품 삭제 실패: ${e.message}`);
    }
  }

  console.log('\n==========================================');
  console.log('완료! 남은 SUPPLEMENT 상품:');
  console.log('==========================================');

  const remaining = await prisma.product.findMany({
    where: { categoryCode: 'SUPPLEMENT' },
    select: { id: true, name: true, status: true },
    orderBy: { id: 'asc' },
  });

  remaining.forEach((p) => {
    const status = p.status === 'ACTIVE' ? '✅' : '❌';
    console.log(`  ${status} ID:${p.id} | ${p.name}`);
  });
  console.log(`\n총 ${remaining.length}개 (기존 24개 → 13개)`);
}

main()
  .catch((e) => {
    console.error('에러:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
