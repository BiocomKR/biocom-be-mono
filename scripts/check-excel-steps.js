const ExcelJS = require('exceljs');

async function check() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_완료_수정완료.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');

  // challenge_day별 step_type 카운트
  const countByDayAndType = {};

  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const challengeDay = row.getCell(2).value;
    const stepType = row.getCell(4).value;

    if (!challengeDay || !stepType) return;

    const key = `${challengeDay}일차`;
    if (!countByDayAndType[key]) {
      countByDayAndType[key] = { DIALOGUE: 0, QUESTION: 0, RESULT: 0 };
    }
    countByDayAndType[key][stepType]++;
  });

  console.log('=== 일차별 step_type 개수 ===\n');
  for (const [day, counts] of Object.entries(countByDayAndType).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
    console.log(`${day}: DIALOGUE=${counts.DIALOGUE}, QUESTION=${counts.QUESTION}, RESULT=${counts.RESULT}`);
  }
}

check();
