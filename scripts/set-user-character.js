const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setUserCharacter() {
  console.log('👤 사용자에게 캐릭터 설정 중...');

  try {
    // 사용자 ID 1에게 스텔라(ID: 1) 캐릭터 설정
    const user = await prisma.user.update({
      where: { id: 1 },
      data: { characterId: 1 }
    });

    console.log(`✅ 사용자 ${user.id}에게 캐릭터 ${user.characterId} 설정 완료`);

    // 챌린지도 생성해주자
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 21); // 21일 후

    await prisma.userChallenge.create({
      data: {
        userId: 1,
        challengeId: 1, // 기본 챌린지 ID
        isActive: true,
        activatedAt: new Date(),
        expiresAt: expiresAt
      }
    });

    console.log('✅ 활성 챌린지도 생성 완료');

  } catch (error) {
    if (error.code === 'P2002') {
      console.log('ℹ️ 사용자에게 이미 챌린지가 있습니다.');
    } else {
      console.error('❌ 오류 발생:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

setUserCharacter();