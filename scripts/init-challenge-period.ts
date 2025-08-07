import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function initChallengePeriod() {
  console.log('=== 챌린지 기간 초기 데이터 생성 ===\n');

  try {
    // 기존 활성 챌린지 확인
    const existingActive = await prisma.event.findFirst({
      where: { isActive: true }
    });

    if (existingActive) {
      console.log('이미 활성화된 챌린지가 있습니다:', existingActive.name);
      console.log(`기간: ${existingActive.startDate} ~ ${existingActive.endDate}`);
      return;
    }

    // 새 챌린지 생성 (2025년 7월 1일 시작)
    const startDate = new Date('2025-07-01');
    const endDate = new Date('2025-07-21');
    
    const newPeriod = await prisma.event.create({
      data: {
        name: '2025년 7월 건강 챌린지',
        startDate,
        endDate,
        totalDays: 21,
        isActive: true,
        description: '21일간의 건강한 생활 습관 만들기 챌린지'
      }
    });

    console.log('✅ 새 챌린지가 생성되었습니다!');
    console.log(`   이름: ${newPeriod.name}`);
    console.log(`   시작일: ${newPeriod.startDate}`);
    console.log(`   종료일: ${newPeriod.endDate}`);
    console.log(`   총 일수: ${newPeriod.totalDays}일`);
    console.log(`   상태: ${newPeriod.isActive ? '활성' : '비활성'}`);

  } catch (error) {
    console.error('❌ 초기 데이터 생성 실패:', error);
  }
}

initChallengePeriod()
  .catch(console.error)
  .finally(() => prisma.$disconnect());