/**
 * user_id 40번 관련 모든 데이터 삭제 스크립트
 *
 * 사용법: npx ts-node prisma/operation/delete-user-40.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteUser40Data() {
  const userId = 54;

  console.log(`\n🗑️  user_id ${userId} 관련 데이터 삭제 시작...\n`);

  try {
    // 1. 먼저 관련 데이터 수 확인
    console.log('📊 삭제 대상 데이터 확인:');

    // 먼저 userChallenge ID들 조회
    const userChallenges = await prisma.userChallenge.findMany({
      where: { userId },
      select: { id: true }
    });
    const userChallengeIds = userChallenges.map(uc => uc.id);

    const counts = {
      user: await prisma.user.count({ where: { id: userId } }),
      userChallenges: userChallenges.length,
      userMissions: await prisma.userMission.count({ where: { userId } }),
      dailyProgress: userChallengeIds.length > 0
        ? await prisma.dailyProgress.count({ where: { userChallengeId: { in: userChallengeIds } } })
        : 0,
      userRecord: await prisma.userRecord.count({ where: { userId } }),
      pushTokens: await prisma.pushToken.count({ where: { userId } }),
      userBalanceGameHistory: await prisma.userBalanceGameHistory.count({ where: { userId } }),
      pointHistories: await prisma.pointHistory.count({ where: { userId } }),
      carts: await prisma.cart.count({ where: { userId } }),
      orders: await prisma.order.count({ where: { userId } }),
      subscriptions: await prisma.subscription.count({ where: { userId } }),
      userAddresses: await prisma.userAddress.count({ where: { userId } }),
      userCoupons: await prisma.userCoupon.count({ where: { userId } }),
      productFeedback: await prisma.productFeedback.count({ where: { userId } }),
      wishlist: await prisma.wishlist.count({ where: { userId } }),
      recentlyViewed: await prisma.recentlyViewed.count({ where: { userId } }),
      userDeepReport: await prisma.userDeepReport.count({ where: { userId } }),
      userAllergyReport: await prisma.userAllergyReport.count({ where: { userId } }),
      userMetabolicReport: await prisma.userMetabolicReport.count({ where: { userId } }),
      userChatHistory: await prisma.userChatHistory.count({ where: { userId } }),
      userChatDailySummary: await prisma.userChatDailySummary.count({ where: { userId } }),
      userEmotionalState: await prisma.userEmotionalState.count({ where: { userId } }),
      userChallengeSurveyResult: await prisma.userChallengeSurveyResult.count({ where: { userId } }),
      userSupplementRoutine: await prisma.userSupplementRoutine.count({ where: { userId } }),
      userChart: await prisma.userChart.count({ where: { userId } }),
      userConsent: await prisma.userConsent.count({ where: { userId } }),
      surveyAnswer: await prisma.surveyAnswer.count({ where: { userId } }),
      quizAttempt: await prisma.quizAttempt.count({ where: { userId } }),
      refreshToken: await prisma.refreshToken.count({ where: { userId } }),
      userFile: await prisma.userFile.count({ where: { userId } }),
      issueReport: await prisma.issueReport.count({ where: { userId } }),
    };

    for (const [table, count] of Object.entries(counts)) {
      if (count > 0) {
        console.log(`  - ${table}: ${count}건`);
      }
    }

    // 2. 트랜잭션으로 삭제 (외래키 제약 순서 고려)
    console.log('\n🔄 데이터 삭제 중...');

    await prisma.$transaction(async (tx) => {
      // 자식 테이블부터 삭제
      await tx.userMission.deleteMany({ where: { userId } });
      console.log('  ✅ userMissions 삭제 완료');

      // DailyProgress는 userChallengeId로 연결됨
      if (userChallengeIds.length > 0) {
        await tx.dailyProgress.deleteMany({ where: { userChallengeId: { in: userChallengeIds } } });
        console.log('  ✅ dailyProgress 삭제 완료');
      }

      await tx.userRecord.deleteMany({ where: { userId } });
      console.log('  ✅ userRecord 삭제 완료');

      await tx.pushToken.deleteMany({ where: { userId } });
      console.log('  ✅ pushTokens 삭제 완료');

      await tx.userBalanceGameHistory.deleteMany({ where: { userId } });
      console.log('  ✅ userBalanceGameHistory 삭제 완료');

      await tx.pointHistory.deleteMany({ where: { userId } });
      console.log('  ✅ pointHistories 삭제 완료');

      // CartItem 먼저 삭제
      const carts = await tx.cart.findMany({ where: { userId }, select: { id: true } });
      if (carts.length > 0) {
        const cartIds = carts.map(c => c.id);
        await tx.cartItem.deleteMany({ where: { cartId: { in: cartIds } } });
        console.log('  ✅ cartItems 삭제 완료');
      }
      await tx.cart.deleteMany({ where: { userId } });
      console.log('  ✅ carts 삭제 완료');

      // Order 관련 - OrderItem, Payment, Refund 먼저 삭제
      const orders = await tx.order.findMany({ where: { userId }, select: { id: true } });
      if (orders.length > 0) {
        const orderIds = orders.map(o => o.id);
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        console.log('  ✅ orderItems 삭제 완료');
        await tx.orderStateLog.deleteMany({ where: { orderId: { in: orderIds } } });
        console.log('  ✅ orderStateLogs 삭제 완료');

        // Payment 관련 - Refund, PaymentLog 먼저 삭제
        const payments = await tx.payment.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } });
        if (payments.length > 0) {
          const paymentIds = payments.map(p => p.id);
          await tx.refund.deleteMany({ where: { paymentId: { in: paymentIds } } });
          console.log('  ✅ refunds 삭제 완료');
          await tx.paymentLog.deleteMany({ where: { paymentId: { in: paymentIds } } });
          console.log('  ✅ paymentLogs 삭제 완료');
        }
        await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
        console.log('  ✅ payments 삭제 완료');
      }
      await tx.order.deleteMany({ where: { userId } });
      console.log('  ✅ orders 삭제 완료');

      await tx.subscription.deleteMany({ where: { userId } });
      console.log('  ✅ subscriptions 삭제 완료');

      await tx.userAddress.deleteMany({ where: { userId } });
      console.log('  ✅ userAddresses 삭제 완료');

      await tx.userCoupon.deleteMany({ where: { userId } });
      console.log('  ✅ userCoupons 삭제 완료');

      await tx.productFeedback.deleteMany({ where: { userId } });
      console.log('  ✅ productFeedback 삭제 완료');

      await tx.wishlist.deleteMany({ where: { userId } });
      console.log('  ✅ wishlist 삭제 완료');

      await tx.recentlyViewed.deleteMany({ where: { userId } });
      console.log('  ✅ recentlyViewed 삭제 완료');

      await tx.userDeepReport.deleteMany({ where: { userId } });
      console.log('  ✅ userDeepReport 삭제 완료');

      await tx.userAllergyReport.deleteMany({ where: { userId } });
      console.log('  ✅ userAllergyReport 삭제 완료');

      await tx.userMetabolicReport.deleteMany({ where: { userId } });
      console.log('  ✅ userMetabolicReport 삭제 완료');

      await tx.userChatHistory.deleteMany({ where: { userId } });
      console.log('  ✅ userChatHistory 삭제 완료');

      await tx.userChatDailySummary.deleteMany({ where: { userId } });
      console.log('  ✅ userChatDailySummary 삭제 완료');

      await tx.userEmotionalState.deleteMany({ where: { userId } });
      console.log('  ✅ userEmotionalState 삭제 완료');

      await tx.userChallengeSurveyResult.deleteMany({ where: { userId } });
      console.log('  ✅ userChallengeSurveyResult 삭제 완료');

      // UserSupplementRoutineHistory 먼저 삭제 (userId로 직접 연결)
      await tx.userSupplementRoutineHistory.deleteMany({ where: { userId } });
      console.log('  ✅ userSupplementRoutineHistory 삭제 완료');

      await tx.userSupplementRoutine.deleteMany({ where: { userId } });
      console.log('  ✅ userSupplementRoutine 삭제 완료');

      await tx.userChart.deleteMany({ where: { userId } });
      console.log('  ✅ userChart 삭제 완료');

      await tx.userConsent.deleteMany({ where: { userId } });
      console.log('  ✅ userConsent 삭제 완료');

      await tx.surveyAnswer.deleteMany({ where: { userId } });
      console.log('  ✅ surveyAnswer 삭제 완료');

      await tx.quizAttempt.deleteMany({ where: { userId } });
      console.log('  ✅ quizAttempt 삭제 완료');

      await tx.refreshToken.deleteMany({ where: { userId } });
      console.log('  ✅ refreshToken 삭제 완료');

      await tx.userFile.deleteMany({ where: { userId } });
      console.log('  ✅ userFile 삭제 완료');

      await tx.issueReport.deleteMany({ where: { userId } });
      console.log('  ✅ issueReport 삭제 완료');

      await tx.userChallenge.deleteMany({ where: { userId } });
      console.log('  ✅ userChallenges 삭제 완료');

      await tx.challengeTicket.deleteMany({ where: { userId } });
      console.log('  ✅ challengeTickets 삭제 완료');

      // 마지막으로 User 삭제
      await tx.user.deleteMany({ where: { id: userId } });
      console.log('  ✅ user 삭제 완료');
    });

    console.log(`\n✅ user_id ${userId} 관련 모든 데이터 삭제 완료!\n`);

  } catch (error) {
    console.error('❌ 삭제 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

deleteUser40Data();
