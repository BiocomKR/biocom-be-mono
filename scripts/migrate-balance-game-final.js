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
 * content 필드 파싱 (richText → plain text)
 */
function parseContent(content) {
  if (!content) return '';

  // richText 객체인 경우
  if (content.richText && Array.isArray(content.richText)) {
    return content.richText.map(item => item.text || '').join('');
  }

  // 이미 문자열인 경우
  if (typeof content === 'string') {
    return content;
  }

  return '';
}

/**
 * option_text 파싱
 * QUESTION: "A|B" → [{"value": 1, "text": "A"}, {"value": 2, "text": "B"}]
 * DIALOGUE: "A" → [{"value": 1, "text": "A"}]
 * RESULT: "" → null
 */
function parseOptionText(optionText, stepType) {
  if (!optionText) {
    return null;
  }

  // richText 객체인 경우 텍스트로 변환
  let text = optionText;
  if (typeof optionText === 'object' && optionText.richText) {
    text = optionText.richText.map(item => item.text || '').join('');
  }

  // 문자열이 아닌 경우 변환
  if (typeof text !== 'string') {
    text = String(text);
  }

  if (text.trim() === '') {
    return null;
  }

  if (stepType === 'QUESTION') {
    // | 로 분리
    const parts = text.split('|').map(t => t.trim());
    if (parts.length !== 2) {
      throw new Error(`QUESTION의 option_text는 2개여야 합니다: ${text}`);
    }
    return [
      { value: 1, text: parts[0] },
      { value: 2, text: parts[1] }
    ];
  } else if (stepType === 'DIALOGUE') {
    // 1개만
    return [{ value: 1, text: text.trim() }];
  } else {
    // RESULT는 null
    return null;
  }
}

/**
 * 메인 마이그레이션 함수
 */
async function migrateBalanceGameFinal(excelPath) {
  console.log('🎮 밸런스게임 마이그레이션 시작 (최종 버전)...\n');

  try {
    // ============================================
    // 1. 기존 데이터 전체 삭제 및 auto_increment 초기화
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

    // ============================================
    // 2. 엑셀 파일 읽기
    // ============================================
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    console.log('✅ 엑셀 파일 읽기 완료');

    // ============================================
    // 3. GAME 시트 읽기
    // ============================================
    const gameSheet = workbook.getWorksheet('GAME');
    if (!gameSheet) {
      throw new Error('GAME 시트를 찾을 수 없습니다.');
    }

    const games = [];
    gameSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // 헤더 스킵

      const game = {
        id: row.getCell(1).value,
        title: row.getCell(2).value,
        description: row.getCell(3).value,
        is_active: row.getCell(4).value,
        challenge_day: row.getCell(5).value,
        option1_text: row.getCell(6).value,
        option1_keyword: row.getCell(7).value,
        option1_linked_product: row.getCell(8).value,
        option2_text: row.getCell(9).value,
        option2_keyword: row.getCell(10).value,
        option2_linked_product: row.getCell(11).value,
      };

      if (game.challenge_day) games.push(game);
    });

    console.log(`📊 GAME 시트 파싱 완료: ${games.length}개 게임`);

    // ============================================
    // 4. STEPS 시트 읽기
    // ============================================
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
        step_number: row.getCell(5).value,
        parent_row_id: row.getCell(6).value,
        title: row.getCell(7).value,
        content: row.getCell(8).value,
        option_text: row.getCell(9).value,
      };

      // 필수 필드가 모두 있는 경우만 추가
      if (step.row_id && step.challenge_day && step.ai_persona_name && step.step_type && step.step_number) {
        steps.push(step);
      }
    });

    console.log(`📊 STEPS 시트 파싱 완료: ${steps.length}개 스텝\n`);

    // ============================================
    // 5. 게임 데이터 생성
    // ============================================
    console.log('🎭 게임 데이터 생성 시작...\n');

    const gameIdMap = {}; // challengeDay → gameId 매핑

    for (const gameData of games) {
      const challengeDay = parseInt(gameData.challenge_day);

      console.log(`📌 ${challengeDay}일차: ${gameData.title} 생성 중...`);

      const game = await prisma.balanceGame.create({
        data: {
          challengeDay,
          title: gameData.title,
          description: gameData.description || null,
          isActive: gameData.is_active !== false,
          option1Text: gameData.option1_text || null,
          option1Keyword: gameData.option1_keyword || null,
          option1LinkedProduct: gameData.option1_linked_product || null,
          option2Text: gameData.option2_text || null,
          option2Keyword: gameData.option2_keyword || null,
          option2LinkedProduct: gameData.option2_linked_product || null,
          createdAt: new Date()
        }
      });

      console.log(`  ✅ 게임 생성 완료 (ID: ${game.id})`);
      gameIdMap[challengeDay] = game.id;
    }

    console.log(`\n✅ 총 ${games.length}개 게임 생성 완료\n`);

    // ============================================
    // 6. 스텝 데이터 생성
    // ============================================
    console.log('🎭 스텝 데이터 생성 시작...\n');

    // 챌린지 일차별로 스텝 그룹화
    const stepsByDay = {};
    for (const step of steps) {
      const day = parseInt(step.challenge_day);
      if (!stepsByDay[day]) stepsByDay[day] = [];
      stepsByDay[day].push(step);
    }

    // row_id → 실제 DB step ID 매핑
    const rowIdToStepIdMap = {};

    let totalStepCount = 0;

    // 각 챌린지 일차별로 처리
    for (const [challengeDay, daySteps] of Object.entries(stepsByDay)) {
      const gameId = gameIdMap[challengeDay];
      if (!gameId) {
        console.error(`❌ ${challengeDay}일차 게임 ID를 찾을 수 없습니다.`);
        continue;
      }

      console.log(`📅 ${challengeDay}일차 스텝 처리 중... (${daySteps.length}개)`);

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

        // row_id 순서대로 정렬
        personaSteps.sort((a, b) => parseInt(a.row_id) - parseInt(b.row_id));

        for (const stepData of personaSteps) {
          const rowId = parseInt(stepData.row_id);
          const parentRowId = stepData.parent_row_id ? parseInt(stepData.parent_row_id) : null;

          // 부모 스텝 ID 찾기
          let parentStepId = null;
          if (parentRowId) {
            parentStepId = rowIdToStepIdMap[parentRowId];
            if (!parentStepId) {
              console.warn(`  ⚠️  row_id=${rowId}: parent_row_id=${parentRowId}를 찾을 수 없음`);
            }
          }

          // selectedOption 결정
          let selectedOption = null;
          if (stepData.step_type === 'DIALOGUE' && parentRowId) {
            const parentStep = steps.find(s => parseInt(s.row_id) === parentRowId);
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

          // content 텍스트 추출
          const contentText = parseContent(stepData.content);

          // 스텝 생성
          const createdStep = await prisma.balanceGameStep.create({
            data: {
              gameId,
              aiPersonaId,
              stepNumber: stepData.step_number,
              stepType: stepData.step_type,
              parentStepId,
              selectedOption,
              title: stepData.title || null,
              content: contentText,
              options,
              couponId: null, // 형님이 별도 처리
              sortOrder: stepData.step_number,
              isActive: true,
              createdAt: new Date()
            }
          });

          // row_id → DB step ID 매핑 저장
          rowIdToStepIdMap[rowId] = createdStep.id;
          totalStepCount++;
        }
      }

      console.log(`  ✅ ${challengeDay}일차 완료`);
    }

    console.log(`\n✅ 총 ${totalStepCount}개 스텝 생성 완료\n`);

    console.log('\n🎉 마이그레이션 완료!');
    console.log(`  - ${games.length}개 게임 생성`);
    console.log(`  - ${totalStepCount}개 스텝 생성`);

  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
const excelPath = process.argv[2] || '/Users/daegilchoi/Downloads/balance-game-template-v2_완료_수정완료.xlsx';
console.log(`📁 엑셀 파일: ${excelPath}\n`);

migrateBalanceGameFinal(excelPath)
  .then(() => {
    console.log('\n✨ 프로세스 종료\n');
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
