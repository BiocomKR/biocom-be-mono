const ExcelJS = require('exceljs');

async function fixExcel() {
  console.log('=== Excel 데이터 수정 시작 ===\n');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_완료_수정완료.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');

  let fixedCount = 0;
  let deletedCount = 0;

  // 1. 엑셀행 41에 row_id=2556 부여
  const row41 = stepsSheet.getRow(41);
  console.log(`수정 전 - 엑셀행 41: row_id=${row41.getCell(1).value}`);
  row41.getCell(1).value = 2556;
  console.log(`수정 후 - 엑셀행 41: row_id=${row41.getCell(1).value}`);
  row41.commit();
  fixedCount++;

  // 2. 엑셀행 49에 row_id=2927 부여
  const row49 = stepsSheet.getRow(49);
  console.log(`\n수정 전 - 엑셀행 49: row_id=${row49.getCell(1).value}`);
  row49.getCell(1).value = 2927;
  console.log(`수정 후 - 엑셀행 49: row_id=${row49.getCell(1).value}`);
  row49.commit();
  fixedCount++;

  // 3. 엑셀행 395 (row_id=392, 잘못된 16일차 스텔라 RESULT) 삭제
  // ExcelJS에서는 행 삭제가 복잡하므로, 해당 행의 모든 셀을 비워서 표시
  // 실제로는 새 시트를 만들어 해당 행만 제외하고 복사하는 게 더 깔끔함

  console.log('\n=== 잘못된 행 삭제를 위해 새 워크북 생성 ===\n');

  const newWorkbook = new ExcelJS.Workbook();

  // 모든 시트 복사
  for (const sheet of workbook.worksheets) {
    const newSheet = newWorkbook.addWorksheet(sheet.name);

    // 컬럼 너비 복사 (안전하게)
    if (sheet.columns && sheet.columns.length > 0) {
      sheet.columns.forEach((col, index) => {
        if (col && col.width) {
          newSheet.getColumn(index + 1).width = col.width;
        }
      });
    }

    if (sheet.name === 'STEPS') {
      // STEPS 시트는 395행 제외하고 복사
      let newRowNum = 1;
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 395) {
          console.log(`삭제됨 - 엑셀행 395: row_id=${row.getCell(1).value}, day=${row.getCell(2).value}, persona=${row.getCell(3).value}, type=${row.getCell(4).value}`);
          deletedCount++;
          return; // 이 행은 건너뜀
        }

        const newRow = newSheet.getRow(newRowNum);

        // 수정된 row_id 적용
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          let value = cell.value;

          // 41행과 49행의 row_id 수정
          if (colNumber === 1) {
            if (rowNumber === 41) {
              value = 2556;
            } else if (rowNumber === 49) {
              value = 2927;
            }
          }

          newRow.getCell(colNumber).value = value;
        });

        newRow.commit();
        newRowNum++;
      });
    } else {
      // 다른 시트는 그대로 복사
      sheet.eachRow((row, rowNumber) => {
        const newRow = newSheet.getRow(rowNumber);
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          newRow.getCell(colNumber).value = cell.value;
        });
        newRow.commit();
      });
    }
  }

  // 새 파일로 저장
  const outputPath = '/Users/daegilchoi/Downloads/balance-game-template-v2_fixed.xlsx';
  await newWorkbook.xlsx.writeFile(outputPath);

  console.log(`\n=== 수정 완료 ===`);
  console.log(`row_id 부여: ${fixedCount}개`);
  console.log(`삭제된 행: ${deletedCount}개`);
  console.log(`저장 위치: ${outputPath}`);
}

fixExcel().catch(console.error);
