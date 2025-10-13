const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateUserSubscription() {
  try {
    const user = await prisma.user.update({
      where: { email: 'test@example.com' },
      data: { subscriptionStatus: 'active' }
    });

    console.log('사용자 구독 상태 업데이트 완료:', user);
  } catch (error) {
    console.error('에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateUserSubscription();