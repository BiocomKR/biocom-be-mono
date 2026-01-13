/**
 * 주문/결제 관련 데이터 조회 스크립트
 *
 * 사용법:
 *   npx ts-node prisma/operation/find-order-data.ts <user_id> [order_id]
 *
 * 예시:
 *   npx ts-node prisma/operation/find-order-data.ts 40          # userId 40의 모든 주문 데이터 조회
 *   npx ts-node prisma/operation/find-order-data.ts 40 123      # userId 40, orderId 123 조회
 *
 * 운영 DB 조회 방법:
 *   .env의 DATABASE_URL을 운영 DB URL로 변경 후 실행
 *   - 개발 DB: postgresql://biocom:bico0825%21%40%23@34.47.124.132:5432/biocom
 *   - 운영 DB: postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom
 *
 * 조회 테이블 (삭제 순서대로 정렬됨):
 *   1. payment_logs (결제 로그) - FK: paymentId
 *   2. order_state_logs (주문 상태 로그) - FK: orderId
 *   3. exchange_returns (교환/반품) - FK: orderId
 *   4. refund_warranty (환불 워런티) - FK: orderId, userId
 *   5. refunds (환불) - FK: orderId, paymentId
 *   6. shipping (배송) - FK: orderId
 *   7. user_coupons (사용된 쿠폰) - FK: usedOrderId
 *   8. point_histories (포인트 내역) - FK: relatedId (ORDER)
 *   9. challenge_tickets (챌린지 티켓) - FK: orderItemId
 *   10. product_feedbacks (상품 리뷰/문의) - FK: orderItemId
 *   11. order_items (주문 상품) - FK: orderId
 *   12. payments (결제) - FK: orderId
 *   13. orders (주문) - FK: userId
 *   14. cart_items (장바구니 아이템) - FK: cartId
 *   15. carts (장바구니) - FK: userId
 *
 * 작성자: 엄신우
 * 작성일: 26/01/09
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface OrderData {
  orders: any[];
  orderItems: any[];
  payments: any[];
  paymentLogs: any[];
  orderStateLogs: any[];
  refunds: any[];
  refundWarranties: any[];
  shipping: any[];
  exchangeReturns: any[];
  userCoupons: any[];
  pointHistories: any[];
  challengeTickets: any[];
  productFeedbacks: any[];
  carts: any[];
  cartItems: any[];
}

async function findOrderData(
  userId: number,
  orderId?: number,
): Promise<OrderData> {
  console.log('\n========================================');
  console.log('🔍 주문/결제 데이터 조회');
  console.log('========================================');
  console.log(`userId: ${userId}`);
  if (orderId) {
    console.log(`orderId: ${orderId}`);
  }
  console.log('----------------------------------------\n');

  // 1. 주문 조회
  const orders = await prisma.order.findMany({
    where: orderId ? { id: orderId, userId } : { userId },
    orderBy: { orderedAt: 'desc' },
  });

  console.log(`📦 orders (주문): ${orders.length}건`);
  orders.forEach((o) => {
    console.log(
      `   - id: ${o.id}, orderNumber: ${o.orderNumber}, status: ${o.status}, totalAmount: ${o.totalAmount}`,
    );
  });

  const orderIds = orders.map((o) => o.id);

  // 2. 주문 상품 조회
  const orderItems = await prisma.orderItem.findMany({
    where: { orderId: { in: orderIds } },
  });

  console.log(`\n📋 order_items (주문 상품): ${orderItems.length}건`);
  orderItems.forEach((oi) => {
    console.log(
      `   - id: ${oi.id}, orderId: ${oi.orderId}, productName: ${oi.productName}, quantity: ${oi.quantity}`,
    );
  });

  const orderItemIds = orderItems.map((oi) => oi.id);

  // 3. 결제 조회
  const payments = await prisma.payment.findMany({
    where: { orderId: { in: orderIds } },
  });

  console.log(`\n💳 payments (결제): ${payments.length}건`);
  payments.forEach((p) => {
    console.log(
      `   - id: ${p.id}, orderId: ${p.orderId}, status: ${p.status}, amount: ${p.amount}, pgTransactionId: ${p.pgTransactionId}`,
    );
  });

  const paymentIds = payments.map((p) => p.id);

  // 4. 결제 로그 조회
  const paymentLogs = await prisma.paymentLog.findMany({
    where: { paymentId: { in: paymentIds } },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`\n📝 payment_logs (결제 로그): ${paymentLogs.length}건`);
  paymentLogs.forEach((pl) => {
    console.log(
      `   - id: ${pl.id}, paymentId: ${pl.paymentId}, ${pl.previousStatus} → ${pl.newStatus}`,
    );
  });

  // 5. 주문 상태 로그 조회
  const orderStateLogs = await prisma.orderStateLog.findMany({
    where: { orderId: { in: orderIds } },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`\n📜 order_state_logs (주문 상태 로그): ${orderStateLogs.length}건`);
  orderStateLogs.forEach((osl) => {
    console.log(
      `   - id: ${osl.id}, orderId: ${osl.orderId}, ${osl.fromStatus} → ${osl.toStatus}`,
    );
  });

  // 6. 환불 조회
  const refunds = await prisma.refund.findMany({
    where: { orderId: { in: orderIds } },
  });

  console.log(`\n💸 refunds (환불): ${refunds.length}건`);
  refunds.forEach((r) => {
    console.log(
      `   - id: ${r.id}, orderId: ${r.orderId}, status: ${r.status}, refundAmount: ${r.refundAmount}`,
    );
  });

  // 7. 환불 워런티 조회
  const refundWarranties = await prisma.refundWarranty.findMany({
    where: { orderId: { in: orderIds } },
  });

  console.log(`\n🛡️ refund_warranties (환불 워런티): ${refundWarranties.length}건`);
  refundWarranties.forEach((rw) => {
    console.log(`   - id: ${rw.id}, orderId: ${rw.orderId}, status: ${rw.status}`);
  });

  // 8. 배송 조회
  const shipping = await prisma.shipping.findMany({
    where: { orderId: { in: orderIds } },
  });

  console.log(`\n🚚 shipping (배송): ${shipping.length}건`);
  shipping.forEach((s) => {
    console.log(
      `   - id: ${s.id}, orderId: ${s.orderId}, status: ${s.status}, trackingNumber: ${s.trackingNumber}`,
    );
  });

  // 9. 교환/반품 조회
  const exchangeReturns = await prisma.exchangeReturn.findMany({
    where: { orderId: { in: orderIds } },
  });

  console.log(`\n🔄 exchange_returns (교환/반품): ${exchangeReturns.length}건`);
  exchangeReturns.forEach((er) => {
    console.log(
      `   - id: ${er.id}, orderId: ${er.orderId}, type: ${er.type}, status: ${er.status}`,
    );
  });

  // 10. 사용된 쿠폰 조회
  const userCoupons = await prisma.userCoupon.findMany({
    where: { usedOrderId: { in: orderIds } },
  });

  console.log(`\n🎟️ user_coupons (사용된 쿠폰): ${userCoupons.length}건`);
  userCoupons.forEach((uc) => {
    console.log(
      `   - id: ${uc.id}, usedOrderId: ${uc.usedOrderId}, couponId: ${uc.couponId}, status: ${uc.status}`,
    );
  });

  // 11. 포인트 내역 조회 (주문 관련)
  const pointHistories = await prisma.pointHistory.findMany({
    where: {
      userId,
      relatedType: 'ORDER',
      relatedId: { in: orderIds },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`\n🪙 point_histories (포인트 내역): ${pointHistories.length}건`);
  pointHistories.forEach((ph) => {
    console.log(
      `   - id: ${ph.id}, type: ${ph.type}, amount: ${ph.amount}, relatedId: ${ph.relatedId}`,
    );
  });

  // 12. 챌린지 티켓 조회
  const challengeTickets = await prisma.challengeTicket.findMany({
    where: { orderItemId: { in: orderItemIds } },
  });

  console.log(`\n🎫 challenge_tickets (챌린지 티켓): ${challengeTickets.length}건`);
  challengeTickets.forEach((ct) => {
    console.log(
      `   - id: ${ct.id}, orderItemId: ${ct.orderItemId}, status: ${ct.status}`,
    );
  });

  // 13. 상품 피드백 조회 (리뷰/문의)
  const productFeedbacks = await prisma.productFeedback.findMany({
    where: { orderItemId: { in: orderItemIds } },
  });

  console.log(`\n⭐ product_feedbacks (상품 리뷰/문의): ${productFeedbacks.length}건`);
  productFeedbacks.forEach((pf) => {
    console.log(
      `   - id: ${pf.id}, orderItemId: ${pf.orderItemId}, feedbackType: ${pf.feedbackType}`,
    );
  });

  // 14. 장바구니 조회
  const carts = await prisma.cart.findMany({
    where: { userId },
  });

  console.log(`\n🛒 carts (장바구니): ${carts.length}건`);
  carts.forEach((c) => {
    console.log(`   - id: ${c.id}, userId: ${c.userId}`);
  });

  const cartIds = carts.map((c) => c.id);

  // 15. 장바구니 아이템 조회
  const cartItems = await prisma.cartItem.findMany({
    where: { cartId: { in: cartIds } },
  });

  console.log(`\n🛍️ cart_items (장바구니 아이템): ${cartItems.length}건`);
  cartItems.forEach((ci) => {
    console.log(
      `   - id: ${ci.id}, cartId: ${ci.cartId}, productId: ${ci.productId}, quantity: ${ci.quantity}`,
    );
  });

  // 요약
  console.log('\n========================================');
  console.log('📊 요약 (삭제 순서)');
  console.log('========================================');
  console.log(`1.  payment_logs:      ${paymentLogs.length}건`);
  console.log(`2.  order_state_logs:  ${orderStateLogs.length}건`);
  console.log(`3.  exchange_returns:  ${exchangeReturns.length}건`);
  console.log(`4.  refund_warranties: ${refundWarranties.length}건`);
  console.log(`5.  refunds:           ${refunds.length}건`);
  console.log(`6.  shipping:          ${shipping.length}건`);
  console.log(`7.  user_coupons:      ${userCoupons.length}건`);
  console.log(`8.  point_histories:   ${pointHistories.length}건`);
  console.log(`9.  challenge_tickets: ${challengeTickets.length}건`);
  console.log(`10. product_feedbacks: ${productFeedbacks.length}건`);
  console.log(`11. order_items:       ${orderItems.length}건`);
  console.log(`12. payments:          ${payments.length}건`);
  console.log(`13. orders:            ${orders.length}건`);
  console.log(`14. cart_items:        ${cartItems.length}건`);
  console.log(`15. carts:             ${carts.length}건`);
  console.log('========================================\n');

  return {
    orders,
    orderItems,
    payments,
    paymentLogs,
    orderStateLogs,
    refunds,
    refundWarranties,
    shipping,
    exchangeReturns,
    userCoupons,
    pointHistories,
    challengeTickets,
    productFeedbacks,
    carts,
    cartItems,
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('사용법: npx ts-node prisma/operation/find-order-data.ts <user_id> [order_id]');
    console.log('');
    console.log('예시:');
    console.log('  npx ts-node prisma/operation/find-order-data.ts 40       # userId 40의 모든 주문');
    console.log('  npx ts-node prisma/operation/find-order-data.ts 40 123   # 특정 주문만');
    process.exit(1);
  }

  const userId = parseInt(args[0], 10);
  const orderId = args[1] ? parseInt(args[1], 10) : undefined;

  if (isNaN(userId)) {
    console.error('❌ userId는 숫자여야 합니다.');
    process.exit(1);
  }

  if (orderId !== undefined && isNaN(orderId)) {
    console.error('❌ orderId는 숫자여야 합니다.');
    process.exit(1);
  }

  try {
    await findOrderData(userId, orderId);
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
