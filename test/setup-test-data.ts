import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupTestData() {
  try {
    console.log('🔧 테스트 데이터 설정 시작...');

    // 1. 기존 테스트 이벤트 비활성화
    await prisma.event.updateMany({
      where: { name: { startsWith: 'TEST' } },
      data: { isActive: false }
    });

    // 2. 테스트 이벤트 생성
    const testEvent = await prisma.event.create({
      data: {
        type: 'CHALLENGE',
        name: 'TEST 21일 건강 챌린지',
        description: '테스트용 건강 챌린지입니다',
        startDate: new Date(),
        endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20일 후
        totalDays: 21,
        isActive: true
      }
    });
    console.log(`✅ 테스트 이벤트 생성: ${testEvent.name} (ID: ${testEvent.id})`);

    // 3. 테스트 설문 생성 또는 조회
    let testSurvey = await prisma.survey.findFirst({
      where: { name: '테스트 건강 설문' }
    });

    if (!testSurvey) {
      testSurvey = await prisma.survey.create({
        data: {
          name: '테스트 건강 설문',
          description: '건강 상태 체크를 위한 설문입니다',
          isActive: true
        }
      });
    }
    console.log(`✅ 테스트 설문: ${testSurvey.name} (ID: ${testSurvey.id})`);

    // 4. 이벤트-설문 연결
    await prisma.eventSurvey.createMany({
      data: [
        {
          eventId: testEvent.id,
          surveyId: testSurvey.id,
          surveyOptions: { type: 'before', fromDay: 1 },
          isActive: true
        },
        {
          eventId: testEvent.id,
          surveyId: testSurvey.id,
          surveyOptions: { type: 'after', fromDay: 19 },
          isActive: true
        }
      ],
      skipDuplicates: true
    });
    console.log('✅ 이벤트-설문 연결 완료');

    // 5. 테스트 미션 생성
    const missions = await prisma.mission.createMany({
      data: [
        {
          code: 'TEST_WATER',
          name: '물 8잔 마시기',
          description: '하루에 물을 8잔 이상 마십니다',
          points: 100,
          category: 'DAILY',
          requireUpload: false,
          isActive: true,
          sortOrder: 1
        },
        {
          code: 'TEST_EXERCISE',
          name: '운동 인증',
          description: '30분 이상 운동 후 인증샷을 올려주세요',
          points: 200,
          category: 'EXERCISE',
          requireUpload: true,
          uploadType: 'image',
          isActive: true,
          sortOrder: 2
        }
      ],
      skipDuplicates: true
    });
    console.log('✅ 테스트 미션 생성 완료');

    // 미션 ID 조회
    const waterMission = await prisma.mission.findUnique({ where: { code: 'TEST_WATER' } });
    const exerciseMission = await prisma.mission.findUnique({ where: { code: 'TEST_EXERCISE' } });

    // 6. 이벤트-미션 연결
    if (waterMission && exerciseMission) {
      await prisma.eventMission.createMany({
        data: [
          {
            eventId: testEvent.id,
            missionId: waterMission.id,
            points: 100,
            activeFromDay: 1,
            activeToDay: 21,
            isActive: true
          },
          {
            eventId: testEvent.id,
            missionId: exerciseMission.id,
            points: 200,
            activeFromDay: 1,
            activeToDay: 21,
            isActive: true
          }
        ],
        skipDuplicates: true
      });
      console.log('✅ 이벤트-미션 연결 완료');
    }

    // 7. 퀴즈 마스터 데이터 생성
    const quiz1 = await prisma.quiz.create({
      data: {
        title: '하루 권장 물 섭취량',
        question: '하루 권장 물 섭취량은?',
        options: ['1L', '1.5L', '2L', '3L'],
        correctAnswer: 2, // 0-based index (2L)
        points: 50,
        category: 'health',
        difficulty: 'EASY',
        isActive: true
      }
    });

    const quiz2 = await prisma.quiz.create({
      data: {
        title: '운동 후 스트레칭',
        question: '운동 후 언제 스트레칭을 해야 할까요?',
        options: ['운동 전만', '운동 후만', '운동 전후 모두', '필요없음'],
        correctAnswer: 2, // 0-based index (운동 전후 모두)
        points: 50,
        category: 'exercise',
        difficulty: 'MEDIUM',
        isActive: true
      }
    });
    console.log('✅ 퀴즈 마스터 데이터 생성 완료');

    // 8. 이벤트-퀴즈 연결
    await prisma.eventQuiz.createMany({
      data: [
        {
          eventId: testEvent.id,
          quizId: quiz1.id,
          day: 1,
          sortOrder: 0,
          isActive: true
        },
        {
          eventId: testEvent.id,
          quizId: quiz2.id,
          day: 3,
          sortOrder: 0,
          isActive: true
        }
      ],
      skipDuplicates: true
    });
    console.log('✅ 이벤트-퀴즈 연결 완료');

    // 9. 설문 질문 생성 (기본 20개)
    const questions = [];
    const categories = ['SKIN_HEALTH', 'METABOLISM', 'IMMUNE_BALANCE', 'GUT_HEALTH'];
    
    for (let i = 0; i < 20; i++) {
      const category = categories[i % 4];
      questions.push({
        surveyId: testSurvey.id,
        category,
        categoryCode: category,
        questionText: `테스트 질문 ${i + 1}: ${category} 관련 증상이 있나요?`,
        sortOrder: i + 1
      });
    }

    await prisma.surveyQuestion.createMany({
      data: questions,
      skipDuplicates: true
    });
    console.log('✅ 설문 질문 20개 생성 완료');

    // 9. 설문 선택지 생성 (없으면)
    const optionCount = await prisma.surveyOption.count();
    if (optionCount === 0) {
      await prisma.surveyOption.createMany({
        data: [
          { optionText: '그렇지 않다', score: 0 },
          { optionText: '약간 그렇지 않다', score: -3 },
          { optionText: '보통이다', score: -7 },
          { optionText: '약간 그렇다', score: -10 },
          { optionText: '그렇다', score: -14 }
        ]
      });
      console.log('✅ 설문 선택지 생성 완료');
    }

    // 결과 확인
    const activeEvents = await prisma.event.findMany({
      where: { isActive: true },
      include: {
        eventMissions: { include: { mission: true } },
        eventSurveys: { include: { survey: true } },
        eventQuizzes: true
      }
    });

    console.log('\n📊 현재 활성 이벤트:');
    activeEvents.forEach(event => {
      console.log(`- ${event.name} (ID: ${event.id})`);
      console.log(`  미션: ${event.eventMissions.length}개`);
      console.log(`  설문: ${event.eventSurveys.length}개`);
      console.log(`  퀴즈: ${event.eventQuizzes.length}개`);
    });

    console.log('\n✅ 테스트 데이터 설정 완료!');

  } catch (error) {
    console.error('❌ 에러 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestData();