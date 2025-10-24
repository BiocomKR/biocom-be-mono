import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 운동 종목 데이터 시드
 * 활동_운동목록.png에서 확인된 데이터를 기반으로 생성
 */
async function seedExerciseTypes() {
  console.log('🏃‍♂️ 운동 종목 데이터 시드를 시작합니다...');

  // 기존 데이터 삭제
  await prisma.exerciseType.deleteMany();
  console.log('기존 운동 종목 데이터를 삭제했습니다.');

  // 운동 종목 데이터 (이미지에서 확인된 정보)
  const exerciseTypes = [
    {
      name: '걷기',
      code: 'WALKING',
      category: '유산소',
      calorieRate: 150, // 시간당 150kcal
      sortOrder: 1,
    },
    {
      name: '달리기',
      code: 'RUNNING',
      category: '유산소',
      calorieRate: 150, // 시간당 150kcal
      sortOrder: 2,
    },
    {
      name: '계단 오르기',
      code: 'STAIR_CLIMBING',
      category: '유산소',
      calorieRate: 150, // 시간당 150kcal
      sortOrder: 3,
    },
    {
      name: '스트레칭',
      code: 'STRETCHING',
      category: '스트레칭',
      calorieRate: 150, // 시간당 150kcal
      sortOrder: 4,
    },
    {
      name: '흥요가',
      code: 'YOGA',
      category: '스트레칭',
      calorieRate: 150, // 시간당 150kcal
      sortOrder: 5,
    },
    {
      name: '사이클링',
      code: 'CYCLING',
      category: '유산소',
      calorieRate: 150, // 시간당 150kcal
      sortOrder: 6,
    },
    {
      name: '클라이밍',
      code: 'CLIMBING',
      category: '무산소',
      calorieRate: 150, // 시간당 150kcal
      sortOrder: 7,
    },
    // 추가로 웨이트 트레이닝도 포함 (기존에 있던 것 같아서)
    {
      name: '웨이트 트레이닝',
      code: 'WEIGHT_TRAINING',
      category: '무산소',
      calorieRate: 200, // 웨이트는 조금 더 높게 설정
      sortOrder: 8,
    },
  ];

  // 데이터 삽입
  for (const exerciseType of exerciseTypes) {
    const now = new Date();
    await prisma.exerciseType.create({
      data: {
        ...exerciseType,
        createdAt: now,
        updatedAt: now
      },
    });
    console.log(`✅ ${exerciseType.name} (${exerciseType.code}) 추가 완료`);
  }

  console.log('🎉 운동 종목 데이터 시드가 완료되었습니다!');
}

async function main() {
  try {
    await seedExerciseTypes();
  } catch (error) {
    console.error('❌ 시드 실행 중 오류 발생:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();