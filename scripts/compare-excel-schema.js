const ExcelJS = require('exceljs');

/**
 * 엑셀과 Prisma 스키마 비교 분석
 */

async function compareExcelSchema() {
  console.log('📊 엑셀 vs Prisma 스키마 비교 분석\n');
  console.log('='.repeat(100));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_완료.xlsx');

  // GAME 시트 분석
  console.log('\n📋 GAME 시트 vs balance_games 테이블:\n');
  console.log('-'.repeat(100));

  const gameSheet = workbook.getWorksheet('GAME');
  const gameHeaders = [];
  gameSheet.getRow(1).eachCell((cell, colNumber) => {
    gameHeaders.push({ col: colNumber, name: cell.value });
  });

  console.log('엑셀 GAME 시트 컬럼:');
  gameHeaders.forEach(h => console.log(`  ${h.col}. ${h.name}`));

  console.log('\n✅ 매핑 관계:');
  console.log('  엑셀 challenge_day     → DB challengeDay');
  console.log('  엑셀 title             → DB title');
  console.log('  엑셀 description       → DB description');
  console.log('  추가 필드              → DB isActive (default: true)');
  console.log('  추가 필드              → DB createdAt (현재 시간)');

  console.log('\n⚠️  주의사항:');
  console.log('  - option1Keyword, option1LinkedProduct, option1Text');
  console.log('  - option2Keyword, option2LinkedProduct, option2Text');
  console.log('  → 이 필드들은 엑셀에 없음 (기본값 null 또는 STEPS에서 추출 필요)');

  // STEPS 시트 분석
  console.log('\n\n📋 STEPS 시트 vs balance_game_steps 테이블:\n');
  console.log('-'.repeat(100));

  const stepsSheet = workbook.getWorksheet('STEPS');
  const stepsHeaders = [];
  stepsSheet.getRow(1).eachCell((cell, colNumber) => {
    stepsHeaders.push({ col: colNumber, name: cell.value });
  });

  console.log('엑셀 STEPS 시트 컬럼:');
  stepsHeaders.forEach(h => console.log(`  ${h.col}. ${h.name}`));

  console.log('\n✅ 매핑 관계:');
  console.log('  엑셀 row_id                → DB id (auto_increment, 엑셀과 일치해야 함!)');
  console.log('  엑셀 challenge_day         → DB gameId (balance_games.id 참조)');
  console.log('  엑셀 ai_persona_name       → DB aiPersonaId (ai_personas 테이블 조회)');
  console.log('  엑셀 step_type             → DB stepType');
  console.log('  엑셀 step_number           → DB stepNumber');
  console.log('  엑셀 parent_row_id         → DB parentStepId');
  console.log('  엑셀 title                 → DB title');
  console.log('  엑셀 content               → DB content');
  console.log('  엑셀 option_text           → DB options (JSON 변환 필요)');
  console.log('  엑셀 coupon_product_name   → DB couponId (coupons 테이블 조회)');
  console.log('  추가 필드                  → DB selectedOption (DIALOGUE의 경우 계산 필요)');
  console.log('  추가 필드                  → DB sortOrder (stepNumber 사용)');
  console.log('  추가 필드                  → DB isActive (default: true)');
  console.log('  추가 필드                  → DB createdAt (현재 시간)');

  console.log('\n⚠️  중요 포인트:');
  console.log('  1. challenge_day → gameId 변환 필요 (balance_games.challengeDay로 조회)');
  console.log('  2. ai_persona_name → aiPersonaId 변환 필요 (ai_personas.name으로 조회)');
  console.log('  3. option_text → options JSON 변환:');
  console.log('     - QUESTION: "A|B" → [{"value": 1, "text": "A"}, {"value": 2, "text": "B"}]');
  console.log('     - DIALOGUE: "A" → [{"value": 1, "text": "A"}]');
  console.log('     - RESULT: "" → null');
  console.log('  4. coupon_product_name → couponId 변환 (products.name으로 coupons 조회)');
  console.log('  5. selectedOption 계산:');
  console.log('     - QUESTION의 직계 자식 DIALOGUE 중 몇 번째인지 확인 (1 or 2)');

  // 샘플 데이터 확인
  console.log('\n\n📝 샘플 데이터 확인 (GAME 시트 처음 3개):\n');
  console.log('-'.repeat(100));

  let rowCount = 0;
  gameSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || rowCount >= 3) return;

    const challengeDay = row.getCell(1).value;
    const title = row.getCell(2).value;
    const description = row.getCell(3).value;

    console.log(`\n[${rowCount + 1}] challenge_day=${challengeDay}`);
    console.log(`  title: ${title}`);
    console.log(`  description: ${description}`);
    rowCount++;
  });

  console.log('\n\n📝 샘플 데이터 확인 (STEPS 시트 처음 5개):\n');
  console.log('-'.repeat(100));

  rowCount = 0;
  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || rowCount >= 5) return;

    const row_id = row.getCell(1).value;
    const challenge_day = row.getCell(2).value;
    const ai_persona_name = row.getCell(3).value;
    const step_type = row.getCell(4).value;
    const step_number = row.getCell(5).value;
    const parent_row_id = row.getCell(6).value;
    const title = row.getCell(7).value;
    const option_text = row.getCell(9).value;

    console.log(`\n[${rowCount + 1}] row_id=${row_id}, challenge_day=${challenge_day}, ${ai_persona_name}`);
    console.log(`  step_type: ${step_type}, step_number: ${step_number}, parent: ${parent_row_id}`);
    console.log(`  title: ${title}`);
    if (option_text) console.log(`  option_text: ${option_text.substring(0, 50)}...`);
    rowCount++;
  });

  console.log('\n\n' + '='.repeat(100));
  console.log('\n✨ 분석 완료!\n');
}

compareExcelSchema().catch(console.error);
