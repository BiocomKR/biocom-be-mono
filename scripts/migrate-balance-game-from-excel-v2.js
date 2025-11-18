const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');

const prisma = new PrismaClient();

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
 * option_text 파싱
 * QUESTION: "A|B" → [{"value": 1, "text": "A"}, {"value": 2, "text": "B"}]
 * DIALOGUE: "A" → [{"value": 1, "text": "A"}]
 * RESULT: "" → null
 */
function parseOptionText(optionText, stepType) {
  if (!optionText || optionText.trim() === '') {
    return null;
  }

  if (stepType === 'QUESTION') {
    // | 로 분리
    const parts = optionText.split('|').map(t => t.trim());
    if (parts.length !== 2) {
      throw new Error(`QUESTION의 option_text는 2개여야 합니다: ${optionText}`);
    }
    return [
      { value: 1, text: parts[0] },
      { value: 2, text: parts[1] }
    ];
  } else if (stepType === 'DIALOGUE') {
    // 1개만
    return [{ value: 1, text: optionText.trim() }];
  } else {
    // RESULT는 null
    return null;
  }
}

/**
 * 메인 마이그레이션 함수
 */
async function migrateBalanceGameFromExcel(excelPath) {
  console.log('🎮 밸런스게임 엑셀 마이그레이션 시작 (v2)...\n');

  try {
    // 엑셀 파일 읽기
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    console.log('✅ 엑셀 파일 읽기 완료');

    // GAME 시트 읽기
    const gameSheet = workbook.getWorksheet('GAME');
    if (!gameSheet) {
      throw new Error('GAME 시트를 찾을 수 없습니다.');
    }

    const games = [];
    gameSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // 헤더 스킵

      const game = {
        challenge_day: row.getCell(1).value,
        title: row.getCell(2).value,
        description: row.getCell(3).value
      };

      if (game.challenge_day) games.push(game);
    });

    console.log(`📊 GAME 시트 파싱 완료: ${games.length}개 게임`);

    // STEPS 시트 읽기
    const stepsSheet = workbook.getWorksheet('STEPS');
    if (!stepsSheet) {
      throw new Error('STEPS 시트를 찾을 수 없습니다.');
    }

    const steps = [];
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

      if (step.row_id && step.challenge_day && step.ai_persona_name) {
        steps.push(step);
      }
    });

    console.log(`📊 STEPS 시트 파싱 완료: ${steps.length}개 스텝\n`);

    // ============================================
    // 기존 데이터 전체 삭제 및 auto_increment 초기화
    // ============================================
    console.log('\n🗑️  기존 데이터 전체 삭제 시작...');

    // 1. balance_game_steps 삭제 (자식 먼저)
    const deletedSteps = await prisma.balanceGameStep.deleteMany({});
    console.log(`  ✅ balance_game_steps 삭제 완료 (${deletedSteps.count}개)`);

    // 2. balance_games 삭제 (부모)
    const deletedGames = await prisma.balanceGame.deleteMany({});
    console.log(`  ✅ balance_games 삭제 완료 (${deletedGames.count}개)`);

    // 3. auto_increment 초기화 (PostgreSQL)
    await prisma.$executeRaw`ALTER SEQUENCE balance_game_steps_id_seq RESTART WITH 1;`;
    console.log(`  ✅ balance_game_steps auto_increment 초기화`);

    await prisma.$executeRaw`ALTER SEQUENCE balance_games_id_seq RESTART WITH 1;`;
    console.log(`  ✅ balance_games auto_increment 초기화`);

    console.log('✅ 기존 데이터 삭제 및 초기화 완료\n');

    // 게임별로 처리
    const gameIdMap = {}; // challengeDay → gameId 매핑

    for (const gameData of games) {
      const challengeDay = parseInt(gameData.challenge_day);

      console.log(`\n📌 ${challengeDay}일차: ${gameData.title} 생성 중...`);

      // 게임 생성 (기존 데이터는 이미 전체 삭제했으므로 바로 생성)
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

        // row_id 순서대로 정렬
        personaSteps.sort((a, b) => parseInt(a.row_id) - parseInt(b.row_id));

        // row_id → 실제 DB step ID 매핑
        const rowIdToStepIdMap = {};

        // step_number 카운터 (QUESTION부터 순차 증가)
        let stepNumber = 1;

        for (const stepData of personaSteps) {
          const rowId = parseInt(stepData.row_id);
          const parentRowId = stepData.parent_row_id ? parseInt(stepData.parent_row_id) : null;

          // 부모 스텝 ID 찾기
          let parentStepId = null;
          if (parentRowId) {
            parentStepId = rowIdToStepIdMap[parentRowId];
            if (!parentStepId) {
              throw new Error(`부모 row_id=${parentRowId}를 찾을 수 없습니다 (현재 row_id=${rowId})`);
            }
          }

          // selectedOption 결정
          // QUESTION의 직계 자식 DIALOGUE들만 selectedOption 1 또는 2를 가짐
          let selectedOption = null;
          if (stepData.step_type === 'DIALOGUE' && parentRowId) {
            const parentStep = personaSteps.find(s => parseInt(s.row_id) === parentRowId);
            if (parentStep && parentStep.step_type === 'QUESTION') {
              // QUESTION의 자식들 중 몇 번째인지 확인
              const siblings = personaSteps.filter(s =>
                parseInt(s.parent_row_id) === parentRowId && s.step_type === 'DIALOGUE'
              );
              siblings.sort((a, b) => parseInt(a.row_id) - parseInt(b.row_id));
              const index = siblings.findIndex(s => parseInt(s.row_id) === rowId);
              selectedOption = index + 1; // 1 또는 2
            }
          }

          // options JSON 구성
          const options = parseOptionText(stepData.option_text, stepData.step_type);

          // 쿠폰 ID 찾기
          let couponId = null;
          if (stepData.step_type === 'RESULT' && stepData.coupon_product_name) {
            couponId = await findCouponByProductName(stepData.coupon_product_name);
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

          // row_id → DB step ID 매핑 저장
          rowIdToStepIdMap[rowId] = createdStep.id;

          stepNumber++; // 다음 스텝 번호 증가
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
const excelPath = process.argv[2] || '/Users/daegilchoi/biocom/biocom-api/scripts/balance-game-template-v2.xlsx';
console.log(`📁 엑셀 파일: ${excelPath}\n`);

migrateBalanceGameFromExcel(excelPath)
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
