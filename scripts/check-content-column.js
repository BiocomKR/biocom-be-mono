const ExcelJS = require('exceljs');

async function checkContentColumn() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_완료.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');

  console.log('📋 STEPS 시트 컬럼 확인:\n');

  // 헤더 확인
  const headerRow = stepsSheet.getRow(1);
  console.log('헤더 (1~10번 컬럼):');
  for (let i = 1; i <= 10; i++) {
    const cell = headerRow.getCell(i);
    console.log(`  ${i}. ${cell.value}`);
  }

  console.log('\n\n샘플 데이터 (2~5번 행, 1~10번 컬럼):');
  for (let rowNum = 2; rowNum <= 5; rowNum++) {
    const row = stepsSheet.getRow(rowNum);
    console.log(`\n[행 ${rowNum}]:`);
    for (let colNum = 1; colNum <= 10; colNum++) {
      const cell = row.getCell(colNum);
      const value = cell.value;
      const preview = value ? String(value).substring(0, 50) : '(빈칸)';
      console.log(`  ${colNum}. ${preview}`);
    }
  }
}

checkContentColumn().catch(console.error);
