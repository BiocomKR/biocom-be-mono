import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 챌린지 일차 테스트용 스크립트
 * 특정 유저의 activatedAt을 조정하여 원하는 챌린지 일차로 테스트
 *
 * 사용법:
 * npx ts-node prisma/operation/set-challenge-day.ts <userId> <targetDay>
 *
 * 예시:
 * npx ts-node prisma/operation/set-challenge-day.ts 40 7    # 7일차로 설정 (ACTIVE로 변경)
 * npx ts-node prisma/operation/set-challenge-day.ts 40 1    # 1일차로 설정 (ACTIVE로 변경)
 * npx ts-node prisma/operation/set-challenge-day.ts 40 0    # 챌린지 전날 (PENDING 상태)
 * npx ts-node prisma/operation/set-challenge-day.ts 40 -1   # 챌린지 2일 전 (PENDING 상태)
 */

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('사용법: npx ts-node prisma/operation/set-challenge-day.ts <userId> <targetDay>');
    console.log('');
    console.log('예시:');
    console.log('  npx ts-node prisma/operation/set-challenge-day.ts 40 7   # 7일차 (ACTIVE)');
    console.log('  npx ts-node prisma/operation/set-challenge-day.ts 40 1   # 1일차 (ACTIVE)');
    console.log('  npx ts-node prisma/operation/set-challenge-day.ts 40 0   # 전날 (PENDING)');
    console.log('  npx ts-node prisma/operation/set-challenge-day.ts 40 -1  # 2일 전 (PENDING)');
    console.log('');

    // 현재 ACTIVE 챌린지 목록 보여주기
    console.log('=== 현재 ACTIVE 챌린지 목록 ===');
    const activeChallenges = await prisma.userChallenge.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        userId: true,
        activatedAt: true,
        status: true,
        user: { select: { mobile: true } },
      },
    });

    if (activeChallenges.length === 0) {
      console.log('ACTIVE 챌린지가 없습니다.');
    } else {
      const now = new Date();
      for (const uc of activeChallenges) {
        const diffTime = now.getTime() - uc.activatedAt.getTime();
        const currentDay = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        console.log(
          `  userId: ${uc.userId}, challengeId: ${uc.id}, 현재 ${currentDay}일차, activatedAt: ${uc.activatedAt.toISOString().split('T')[0]}`,
        );
      }
    }
    return;
  }

  const userId = parseInt(args[0], 10);
  const targetDay = parseInt(args[1], 10);

  if (isNaN(userId) || isNaN(targetDay)) {
    console.error('❌ userId와 targetDay는 유효한 숫자여야 합니다.');
    process.exit(1);
  }

  // ACTIVE 또는 PENDING 챌린지 조회 (ACTIVE 우선)
  let challenge = await prisma.userChallenge.findFirst({
    where: { userId, status: 'ACTIVE' },
  });

  if (!challenge) {
    challenge = await prisma.userChallenge.findFirst({
      where: { userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!challenge) {
    console.error(`❌ userId ${userId}의 ACTIVE/PENDING 챌린지를 찾을 수 없습니다.`);

    // 해당 유저의 모든 챌린지 보여주기
    const allChallenges = await prisma.userChallenge.findMany({
      where: { userId },
      select: { id: true, status: true, activatedAt: true },
    });

    if (allChallenges.length > 0) {
      console.log(`\nuserId ${userId}의 챌린지 목록:`);
      for (const uc of allChallenges) {
        console.log(`  id: ${uc.id}, status: ${uc.status}, activatedAt: ${uc.activatedAt?.toISOString().split('T')[0] || 'null'}`);
      }
    }
    process.exit(1);
  }

  // 새로운 activatedAt 계산: 오늘 UTC 00:00:00 기준 - (targetDay - 1)일
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const newActivatedAt = new Date(todayUTC.getTime() - (targetDay - 1) * 24 * 60 * 60 * 1000);

  // 챌린지 기간 계산 (기존 expiresAt - activatedAt)
  const oldActivatedAt = challenge.activatedAt;
  const oldExpiresAt = challenge.expiresAt;
  const challengeDuration = oldExpiresAt.getTime() - oldActivatedAt.getTime();

  // 새로운 expiresAt 계산: newActivatedAt + 기존 챌린지 기간
  const newExpiresAt = new Date(newActivatedAt.getTime() + challengeDuration);

  // 상태 결정: targetDay >= 1이면 ACTIVE, 0 이하면 PENDING
  const newStatus = targetDay >= 1 ? 'ACTIVE' : 'PENDING';
  const newUserStatus = targetDay >= 1 ? 'CHALLENGER' : 'NEWCOMER';

  // 기존 값 출력
  const oldDiffTime = now.getTime() - oldActivatedAt.getTime();
  const oldDay = Math.ceil(oldDiffTime / (1000 * 60 * 60 * 24));

  console.log('=== 챌린지 일차 변경 ===');
  console.log(`userId: ${userId}`);
  console.log(`challengeId: ${challenge.id}`);
  console.log('');
  console.log(`변경 전: ${oldDay >= 1 ? oldDay + '일차' : 'D' + oldDay} (status: ${challenge.status})`);
  console.log(`  activatedAt: ${oldActivatedAt.toISOString().split('T')[0]}`);
  console.log(`  expiresAt: ${oldExpiresAt.toISOString().split('T')[0]}`);
  console.log(`변경 후: ${targetDay >= 1 ? targetDay + '일차' : 'D' + targetDay} (status: ${newStatus})`);
  console.log(`  activatedAt: ${newActivatedAt.toISOString().split('T')[0]}`);
  console.log(`  expiresAt: ${newExpiresAt.toISOString().split('T')[0]}`);

  // 업데이트
  await prisma.userChallenge.update({
    where: { id: challenge.id },
    data: {
      activatedAt: newActivatedAt,
      expiresAt: newExpiresAt,
      status: newStatus,
    },
  });

  // 유저 상태도 업데이트
  await prisma.user.update({
    where: { id: userId },
    data: { status: newUserStatus },
  });

  console.log('');
  console.log(`✅ 변경 완료! (유저 status: ${newUserStatus})`);
}

main()
  .catch((e) => {
    console.error('실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
