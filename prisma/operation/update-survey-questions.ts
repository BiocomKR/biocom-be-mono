import { PrismaClient } from '@prisma/client';
import { getNowKST } from '../../src/common/utils/kst-date.util';

const prisma = new PrismaClient();

/**
 * 문진 문안 업데이트 스크립트
 *
 * 1. survey_options: 선택지 문안 변경 (동의하지 않음 → 그렇지 않다)
 * 2. survey_questions: 질문 문안 변경 (25개)
 *
 * 실행: npx ts-node prisma/operation/update-survey-questions.ts
 */

// 새로운 선택지 문안 (PRE_SURVEY용 - 5개)
const newPreSurveyOptions = [
  { score: 0, oldText: '그렇지 않다', newText: '그렇지 않다' }, // 유지
  { score: -3, oldText: '약간 그렇지 않다', newText: '약간 그렇지 않다' }, // 유지
  { score: -7, oldText: '보통이다', newText: '보통이다' }, // 유지
  { score: -10, oldText: '약간 그렇다', newText: '약간 그렇다' }, // 유지
  { score: -14, oldText: '그렇다', newText: '그렇다' }, // 유지
];

// 새로운 질문 문안 (카테고리별 5개씩, 총 25개)
const newQuestions = {
  // 염증 (SKIN_HEALTH) - 5문항
  SKIN_HEALTH: [
    '아침에 일어나면\n얼굴이나 손이 자주 붓는 편인가요?',
    '피부가 예민해서 새로운 화장품을 쓰면\n금세 붉어지거나 트러블이 올라오나요?',
    '딱히 덥지도 않은데\n얼굴만 갑자기 화끈거릴 때가 있나요?',
    '이유 없는 멍이 잘 생기나요?',
    '오후가 되면 눈이 건조해\n인공눈물을 자주 찾게 되나요?',
  ],

  // 대사 밸런스 (METABOLISM) - 5문항
  METABOLISM: [
    '점심 식사 후 유난히 졸음이 몰려오나요?',
    '밥을 먹은 지 얼마 안 됐는데도\n빵이나 과자가 당기나요?',
    '피곤해 보인다는 말을 자주 들을 정도로\n안색이 칙칙하고 피부가 푸석한가요?',
    '아침에 일어나기가 힘들고,\n\'5분만 더\' 하며 알람을 미루게 되나요?',
    '머릿속에 안개가 낀 듯 멍해\n일에 집중하기 어려울 때가 많나요?',
  ],

  // 장 건강 (GUT_HEALTH) - 5문항
  GUT_HEALTH: [
    '식사 후, 아랫배가 빵빵하게 부풀거나\n속이 불편한가요?',
    '속이 더부룩했던 날, 며칠 뒤\n턱이나 이마에 뾰루지가 올라온 적 있나요?',
    '화장실 가는 주기가 불규칙하거나,\n다녀와도 시원하지 않은 느낌이 있나요?',
    '밀가루 음식이나 우유를 먹은 날,\n속이 불편하고 가스가 많이 차나요?',
    '턱선을 따라 오돌토돌한 트러블이\n자주 생기나요?',
  ],

  // 면역 과민 반응 (IMMUNE_BALANCE) - 5문항
  IMMUNE_BALANCE: [
    '이유 없이 몸이나 얼굴이 가려울 때가 있나요?',
    '피부를 살짝 긁기만 해도\n빨갛게 부풀고 자국이 오래 남나요?',
    '순한 화장품인데도\n따갑거나 얼굴이 붉어질 때가 있나요?',
    '스트레스를 받으면 피부가 가렵거나\n갑자기 뒤집어질 때가 있나요?',
    '니트나 목걸이처럼 피부에 닿는 것 때문에\n가렵거나 신경 쓰일 때가 있나요?',
  ],

  // 수면 (SLEEP) - 5문항
  SLEEP: [
    '평균 수면 시간이 6시간보다 적나요?',
    '잠들기까지 30분 이상 걸리는 편인가요?',
    '자는 동안 자주 깨거나,\n한 번 깨면 다시 잠들기 어렵나요?',
    '아침에 일어났을 때 개운하지 않고 피로감이 남아 있나요?',
    '충분히 잤는데도 다음날 졸리거나 머리가 멍한 느낌이 자주 드나요?',
  ],
};

// 카테고리별 한글명 매핑
const categoryNameMap: { [key: string]: string } = {
  SKIN_HEALTH: '염증',
  METABOLISM: '대사 밸런스',
  GUT_HEALTH: '장 건강',
  IMMUNE_BALANCE: '면역 과민 반응',
  SLEEP: '수면',
};

async function updateSurveyData() {
  console.log('🚀 문진 문안 업데이트 시작...\n');

  try {
    // 1. 현재 데이터 확인
    console.log('📋 현재 데이터 확인 중...');

    const currentOptions = await prisma.surveyOption.findMany({
      where: { surveyType: 'PRE_SURVEY' },
      orderBy: { id: 'asc' },
    });
    console.log(`  - PRE_SURVEY 옵션 수: ${currentOptions.length}개`);

    const currentQuestions = await prisma.surveyQuestion.findMany({
      where: { isActive: true },
      orderBy: [{ categoryCode: 'asc' }, { sortOrder: 'asc' }],
    });
    console.log(`  - 활성 질문 수: ${currentQuestions.length}개\n`);

    // 2. survey_questions 업데이트
    console.log('📝 질문 문안 업데이트 중...');

    const categoryOrder = ['SKIN_HEALTH', 'METABOLISM', 'GUT_HEALTH', 'IMMUNE_BALANCE', 'SLEEP'];
    let questionUpdateCount = 0;

    for (const categoryCode of categoryOrder) {
      const questionsInCategory = currentQuestions.filter(q => q.categoryCode === categoryCode);
      const newTexts = newQuestions[categoryCode as keyof typeof newQuestions];
      const categoryName = categoryNameMap[categoryCode];

      console.log(`\n  [${categoryName}] (${categoryCode})`);

      if (questionsInCategory.length !== newTexts.length) {
        console.log(`    ⚠️  질문 수 불일치: DB ${questionsInCategory.length}개, 신규 ${newTexts.length}개`);
        console.log(`    ⚠️  sortOrder 기준으로 매핑 진행...`);
      }

      // sortOrder 순으로 정렬
      const sortedQuestions = questionsInCategory.sort((a, b) => a.sortOrder - b.sortOrder);

      for (let i = 0; i < newTexts.length; i++) {
        const question = sortedQuestions[i];
        const newText = newTexts[i];

        if (question) {
          console.log(`    ${i + 1}. ID ${question.id}: "${question.questionText.substring(0, 20)}..." → "${newText.substring(0, 20)}..."`);

          await prisma.surveyQuestion.update({
            where: { id: question.id },
            data: {
              questionText: newText,
              category: categoryName,
              updatedAt: getNowKST(),
            },
          });
          questionUpdateCount++;
        } else {
          console.log(`    ${i + 1}. ⚠️  매핑할 질문 없음 (새로 INSERT 필요)`);
        }
      }
    }

    console.log(`\n✅ 질문 업데이트 완료: ${questionUpdateCount}개`);

    // 3. 결과 확인
    console.log('\n📊 업데이트 결과 확인...');

    const updatedQuestions = await prisma.surveyQuestion.findMany({
      where: { isActive: true },
      orderBy: [{ categoryCode: 'asc' }, { sortOrder: 'asc' }],
    });

    console.log('\n=== 업데이트된 질문 목록 ===');
    for (const categoryCode of categoryOrder) {
      const questions = updatedQuestions.filter(q => q.categoryCode === categoryCode);
      console.log(`\n[${categoryNameMap[categoryCode]}] (${categoryCode})`);
      questions.forEach((q, i) => {
        console.log(`  ${i + 1}. (ID: ${q.id}) ${q.questionText.replace(/\n/g, ' ')}`);
      });
    }

    console.log('\n🎉 문진 문안 업데이트 완료!');

  } catch (error) {
    console.error('❌ 업데이트 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
if (require.main === module) {
  updateSurveyData()
    .then(() => {
      console.log('\n✅ 스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export default updateSurveyData;
