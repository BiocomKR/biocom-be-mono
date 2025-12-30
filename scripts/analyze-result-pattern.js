const ExcelJS = require('exceljs');

async function analyze() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_완료_수정완료.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');

  // 각 일차별 스텔라 RESULT의 step_number 패턴 확인
  console.log('=== 스텔라 RESULT step_number 패턴 (일차별) ===\n');

  const stellaResultsByDay = {};

  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const challengeDay = parseInt(row.getCell(2).value);
    const persona = row.getCell(3).value;
    const stepType = row.getCell(4).value;
    const stepNumber = row.getCell(5).value;

    if (persona === '스텔라' && stepType === 'RESULT') {
      if (!stellaResultsByDay[challengeDay]) {
        stellaResultsByDay[challengeDay] = [];
      }
      stellaResultsByDay[challengeDay].push(stepNumber);
    }
  });

  for (const [day, steps] of Object.entries(stellaResultsByDay).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
    const status = steps.length !== 2 ? '⚠️ 이상!' : '✓ 정상';
    console.log(`  ${day}일차: [${steps.join(', ')}] (${steps.length}개) ${status}`);
  }

  // 16일차 스텔라 RESULT 중 중복 확인 (내용 비교)
  console.log('\n=== 16일차 스텔라 RESULT 내용 비교 ===\n');

  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const challengeDay = parseInt(row.getCell(2).value);
    const persona = row.getCell(3).value;
    const stepType = row.getCell(4).value;

    if (challengeDay === 16 && persona === '스텔라' && stepType === 'RESULT') {
      const rowId = row.getCell(1).value;
      const stepNumber = row.getCell(5).value;
      const parentRowId = row.getCell(6).value;
      const content = row.getCell(7).value;

      console.log(`row_id=${rowId}, step=${stepNumber}, parent=${parentRowId}`);
      console.log(`내용: ${content}\n`);
    }
  });
}

analyze();
