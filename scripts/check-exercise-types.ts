import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkExerciseTypes() {
  console.log('🔍 현재 exercise_types 테이블 데이터 확인...');

  const exerciseTypes = await prisma.exerciseType.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  console.log(`총 ${exerciseTypes.length}개의 운동 종목이 있습니다:`);
  console.table(exerciseTypes.map(et => ({
    id: et.id,
    name: et.name,
    code: et.code,
    category: et.category,
    calorieRate: et.calorieRate,
    sortOrder: et.sortOrder,
    isActive: et.isActive,
  })));
}

async function main() {
  try {
    await checkExerciseTypes();
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();