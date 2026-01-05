import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom?connection_limit=10&pool_timeout=30&connect_timeout=10&timezone=Asia/Seoul'
    }
  }
});

async function main() {
  const userId = 45;
  
  console.log('\n========== 1. 유저 기본 정보 ==========');
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, points: true, createdAt: true }
  });
  console.log(user);
  
  console.log('\n========== 2. 유저 챌린지 정보 ==========');
  const userChallenges = await prisma.userChallenge.findMany({
    where: { userId },
    include: {
      product: { select: { id: true, name: true } }
    }
  });
  console.log(JSON.stringify(userChallenges, null, 2));
  
  console.log('\n========== 3. 퀴즈 시도 기록 (quiz_attempts) ==========');
  const quizAttempts = await prisma.quizAttempt.findMany({
    where: { userId },
    include: {
      quiz: { select: { id: true, question: true, points: true } },
      content: { select: { id: true, title: true, points: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log(JSON.stringify(quizAttempts, null, 2));
  
  console.log('\n========== 4. 포인트 히스토리 (최근 30개) ==========');
  const pointHistories = await prisma.pointHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30
  });
  console.log(JSON.stringify(pointHistories, null, 2));
  
  console.log('\n========== 5. 일일 진행 현황 (daily_progress) ==========');
  const userChallengeIds = userChallenges.map((uc: { id: number }) => uc.id);
  const dailyProgress = await prisma.dailyProgress.findMany({
    where: { userChallengeId: { in: userChallengeIds } },
    orderBy: { day: 'asc' }
  });
  console.log(JSON.stringify(dailyProgress, null, 2));
  
  console.log('\n========== 6. 강의 퀴즈 (lecture_quizzes) - 전체 확인 ==========');
  const lectureQuizzes = await prisma.lectureQuiz.findMany({
    include: {
      content: { select: { id: true, title: true, points: true } },
      quiz: { select: { id: true, question: true, points: true } }
    }
  });
  console.log(JSON.stringify(lectureQuizzes, null, 2));
  
  console.log('\n========== 7. 퀴즈 관련 포인트 히스토리만 ==========');
  const quizPointHistories = await prisma.pointHistory.findMany({
    where: { 
      userId,
      OR: [
        { description: { contains: '퀴즈' } },
        { description: { contains: 'quiz' } },
        { description: { contains: 'Quiz' } },
        { relatedType: 'QUIZ' },
        { relatedType: 'LECTURE' },
        { relatedType: 'CONTENT' }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log(JSON.stringify(quizPointHistories, null, 2));
  
  await prisma.$disconnect();
}

main().catch(console.error);
