const ExcelJS = require('exceljs');

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('../맞춤솔루션문서/balance-game-template-v2_완료.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');

  console.log('=== 맞춤솔루션 엑셀 STEPS 시트 ===');

  // 헤더 확인
  const headerRow = stepsSheet.getRow(1);
  console.log('헤더:', headerRow.values.slice(1, 10).join(' | '));
  console.log('');

  // challenge_day별 title 수집
  const gamesByDay = {};
  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const day = row.getCell(2).value; // challenge_day
    const title = row.getCell(6).value; // title
    if (day && title && !gamesByDay[day]) {
      gamesByDay[day] = title;
    }
  });

  // 정렬해서 출력
  const days = Object.keys(gamesByDay).map(Number).sort((a,b) => a-b);
  days.slice(0, 10).forEach(day => {
    console.log(day + '일차:', gamesByDay[day]);
  });
  console.log('총', days.length, '개 일차');
}
main();
