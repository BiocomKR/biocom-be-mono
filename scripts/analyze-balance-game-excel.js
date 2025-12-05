const ExcelJS = require('exceljs');

async function analyzeExcel() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_완료.xlsx');

  console.log('📊 밸런스게임 엑셀 파일 분석 결과\n');
  console.log('='.repeat(100));

  // GAME 시트 분석
  const gameSheet = workbook.getWorksheet('GAME');
  if (gameSheet) {
    console.log('\n📋 GAME 시트 (게임 목록):');
    console.log('-'.repeat(100));

    let gameCount = 0;
    gameSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        console.log('헤더: challenge_day | title | description\n');
        return;
      }

      const challengeDay = row.getCell(1).value;
      const title = row.getCell(2).value;
      const description = row.getCell(3).value;

      if (challengeDay) {
        console.log(`[${challengeDay}일차] ${title}`);
        if (description) console.log(`  └─ ${description}`);
        gameCount++;
      }
    });
    console.log(`\n✅ 총 ${gameCount}개 게임 등록됨`);
  }

  // STEPS 시트 상세 분석
  const stepsSheet = workbook.getWorksheet('STEPS');
  if (stepsSheet) {
    console.log('\n\n📋 STEPS 시트 (스텝 데이터):');
    console.log('-'.repeat(100));

    const stepsByDay = {};
    const stepsByType = {};
    const stepsByPersona = {};
    const allSteps = [];

    stepsSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        console.log('헤더: row_id | challenge_day | ai_persona_name | step_type | parent_row_id | title | content | option_text | coupon_product_name\n');
        return;
      }

      const rowId = row.getCell(1).value;
      const challengeDay = row.getCell(2).value;
      const aiPersona = row.getCell(3).value;
      const stepType = row.getCell(4).value;
      const parentRowId = row.getCell(5).value;
      const title = row.getCell(6).value;
      const content = row.getCell(7).value;
      const optionText = row.getCell(8).value;
      const couponProductName = row.getCell(9).value;

      if (!rowId || !challengeDay) return;

      allSteps.push({
        rowId,
        challengeDay,
        aiPersona,
        stepType,
        parentRowId,
        title,
        content,
        optionText,
        couponProductName
      });

      // 일차별 카운트
      if (!stepsByDay[challengeDay]) stepsByDay[challengeDay] = 0;
      stepsByDay[challengeDay]++;

      // 타입별 카운트
      if (!stepsByType[stepType]) stepsByType[stepType] = 0;
      stepsByType[stepType]++;

      // 페르소나별 카운트
      if (!stepsByPersona[aiPersona]) stepsByPersona[aiPersona] = 0;
      stepsByPersona[aiPersona]++;
    });

    // 통계 출력
    console.log('\n📊 챌린지 일차별 스텝 수:');
    Object.entries(stepsByDay).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([day, count]) => {
      console.log(`  ${day}일차: ${count}개 스텝`);
    });

    console.log('\n📊 스텝 타입별 분포:');
    Object.entries(stepsByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}개`);
    });

    console.log('\n📊 AI 페르소나별 스텝 수:');
    Object.entries(stepsByPersona).forEach(([persona, count]) => {
      console.log(`  ${persona}: ${count}개`);
    });

    const totalSteps = allSteps.length;
    console.log(`\n✅ 총 ${totalSteps}개 스텝 등록됨`);

    // 샘플 스텝 출력 (첫 3개)
    console.log('\n\n📝 샘플 스텝 데이터 (처음 3개):');
    console.log('-'.repeat(100));
    allSteps.slice(0, 3).forEach((step, index) => {
      console.log(`\n[${index + 1}] Row ${step.rowId} - ${step.challengeDay}일차 (${step.aiPersona})`);
      console.log(`  Type: ${step.stepType}`);
      console.log(`  Parent: ${step.parentRowId || '없음'}`);
      console.log(`  Title: ${step.title || '없음'}`);
      console.log(`  Content: ${step.content ? step.content.substring(0, 50) + '...' : '없음'}`);
      console.log(`  Options: ${step.optionText || '없음'}`);
      if (step.couponProductName) {
        console.log(`  Coupon: ${step.couponProductName}`);
      }
    });
  }

  console.log('\n' + '='.repeat(100));
  console.log('\n✨ 분석 완료!\n');
}

analyzeExcel().catch(console.error);
