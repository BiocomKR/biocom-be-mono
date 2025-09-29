const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// 캐릭터별 말투 변환 함수
function adaptToCharacter(text, characterId, characterName) {
  if (!text) return '';

  switch (characterId) {
    case 1: // 스텔라 - 야무진 워커홀릭 커리어우먼 (INTJ)
      return text
        .replace(/좋다!/g, '괜찮은 선택이네.')
        .replace(/좋아!/g, '그렇게 하자.')
        .replace(/와\s?/g, '흠, ')
        .replace(/헉/g, '역시')
        .replace(/!\s/g, '. ')
        .replace(/~+/g, '.')
        .replace(/ㅎㅎ/g, '')
        .replace(/\s+/g, ' ');

    case 2: // 메이브 - 뷰티 인플루언서 글로우걸 (ENFP)
      return text
        .replace(/좋다!/g, '완전 좋아! 💕')
        .replace(/맞아/g, '맞아맞아!')
        .replace(/그렇지/g, '완전 그렇지~!')
        .replace(/\./g, '~!')
        .replace(/정말/g, '진짜진짜')
        .replace(/(?<!~)$/g, '~!')
        .replace(/\s+/g, ' ');

    case 3: // 헤이즈 - 보헤미안 마인드걸 (ISTP)
      return text
        .replace(/좋다!/g, '음, 괜찮네.')
        .replace(/맞아/g, '그런 것 같아')
        .replace(/정말/g, '사실')
        .replace(/!\s/g, '... ')
        .replace(/완전/g, '꽤')
        .replace(/~+/g, '...')
        .replace(/\s+/g, ' ');

    case 4: // 이안 - 배려심 많은 교회 오빠 (ENFP)
      return text
        .replace(/좋다!/g, '좋은 생각이야!')
        .replace(/맞아/g, '맞다, 그렇구나')
        .replace(/그렇지/g, '그렇지, 맞아')
        .replace(/\./g, '. 혹시 궁금한 건 없어?')
        .replace(/(야|너)/g, '')
        .replace(/\s+/g, ' ');

    case 5: // 테오 - 섹시 카리스마 장착한 나쁜남자 (ENTP)
      return text
        .replace(/좋다!/g, '흥미롭군.')
        .replace(/맞아/g, '그럴 수 있지')
        .replace(/그렇지/g, '당연하지')
        .replace(/!/g, '.')
        .replace(/~+/g, '')
        .replace(/완전/g, '꽤')
        .replace(/\s+/g, ' ');

    case 6: // 헨리 - 귀여운 연하 (INFJ)
      return text
        .replace(/좋다!/g, '좋아요! 히히~')
        .replace(/맞아/g, '맞아요!')
        .replace(/그렇지/g, '그런 것 같아요~')
        .replace(/\./g, '~ ♪')
        .replace(/정말/g, '정말정말')
        .replace(/(?<!~)(?<!♪)$/g, '~ ♪')
        .replace(/\s+/g, ' ');

    case 7: // 볼찌 - 응원만땅 햄토리 (ENFP)
      return text
        .replace(/좋다!/g, '좋다구! 볼찌가 응원한다구~!')
        .replace(/맞아/g, '맞다구!')
        .replace(/그렇지/g, '그렇다구~!')
        .replace(/\./g, '다구!')
        .replace(/(?<!구)(?<!!)$/g, '다구!')
        .replace(/\s+/g, ' ');

    case 8: // 윈터 - 까칠한 냥집사 (ISFP)
      return text
        .replace(/좋다!/g, '뭐... 괜찮은 듯.')
        .replace(/맞아/g, '그런가?')
        .replace(/완전/g, '좀')
        .replace(/!\s/g, '... ')
        .replace(/~+/g, '.')
        .replace(/정말/g, '그냥')
        .replace(/\s+/g, ' ');

    case 9: // 초롬이 - 푸들은 참지않긔 (ESFP)
      return text
        .replace(/좋다!/g, '완전 좋다옹!')
        .replace(/맞아/g, '맞다옹!')
        .replace(/그렇지/g, '그렇다옹~!')
        .replace(/\./g, '다옹!')
        .replace(/(?<!옹)(?<!!)$/g, '다옹!')
        .replace(/정말/g, '진짜진짜')
        .replace(/\s+/g, ' ');

    default:
      return text;
  }
}

// CSV 파싱 함수
function parseBalanceGameCSV(csvContent) {
  const lines = csvContent.split('\n');
  const games = [];

  let currentGame = null;
  let gameNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 게임 시작 감지 (숫자로 시작하는 줄)
    if (/^\d+\./.test(line)) {
      if (currentGame) {
        games.push(currentGame);
      }

      gameNumber++;
      const title = line.replace(/^\d+\.\s*/, '').split(',')[0];
      currentGame = {
        gameNumber,
        title,
        question: '',
        choices: []
      };
      continue;
    }

    // 질문 감지
    if (line.includes('?') && !currentGame.question) {
      currentGame.question = line.split(',')[0];
      continue;
    }

    // 선택지 감지 (쉼표로 구분된 여러 내용이 있는 줄)
    const parts = line.split(',').map(s => s.trim()).filter(s => s);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      const choiceTitle = parts[0];
      const response1 = parts[1] || '';
      const explanation1 = parts[2] || '';
      const explanation2 = parts[3] || '';
      const explanation3 = parts[4] || '';
      const productName = parts.find(p => ['클린 밸런스', '다래케어', '썬화이버', '종대사', '뉴로마스터', '영데이즈', '바이오밸런스', '리셋데이', '풀스펙트럼 비타민B'].some(prod => p.includes(prod))) || '';

      currentGame.choices.push({
        title: choiceTitle,
        response: response1,
        explanations: [explanation1, explanation2, explanation3].filter(e => e),
        productName: productName.replace(/\s+/g, ' ').trim()
      });
    }
  }

  if (currentGame && currentGame.choices.length > 0) {
    games.push(currentGame);
  }

  return games.slice(0, 11); // 11개 게임만
}

// 제품명으로 쿠폰 ID 찾기
async function findCouponByProductName(productName) {
  if (!productName) return null;

  try {
    // 제품명 매칭 맵
    const productMapping = {
      '클린 밸런스': '클린 밸런스 (120정)',
      '다래케어': '다래케어 (180정)',
      '썬화이버': '썬화이버 프리바이오틱스 식이섬유 (210g)',
      '종대사': '종합대사', // 실제 제품명 확인 필요
      '뉴로마스터': '뉴로 마스터 (60정)',
      '영데이즈': '영데이즈 저속노화 SOD효소 (15포)',
      '바이오밸런스': '바이오 밸런스 (90정)',
      '리셋데이': '리셋데이', // 실제 제품명 확인 필요
      '풀스펙트럼 비타민B': '풍성 밸런스 (90정)' // 매칭 추정
    };

    const mappedProductName = productMapping[productName] || productName;

    const coupon = await prisma.coupon.findFirst({
      where: {
        product: {
          name: {
            contains: mappedProductName,
            mode: 'insensitive'
          }
        }
      },
      select: { id: true }
    });

    return coupon?.id || null;
  } catch (error) {
    console.error(`쿠폰 찾기 오류 (${productName}):`, error.message);
    return null;
  }
}

// 메인 함수
async function createBalanceGameFromCSV() {
  console.log('🎮 CSV에서 밸런스게임 데이터 생성 시작...');

  try {
    // CSV 파일 읽기
    const csvPath = '/Users/daegilchoi/Downloads/밸런스게임_script.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    // CSV 파싱
    const games = parseBalanceGameCSV(csvContent);
    console.log(`📊 총 ${games.length}개의 게임 파싱 완료`);

    // 캐릭터 목록 조회
    const characters = await prisma.aiCharacter.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' }
    });

    console.log(`🤖 총 ${characters.length}개의 활성 캐릭터 발견`);

    // 각 게임별로 처리
    for (let gameIndex = 0; gameIndex < games.length; gameIndex++) {
      const gameData = games[gameIndex];

      console.log(`\n🎯 ${gameIndex + 1}일차: ${gameData.title} 처리 중...`);

      // BalanceGame 생성
      const balanceGame = await prisma.balanceGame.create({
        data: {
          title: gameData.title,
          description: gameData.question,
          challengeDay: gameIndex + 1,
          thumbnailUrl: `https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-day${gameIndex + 1}.png`,
          backgroundUrl: `https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-bg${gameIndex + 1}.png`,
          isActive: true
        }
      });

      console.log(`  ✅ 게임 생성 완료 (ID: ${balanceGame.id})`);

      // 각 캐릭터별로 단계 생성
      for (const character of characters) {
        console.log(`    🎭 ${character.name} 캐릭터 단계 생성 중...`);

        // 1단계: 질문 (QUESTION)
        const questionStep = await prisma.balanceGameStep.create({
          data: {
            gameId: balanceGame.id,
            characterId: character.id,
            stepNumber: 1,
            stepType: 'QUESTION',
            title: adaptToCharacter(gameData.title, character.id, character.name),
            content: adaptToCharacter(gameData.question, character.id, character.name),
            options: gameData.choices.map((choice, idx) => ({
              value: idx + 1,
              text: adaptToCharacter(choice.title, character.id, character.name)
            })),
            isActive: true
          }
        });

        // 각 선택지별로 대화 단계들 생성
        for (let choiceIdx = 0; choiceIdx < gameData.choices.length; choiceIdx++) {
          const choice = gameData.choices[choiceIdx];
          const selectedOption = choiceIdx + 1;

          // 2단계: 첫 반응 (DIALOGUE)
          const dialogueStep1 = await prisma.balanceGameStep.create({
            data: {
              gameId: balanceGame.id,
              characterId: character.id,
              stepNumber: 2,
              parentStepId: questionStep.id,
              selectedOption: selectedOption,
              stepType: 'DIALOGUE',
              title: null,
              content: adaptToCharacter(choice.response, character.id, character.name),
              options: null,
              isActive: true
            }
          });

          // 3-5단계: 설명 단계들 (DIALOGUE)
          for (let explIdx = 0; explIdx < choice.explanations.length; explIdx++) {
            if (!choice.explanations[explIdx]) continue;

            await prisma.balanceGameStep.create({
              data: {
                gameId: balanceGame.id,
                characterId: character.id,
                stepNumber: 3 + explIdx,
                parentStepId: dialogueStep1.id,
                selectedOption: null,
                stepType: 'DIALOGUE',
                title: null,
                content: adaptToCharacter(choice.explanations[explIdx], character.id, character.name),
                options: null,
                isActive: true
              }
            });
          }

          // 마지막 단계: 결과 및 제품 추천 (RESULT)
          const couponId = await findCouponByProductName(choice.productName);

          await prisma.balanceGameStep.create({
            data: {
              gameId: balanceGame.id,
              characterId: character.id,
              stepNumber: 6,
              parentStepId: dialogueStep1.id,
              selectedOption: null,
              stepType: 'RESULT',
              title: '완료!',
              content: adaptToCharacter(
                choice.productName ?
                `${choice.productName}로 더 건강하게 관리해보세요!` :
                '훌륭한 선택이었습니다!',
                character.id,
                character.name
              ),
              options: null,
              couponId: couponId,
              isActive: true
            }
          });
        }

        console.log(`    ✅ ${character.name} 캐릭터 완료`);
      }
    }

    console.log(`\n🎉 모든 밸런스게임 데이터 생성 완료!`);
    console.log(`- 총 ${games.length}개 게임`);
    console.log(`- 총 ${characters.length}개 캐릭터`);
    console.log(`- 각 게임당 캐릭터별 6단계 구조`);

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createBalanceGameFromCSV();