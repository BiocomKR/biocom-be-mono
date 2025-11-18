const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

/**
 * CSV 파싱 함수
 */
function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));

  const games = [];
  const steps = [];

  let currentSection = null;
  let headers = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 섹션 구분
    if (trimmedLine.startsWith('=== GAME')) {
      currentSection = 'GAME';
      continue;
    } else if (trimmedLine.startsWith('=== STEPS')) {
      currentSection = 'STEPS';
      continue;
    }

    // 헤더 라인
    if (trimmedLine.includes('challenge_day')) {
      headers = trimmedLine.split(',').map(h => h.trim());
      continue;
    }

    // 데이터 라인 파싱
    const values = parseCSVLine(trimmedLine);
    if (values.length === 0) continue;

    if (currentSection === 'GAME' && headers.length > 0) {
      const game = {};
      headers.forEach((header, index) => {
        game[header] = values[index] || null;
      });
      games.push(game);
    } else if (currentSection === 'STEPS' && headers.length > 0) {
      const step = {};
      headers.forEach((header, index) => {
        step[header] = values[index] || null;
      });
      steps.push(step);
    }
  }

  return { games, steps };
}

/**
 * CSV 라인 파싱 (쉼표로 구분, 따옴표 고려)
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * 제품명으로 쿠폰 ID 찾기
 */
async function findCouponByProductName(productName) {
  if (!productName) return null;

  try {
    const coupon = await prisma.coupon.findFirst({
      where: {
        product: {
          name: {
            contains: productName,
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

/**
 * AI 페르소나 이름으로 ID 찾기
 */
async function findAiPersonaByName(personaName) {
  if (!personaName) return null;

  try {
    const persona = await prisma.aiPersona.findFirst({
      where: {
        name: personaName
      },
      select: { id: true }
    });

    return persona?.id || null;
  } catch (error) {
    console.error(`AI 페르소나 찾기 오류 (${personaName}):`, error.message);
    return null;
  }
}

/**
 * 메인 마이그레이션 함수
 */
async function migrateBalanceGameFromCSV(csvPath) {
  console.log('🎮 밸런스게임 CSV 마이그레이션 시작...\n');

  try {
    // CSV 파일 읽기
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    console.log('✅ CSV 파일 읽기 완료');

    // CSV 파싱
    const { games, steps } = parseCSV(csvContent);
    console.log(`📊 파싱 완료: ${games.length}개 게임, ${steps.length}개 스텝\n`);

    // 게임별로 처리
    const gameIdMap = {}; // challengeDay → gameId 매핑

    for (const gameData of games) {
      const challengeDay = parseInt(gameData.challenge_day);

      console.log(`\n📌 ${challengeDay}일차: ${gameData.title} 생성 중...`);

      // 기존 게임 확인
      const existingGame = await prisma.balanceGame.findFirst({
        where: { challengeDay }
      });

      let game;
      if (existingGame) {
        console.log(`  ⚠️  기존 게임 발견 (ID: ${existingGame.id}), 업데이트합니다.`);
        game = await prisma.balanceGame.update({
          where: { id: existingGame.id },
          data: {
            title: gameData.title,
            description: gameData.description,
            thumbnailUrl: gameData.thumbnail_url,
            backgroundUrl: gameData.background_url,
            isActive: true
          }
        });
      } else {
        game = await prisma.balanceGame.create({
          data: {
            challengeDay,
            title: gameData.title,
            description: gameData.description,
            thumbnailUrl: gameData.thumbnail_url,
            backgroundUrl: gameData.background_url,
            isActive: true,
            createdAt: new Date()
          }
        });
        console.log(`  ✅ 게임 생성 완료 (ID: ${game.id})`);
      }

      gameIdMap[challengeDay] = game.id;
    }

    console.log('\n\n🎭 단계별 대사 마이그레이션 시작...\n');

    // 챌린지 일차별로 스텝 그룹화
    const stepsByDay = {};
    for (const step of steps) {
      const day = parseInt(step.challenge_day);
      if (!stepsByDay[day]) stepsByDay[day] = [];
      stepsByDay[day].push(step);
    }

    // 각 챌린지 일차별로 처리
    for (const [challengeDay, daySteps] of Object.entries(stepsByDay)) {
      const gameId = gameIdMap[challengeDay];
      if (!gameId) {
        console.error(`❌ ${challengeDay}일차 게임 ID를 찾을 수 없습니다.`);
        continue;
      }

      console.log(`\n📅 ${challengeDay}일차 스텝 처리 중...`);

      // 기존 스텝 삭제 (전체 재생성)
      await prisma.balanceGameStep.deleteMany({
        where: { gameId }
      });
      console.log(`  🗑️  기존 스텝 삭제 완료`);

      // AI 페르소나별로 그룹화
      const stepsByPersona = {};
      for (const step of daySteps) {
        const personaName = step.ai_persona_name;
        if (!stepsByPersona[personaName]) stepsByPersona[personaName] = [];
        stepsByPersona[personaName].push(step);
      }

      // 각 페르소나별로 스텝 생성
      for (const [personaName, personaSteps] of Object.entries(stepsByPersona)) {
        const aiPersonaId = await findAiPersonaByName(personaName);
        if (!aiPersonaId) {
          console.error(`  ❌ AI 페르소나를 찾을 수 없습니다: ${personaName}`);
          continue;
        }

        console.log(`    🎭 ${personaName} (ID: ${aiPersonaId}) 스텝 생성 중...`);

        // step_number 순서대로 정렬
        personaSteps.sort((a, b) => parseInt(a.step_number) - parseInt(b.step_number));

        // 스텝 ID 매핑 (step_number + selected_option → createdStepId)
        const stepIdMap = {};

        for (const stepData of personaSteps) {
          const stepNumber = parseInt(stepData.step_number);
          const parentStepNumber = stepData.parent_step_number ? parseInt(stepData.parent_step_number) : null;
          const parentSelectedOption = stepData.parent_selected_option ? parseInt(stepData.parent_selected_option) : null;
          const selectedOption = stepData.selected_option ? parseInt(stepData.selected_option) : null;

          // 옵션 JSON 구성
          let options = null;
          if (stepData.step_type === 'QUESTION' && stepData.option_1_text && stepData.option_2_text) {
            options = [
              { value: 1, text: stepData.option_1_text },
              { value: 2, text: stepData.option_2_text }
            ];
          }

          // 쿠폰 ID 찾기
          let couponId = null;
          if (stepData.step_type === 'RESULT' && stepData.coupon_product_name) {
            couponId = await findCouponByProductName(stepData.coupon_product_name);
          }

          // 부모 스텝 ID 찾기
          let parentStepId = null;
          if (parentStepNumber) {
            // parent_step_number + parent_selected_option 조합으로 부모 찾기
            const parentKey = parentSelectedOption
              ? `${parentStepNumber}_${parentSelectedOption}`
              : `${parentStepNumber}`;
            parentStepId = stepIdMap[parentKey] || null;
          }

          // 스텝 생성
          const createdStep = await prisma.balanceGameStep.create({
            data: {
              gameId,
              aiPersonaId,
              stepNumber,
              stepType: stepData.step_type,
              parentStepId,
              selectedOption,
              title: stepData.title || null,
              content: stepData.content,
              options,
              couponId,
              sortOrder: stepNumber,
              isActive: true,
              createdAt: new Date()
            }
          });

          // 스텝 ID 매핑 저장 (step_number + selected_option 조합)
          const mapKey = selectedOption
            ? `${stepNumber}_${selectedOption}`
            : `${stepNumber}`;
          stepIdMap[mapKey] = createdStep.id;
        }

        console.log(`    ✅ ${personaName} 완료 (${personaSteps.length}개 스텝)`);
      }
    }

    console.log('\n\n🎉 마이그레이션 완료!');
    console.log(`- 총 ${games.length}개 게임 생성/업데이트`);
    console.log(`- 총 ${steps.length}개 스텝 생성`);

  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
const csvPath = process.argv[2] || '/Users/daegilchoi/biocom/biocom-api/scripts/balance-game-template.csv';
console.log(`📁 CSV 파일: ${csvPath}\n`);

migrateBalanceGameFromCSV(csvPath);
