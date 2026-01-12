import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const productId = 66;

  console.log(`=== Product ID ${productId} 사용처 ===\n`);

  // HealthTypeAnimalProduct
  const htap = await prisma.healthTypeAnimalProduct.count({ where: { productId } });
  if (htap > 0) console.log(`HealthTypeAnimalProduct: ${htap}건`);

  // OrderItem
  const orderItem = await prisma.orderItem.count({ where: { productId } });
  if (orderItem > 0) console.log(`OrderItem: ${orderItem}건`);

  // CartItem
  const cartItem = await prisma.cartItem.count({ where: { productId } });
  if (cartItem > 0) console.log(`CartItem: ${cartItem}건`);

  // ProductFeedback
  const pf = await prisma.productFeedback.count({ where: { productId } });
  if (pf > 0) console.log(`ProductFeedback: ${pf}건`);

  // CouponProduct
  const coup = await prisma.couponProduct.count({ where: { productId } });
  if (coup > 0) console.log(`CouponProduct: ${coup}건`);

  // UserSupplementRoutine
  const usr = await prisma.userSupplementRoutine.count({ where: { productId } });
  if (usr > 0) console.log(`UserSupplementRoutine: ${usr}건`);

  // UserSupplementRoutineHistory
  const usrh = await prisma.userSupplementRoutineHistory.count({ where: { productId } });
  if (usrh > 0) console.log(`UserSupplementRoutineHistory: ${usrh}건`);

  // IAPProduct
  const iap = await prisma.iAPProduct.count({ where: { productId } });
  if (iap > 0) console.log(`IAPProduct: ${iap}건`);

  // ProductFile
  const pfile = await prisma.productFile.count({ where: { productId } });
  if (pfile > 0) console.log(`ProductFile: ${pfile}건`);

  // ProductImage (모델 삭제됨 - ProductFile로 대체)
  // const pimg = await prisma.productImage.count({ where: { productId } });
  // if (pimg > 0) console.log(`ProductImage: ${pimg}건`);

  // Subscription
  const sub = await prisma.subscription.count({ where: { productId } });
  if (sub > 0) console.log(`Subscription: ${sub}건`);

  // Coupon (nullable)
  const coupon = await prisma.coupon.count({ where: { productId } });
  if (coupon > 0) console.log(`Coupon: ${coupon}건`);

  console.log('\n사용처가 없으면 아무것도 출력되지 않습니다.');

  await prisma.$disconnect();
}

main();
