const ExcelJS = require('exceljs');

async function verify() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_fixed.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');

  // 모든 데이터 로드
  const allSteps = [];
  const rowIdMap = new Map(); // row_id -> step 데이터

  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const step = {
      excelRow: rowNumber,
      rowId: row.getCell(1).value,
      challengeDay: parseInt(row.getCell(2).value),
      persona: row.getCell(3).value ? row.getCell(3).value.trim() : null,
      stepType: row.getCell(4).value,
      stepNumber: row.getCell(5).value,
      parentRowId: row.getCell(6).value,
    };

    allSteps.push(step);
    if (step.rowId) {
      rowIdMap.set(parseInt(step.rowId), step);
    }
  });

  console.log('=== 1. 기본 통계 ===\n');
  console.log(`총 레코드: ${allSteps.length}개`);

  // row_id null 체크
  const nullRowIds = allSteps.filter(s => !s.rowId);
  console.log(`row_id null: ${nullRowIds.length}개`);
  if (nullRowIds.length > 0) {
    nullRowIds.forEach(s => console.log(`  ⚠️ 엑셀행 ${s.excelRow}`));
  }

  // row_id 중복 체크
  const rowIdCounts = {};
  allSteps.forEach(s => {
    if (s.rowId) {
      rowIdCounts[s.rowId] = (rowIdCounts[s.rowId] || 0) + 1;
    }
  });
  const duplicates = Object.entries(rowIdCounts).filter(([_, count]) => count > 1);
  console.log(`row_id 중복: ${duplicates.length}개`);
  if (duplicates.length > 0) {
    duplicates.forEach(([id, count]) => console.log(`  ⚠️ row_id=${id}: ${count}회`));
  }

  // ============================
  console.log('\n=== 2. 페르소나별 21일 x 2개 RESULT 검증 ===\n');

  const personas = ['스텔라', '메이브', '헤이즐', '이안', '테오', '헨리'];
  const days = Array.from({ length: 21 }, (_, i) => i + 1);

  let resultErrors = [];

  for (const persona of personas) {
    let personaOk = true;
    const personaResults = allSteps.filter(s => s.persona === persona && s.stepType === 'RESULT');

    for (const day of days) {
      const dayResults = personaResults.filter(s => s.challengeDay === day);
      if (dayResults.length !== 2) {
        resultErrors.push(`${persona} ${day}일차: RESULT ${dayResults.length}개 (기대값: 2)`);
        personaOk = false;
      }
    }

    const totalResults = personaResults.length;
    const status = totalResults === 42 ? '✓' : '⚠️';
    console.log(`${persona}: RESULT 총 ${totalResults}개 (기대값: 42) ${status}`);
  }

  if (resultErrors.length > 0) {
    console.log('\n⚠️ RESULT 개수 오류:');
    resultErrors.forEach(e => console.log(`  ${e}`));
  } else {
    console.log('\n✓ 모든 페르소나가 21일 x 2개 = 42개 RESULT를 가짐');
  }

  // ============================
  console.log('\n=== 3. parent_row_id 연결 검증 ===\n');

  let parentErrors = [];
  let orphanCount = 0;

  for (const step of allSteps) {
    if (step.parentRowId) {
      const parent = rowIdMap.get(parseInt(step.parentRowId));
      if (!parent) {
        parentErrors.push(`row_id=${step.rowId} (${step.persona} ${step.challengeDay}일차 ${step.stepType}): parent_row_id=${step.parentRowId} 없음`);
        orphanCount++;
      }
    }
  }

  if (parentErrors.length > 0) {
    console.log(`⚠️ 부모 없는 레코드: ${orphanCount}개`);
    parentErrors.slice(0, 10).forEach(e => console.log(`  ${e}`));
    if (parentErrors.length > 10) {
      console.log(`  ... 외 ${parentErrors.length - 10}개 더`);
    }
  } else {
    console.log('✓ 모든 parent_row_id가 유효한 row_id를 참조함');
  }

  // ============================
  console.log('\n=== 4. 각 일차별 구조 검증 (QUESTION → DIALOGUE → RESULT 흐름) ===\n');

  let structureErrors = [];

  for (const persona of personas) {
    for (const day of days) {
      const daySteps = allSteps.filter(s => s.persona === persona && s.challengeDay === day);

      // QUESTION이 1개 있어야 함
      const questions = daySteps.filter(s => s.stepType === 'QUESTION');
      if (questions.length !== 1) {
        structureErrors.push(`${persona} ${day}일차: QUESTION ${questions.length}개 (기대값: 1)`);
        continue;
      }

      const question = questions[0];

      // QUESTION의 parent는 null이어야 함
      if (question.parentRowId !== null && question.parentRowId !== undefined) {
        structureErrors.push(`${persona} ${day}일차: QUESTION의 parent가 null이 아님 (${question.parentRowId})`);
      }

      // RESULT가 2개 있어야 함
      const results = daySteps.filter(s => s.stepType === 'RESULT');
      if (results.length !== 2) {
        structureErrors.push(`${persona} ${day}일차: RESULT ${results.length}개 (기대값: 2)`);
      }

      // 각 RESULT에서 QUESTION까지 역추적
      for (const result of results) {
        let current = result;
        let depth = 0;
        let reachesQuestion = false;

        while (current && depth < 50) {
          if (current.stepType === 'QUESTION') {
            reachesQuestion = true;
            break;
          }

          if (!current.parentRowId) break;

          current = rowIdMap.get(parseInt(current.parentRowId));
          depth++;
        }

        if (!reachesQuestion) {
          structureErrors.push(`${persona} ${day}일차: RESULT(row_id=${result.rowId})가 QUESTION까지 연결 안됨`);
        }
      }
    }
  }

  if (structureErrors.length > 0) {
    console.log(`⚠️ 구조 오류: ${structureErrors.length}개`);
    structureErrors.forEach(e => console.log(`  ${e}`));
  } else {
    console.log('✓ 모든 일차의 QUESTION → DIALOGUE → RESULT 흐름 정상');
  }

  // ============================
  console.log('\n=== 5. 수정된 row_id 검증 (2556, 2927) ===\n');

  const step2556 = rowIdMap.get(2556);
  const step2927 = rowIdMap.get(2927);

  if (step2556) {
    console.log(`row_id=2556: ${step2556.persona} ${step2556.challengeDay}일차 ${step2556.stepType} (parent=${step2556.parentRowId})`);
    const parent = rowIdMap.get(parseInt(step2556.parentRowId));
    console.log(`  → parent 존재: ${parent ? '✓' : '⚠️'}`);
  } else {
    console.log('⚠️ row_id=2556 없음');
  }

  if (step2927) {
    console.log(`row_id=2927: ${step2927.persona} ${step2927.challengeDay}일차 ${step2927.stepType} (parent=${step2927.parentRowId})`);
    const parent = rowIdMap.get(parseInt(step2927.parentRowId));
    console.log(`  → parent 존재: ${parent ? '✓' : '⚠️'}`);
  } else {
    console.log('⚠️ row_id=2927 없음');
  }

  // ============================
  console.log('\n=== 최종 결과 ===\n');

  const hasErrors = nullRowIds.length > 0 || duplicates.length > 0 ||
                    resultErrors.length > 0 || parentErrors.length > 0 ||
                    structureErrors.length > 0;

  if (hasErrors) {
    console.log('⚠️ 오류가 발견되었습니다. 위 내용을 확인하세요.');
  } else {
    console.log('✓ 모든 검증 통과! Excel 파일이 정상입니다.');
  }
}

verify().catch(console.error);
