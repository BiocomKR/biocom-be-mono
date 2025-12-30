const ExcelJS = require('exceljs');

async function analyze() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_완료_수정완료.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');

  // 16일차 스텔라 전체 스텝 구조 확인
  console.log('=== 16일차 스텔라 전체 스텝 구조 ===\n');

  const day16Stella = [];

  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const challengeDay = parseInt(row.getCell(2).value);
    const persona = row.getCell(3).value;

    if (challengeDay === 16 && persona === '스텔라') {
      day16Stella.push({
        excelRow: rowNumber,
        rowId: row.getCell(1).value,
        stepType: row.getCell(4).value,
        stepNumber: row.getCell(5).value,
        parentRowId: row.getCell(6).value,
      });
    }
  });

  day16Stella.forEach(r => {
    const marker = r.stepType === 'RESULT' ? '>>> ' : '    ';
    console.log(`${marker}엑셀행=${r.excelRow}, row_id=${r.rowId}, type=${r.stepType}, step=${r.stepNumber}, parent=${r.parentRowId}`);
  });

  console.log(`\n총 ${day16Stella.length}개 스텝`);

  // 다른 일차 (예: 15일차) 스텔라와 비교
  console.log('\n\n=== 15일차 스텔라 전체 스텝 구조 (비교용) ===\n');

  const day15Stella = [];

  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const challengeDay = parseInt(row.getCell(2).value);
    const persona = row.getCell(3).value;

    if (challengeDay === 15 && persona === '스텔라') {
      day15Stella.push({
        excelRow: rowNumber,
        rowId: row.getCell(1).value,
        stepType: row.getCell(4).value,
        stepNumber: row.getCell(5).value,
        parentRowId: row.getCell(6).value,
      });
    }
  });

  day15Stella.forEach(r => {
    const marker = r.stepType === 'RESULT' ? '>>> ' : '    ';
    console.log(`${marker}엑셀행=${r.excelRow}, row_id=${r.rowId}, type=${r.stepType}, step=${r.stepNumber}, parent=${r.parentRowId}`);
  });

  console.log(`\n총 ${day15Stella.length}개 스텝`);
}

analyze();
