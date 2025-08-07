import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSurveyData() {
  console.log('=== 설문 데이터 확인 ===\n');

  // 1. 설문 질문 카테고리별 개수
  const questionsByCategory = await prisma.surveyQuestion.groupBy({
    by: ['category', 'categoryCode'],
    _count: true,
    orderBy: { category: 'asc' }
  });

  console.log('1. 카테고리별 질문 개수:');
  questionsByCategory.forEach(cat => {
    console.log(`   - ${cat.category} (${cat.categoryCode}): ${cat._count}개`);
  });

  // 2. 전체 질문 목록 (처음 5개만)
  const questions = await prisma.surveyQuestion.findMany({
    take: 5,
    orderBy: [{ categoryCode: 'asc' }, { sortOrder: 'asc' }]
  });

  console.log('\n2. 질문 예시 (처음 5개):');
  questions.forEach(q => {
    console.log(`   [${q.id}] ${q.category} - ${q.questionText}`);
  });

  // 3. 설문 옵션 확인
  const options = await prisma.surveyOption.findMany({
    orderBy: { score: 'desc' }
  });

  console.log('\n3. 설문 옵션 (점수순):');
  options.forEach(opt => {
    console.log(`   [${opt.id}] ${opt.optionText} - ${opt.score}점`);
  });

  // 4. 전체 질문 개수
  const totalQuestions = await prisma.surveyQuestion.count();
  console.log(`\n4. 전체 질문 개수: ${totalQuestions}개`);

  // 5. 카테고리별 상세 질문 확인
  const categories = ['피부 건강', '대사 건강', '면역 밸런스', '장 건강'];
  
  console.log('\n5. 카테고리별 질문 상세:');
  for (const category of categories) {
    const categoryQuestions = await prisma.surveyQuestion.findMany({
      where: { category },
      orderBy: { sortOrder: 'asc' }
    });
    
    console.log(`\n   ${category} (${categoryQuestions[0]?.categoryCode || 'N/A'}):`);
    categoryQuestions.forEach(q => {
      console.log(`     ${q.sortOrder}. [ID:${q.id}] ${q.questionText}`);
    });
  }

  // 6. 데이터 무결성 체크
  console.log('\n6. 데이터 무결성 체크:');
  
  // 중복된 sortOrder 체크
  const duplicateSortOrders = await prisma.$queryRaw`
    SELECT category, sort_order, COUNT(*) as count 
    FROM survey_questions 
    GROUP BY category, sort_order 
    HAVING COUNT(*) > 1
  `;
  
  if (Array.isArray(duplicateSortOrders) && duplicateSortOrders.length > 0) {
    console.log('   ⚠️  중복된 정렬 순서 발견:');
    duplicateSortOrders.forEach((dup: any) => {
      console.log(`      - ${dup.category}: sortOrder ${dup.sort_order} (${dup.count}개)`);
    });
  } else {
    console.log('   ✅ 중복된 정렬 순서 없음');
  }

  // 카테고리 코드 일관성 체크
  const inconsistentCategories = await prisma.$queryRaw`
    SELECT DISTINCT category, category_code 
    FROM survey_questions 
    ORDER BY category
  `;
  
  console.log('\n   카테고리 코드 매핑:');
  if (Array.isArray(inconsistentCategories)) {
    inconsistentCategories.forEach((cat: any) => {
      console.log(`      - ${cat.category} → ${cat.category_code}`);
    });
  }
}

checkSurveyData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());