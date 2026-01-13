/**
 * 주문/결제 관련 데이터 삭제 스크립트
 *
 * 사용법:
 *   npx ts-node prisma/operation/delete-order-data.ts <user_id> [--dry-run]
 *
 * 예시:
 *   npx ts-node prisma/operation/delete-order-data.ts 45              # userId 45의 모든 주문 데이터 삭제
 *   npx ts-node prisma/operation/delete-order-data.ts 45 --dry-run    # 삭제 대상만 조회 (실제 삭제 안 함)
 *
 * 운영 DB 사용 시:
 *   .env의 DATABASE_URL을 운영 DB URL로 변경 후 실행
 *   - 개발 DB: postgresql://biocom:bico0825%21%40%23@34.47.124.132:5432/biocom
 *   - 운영 DB: postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom
 *
 * 삭제 순서 (FK 의존성 기반):
 *   1. payment_logs (결제 로그) - FK: paymentId
 *   2. order_state_logs (주문 상태 로그) - FK: orderId
 *   3. exchange_returns (교환/반품) - FK: orderId
 *   4. refund_warranties (환불 워런티) - FK: orderId
 *   5. refunds (환불) - FK: orderId, paymentId
 *   6. shipping (배송) - FK: orderId
 *   7. user_coupons (사용된 쿠폰) - usedOrderId null로 변경
 *   8. point_histories (포인트 내역) - FK: relatedId (ORDER)
 *   9. challenge_tickets (챌린지 티켓) - orderItemId null로 변경
 *   10. product_feedbacks (상품 리뷰/문의) - orderItemId null로 변경
 *   11. order_items (주문 상품) - FK: orderId
 *   12. payments (결제) - FK: orderId
 *   13. orders (주문) - FK: userId
 *
 * 작성자: 엄신우
 * 작성일: 26/01/09
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteOrderData(userId: number, isDryRun: boolean) {
  console.log('\n========================================');
  console.log(`🗑️ 주문/결제 데이터 삭제 ${isDryRun ? '(DRY-RUN)' : ''}`);
  console.log('========================================');
  console.log(`userId: ${userId}`);
  console.log('----------------------------------------\n');

  // 1. 주문 조회
  const orders = await prisma.order.findMany({
    where: { userId },
    select: { id: true, orderNumber: true, status: true },
  });

  if (orders.length === 0) {
    console.log('❌ 해당 유저의 주문이 없습니다.');
    return;
  }

  console.log(`📦 삭제 대상 주문: ${orders.length}건`);
  orders.forEach((o) => {
    console.log(`   - id: ${o.id}, orderNumber: ${o.orderNumber}, status: ${o.status}`);
  });

  const orderIds = orders.map((o) => o.id);

  // 주문 상품 ID 조회
  const orderItems = await prisma.orderItem.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const orderItemIds = orderItems.map((oi) => oi.id);

  // 결제 ID 조회
  const payments = await prisma.payment.findMany({
    where: { orderId: { in: orderIds } },
    select: { id: true },
  });
  const paymentIds = payments.map((p) => p.id);

  // 삭제 대상 카운트
  const counts = {
    paymentLogs: await prisma.paymentLog.count({ where: { paymentId: { in: paymentIds } } }),
    orderStateLogs: await prisma.orderStateLog.count({ where: { orderId: { in: orderIds } } }),
    exchangeReturns: await prisma.exchangeReturn.count({ where: { orderId: { in: orderIds } } }),
    refundWarranties: await prisma.refundWarranty.count({ where: { orderId: { in: orderIds } } }),
    refunds: await prisma.refund.count({ where: { orderId: { in: orderIds } } }),
    shipping: await prisma.shipping.count({ where: { orderId: { in: orderIds } } }),
    userCoupons: await prisma.userCoupon.count({ where: { usedOrderId: { in: orderIds } } }),
    pointHistories: await prisma.pointHistory.count({
      where: { userId, relatedType: 'ORDER', relatedId: { in: orderIds } },
    }),
    challengeTickets: await prisma.challengeTicket.count({ where: { orderItemId: { in: orderItemIds } } }),
    productFeedbacks: await prisma.productFeedback.count({ where: { orderItemId: { in: orderItemIds } } }),
    orderItems: orderItems.length,
    payments: payments.length,
    orders: orders.length,
  };

  console.log('\n📊 삭제 대상 요약:');
  console.log(`   1.  payment_logs:      ${counts.paymentLogs}건`);
  console.log(`   2.  order_state_logs:  ${counts.orderStateLogs}건`);
  console.log(`   3.  exchange_returns:  ${counts.exchangeReturns}건`);
  console.log(`   4.  refund_warranties: ${counts.refundWarranties}건`);
  console.log(`   5.  refunds:           ${counts.refunds}건`);
  console.log(`   6.  shipping:          ${counts.shipping}건`);
  console.log(`   7.  user_coupons:      ${counts.userCoupons}건 (usedOrderId → null)`);
  console.log(`   8.  point_histories:   ${counts.pointHistories}건`);
  console.log(`   9.  challenge_tickets: ${counts.challengeTickets}건 (orderItemId → null)`);
  console.log(`   10. product_feedbacks: ${counts.productFeedbacks}건 (orderItemId → null)`);
  console.log(`   11. order_items:       ${counts.orderItems}건`);
  console.log(`   12. payments:          ${counts.payments}건`);
  console.log(`   13. orders:            ${counts.orders}건`);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`   ─────────────────────────────`);
  console.log(`   총합:                  ${total}건\n`);

  if (isDryRun) {
    console.log('⚠️  DRY-RUN 모드: 실제 삭제가 수행되지 않았습니다.');
    console.log('    실제 삭제하려면 --dry-run 옵션을 제거하세요.\n');
    return;
  }

  // 실제 삭제 수행
  console.log('🔄 삭제 진행 중...\n');

  await prisma.$transaction(async (tx) => {
    // 1. payment_logs
    if (paymentIds.length > 0) {
      const r = await tx.paymentLog.deleteMany({ where: { paymentId: { in: paymentIds } } });
      console.log(`   1.  payment_logs 삭제: ${r.count}건`);
    }

    // 2. order_state_logs
    const r2 = await tx.orderStateLog.deleteMany({ where: { orderId: { in: orderIds } } });
    console.log(`   2.  order_state_logs 삭제: ${r2.count}건`);

    // 3. exchange_returns
    const r3 = await tx.exchangeReturn.deleteMany({ where: { orderId: { in: orderIds } } });
    console.log(`   3.  exchange_returns 삭제: ${r3.count}건`);

    // 4. refund_warranties
    const r4 = await tx.refundWarranty.deleteMany({ where: { orderId: { in: orderIds } } });
    console.log(`   4.  refund_warranties 삭제: ${r4.count}건`);

    // 5. refunds
    const r5 = await tx.refund.deleteMany({ where: { orderId: { in: orderIds } } });
    console.log(`   5.  refunds 삭제: ${r5.count}건`);

    // 6. shipping
    const r6 = await tx.shipping.deleteMany({ where: { orderId: { in: orderIds } } });
    console.log(`   6.  shipping 삭제: ${r6.count}건`);

    // 7. user_coupons (usedOrderId → null)
    const r7 = await tx.userCoupon.updateMany({
      where: { usedOrderId: { in: orderIds } },
      data: { usedOrderId: null, usedAt: null, status: 'ACTIVE' },
    });
    console.log(`   7.  user_coupons 복구: ${r7.count}건`);

    // 8. point_histories
    const r8 = await tx.pointHistory.deleteMany({
      where: { userId, relatedType: 'ORDER', relatedId: { in: orderIds } },
    });
    console.log(`   8.  point_histories 삭제: ${r8.count}건`);

    // 9. challenge_tickets (orderItemId → null)
    if (orderItemIds.length > 0) {
      const r9 = await tx.challengeTicket.updateMany({
        where: { orderItemId: { in: orderItemIds } },
        data: { orderItemId: null },
      });
      console.log(`   9.  challenge_tickets 해제: ${r9.count}건`);
    }

    // 10. product_feedbacks (orderItemId → null)
    if (orderItemIds.length > 0) {
      const r10 = await tx.productFeedback.updateMany({
        where: { orderItemId: { in: orderItemIds } },
        data: { orderItemId: null },
      });
      console.log(`   10. product_feedbacks 해제: ${r10.count}건`);
    }

    // 11. order_items
    const r11 = await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    console.log(`   11. order_items 삭제: ${r11.count}건`);

    // 12. payments
    const r12 = await tx.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    console.log(`   12. payments 삭제: ${r12.count}건`);

    // 13. orders
    const r13 = await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    console.log(`   13. orders 삭제: ${r13.count}건`);
  });

  console.log('\n✅ 삭제 완료!\n');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1 || args[0] === '--help') {
    console.log('사용법: npx ts-node prisma/operation/delete-order-data.ts <user_id> [--dry-run]');
    console.log('');
    console.log('옵션:');
    console.log('  --dry-run    삭제 대상만 조회 (실제 삭제 안 함)');
    console.log('');
    console.log('예시:');
    console.log('  npx ts-node prisma/operation/delete-order-data.ts 45');
    console.log('  npx ts-node prisma/operation/delete-order-data.ts 45 --dry-run');
    process.exit(1);
  }

  const userId = parseInt(args[0], 10);
  const isDryRun = args.includes('--dry-run');

  if (isNaN(userId)) {
    console.error('❌ userId는 숫자여야 합니다.');
    process.exit(1);
  }

  try {
    await deleteOrderData(userId, isDryRun);
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
