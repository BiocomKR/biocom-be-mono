const ExcelJS = require('exceljs');

/**
 * STEPS 시트의 step_number와 parent_row_id 자동 채우기
 *
 * 규칙:
 * 1. QUESTION: step_number=1, parent_row_id=null
 * 2. DIALOGUE:
 *    - QUESTION의 직계 자식 (2개): step_number=2, parent_row_id=QUESTION의 row_id
 *    - 체인 연결: step_number = 이전 + 1, parent_row_id = 이전 row_id
 * 3. RESULT: step_number = 이전 + 1, parent_row_id = 이전 row_id
 */

async function fillStepsData() {
  console.log('🚀 STEPS 데이터 자동 채우기 시작...\n');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_완료.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');
  if (!stepsSheet) {
    throw new Error('STEPS 시트를 찾을 수 없습니다.');
  }

  console.log('✅ 엑셀 파일 로드 완료');
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

  // 채우기 작업
  let fillCount = 0;
  let skipCount = 0;
  let currentQuestion = null;
  let currentQuestionChildCount = 0; // QUESTION의 직계 자식 카운트
  let prevRow = null;

  console.log('🔄 데이터 채우기 시작...\n');

  for (let i = 0; i < allRows.length; i++) {
    const currentRow = allRows[i];

    // null 데이터 스킵
    if (!currentRow.row_id || !currentRow.step_type) {
      skipCount++;
      continue;
    }

    // 이미 채워져 있으면 스킵 (71번째 줄까지)
    if (currentRow.step_number !== null && currentRow.parent_row_id !== null) {
      // QUESTION인 경우 현재 QUESTION 업데이트
      if (currentRow.step_type === 'QUESTION') {
        currentQuestion = currentRow;
        currentQuestionChildCount = 0;
      }
      // DIALOGUE이고 parent가 QUESTION이면 자식 카운트 증가
      else if (currentRow.step_type === 'DIALOGUE' && currentQuestion && currentRow.parent_row_id === currentQuestion.row_id) {
        currentQuestionChildCount++;
      }

      prevRow = currentRow;
      continue;
    }

    // step_number와 parent_row_id 채우기
    let newStepNumber = null;
    let newParentRowId = null;

    if (currentRow.step_type === 'QUESTION') {
      // QUESTION: 항상 step_number=1, parent_row_id=null
      newStepNumber = 1;
      newParentRowId = null;
      currentQuestion = currentRow;
      currentQuestionChildCount = 0;

    } else if (currentRow.step_type === 'DIALOGUE') {
      // DIALOGUE 처리
      if (currentQuestion && currentQuestionChildCount < 2) {
        // QUESTION의 직계 자식 (선택지 A 또는 B)
        newStepNumber = 2;
        newParentRowId = currentQuestion.row_id;
        currentQuestionChildCount++;
      } else if (prevRow) {
        // 체인 연결
        newStepNumber = (prevRow.step_number || prevRow.newStepNumber || 1) + 1;
        newParentRowId = prevRow.row_id;
      } else {
        console.warn(`⚠️  row ${currentRow.row_id}: DIALOGUE이지만 부모를 찾을 수 없음`);
        skipCount++;
        continue;
      }

    } else if (currentRow.step_type === 'RESULT') {
      // RESULT: 이전 row의 다음
      if (prevRow) {
        newStepNumber = (prevRow.step_number || prevRow.newStepNumber || 1) + 1;
        newParentRowId = prevRow.row_id;
      } else {
        console.warn(`⚠️  row ${currentRow.row_id}: RESULT이지만 부모를 찾을 수 없음`);
        skipCount++;
        continue;
      }

    } else {
      console.warn(`⚠️  row ${currentRow.row_id}: 알 수 없는 step_type=${currentRow.step_type}`);
      skipCount++;
      continue;
    }

    // 엑셀에 값 쓰기
    if (newStepNumber !== null && newParentRowId !== null) {
      currentRow.excelRow.getCell(5).value = newStepNumber;
      currentRow.excelRow.getCell(6).value = newParentRowId;
      currentRow.newStepNumber = newStepNumber;
      currentRow.newParentRowId = newParentRowId;
      fillCount++;

      if (fillCount % 100 === 0) {
        console.log(`  ✓ ${fillCount}개 행 처리 완료...`);
      }
    } else if (newStepNumber !== null && newParentRowId === null) {
      // QUESTION의 경우 parent_row_id가 null
      currentRow.excelRow.getCell(5).value = newStepNumber;
      currentRow.excelRow.getCell(6).value = null;
      currentRow.newStepNumber = newStepNumber;
      currentRow.newParentRowId = null;
      fillCount++;

      if (fillCount % 100 === 0) {
        console.log(`  ✓ ${fillCount}개 행 처리 완료...`);
      }
    }

    prevRow = currentRow;
  }

  console.log(`\n✅ 데이터 채우기 완료!`);
  console.log(`  - 채운 행: ${fillCount}개`);
  console.log(`  - 스킵한 행: ${skipCount}개\n`);

  // 파일 저장
  const outputPath = '/Users/daegilchoi/Downloads/balance-game-template-v2_완료.xlsx';
  await workbook.xlsx.writeFile(outputPath);
  console.log(`💾 파일 저장 완료: ${outputPath}\n`);

  // 검증
  console.log('🔍 검증 시작...\n');
  await validateData(outputPath);
}

/**
 * 채워진 데이터 검증
 */
async function validateData(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const stepsSheet = workbook.getWorksheet('STEPS');

  const errors = [];
  const warnings = [];
  let totalRows = 0;
  let filledRows = 0;

  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const row_id = row.getCell(1).value;
    const step_type = row.getCell(4).value;
    const step_number = row.getCell(5).value;
    const parent_row_id = row.getCell(6).value;

    if (!row_id || !step_type) return;

    totalRows++;

    // step_number, parent_row_id가 채워져 있는지 확인
    if (step_number !== null) {
      filledRows++;
    }

    // 규칙 검증
    if (step_type === 'QUESTION') {
      if (step_number !== 1) {
        errors.push(`row ${row_id}: QUESTION이지만 step_number=${step_number} (1이어야 함)`);
      }
      if (parent_row_id !== null) {
        errors.push(`row ${row_id}: QUESTION이지만 parent_row_id=${parent_row_id} (null이어야 함)`);
      }
    }

    if (step_type === 'DIALOGUE' || step_type === 'RESULT') {
      if (parent_row_id === null) {
        errors.push(`row ${row_id}: ${step_type}이지만 parent_row_id가 null`);
      }
    }

    if (step_number !== null && step_number < 1) {
      errors.push(`row ${row_id}: step_number=${step_number} (1 이상이어야 함)`);
    }
  });

  console.log(`📊 검증 결과:`);
  console.log(`  - 전체 행: ${totalRows}개`);
  console.log(`  - step_number 채워진 행: ${filledRows}개`);
  console.log(`  - 채우기 비율: ${Math.round(filledRows / totalRows * 100)}%`);

  if (errors.length > 0) {
    console.log(`\n❌ 오류 ${errors.length}개 발견:`);
    errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
    if (errors.length > 10) {
      console.log(`  ... 외 ${errors.length - 10}개`);
    }
  } else {
    console.log(`\n✅ 오류 없음!`);
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  경고 ${warnings.length}개:`);
    warnings.slice(0, 5).forEach(warn => console.log(`  - ${warn}`));
  }

  console.log('\n✨ 검증 완료!\n');
}

fillStepsData().catch(error => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
