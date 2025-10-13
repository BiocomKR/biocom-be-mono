const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteBalanceGames() {
  console.log('🗑️ 밸런스게임 데이터 삭제 시작...');

  try {
    // 밸런스게임 데이터 삭제
    const deletedGames = await prisma.balanceGame.deleteMany({});

    console.log(`✅ 밸런스게임 ${deletedGames.count}개 삭제 완료`);

  } catch (error) {
    console.error('❌ 밸런스게임 삭제 중 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteBalanceGames();