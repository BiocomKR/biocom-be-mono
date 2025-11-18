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
async function migrateBalanceGameFromExcel(excelPath) {
  console.log('🎮 밸런스게임 엑셀 마이그레이션 시작...\n');

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
        description: row.getCell(3).value,
        thumbnail_url: row.getCell(4).value,
        background_url: row.getCell(5).value
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
        challenge_day: row.getCell(1).value,
        ai_persona_name: row.getCell(2).value,
        step_number: row.getCell(3).value,
        step_type: row.getCell(4).value,
        parent_step_number: row.getCell(5).value,
        parent_selected_option: row.getCell(6).value,
        selected_option: row.getCell(7).value,
        title: row.getCell(8).value,
        content: row.getCell(9).value,
        option_1_text: row.getCell(10).value,
        option_2_text: row.getCell(11).value,
        coupon_product_name: row.getCell(12).value
      };

      if (step.challenge_day && step.ai_persona_name) steps.push(step);
    });

    console.log(`📊 STEPS 시트 파싱 완료: ${steps.length}개 스텝\n`);

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
        personaSteps.sort((a, b) => {
          const aNum = parseInt(a.step_number);
          const bNum = parseInt(b.step_number);
          if (aNum !== bNum) return aNum - bNum;
          // 같은 step_number면 selected_option으로 정렬
          const aOpt = a.selected_option ? parseInt(a.selected_option) : 999;
          const bOpt = b.selected_option ? parseInt(b.selected_option) : 999;
          return aOpt - bOpt;
        });

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
const excelPath = process.argv[2] || '/Users/daegilchoi/biocom/biocom-api/scripts/balance-game-template.xlsx';
console.log(`📁 엑셀 파일: ${excelPath}\n`);

migrateBalanceGameFromExcel(excelPath)
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
