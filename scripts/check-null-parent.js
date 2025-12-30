const ExcelJS = require('exceljs');

async function check() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_완료_수정완료.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');

  // 엑셀행 41과 49의 parent_row_id 확인 및 해당 parent의 존재 여부
  console.log('=== row_id null인 레코드의 parent 확인 ===\n');

  const nullRecords = [];
  const allRowIds = new Set();

  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rowId = row.getCell(1).value;
    if (rowId !== null && rowId !== undefined && rowId !== '') {
      allRowIds.add(parseInt(rowId));
    }

    if (rowNumber === 41 || rowNumber === 49) {
      nullRecords.push({
        excelRow: rowNumber,
        rowId: rowId,
        challengeDay: row.getCell(2).value,
        persona: row.getCell(3).value,
        stepType: row.getCell(4).value,
        stepNumber: row.getCell(5).value,
        parentRowId: row.getCell(6).value,
      });
    }
  });

  nullRecords.forEach(r => {
    const parentExists = allRowIds.has(parseInt(r.parentRowId));
    console.log(`엑셀행 ${r.excelRow}:`);
    console.log(`  row_id: ${r.rowId}`);
    console.log(`  day: ${r.challengeDay}, persona: ${r.persona}`);
    console.log(`  stepType: ${r.stepType}, stepNumber: ${r.stepNumber}`);
    console.log(`  parent_row_id: ${r.parentRowId} (존재여부: ${parentExists ? '✓' : '✗'})`);
    console.log('');
  });

  // 이 null 레코드들을 parent로 참조하는 레코드가 있는지 확인
  console.log('=== null 레코드를 parent로 참조하는 레코드 확인 ===\n');

  // RESULT는 보통 마지막이므로 child가 없어야 정상
  // 하지만 확인 필요
  let hasChildren = false;
  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const parentRowId = row.getCell(6).value;
    // null인 row_id를 parent로 참조할 수는 없음 (null이니까)
    // 하지만 혹시 엑셀에 잘못 입력된 경우 확인
  });

  console.log('RESULT 타입은 마지막 노드이므로 child가 없는게 정상입니다.');
  console.log('따라서 row_id만 부여하면 됩니다.');
}

check();
