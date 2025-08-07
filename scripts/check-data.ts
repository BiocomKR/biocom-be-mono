import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Mission 테이블 확인
  const missions = await prisma.mission.findMany({
    where: {
      code: {
        in: ['QUIZ', 'DAILY_MISSION', 'DAILY_CONTENT']
      }
    }
  });
  
  console.log('\n📋 Mission 테이블:');
  missions.forEach(m => {
    console.log(`- ${m.code}: ${m.name} (ID: ${m.id})`);
  });

  // MissionSchedule 개수 확인
  const schedules = await prisma.missionSchedule.groupBy({
    by: ['type'],
    _count: true
  });
  
  console.log('\n📊 MissionSchedule 데이터 개수:');
  schedules.forEach(s => {
    console.log(`- ${s.type}: ${s._count}개`);
  });

  // 샘플 데이터 확인 (각 타입별 1개씩)
  console.log('\n📝 샘플 데이터:');
  
  // 퀴즈 샘플
  const quizSample = await prisma.missionSchedule.findFirst({
    where: { type: 'QUIZ', day: 1 }
  });
  if (quizSample) {
    console.log('\n[QUIZ - Day 1]');
    console.log('Title:', quizSample.title);
    console.log('Data:', JSON.stringify(quizSample.data, null, 2));
  }

  // 1일1미션 샘플
  const missionSample = await prisma.missionSchedule.findFirst({
    where: { type: 'DAILY_MISSION', day: 1 }
  });
  if (missionSample) {
    console.log('\n[DAILY_MISSION - Day 1]');
    console.log('Title:', missionSample.title);
    console.log('Data:', JSON.stringify(missionSample.data, null, 2));
  }

  // 컨텐츠 샘플
  const contentSample = await prisma.missionSchedule.findFirst({
    where: { type: 'CONTENT', day: 3 }
  });
  if (contentSample) {
    console.log('\n[CONTENT - Day 3]');
    console.log('Title:', contentSample.title);
    console.log('Data:', JSON.stringify(contentSample.data, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());