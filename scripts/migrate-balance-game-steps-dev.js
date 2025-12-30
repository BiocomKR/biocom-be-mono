/**
 * 밸런스게임 STEPS 마이그레이션 (운영 DB)
 * - balance_game_steps 테이블만 대상
 * - 전체 삭제 후 전체 INSERT
 * - row_id = id로 직접 매핑
 */

const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');

// 개발 DB 연결 (.env 기본값 사용)
const prisma = new PrismaClient();

/**
 * AI 페르소나 이름으로 ID 찾기 (하드코딩 매핑)
 */
function getAiPersonaId(personaName) {
  if (!personaName) return null;

  const name = typeof personaName === 'string' ? personaName.trim() : String(personaName).trim();

  const personaMap = {
    '스텔라': 1,
    '메이브': 2,
    '헤이즐': 3,
    '이안': 4,
    '테오': 5,
    '헨리': 6,
  };

  const id = personaMap[name];
  if (!id) {
    console.warn(`  ⚠️  AI 페르소나를 찾을 수 없습니다: "${name}"`);
  }

  return id || null;
}

/**
 * content 필드 파싱 (richText → plain text)
 */
function parseContent(content) {
  if (!content) return '';

  if (content.richText && Array.isArray(content.richText)) {
    return content.richText.map(item => item.text || '').join('');
  }

  if (typeof content === 'string') {
    return content;
  }

  return '';
}

/**
 * option_text 파싱
 */
function parseOptionText(optionText, stepType) {
  if (!optionText) return null;

  let text = optionText;
  if (typeof optionText === 'object' && optionText.richText) {
    text = optionText.richText.map(item => item.text || '').join('');
  }

  if (typeof text !== 'string') {
    text = String(text);
  }

  if (text.trim() === '') return null;

  if (stepType === 'QUESTION') {
    const parts = text.split('|').map(t => t.trim());
    if (parts.length !== 2) {
      console.warn(`  ⚠️  QUESTION option_text가 2개가 아님: ${text}`);
      return null;
    }
    return [
      { value: 1, text: parts[0] },
      { value: 2, text: parts[1] }
    ];
  } else if (stepType === 'DIALOGUE') {
    return [{ value: 1, text: text.trim() }];
  }

  return null;
}

/**
 * 메인 마이그레이션 함수
 */
async function migrateBalanceGameSteps(excelPath) {
  console.log('🎮 [개발 DB] 밸런스게임 STEPS 마이그레이션 시작...\n');

  try {
    // ============================================
    // 1. 기존 STEPS 데이터 전체 삭제
    // ============================================
    console.log('🗑️  balance_game_steps 전체 삭제 시작...');

    const deletedSteps = await prisma.balanceGameStep.deleteMany({});
    console.log(`  ✅ 삭제 완료: ${deletedSteps.count}개`);

    // 시퀀스 초기화
    await prisma.$executeRawUnsafe('ALTER SEQUENCE balance_game_steps_id_seq RESTART WITH 1;');
    console.log(`  ✅ 시퀀스 초기화 완료\n`);

    // ============================================
    // 2. 엑셀 파일 읽기
    // ============================================
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    console.log('✅ 엑셀 파일 읽기 완료');

    // ============================================
    // 3. STEPS 시트 읽기
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
        coupon_id: row.getCell(10).value,
      };

      // 필수 필드가 모두 있는 경우만 추가
      if (step.row_id && step.challenge_day && step.ai_persona_name && step.step_type && step.step_number) {
        steps.push(step);
      }
    });

    console.log(`📊 STEPS 시트 파싱 완료: ${steps.length}개 스텝\n`);

    // ============================================
    // 4. challenge_day → game_id 매핑 조회
    // ============================================
    console.log('🔍 balance_games 테이블에서 game_id 매핑 조회...');

    const games = await prisma.balanceGame.findMany({
      select: { id: true, challengeDay: true }
    });

    const gameIdMap = {};
    for (const game of games) {
      gameIdMap[game.challengeDay] = game.id;
    }
    console.log(`  ✅ ${games.length}개 게임 매핑 완료\n`);

    // ============================================
    // 5. 스텝 데이터 생성 (row_id = id)
    // ============================================
    console.log('🎭 스텝 데이터 INSERT 시작...\n');

    // row_id 순서대로 정렬
    steps.sort((a, b) => parseInt(a.row_id) - parseInt(b.row_id));

    let insertedCount = 0;
    let maxId = 0;

    for (const stepData of steps) {
      const rowId = parseInt(stepData.row_id);
      const challengeDay = parseInt(stepData.challenge_day);
      const gameId = gameIdMap[challengeDay];

      if (!gameId) {
        console.error(`  ❌ ${challengeDay}일차 게임을 찾을 수 없습니다. row_id=${rowId}`);
        continue;
      }

      const aiPersonaId = getAiPersonaId(stepData.ai_persona_name);
      if (!aiPersonaId) {
        console.error(`  ❌ AI 페르소나를 찾을 수 없습니다: ${stepData.ai_persona_name}, row_id=${rowId}`);
        continue;
      }

      const parentRowId = stepData.parent_row_id ? parseInt(stepData.parent_row_id) : null;

      // selectedOption 결정
      let selectedOption = null;
      if (stepData.step_type === 'DIALOGUE' && parentRowId) {
        const parentStep = steps.find(s => parseInt(s.row_id) === parentRowId);
        if (parentStep && parentStep.step_type === 'QUESTION') {
          const siblings = steps.filter(s =>
            parseInt(s.parent_row_id) === parentRowId &&
            s.step_type === 'DIALOGUE' &&
            s.ai_persona_name === stepData.ai_persona_name
          );
          siblings.sort((a, b) => parseInt(a.row_id) - parseInt(b.row_id));
          const index = siblings.findIndex(s => parseInt(s.row_id) === rowId);
          selectedOption = index + 1;
        }
      }

      const options = parseOptionText(stepData.option_text, stepData.step_type);
      const contentText = parseContent(stepData.content);
      const couponId = stepData.coupon_id ? parseInt(stepData.coupon_id) : null;

      // Raw SQL로 id 직접 지정 INSERT
      await prisma.$executeRaw`
        INSERT INTO balance_game_steps (
          id, game_id, ai_persona_id, step_number, step_type,
          parent_step_id, selected_option, title, content, options,
          coupon_id, sort_order, is_active, created_at
        ) VALUES (
          ${rowId}, ${gameId}, ${aiPersonaId}, ${stepData.step_number}, ${stepData.step_type},
          ${parentRowId}, ${selectedOption}, ${stepData.title || null}, ${contentText}, ${options ? JSON.stringify(options) : null}::jsonb,
          ${couponId}, ${stepData.step_number}, true, NOW()
        )
      `;

      insertedCount++;
      if (rowId > maxId) maxId = rowId;

      if (insertedCount % 100 === 0) {
        console.log(`  ... ${insertedCount}개 처리됨`);
      }
    }

    console.log(`\n✅ 총 ${insertedCount}개 스텝 INSERT 완료`);

    // ============================================
    // 6. 시퀀스 재설정 (max_id + 1)
    // ============================================
    const nextVal = maxId + 1;
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE balance_game_steps_id_seq RESTART WITH ${nextVal};`);
    console.log(`✅ 시퀀스를 ${nextVal}로 재설정 완료\n`);

    // ============================================
    // 7. 검증
    // ============================================
    const totalCount = await prisma.balanceGameStep.count();
    console.log(`📊 검증: balance_game_steps 테이블 총 ${totalCount}개 레코드`);

    console.log('\n🎉 마이그레이션 완료!');

  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 실행
const excelPath = process.argv[2] || '/Users/daegilchoi/Downloads/balance-game-template-v2_fixed.xlsx';
console.log(`📁 엑셀 파일: ${excelPath}\n`);

migrateBalanceGameSteps(excelPath)
  .then(() => {
    console.log('\n✨ 프로세스 종료\n');
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
