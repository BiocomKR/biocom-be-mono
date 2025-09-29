const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAiCharacters() {
  console.log('🤖 AI 캐릭터 데이터 확인 중...');

  try {
    const characters = await prisma.aiCharacter.findMany({
      orderBy: { id: 'asc' }
    });

    if (characters.length === 0) {
      console.log('❌ AI 캐릭터 데이터가 없습니다.');
      return;
    }

    console.log(`✅ 총 ${characters.length}개의 AI 캐릭터 발견:`);
    console.log('=' * 50);

    characters.forEach((char, index) => {
      console.log(`${index + 1}. [ID: ${char.id}] ${char.name}`);
      console.log(`   성격: ${char.personality || '미설정'}`);
      console.log(`   설명: ${char.description || '미설정'}`);
      console.log(`   상태: ${char.isActive ? '활성' : '비활성'}`);
      console.log(`   생성일: ${char.createdAt}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ AI 캐릭터 조회 중 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAiCharacters();