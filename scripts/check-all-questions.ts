import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAllQuestions() {
  console.log('=== 전체 설문 질문 확인 ===\n');

  // ID 순서로 전체 질문 조회
  const allQuestions = await prisma.surveyQuestion.findMany({
    orderBy: { id: 'asc' }
  });

  console.log(`전체 질문 개수: ${allQuestions.length}개\n`);
  
  allQuestions.forEach(q => {
    console.log(`[ID:${q.id}] ${q.category} (${q.categoryCode}) - 순서:${q.sortOrder}`);
    console.log(`   ${q.questionText}\n`);
  });

  // ID 범위 확인
  const minId = await prisma.surveyQuestion.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true }
  });
  
  const maxId = await prisma.surveyQuestion.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true }
  });

  console.log(`\nID 범위: ${minId?.id} ~ ${maxId?.id}`);
}

checkAllQuestions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());