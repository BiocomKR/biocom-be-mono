const ExcelJS = require('exceljs');

async function analyze() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_완료_수정완료.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');

  // 2일차 스텔라 RESULT 상세 분석
  console.log('=== 2일차 스텔라 RESULT 상세 분석 ===\n');

  const day2StellaResults = [];
  const day16StellaResults = [];

  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rowId = row.getCell(1).value;
    const challengeDay = parseInt(row.getCell(2).value);
    const persona = row.getCell(3).value;
    const stepType = row.getCell(4).value;
    const stepNumber = row.getCell(5).value;
    const parentRowId = row.getCell(6).value;
    const content = row.getCell(7).value;

    if (challengeDay === 2 && persona === '스텔라' && stepType === 'RESULT') {
      day2StellaResults.push({
        excelRow: rowNumber,
        rowId,
        stepNumber,
        parentRowId,
        content: content ? content.substring(0, 50) + '...' : null
      });
    }

    if (challengeDay === 16 && persona === '스텔라' && stepType === 'RESULT') {
      day16StellaResults.push({
        excelRow: rowNumber,
        rowId,
        stepNumber,
        parentRowId,
        content: content ? content.substring(0, 50) + '...' : null
      });
    }
  });

  console.log('2일차 스텔라 RESULT:');
  day2StellaResults.forEach(r => {
    console.log(`  엑셀행=${r.excelRow}, row_id=${r.rowId}, step=${r.stepNumber}, parent=${r.parentRowId}`);
    console.log(`    내용: ${r.content}`);
  });

  console.log('\n16일차 스텔라 RESULT:');
  day16StellaResults.forEach(r => {
    console.log(`  엑셀행=${r.excelRow}, row_id=${r.rowId}, step=${r.stepNumber}, parent=${r.parentRowId}`);
    console.log(`    내용: ${r.content}`);
  });

  // row_id가 null인 레코드들 전체 확인
  console.log('\n=== row_id가 null인 전체 레코드 ===\n');

  const nullRowIdRecords = [];
  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rowId = row.getCell(1).value;
    if (rowId === null || rowId === undefined || rowId === '') {
      nullRowIdRecords.push({
        excelRow: rowNumber,
        challengeDay: row.getCell(2).value,
        persona: row.getCell(3).value,
        stepType: row.getCell(4).value,
        stepNumber: row.getCell(5).value,
      });
    }
  });

  console.log(`총 ${nullRowIdRecords.length}개의 row_id=null 레코드:`);
  nullRowIdRecords.forEach(r => {
    console.log(`  엑셀행=${r.excelRow}, day=${r.challengeDay}, persona=${r.persona}, type=${r.stepType}, step=${r.stepNumber}`);
  });

  // 16일차 모든 페르소나의 RESULT 개수 확인
  console.log('\n=== 16일차 페르소나별 RESULT 개수 ===\n');

  const day16ResultCount = {};
  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const challengeDay = parseInt(row.getCell(2).value);
    const persona = row.getCell(3).value;
    const stepType = row.getCell(4).value;

    if (challengeDay === 16 && stepType === 'RESULT') {
      if (!day16ResultCount[persona]) day16ResultCount[persona] = 0;
      day16ResultCount[persona]++;
    }
  });

  for (const [persona, count] of Object.entries(day16ResultCount)) {
    console.log(`  ${persona}: ${count}개 (정상=2개)`);
  }
}

analyze();
