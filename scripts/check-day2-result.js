const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function check() {
  // 1. 엑셀에서 2일차 RESULT 조회
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_완료_수정완료.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');

  const excelResults = [];
  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const challengeDay = parseInt(row.getCell(2).value);
    const stepType = row.getCell(4).value;

    if (challengeDay === 2 && stepType === 'RESULT') {
      excelResults.push({
        row_id: row.getCell(1).value,
        ai_persona_name: row.getCell(3).value,
        step_number: row.getCell(5).value,
        parent_row_id: row.getCell(6).value,
      });
    }
  });

  console.log('=== 엑셀: 2일차 RESULT ===');
  console.log(`총 ${excelResults.length}개\n`);
  excelResults.forEach(r => {
    console.log(`  row_id=${r.row_id}, persona=${r.ai_persona_name}, step=${r.step_number}, parent=${r.parent_row_id}`);
  });

  // 2. DB에서 2일차 RESULT 조회
  const game2 = await prisma.balanceGame.findFirst({
    where: { challengeDay: 2 }
  });

  const dbResults = await prisma.balanceGameStep.findMany({
    where: {
      gameId: game2.id,
      stepType: 'RESULT'
    },
    include: {
      aiPersona: { select: { name: true } }
    },
    orderBy: { id: 'asc' }
  });

  console.log('\n=== DB: 2일차 RESULT ===');
  console.log(`총 ${dbResults.length}개\n`);
  dbResults.forEach(r => {
    console.log(`  id=${r.id}, persona=${r.aiPersona.name}, step=${r.stepNumber}, parent=${r.parentStepId}`);
  });

  // 3. 누락된 row_id 찾기
  const excelRowIds = excelResults.map(r => parseInt(r.row_id));
  const dbIds = dbResults.map(r => r.id);

  const missing = excelRowIds.filter(id => !dbIds.includes(id));
  console.log('\n=== 누락된 row_id ===');
  console.log(missing);

  await prisma.$disconnect();
}

check();
