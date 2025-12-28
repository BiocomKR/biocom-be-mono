/**
 * 중복 상품 정리 스크립트
 *
 * MEAL_* 상품 중 LUNCHBOX_*와 중복되는 것들을 정리:
 * 1. 모든 테이블의 product_id를 LUNCHBOX 상품으로 변경
 * 2. MEAL 상품 비활성화
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 중복 매핑: MEAL -> LUNCHBOX
const DUPLICATE_MAPPING: { mealId: number; lunchboxId: number; description: string }[] = [
  { mealId: 66, lunchboxId: 19, description: '훈제오리 들깨 크림 리조또' },
  { mealId: 70, lunchboxId: 21, description: '저당 두부면 라자냐' },
  { mealId: 68, lunchboxId: 22, description: '우삼겹 오일 파스타' },
  { mealId: 71, lunchboxId: 16, description: '수원 왕갈비 통 닭목살' },
];

async function main() {
  console.log('========================================');
  console.log(' 중복 상품 정리 시작');
  console.log('========================================\n');

  for (const mapping of DUPLICATE_MAPPING) {
    console.log(`\n[${mapping.description}]`);
    console.log(`  MEAL ID ${mapping.mealId} -> LUNCHBOX ID ${mapping.lunchboxId}`);

    // 1. HealthTypeAnimalProduct 매핑 처리
    // LUNCHBOX에 이미 있는 매핑은 삭제, 없는 매핑은 변경
    const mealMappings = await prisma.healthTypeAnimalProduct.findMany({
      where: { productId: mapping.mealId }
    });

    for (const mealMapping of mealMappings) {
      // LUNCHBOX에 같은 healthTypeAnimalId 매핑이 있는지 확인
      const existingLunchbox = await prisma.healthTypeAnimalProduct.findFirst({
        where: {
          productId: mapping.lunchboxId,
          healthTypeAnimalId: mealMapping.healthTypeAnimalId
        }
      });

      if (existingLunchbox) {
        // 이미 LUNCHBOX 매핑이 있으면 MEAL 매핑 삭제
        await prisma.healthTypeAnimalProduct.delete({
          where: { id: mealMapping.id }
        });
        console.log(`  HealthTypeAnimalProduct: healthTypeAnimalId=${mealMapping.healthTypeAnimalId} 삭제 (LUNCHBOX에 이미 존재)`);
      } else {
        // LUNCHBOX 매핑이 없으면 MEAL 매핑을 LUNCHBOX로 변경
        await prisma.healthTypeAnimalProduct.update({
          where: { id: mealMapping.id },
          data: { productId: mapping.lunchboxId }
        });
        console.log(`  HealthTypeAnimalProduct: healthTypeAnimalId=${mealMapping.healthTypeAnimalId} 변경`);
      }
    }

    // 2. OrderItem 매핑 변경
    const orderResult = await prisma.orderItem.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (orderResult.count > 0) {
      console.log(`  OrderItem: ${orderResult.count}건 변경`);
    }

    // 3. CartItem 매핑 변경
    const cartResult = await prisma.cartItem.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (cartResult.count > 0) {
      console.log(`  CartItem: ${cartResult.count}건 변경`);
    }

    // 4. ProductFeedback 매핑 변경
    const feedbackResult = await prisma.productFeedback.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (feedbackResult.count > 0) {
      console.log(`  ProductFeedback: ${feedbackResult.count}건 변경`);
    }

    // 5. CouponProduct 매핑 변경
    const couponProdResult = await prisma.couponProduct.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (couponProdResult.count > 0) {
      console.log(`  CouponProduct: ${couponProdResult.count}건 변경`);
    }

    // 6. UserSupplementRoutine 매핑 변경
    const usrResult = await prisma.userSupplementRoutine.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (usrResult.count > 0) {
      console.log(`  UserSupplementRoutine: ${usrResult.count}건 변경`);
    }

    // 7. UserSupplementRoutineHistory 매핑 변경
    const usrhResult = await prisma.userSupplementRoutineHistory.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (usrhResult.count > 0) {
      console.log(`  UserSupplementRoutineHistory: ${usrhResult.count}건 변경`);
    }

    // 8. Subscription 매핑 변경
    const subResult = await prisma.subscription.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (subResult.count > 0) {
      console.log(`  Subscription: ${subResult.count}건 변경`);
    }

    // 9. Coupon 매핑 변경
    const couponResult = await prisma.coupon.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (couponResult.count > 0) {
      console.log(`  Coupon: ${couponResult.count}건 변경`);
    }

    // 10. IAPProduct 매핑 변경
    const iapResult = await prisma.iAPProduct.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (iapResult.count > 0) {
      console.log(`  IAPProduct: ${iapResult.count}건 변경`);
    }

    // 11. ChallengeMission 매핑 변경
    const cmResult = await prisma.challengeMission.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (cmResult.count > 0) {
      console.log(`  ChallengeMission: ${cmResult.count}건 변경`);
    }

    // 12. ChallengeSurvey 매핑 변경
    const csResult = await prisma.challengeSurvey.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (csResult.count > 0) {
      console.log(`  ChallengeSurvey: ${csResult.count}건 변경`);
    }

    // 13. ChallengeTicket 매핑 변경 (nullable)
    const ctResult = await prisma.challengeTicket.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (ctResult.count > 0) {
      console.log(`  ChallengeTicket: ${ctResult.count}건 변경`);
    }

    // 14. UserChallenge 매핑 변경
    const ucResult = await prisma.userChallenge.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (ucResult.count > 0) {
      console.log(`  UserChallenge: ${ucResult.count}건 변경`);
    }

    // 15. Wishlist 매핑 변경
    const wishlistResult = await prisma.wishlist.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (wishlistResult.count > 0) {
      console.log(`  Wishlist: ${wishlistResult.count}건 변경`);
    }

    // 16. RecentlyViewed 매핑 변경
    const rvResult = await prisma.recentlyViewed.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (rvResult.count > 0) {
      console.log(`  RecentlyViewed: ${rvResult.count}건 변경`);
    }

    // 17. UserChallengeSurveyResult 매핑 변경
    const ucsrResult = await prisma.userChallengeSurveyResult.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (ucsrResult.count > 0) {
      console.log(`  UserChallengeSurveyResult: ${ucsrResult.count}건 변경`);
    }

    // 18. LectureProduct 매핑 변경
    const lpResult = await prisma.lectureProduct.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (lpResult.count > 0) {
      console.log(`  LectureProduct: ${lpResult.count}건 변경`);
    }

    // 19. SupplementNutrient 매핑 변경
    const snResult = await prisma.supplementNutrient.updateMany({
      where: { productId: mapping.mealId },
      data: { productId: mapping.lunchboxId }
    });
    if (snResult.count > 0) {
      console.log(`  SupplementNutrient: ${snResult.count}건 변경`);
    }

    // 20. MEAL 상품 비활성화
    await prisma.product.update({
      where: { id: mapping.mealId },
      data: { status: 'INACTIVE' }
    });
    console.log(`  Product ID ${mapping.mealId} 비활성화 완료`);
  }

  console.log('\n========================================');
  console.log(' 중복 상품 정리 완료!');
  console.log('========================================');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('오류 발생:', e);
  await prisma.$disconnect();
  process.exit(1);
});
