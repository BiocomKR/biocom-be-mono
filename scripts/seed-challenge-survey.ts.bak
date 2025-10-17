import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 챌린지 및 설문 예시 데이터 생성 스크립트
 * 
 * 생성 데이터:
 * 1. 설문 선택지 (SurveyOption) - 5단계 공통 선택지
 * 2. 건강 설문 (Survey) - Before/After 설문
 * 3. 설문 질문들 (SurveyQuestion) - 카테고리별 질문
 * 4. 21일 건강 챌린지 (Challenge)
 * 5. 챌린지-설문 연결 (ChallengeSurvey)
 */
async function seedChallengeSurvey() {
  console.log('🚀 챌린지 및 설문 예시 데이터 생성을 시작합니다...');

  try {
    // 🔶 1. 설문 선택지 생성 (기존에 있다면 스킵)
    console.log('📝 설문 선택지 생성 중...');
    
    const existingOptions = await prisma.surveyOption.count();
    if (existingOptions === 0) {
      await prisma.surveyOption.createMany({
        data: [
          { id: 1, optionText: '그렇지 않다', score: 0 },
          { id: 2, optionText: '약간 그렇지 않다', score: -3 },
          { id: 3, optionText: '보통이다', score: -7 },
          { id: 4, optionText: '약간 그렇다', score: -10 },
          { id: 5, optionText: '그렇다', score: -14 },
        ],
      });
      console.log('✅ 설문 선택지 5개 생성 완료');
    } else {
      console.log('⚡ 설문 선택지가 이미 존재합니다 (건너뜀)');
    }

    // 🔶 2. 건강 설문 생성
    console.log('📋 건강 설문 생성 중...');
    
    const existingSurvey = await prisma.survey.findFirst({
      where: { name: '건강 상태 설문' }
    });

    let surveyId: number;
    if (!existingSurvey) {
      const survey = await prisma.survey.create({
        data: {
          name: '건강 상태 설문',
          description: '21일 챌린지를 위한 사전/사후 건강 상태 설문조사',
          type: 'before', // 기본 타입
          isActive: true,
        },
      });
      surveyId = survey.id;
      console.log(`✅ 건강 설문 생성 완료 (ID: ${surveyId})`);
    } else {
      surveyId = existingSurvey.id;
      console.log(`⚡ 건강 설문이 이미 존재합니다 (ID: ${surveyId})`);
    }

    // 🔶 3. 설문 질문들 생성
    console.log('❓ 설문 질문들 생성 중...');
    
    const existingQuestions = await prisma.surveyQuestion.count({
      where: { surveyId }
    });

    if (existingQuestions === 0) {
      const questions = [
        // 피부 건강 (SKIN_HEALTH)
        { category: '피부 건강', categoryCode: 'SKIN_HEALTH', questionText: '피부가 자주 건조하거나 가렵다', sortOrder: 1 },
        { category: '피부 건강', categoryCode: 'SKIN_HEALTH', questionText: '여드름이나 뾰루지가 자주 생긴다', sortOrder: 2 },
        { category: '피부 건강', categoryCode: 'SKIN_HEALTH', questionText: '피부 톤이 불균등하거나 칙칙하다', sortOrder: 3 },
        { category: '피부 건강', categoryCode: 'SKIN_HEALTH', questionText: '피부가 민감하여 화장품 선택이 어렵다', sortOrder: 4 },
        { category: '피부 건강', categoryCode: 'SKIN_HEALTH', questionText: '피부 노화가 빠르게 진행되는 것 같다', sortOrder: 5 },

        // 대사 건강 (METABOLISM)
        { category: '대사 건강', categoryCode: 'METABOLISM', questionText: '체중 관리가 어렵고 쉽게 살이 찐다', sortOrder: 6 },
        { category: '대사 건강', categoryCode: 'METABOLISM', questionText: '식후에 졸리거나 나른함을 자주 느낀다', sortOrder: 7 },
        { category: '대사 건강', categoryCode: 'METABOLISM', questionText: '단 것이나 탄수화물을 자주 찾게 된다', sortOrder: 8 },
        { category: '대사 건강', categoryCode: 'METABOLISM', questionText: '에너지가 부족하여 쉽게 피로해진다', sortOrder: 9 },
        { category: '대사 건강', categoryCode: 'METABOLISM', questionText: '혈당이나 콜레스테롤 수치가 걱정된다', sortOrder: 10 },

        // 면역 균형 (IMMUNE_BALANCE)
        { category: '면역 균형', categoryCode: 'IMMUNE_BALANCE', questionText: '감기나 질병에 자주 걸린다', sortOrder: 11 },
        { category: '면역 균형', categoryCode: 'IMMUNE_BALANCE', questionText: '스트레스를 받으면 몸이 쉽게 아프다', sortOrder: 12 },
        { category: '면역 균형', categoryCode: 'IMMUNE_BALANCE', questionText: '알레르기 반응이나 염증이 자주 생긴다', sortOrder: 13 },
        { category: '면역 균형', categoryCode: 'IMMUNE_BALANCE', questionText: '상처나 질병 회복이 느리다', sortOrder: 14 },
        { category: '면역 균형', categoryCode: 'IMMUNE_BALANCE', questionText: '계절 변화에 민감하게 반응한다', sortOrder: 15 },

        // 장 건강 (GUT_HEALTH)
        { category: '장 건강', categoryCode: 'GUT_HEALTH', questionText: '소화불량이나 속쓰림이 자주 있다', sortOrder: 16 },
        { category: '장 건강', categoryCode: 'GUT_HEALTH', questionText: '변비나 설사가 자주 발생한다', sortOrder: 17 },
        { category: '장 건강', categoryCode: 'GUT_HEALTH', questionText: '배에 가스가 차거나 더부룩함을 느낀다', sortOrder: 18 },
        { category: '장 건강', categoryCode: 'GUT_HEALTH', questionText: '식사 후 복통이나 불편감이 있다', sortOrder: 19 },
        { category: '장 건강', categoryCode: 'GUT_HEALTH', questionText: '장 건강과 관련된 문제가 걱정된다', sortOrder: 20 },
      ];

      await prisma.surveyQuestion.createMany({
        data: questions.map(q => ({ ...q, surveyId }))
      });
      console.log(`✅ 설문 질문 ${questions.length}개 생성 완료`);
    } else {
      console.log(`⚡ 설문 질문이 이미 존재합니다 (${existingQuestions}개)`);
    }

    // 🔶 4. 21일 건강 챌린지 생성
    console.log('🏆 21일 건강 챌린지 생성 중...');
    
    const existingChallenge = await prisma.challenge.findFirst({
      where: { name: '21일 건강 챌린지' }
    });

    let challengeId: number;
    if (!existingChallenge) {
      const challenge = await prisma.challenge.create({
        data: {
          name: '21일 건강 챌린지',
          description: '21일간 건강한 습관을 만들어가는 챌린지입니다. 매일 미션을 수행하고 건강한 변화를 경험해보세요.',
          totalDays: 21,
          isActive: true,
        },
      });
      challengeId = challenge.id;
      console.log(`✅ 21일 건강 챌린지 생성 완료 (ID: ${challengeId})`);
    } else {
      challengeId = existingChallenge.id;
      console.log(`⚡ 21일 건강 챌린지가 이미 존재합니다 (ID: ${challengeId})`);
    }

    // 🔶 5. 챌린지-설문 연결
    console.log('🔗 챌린지-설문 연결 생성 중...');
    
    const existingChallengeSurvey = await prisma.challengeSurvey.findFirst({
      where: { 
        challengeId,
        surveyId 
      }
    });

    if (!existingChallengeSurvey) {
      await prisma.challengeSurvey.createMany({
        data: [
          {
            challengeId,
            surveyId,
            day: 1, // 1일차에 사전 설문
            isActive: true,
          },
          {
            challengeId,
            surveyId,
            day: 21, // 21일차에 사후 설문
            isActive: true,
          },
        ],
      });
      console.log('✅ 챌린지-설문 연결 2개 생성 완료 (사전/사후)');
    } else {
      console.log('⚡ 챌린지-설문 연결이 이미 존재합니다 (건너뜀)');
    }

    // 🔶 6. 생성 결과 요약
    console.log('\n📊 생성된 데이터 요약:');
    console.log(`   • 설문 선택지: 5개 (5단계 척도)`);
    console.log(`   • 건강 설문: 1개 (ID: ${surveyId})`);
    console.log(`   • 설문 질문: 20개 (카테고리별 5개씩)`);
    console.log(`   • 21일 챌린지: 1개 (ID: ${challengeId})`);
    console.log(`   • 챌린지-설문 연결: 2개 (1일차 사전, 21일차 사후)`);

    console.log('\n🎉 챌린지 및 설문 예시 데이터 생성 완료!');

    // 🔶 7. API 테스트 가이드
    console.log('\n📋 API 테스트 가이드:');
    console.log(`   • GET /api/surveys/status - 사용자 설문 상태 확인`);
    console.log(`   • GET /api/surveys/questions - 설문 질문 조회`);
    console.log(`   • GET /api/surveys/${surveyId}/before - 사전 설문 조회`);
    console.log(`   • POST /api/surveys/${surveyId}/complete - 설문 완료`);
    console.log(`   • GET /api/surveys/${surveyId}/comparison - 사전/사후 비교`);

  } catch (error) {
    console.error('❌ 데이터 생성 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
if (require.main === module) {
  seedChallengeSurvey()
    .then(() => {
      console.log('✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export default seedChallengeSurvey;