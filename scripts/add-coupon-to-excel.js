const ExcelJS = require('exceljs');
const { PrismaClient } = require('@prisma/client');

// 운영 DB 연결
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom'
    }
  }
});

async function addCouponToExcel() {
  console.log('=== 운영 DB에서 coupon_id 조회 ===\n');

  // 1. 운영 DB에서 RESULT의 coupon_id 조회
  const prodResults = await prisma.$queryRaw`
    SELECT bgs.id, bg.challenge_day, bgs.ai_persona_id, bgs.step_number, bgs.coupon_id
    FROM balance_game_steps bgs
    JOIN balance_games bg ON bgs.game_id = bg.id
    WHERE bgs.step_type = 'RESULT'
    ORDER BY bgs.id ASC
  `;

  console.log(`운영 DB RESULT 레코드: ${prodResults.length}개`);

  // challenge_day + ai_persona_id + step_number -> coupon_id 매핑
  const couponMap = new Map();
  for (const r of prodResults) {
    const key = `${r.challenge_day}_${r.ai_persona_id}_${r.step_number}`;
    couponMap.set(key, r.coupon_id);
  }

  console.log(`coupon_id 매핑: ${couponMap.size}개\n`);

  // 2. 엑셀 파일 읽기
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_fixed.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');

  // persona 이름 -> id 매핑
  const personaIdMap = {
    '스텔라': 1,
    '메이브': 2,
    '헤이즐': 3,
    '이안': 4,
    '테오': 5,
    '헨리': 6,
  };

  // 3. 헤더에 coupon_id 컬럼 추가 (10번째 컬럼)
  const headerRow = stepsSheet.getRow(1);
  headerRow.getCell(10).value = 'coupon_id';
  headerRow.commit();

  // 4. RESULT 행에 coupon_id 추가
  let matchedCount = 0;
  let notMatchedCount = 0;

  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const stepType = row.getCell(4).value;
    if (stepType !== 'RESULT') return;

    const challengeDay = parseInt(row.getCell(2).value);
    const personaName = row.getCell(3).value ? row.getCell(3).value.trim() : null;
    const stepNumber = parseInt(row.getCell(5).value);

    const personaId = personaIdMap[personaName];
    if (!personaId) {
      console.log(`  ⚠️ 페르소나 없음: ${personaName} (엑셀행 ${rowNumber})`);
      return;
    }

    const key = `${challengeDay}_${personaId}_${stepNumber}`;
    const couponId = couponMap.get(key);

    if (couponId !== undefined && couponId !== null) {
      row.getCell(10).value = parseInt(couponId);
      matchedCount++;
    } else {
      notMatchedCount++;
      // 2일차와 일부 일차는 coupon_id가 없을 수 있음
      if (![2, 4, 7, 9, 10, 13, 14, 17, 19, 20, 21].includes(challengeDay)) {
        console.log(`  ⚠️ coupon_id 없음: ${challengeDay}일차 ${personaName} step=${stepNumber}`);
      }
    }

    row.commit();
  });

  console.log(`\ncoupon_id 매칭: ${matchedCount}개`);
  console.log(`coupon_id 없음: ${notMatchedCount}개`);

  // 5. 새 파일로 저장
  const outputPath = '/Users/daegilchoi/Downloads/balance-game-template-v2_fixed_with_coupon.xlsx';
  await workbook.xlsx.writeFile(outputPath);

  console.log(`\n✅ 저장 완료: ${outputPath}`);

  await prisma.$disconnect();
}

addCouponToExcel().catch(console.error);
