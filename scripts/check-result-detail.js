const ExcelJS = require('exceljs');

async function check() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_완료_수정완료.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');

  // RESULT만 추출
  const resultsByDay = {};

  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const challengeDay = parseInt(row.getCell(2).value);
    const stepType = row.getCell(4).value;

    if (stepType === 'RESULT') {
      if (!resultsByDay[challengeDay]) {
        resultsByDay[challengeDay] = [];
      }
      resultsByDay[challengeDay].push({
        row_id: row.getCell(1).value,
        persona: row.getCell(3).value,
        step_number: row.getCell(5).value,
      });
    }
  });

  // 2일차와 16일차 상세 출력
  console.log('=== 2일차 RESULT ===');
  if (resultsByDay[2]) {
    resultsByDay[2].forEach(r => {
      console.log(`  row_id=${r.row_id}, persona=${r.persona}, step=${r.step_number}`);
    });
    console.log(`  총: ${resultsByDay[2].length}개`);
  }

  console.log('\n=== 16일차 RESULT ===');
  if (resultsByDay[16]) {
    resultsByDay[16].forEach(r => {
      console.log(`  row_id=${r.row_id}, persona=${r.persona}, step=${r.step_number}`);
    });
    console.log(`  총: ${resultsByDay[16].length}개`);
  }

  // 페르소나별 RESULT 개수 확인 (모든 일차 합산)
  console.log('\n=== 페르소나별 RESULT 개수 (전체 일차) ===');
  const personaCount = {};
  for (const [day, results] of Object.entries(resultsByDay)) {
    for (const r of results) {
      if (!personaCount[r.persona]) personaCount[r.persona] = 0;
      personaCount[r.persona]++;
    }
  }
  for (const [persona, count] of Object.entries(personaCount)) {
    console.log(`  ${persona}: ${count}개 (21일 기준 정상=${21*2}개)`);
  }
}

check();
