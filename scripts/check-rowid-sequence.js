const ExcelJS = require('exceljs');

async function check() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_완료_수정완료.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');

  // row_id 순서 및 누락/중복 확인
  const rowIds = [];
  const nullRowIdRows = [];

  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rowId = row.getCell(1).value;
    if (rowId === null || rowId === undefined || rowId === '') {
      nullRowIdRows.push(rowNumber);
    } else {
      rowIds.push({
        excelRow: rowNumber,
        rowId: parseInt(rowId)
      });
    }
  });

  // row_id 정렬 후 누락 확인
  rowIds.sort((a, b) => a.rowId - b.rowId);

  console.log('=== row_id 기본 정보 ===');
  console.log(`총 레코드: ${rowIds.length + nullRowIdRows.length}개`);
  console.log(`row_id 있는 레코드: ${rowIds.length}개`);
  console.log(`row_id null인 레코드: ${nullRowIdRows.length}개 (엑셀행: ${nullRowIdRows.join(', ')})`);

  // 최소/최대 row_id
  console.log(`\nrow_id 범위: ${rowIds[0].rowId} ~ ${rowIds[rowIds.length - 1].rowId}`);

  // 누락된 row_id 찾기
  const missingRowIds = [];
  for (let i = rowIds[0].rowId; i <= rowIds[rowIds.length - 1].rowId; i++) {
    if (!rowIds.find(r => r.rowId === i)) {
      missingRowIds.push(i);
    }
  }

  console.log(`\n누락된 row_id: ${missingRowIds.length}개`);
  if (missingRowIds.length > 0 && missingRowIds.length <= 20) {
    console.log(missingRowIds);
  }

  // 2일차 근처의 row_id 확인 (엑셀행 30~60)
  console.log('\n=== 2일차 근처 row_id 상태 (엑셀행 30~60) ===');
  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber < 30 || rowNumber > 60) return;

    const rowId = row.getCell(1).value;
    const challengeDay = row.getCell(2).value;
    const stepType = row.getCell(4).value;
    const marker = (rowId === null || rowId === undefined || rowId === '') ? '⚠️ NULL' : '';

    console.log(`  엑셀행=${rowNumber}, row_id=${rowId || 'NULL'} ${marker}, day=${challengeDay}, type=${stepType}`);
  });
}

check();
