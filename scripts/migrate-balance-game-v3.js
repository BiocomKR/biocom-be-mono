const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');

const prisma = new PrismaClient();

/**
 * AI 페르소나 이름으로 ID 찾기
 */
async function findAiPersonaByName(personaName) {
  if (!personaName) return null;

  try {
    const persona = await prisma.aiPersona.findFirst({
      where: { name: personaName },
      select: { id: true }
    });

    if (!persona) {
      console.warn(`  ⚠️  AI 페르소나를 찾을 수 없습니다: ${personaName}`);
    }

    return persona?.id || null;
  } catch (error) {
    console.error(`AI 페르소나 찾기 오류 (${personaName}):`, error.message);
    return null;
  }
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

    if (!coupon) {
      console.warn(`  ⚠️  쿠폰을 찾을 수 없습니다: ${productName}`);
    }

    return coupon?.id || null;
  } catch (error) {
    console.error(`쿠폰 찾기 오류 (${productName}):`, error.message);
    return null;
  }
}

/**
 * option_text 파싱
 */
function parseOptionText(optionText, stepType) {
  if (!optionText || optionText.trim() === '') {
    return null;
  }

  if (stepType === 'QUESTION') {
    const parts = optionText.split('|').map(t => t.trim());
    if (parts.length !== 2) {
      throw new Error(`QUESTION의 option_text는 2개여야 합니다: ${optionText}`);
    }
    return [
      { value: 1, text: parts[0] },
      { value: 2, text: parts[1] }
    ];
  } else if (stepType === 'DIALOGUE') {
    return [{ value: 1, text: optionText.trim() }];
  } else {
    return null;
  }
}

/**
 * 메인 마이그레이션 함수 (STEPS 시트만 사용)
 */
async function migrateBalanceGame(excelPath) {
  console.log('🎮 밸런스게임 마이그레이션 시작 (v3 - STEPS only)...\n');

  try {
    // 엑셀 파일 읽기
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    console.log('✅ 엑셀 파일 읽기 완료');

    // STEPS 시트 읽기
    const stepsSheet = workbook.getWorksheet('STEPS');
    if (!stepsSheet) {
      throw new Error('STEPS 시트를 찾을 수 없습니다.');
    }

    const steps = [];
    const gamesFromSteps = {}; // challenge_day → { title, description }

    stepsSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // 헤더 스킵

      const step = {
        row_id: row.getCell(1).value,
        challenge_day: row.getCell(2).value,
        ai_persona_name: row.getCell(3).value,
        step_type: row.getCell(4).value,
        parent_row_id: row.getCell(5).value,
        title: row.getCell(6).value,
        content: row.getCell(7).value,
        option_text: row.getCell(8).value,
        coupon_product_name: row.getCell(9).value
      };

      // row_id가 없으면 자동 생성
      if (step.challenge_day && step.ai_persona_name) {
        step.row_id = rowNumber; // row_id가 없으면 행 번호 사용
        steps.push(step);

        // QUESTION 타입에서 게임 정보 추출
        const day = parseInt(step.challenge_day);
        if (!gamesFromSteps[day] && step.step_type === 'QUESTION') {
          gamesFromSteps[day] = {
            challenge_day: day,
            title: step.title,
            description: step.content
          };
        }
      }
    });

    console.log(`📊 STEPS 시트 파싱 완료: ${steps.length}개 스텝`);

    // 게임 목록 생성
    const games = Object.values(gamesFromSteps).sort((a, b) => a.challenge_day - b.challenge_day);
    console.log(`📊 게임 추출 완료: ${games.length}개 게임\n`);

    // ============================================
    // 기존 데이터 전체 삭제 및 auto_increment 초기화
    // ============================================
    console.log('🗑️  기존 데이터 전체 삭제 시작...');

    const deletedSteps = await prisma.balanceGameStep.deleteMany({});
    console.log(`  ✅ balance_game_steps 삭제 완료 (${deletedSteps.count}개)`);

    const deletedGames = await prisma.balanceGame.deleteMany({});
    console.log(`  ✅ balance_games 삭제 완료 (${deletedGames.count}개)`);

    await prisma.$executeRaw`ALTER SEQUENCE balance_game_steps_id_seq RESTART WITH 1;`;
    console.log(`  ✅ balance_game_steps auto_increment 초기화`);

    await prisma.$executeRaw`ALTER SEQUENCE balance_games_id_seq RESTART WITH 1;`;
    console.log(`  ✅ balance_games auto_increment 초기화`);

    console.log('✅ 기존 데이터 삭제 및 초기화 완료\n');

    // 게임별로 처리
    const gameIdMap = {};

    for (const gameData of games) {
      const challengeDay = parseInt(gameData.challenge_day);

      console.log(`📌 ${challengeDay}일차: ${gameData.title} 생성 중...`);

      const game = await prisma.balanceGame.create({
        data: {
          challengeDay,
          title: gameData.title,
          description: gameData.description,
          isActive: true,
          createdAt: new Date()
        }
      });
      console.log(`  ✅ 게임 생성 완료 (ID: ${game.id})`);

      gameIdMap[challengeDay] = game.id;
    }

    console.log('\n🎭 단계별 대사 마이그레이션 시작...\n');

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

      console.log(`📅 ${challengeDay}일차 스텝 처리 중...`);

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

        personaSteps.sort((a, b) => parseInt(a.row_id) - parseInt(b.row_id));

        const rowIdToStepIdMap = {};
        let stepNumber = 1;

        for (const stepData of personaSteps) {
          const rowId = parseInt(stepData.row_id);
          const parentRowId = stepData.parent_row_id ? parseInt(stepData.parent_row_id) : null;

          let parentStepId = null;
          if (parentRowId) {
            parentStepId = rowIdToStepIdMap[parentRowId];
            if (!parentStepId) {
              throw new Error(`부모 row_id=${parentRowId}를 찾을 수 없습니다 (현재 row_id=${rowId})`);
            }
          }

          let selectedOption = null;
          if (stepData.step_type === 'DIALOGUE' && parentRowId) {
            const parentStep = personaSteps.find(s => parseInt(s.row_id) === parentRowId);
            if (parentStep && parentStep.step_type === 'QUESTION') {
              const siblings = personaSteps.filter(s =>
                parseInt(s.parent_row_id) === parentRowId && s.step_type === 'DIALOGUE'
              );
              siblings.sort((a, b) => parseInt(a.row_id) - parseInt(b.row_id));
              const index = siblings.findIndex(s => parseInt(s.row_id) === rowId);
              selectedOption = index + 1;
            }
          }

          const options = parseOptionText(stepData.option_text, stepData.step_type);

          let couponId = null;
          if (stepData.step_type === 'RESULT' && stepData.coupon_product_name) {
            couponId = await findCouponByProductName(stepData.coupon_product_name);
          }

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

          rowIdToStepIdMap[rowId] = createdStep.id;
          stepNumber++;
        }

        console.log(`  ✅ ${personaName} 완료 (${personaSteps.length}개 스텝)`);
      }
    }

    console.log('\n\n🎉 마이그레이션 완료!');
    console.log(`- 총 ${games.length}개 게임 생성`);
    console.log(`- 총 ${steps.length}개 스텝 생성`);

  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
const excelPath = process.argv[2] || '../맞춤솔루션문서/balance-game-template-v2_완료.xlsx';
console.log(`📁 엑셀 파일: ${excelPath}\n`);

migrateBalanceGame(excelPath)
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
