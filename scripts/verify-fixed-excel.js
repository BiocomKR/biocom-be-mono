const ExcelJS = require('exceljs');

async function verify() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_fixed.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');

  // 1. row_id null 확인
  console.log('=== 1. row_id null 확인 ===');
  let nullCount = 0;
  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rowId = row.getCell(1).value;
    if (rowId === null || rowId === undefined || rowId === '') {
      nullCount++;
      console.log(`  ⚠️ 엑셀행 ${rowNumber}: row_id=null`);
    }
  });
  console.log(`row_id null 개수: ${nullCount}개 (기대값: 0)\n`);

  // 2. 총 레코드 수 확인
  let totalRows = 0;
  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    totalRows++;
  });
  console.log(`=== 2. 총 레코드 수 ===`);
  console.log(`총 레코드: ${totalRows}개 (기대값: 2926)\n`);

  // 3. 2일차 스텔라 RESULT 확인
  console.log('=== 3. 2일차 스텔라 RESULT 확인 ===');
  const day2StellaResults = [];
  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const challengeDay = parseInt(row.getCell(2).value);
    const persona = row.getCell(3).value;
    const stepType = row.getCell(4).value;

    if (challengeDay === 2 && persona === '스텔라' && stepType === 'RESULT') {
      day2StellaResults.push({
        rowId: row.getCell(1).value,
        stepNumber: row.getCell(5).value
      });
    }
  });
  day2StellaResults.forEach(r => {
    console.log(`  row_id=${r.rowId}, step=${r.stepNumber}`);
  });
  console.log(`총 ${day2StellaResults.length}개 (기대값: 2)\n`);

  // 4. 16일차 스텔라 RESULT 확인
  console.log('=== 4. 16일차 스텔라 RESULT 확인 ===');
  const day16StellaResults = [];
  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const challengeDay = parseInt(row.getCell(2).value);
    const persona = row.getCell(3).value;
    const stepType = row.getCell(4).value;

    if (challengeDay === 16 && persona === '스텔라' && stepType === 'RESULT') {
      day16StellaResults.push({
        rowId: row.getCell(1).value,
        stepNumber: row.getCell(5).value
      });
    }
  });
  day16StellaResults.forEach(r => {
    console.log(`  row_id=${r.rowId}, step=${r.stepNumber}`);
  });
  console.log(`총 ${day16StellaResults.length}개 (기대값: 2)\n`);

  // 5. 전체 일차별 RESULT 개수 확인
  console.log('=== 5. 전체 일차별 RESULT 개수 ===');
  const resultCountByDay = {};
  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const challengeDay = parseInt(row.getCell(2).value);
    const stepType = row.getCell(4).value;

    if (stepType === 'RESULT') {
      if (!resultCountByDay[challengeDay]) resultCountByDay[challengeDay] = 0;
      resultCountByDay[challengeDay]++;
    }
  });

  let allCorrect = true;
  for (const [day, count] of Object.entries(resultCountByDay).sort((a,b) => parseInt(a[0]) - parseInt(b[0]))) {
    const status = count === 12 ? '✓' : '⚠️';
    if (count !== 12) allCorrect = false;
    console.log(`  ${day}일차: ${count}개 ${status}`);
  }
  console.log(`\n모든 일차 RESULT=12개: ${allCorrect ? '✓ 정상' : '⚠️ 이상'}`);
}

verify().catch(console.error);
