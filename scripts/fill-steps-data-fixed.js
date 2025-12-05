const ExcelJS = require('exceljs');

/**
 * STEPS 시트의 step_number와 parent_row_id 자동 채우기 (수정 버전)
 *
 * 올바른 규칙:
 * 1. QUESTION: step_number=1, parent_row_id=null
 * 2. QUESTION 다음 첫 DIALOGUE: step_number=2, parent_row_id=QUESTION의 row_id
 * 3. 이후 DIALOGUE: step_number=윗줄+1, parent_row_id=윗줄 row_id
 * 4. RESULT: step_number=윗줄+1, parent_row_id=윗줄 row_id
 * 5. **RESULT 다음 DIALOGUE: step_number=2, parent_row_id=QUESTION의 row_id** (2번 분기 시작!)
 */

async function fillStepsDataFixed() {
  console.log('🚀 STEPS 데이터 재작업 시작 (72번째 라인부터)...\n');

  // 백업 파일에서 복원
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_완료_backup_20251204_144951.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');
  if (!stepsSheet) {
    throw new Error('STEPS 시트를 찾을 수 없습니다.');
  }

  console.log('✅ 백업 파일에서 로드 완료');
  console.log(`📊 총 ${stepsSheet.rowCount}개 행\n`);

  // 모든 row 데이터 수집
  const allRows = [];
  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // 헤더 스킵

    allRows.push({
      rowNumber,
      excelRow: row,
      row_id: row.getCell(1).value,
      challenge_day: row.getCell(2).value,
      ai_persona_name: row.getCell(3).value,
      step_type: row.getCell(4).value,
      step_number: row.getCell(5).value,
      parent_row_id: row.getCell(6).value,
      title: row.getCell(7).value,
    });
  });

  console.log(`📋 총 ${allRows.length}개 데이터 행 수집 완료\n`);
  console.log('🔄 72번째 라인부터 채우기 시작...\n');

  let fillCount = 0;
  let skipCount = 0;
  let currentQuestion = null;
  let prevRow = null;

  for (let i = 0; i < allRows.length; i++) {
    const currentRow = allRows[i];

    // null 데이터 스킵
    if (!currentRow.row_id || !currentRow.step_type) {
      skipCount++;
      continue;
    }

    // 71번째 줄까지는 그대로 유지
    if (currentRow.rowNumber <= 71) {
      // QUESTION 추적
      if (currentRow.step_type === 'QUESTION') {
        currentQuestion = currentRow;
      }
      prevRow = currentRow;
      continue;
    }

    // 72번째 줄부터 채우기
    let newStepNumber = null;
    let newParentRowId = null;

    if (currentRow.step_type === 'QUESTION') {
      // QUESTION: 항상 step_number=1, parent_row_id=null
      newStepNumber = 1;
      newParentRowId = null;
      currentQuestion = currentRow;

    } else if (currentRow.step_type === 'DIALOGUE') {
      // DIALOGUE 처리
      if (prevRow && prevRow.step_type === 'QUESTION') {
        // QUESTION 바로 다음: step=2, parent=QUESTION
        newStepNumber = 2;
        newParentRowId = currentQuestion.row_id;
      } else if (prevRow && prevRow.step_type === 'RESULT') {
        // RESULT 다음: 2번 분기 시작! step=2, parent=QUESTION
        newStepNumber = 2;
        newParentRowId = currentQuestion.row_id;
      } else if (prevRow) {
        // 일반 체인: step=윗줄+1, parent=윗줄
        newStepNumber = (prevRow.step_number || prevRow.newStepNumber || 1) + 1;
        newParentRowId = prevRow.row_id;
      } else {
        console.warn(`⚠️  row ${currentRow.row_id}: DIALOGUE이지만 부모를 찾을 수 없음`);
        skipCount++;
        prevRow = currentRow;
        continue;
      }

    } else if (currentRow.step_type === 'RESULT') {
      // RESULT: step=윗줄+1, parent=윗줄
      if (prevRow) {
        newStepNumber = (prevRow.step_number || prevRow.newStepNumber || 1) + 1;
        newParentRowId = prevRow.row_id;
      } else {
        console.warn(`⚠️  row ${currentRow.row_id}: RESULT이지만 부모를 찾을 수 없음`);
        skipCount++;
        prevRow = currentRow;
        continue;
      }

    } else {
      console.warn(`⚠️  row ${currentRow.row_id}: 알 수 없는 step_type=${currentRow.step_type}`);
      skipCount++;
      prevRow = currentRow;
      continue;
    }

    // 엑셀에 값 쓰기
    currentRow.excelRow.getCell(5).value = newStepNumber;
    currentRow.excelRow.getCell(6).value = newParentRowId;
    currentRow.newStepNumber = newStepNumber;
    currentRow.newParentRowId = newParentRowId;
    fillCount++;

    if (fillCount % 100 === 0) {
      console.log(`  ✓ ${fillCount}개 행 처리 완료...`);
    }

    prevRow = currentRow;
  }

  console.log(`\n✅ 데이터 채우기 완료!`);
  console.log(`  - 채운 행: ${fillCount}개 (72번째 줄부터)`);
  console.log(`  - 스킵한 행: ${skipCount}개\n`);

  // 파일 저장
  const outputPath = '/Users/daegilchoi/Downloads/balance-game-template-v2_완료.xlsx';
  await workbook.xlsx.writeFile(outputPath);
  console.log(`💾 파일 저장 완료: ${outputPath}\n`);

  // 샘플 검증 (72~100번 라인)
  console.log('🔍 샘플 검증 (72~100번 라인):\n');
  const sampleRows = allRows.filter(r => r.rowNumber >= 72 && r.rowNumber <= 100);
  sampleRows.forEach(row => {
    const stepNum = row.excelRow.getCell(5).value;
    const parentId = row.excelRow.getCell(6).value;
    console.log(`[${row.rowNumber}] row_id=${row.row_id}, ${row.step_type}, step=${stepNum}, parent=${parentId}`);
  });

  console.log('\n✨ 작업 완료!\n');
}

fillStepsDataFixed().catch(error => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
