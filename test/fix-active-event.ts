import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixActiveEvent() {
  try {
    console.log('🔧 활성 이벤트 수정 중...');

    // 1. 모든 이벤트 비활성화
    await prisma.event.updateMany({
      data: { isActive: false }
    });
    console.log('✅ 모든 이벤트 비활성화 완료');

    // 2. TEST 이벤트만 활성화
    const testEvent = await prisma.event.findFirst({
      where: { name: 'TEST 21일 건강 챌린지' },
      orderBy: { id: 'desc' }
    });

    if (testEvent) {
      await prisma.event.update({
        where: { id: testEvent.id },
        data: { isActive: true }
      });
      console.log(`✅ TEST 이벤트 활성화 완료 (ID: ${testEvent.id})`);
    }

    // 3. 현재 활성 이벤트 확인
    const activeEvent = await prisma.event.findFirst({
      where: { isActive: true },
      include: {
        eventMissions: true,
        eventSurveys: true,
        eventQuizzes: true
      }
    });

    if (activeEvent) {
      console.log(`\n📊 현재 활성 이벤트: ${activeEvent.name}`);
      console.log(`- 시작일: ${activeEvent.startDate}`);
      console.log(`- 종료일: ${activeEvent.endDate}`);
      console.log(`- 미션: ${activeEvent.eventMissions.length}개`);
      console.log(`- 설문: ${activeEvent.eventSurveys.length}개`);
      console.log(`- 퀴즈: ${activeEvent.eventQuizzes.length}개`);
    }

  } catch (error) {
    console.error('❌ 에러 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixActiveEvent();