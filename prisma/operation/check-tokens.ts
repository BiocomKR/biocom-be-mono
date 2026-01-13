import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tokens = await prisma.refreshToken.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      user: {
        select: { id: true, name: true, mobile: true }
      }
    }
  });

  console.log('\n=== Refresh Tokens (최근 20개) ===\n');
  tokens.forEach((t, i) => {
    const tokenPrefix = t.token.substring(0, 30);
    console.log((i+1) + '. User: ' + t.user.name + ' (ID: ' + t.userId + ')');
    console.log('   Token: ' + tokenPrefix + '...');
    console.log('   Created: ' + t.createdAt);
    console.log('   Expires: ' + t.expiresAt);
    console.log('');
  });

  // 사용자별 토큰 개수
  const counts = await prisma.refreshToken.groupBy({
    by: ['userId'],
    _count: true
  });

  console.log('=== 사용자별 토큰 개수 ===');
  console.log(counts);

  // 전체 토큰 수
  const total = await prisma.refreshToken.count();
  console.log('\n전체 토큰 수: ' + total);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
