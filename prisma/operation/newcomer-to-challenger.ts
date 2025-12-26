import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 뉴커머 → 챌린저 전환 스크립트
 * quick_start 티켓 생성 → 29일 챌린지 생성 → 특정 일차로 데이터 조정
 *
 * 사용법:
 * npx ts-node prisma/operation/newcomer-to-challenger.ts <userId> <targetDay>
 *
 * 예시:
 * npx ts-node prisma/operation/newcomer-to-challenger.ts 51 22   # 22일차로 설정
 */

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('사용법: npx ts-node prisma/operation/newcomer-to-challenger.ts <userId> <targetDay>');
    console.log('');
    console.log('예시:');
    console.log('  npx ts-node prisma/operation/newcomer-to-challenger.ts 51 22   # 22일차로 설정');
    return;
  }

  const userId = parseInt(args[0], 10);
  const targetDay = parseInt(args[1], 10);

  if (isNaN(userId) || isNaN(targetDay)) {
    console.error('❌ userId와 targetDay는 유효한 숫자여야 합니다.');
    process.exit(1);
  }

  if (targetDay < 1 || targetDay > 29) {
    console.error('❌ targetDay는 1~29 범위여야 합니다.');
    process.exit(1);
  }

  console.log('=== 뉴커머 → 챌린저 전환 ===');
  console.log(`userId: ${userId}, 목표 일차: ${targetDay}일차`);
  console.log('');

  // 1. 유저 확인
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    console.error(`❌ userId ${userId} 사용자를 찾을 수 없습니다.`);
    process.exit(1);
  }

  console.log(`유저 확인: ${user.name || user.mobile} (현재 status: ${user.status})`);

  // 2. 기존 ACTIVE 챌린지 확인
  const existingActive = await prisma.userChallenge.findFirst({
    where: { userId, status: 'ACTIVE' },
  });

  if (existingActive) {
    console.error(`❌ 이미 ACTIVE 챌린지가 있습니다 (challengeId: ${existingActive.id})`);
    console.log('기존 챌린지를 먼저 종료하거나 set-challenge-day.ts 스크립트를 사용하세요.');
    process.exit(1);
  }

  // 3. 이너뷰티 챌린지 상품 조회
  const product = await prisma.product.findFirst({
    where: {
      name: '이너뷰티 챌린지',
      categoryCode: 'CHALLENGE',
      status: 'ACTIVE',
    },
  });

  if (!product) {
    console.error('❌ 이너뷰티 챌린지 상품을 찾을 수 없습니다.');
    process.exit(1);
  }

  console.log(`챌린지 상품: ${product.name} (id: ${product.id})`);

  // 4. 날짜 계산: targetDay일차가 되도록 activatedAt 설정
  // 오늘이 targetDay일차가 되려면 activatedAt = 오늘 - (targetDay - 1)일
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const activatedAt = new Date(todayUTC.getTime() - (targetDay - 1) * 24 * 60 * 60 * 1000);
  const totalDays = 29;
  const expiresAt = new Date(activatedAt.getTime() + totalDays * 24 * 60 * 60 * 1000);

  console.log(`activatedAt: ${activatedAt.toISOString().split('T')[0]}`);
  console.log(`expiresAt: ${expiresAt.toISOString().split('T')[0]}`);
  console.log('');

  await prisma.$transaction(async (tx) => {
    // 5. QUICK_START 티켓 생성
    const ticket = await tx.challengeTicket.create({
      data: {
        userId,
        productId: product.id,
        ticketType: 'QUICK_START',
        status: 'ACTIVATED',
        purchaseDate: activatedAt,
        createdAt: activatedAt,
      },
    });
    console.log(`✅ 챌린지 티켓 생성 완료 (id: ${ticket.id})`);

    // 6. UserChallenge 생성 (ACTIVE 상태)
    const userChallenge = await tx.userChallenge.create({
      data: {
        userId,
        productId: product.id,
        ticketId: ticket.id,
        activatedAt,
        expiresAt,
        purchasedAt: activatedAt,
        status: 'ACTIVE',
        createdAt: activatedAt,
        isFirstEntry: false,  // 이미 진행 중이므로
        startDateSetAt: activatedAt,
      },
    });
    console.log(`✅ UserChallenge 생성 완료 (id: ${userChallenge.id})`);

    // 7. 1일차부터 (targetDay-1)일차까지 DailyProgress 생성
    const dailyProgressData = [];
    for (let day = 1; day < targetDay; day++) {
      const date = new Date(activatedAt.getTime() + (day - 1) * 24 * 60 * 60 * 1000);
      dailyProgressData.push({
        userChallengeId: userChallenge.id,
        day,
        date,
        missionsTotal: 3,
        missionsCompleted: 3,
        surveysTotal: 1,
        surveysCompleted: 1,
        quizzesTotal: 1,
        quizzesCorrect: 1,
        contentsTotal: 2,
        contentsViewed: 2,
        trackingsTotal: 1,
        trackingsCompleted: 1,
        pointsEarned: 100,
        createdAt: date,
      });
    }

    if (dailyProgressData.length > 0) {
      await tx.dailyProgress.createMany({
        data: dailyProgressData,
      });
      console.log(`✅ DailyProgress 생성 완료 (1~${targetDay - 1}일차, ${dailyProgressData.length}개)`);
    }

    // 8. 유저 상태 업데이트 (CHALLENGER)
    await tx.user.update({
      where: { id: userId },
      data: { status: 'CHALLENGER' },
    });
    console.log(`✅ 유저 상태 업데이트 완료 (CHALLENGER)`);
  });

  console.log('');
  console.log('=== 전환 완료 ===');
  console.log(`userId ${userId}가 ${targetDay}일차 챌린저로 전환되었습니다.`);
}

main()
  .catch((e) => {
    console.error('실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
