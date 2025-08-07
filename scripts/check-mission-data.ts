import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMissionData() {
  console.log('=== 미션 관련 데이터 확인 ===\n');

  // 1. 미션 테이블 확인
  const missions = await prisma.mission.findMany({
    orderBy: { sortOrder: 'asc' }
  });

  console.log('1. 미션 마스터 데이터:');
  missions.forEach(m => {
    console.log(`   [${m.id}] ${m.code} - ${m.name} (${m.points}점)`);
  });

  // 2. 미션 스케줄 확인
  const schedules = await prisma.missionSchedule.findMany({
    include: { mission: true },
    orderBy: [{ day: 'asc' }, { missionId: 'asc' }]
  });

  console.log('\n2. 미션 스케줄 데이터:');
  console.log(`   총 ${schedules.length}개의 스케줄 데이터\n`);
  
  // 일차별로 그룹핑
  const schedulesByDay = schedules.reduce((acc, s) => {
    if (!acc[s.day]) acc[s.day] = [];
    acc[s.day].push(s);
    return acc;
  }, {} as Record<number, typeof schedules>);

  // 처음 5일치만 출력
  for (let day = 1; day <= 5; day++) {
    if (schedulesByDay[day]) {
      console.log(`   ${day}일차:`);
      schedulesByDay[day].forEach(s => {
        console.log(`     - ${s.mission.name} (${s.type}): ${s.title}`);
        console.log(`       데이터: ${JSON.stringify(s.data)}`);
      });
    }
  }

  // 3. 퀴즈 타입 스케줄 확인
  const quizSchedules = schedules.filter(s => s.type === 'QUIZ');
  console.log(`\n3. 퀴즈 스케줄: ${quizSchedules.length}개`);
  
  // 4. 31일차 데이터 확인
  const day31Schedules = schedules.filter(s => s.day === 31);
  console.log(`\n4. 31일차 스케줄: ${day31Schedules.length}개`);
  if (day31Schedules.length > 0) {
    day31Schedules.forEach(s => {
      console.log(`   - ${s.mission.name} (${s.type}): ${s.title}`);
    });
  }

  // 5. 카테고리 상세 확인
  const categoryDetails = await prisma.categoryDetail.findMany();
  console.log('\n5. 카테고리 상세 데이터:');
  categoryDetails.forEach(c => {
    console.log(`   - ${c.categoryCode}: ${c.animalCharacter} (${c.characterKeyword})`);
  });

  // 6. 사용자가 날짜를 입력한 경우 해당 일차 계산
  const today = new Date('2025-07-30');
  const startDate = new Date('2025-07-01'); // 프로그램 시작일 (가정)
  const dayNumber = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  console.log(`\n6. 오늘(2025-07-30) 일차 계산: ${dayNumber}일차`);
  
  const todaySchedules = schedules.filter(s => s.day === dayNumber);
  if (todaySchedules.length > 0) {
    console.log(`   오늘의 스케줄:`);
    todaySchedules.forEach(s => {
      console.log(`   - ${s.mission.name} (${s.type}): ${s.title}`);
    });
  }
}

checkMissionData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());