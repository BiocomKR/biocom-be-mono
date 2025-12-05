const ExcelJS = require('exceljs');

async function analyzeStepsPattern() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('/Users/daegilchoi/Downloads/balance-game-template-v2_완료.xlsx');

  const stepsSheet = workbook.getWorksheet('STEPS');

  console.log('📊 STEPS 시트 71번째 줄까지 패턴 분석\n');
  console.log('='.repeat(120));

  const analysisData = [];
  let headerColumns = [];

  stepsSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // 헤더 저장
      headerColumns = row.values.slice(1);
      console.log('\n📋 컬럼 구조:');
      headerColumns.forEach((col, idx) => {
        console.log(`  ${idx + 1}. ${col}`);
      });
      console.log('\n' + '-'.repeat(120));
      return;
    }

    // 71번째 줄까지만
    if (rowNumber > 71) return;

    const rowData = {
      rowNumber,
      row_id: row.getCell(1).value,
      challenge_day: row.getCell(2).value,
      ai_persona_name: row.getCell(3).value,
      step_type: row.getCell(4).value,
      step_number: row.getCell(5).value,
      parent_row_id: row.getCell(6).value,
      title: row.getCell(7).value,
      content: row.getCell(8).value ? String(row.getCell(8).value).substring(0, 30) + '...' : null,
      option_text: row.getCell(9).value,
      coupon_product_name: row.getCell(10).value
    };

    analysisData.push(rowData);

    // 상세 출력 (처음 30줄만)
    if (rowNumber <= 30) {
      console.log(`\n[${rowNumber}] row_id=${rowData.row_id} (${rowData.ai_persona_name}, ${rowData.step_type})`);
      console.log(`  step_number: ${rowData.step_number}, parent_row_id: ${rowData.parent_row_id}`);
      if (rowData.title) console.log(`  title: ${rowData.title}`);
    }
  });

  console.log('\n\n' + '='.repeat(120));
  console.log('\n🔍 패턴 분석:\n');

  // step_type별 그룹화
  const byType = {};
  analysisData.forEach(row => {
    if (!byType[row.step_type]) byType[row.step_type] = [];
    byType[row.step_type].push(row);
  });

  console.log('1️⃣ step_type별 분석:');
  Object.entries(byType).forEach(([type, rows]) => {
    console.log(`\n  [${type}] ${rows.length}개`);

    // step_number 분포
    const stepNumbers = rows.map(r => r.step_number).filter(n => n !== null);
    const uniqueStepNumbers = [...new Set(stepNumbers)];
    console.log(`    step_number 범위: ${uniqueStepNumbers.join(', ')}`);

    // parent_row_id 패턴
    const hasParent = rows.filter(r => r.parent_row_id !== null).length;
    const noParent = rows.filter(r => r.parent_row_id === null).length;
    console.log(`    parent_row_id: 있음(${hasParent}), 없음(${noParent})`);

    // 샘플 출력
    console.log(`    샘플 (처음 3개):`);
    rows.slice(0, 3).forEach(r => {
      console.log(`      row=${r.row_id}, step_number=${r.step_number}, parent=${r.parent_row_id}`);
    });
  });

  console.log('\n\n2️⃣ AI 페르소나별 분석:');
  const byPersona = {};
  analysisData.forEach(row => {
    if (!byPersona[row.ai_persona_name]) byPersona[row.ai_persona_name] = [];
    byPersona[row.ai_persona_name].push(row);
  });

  Object.entries(byPersona).forEach(([persona, rows]) => {
    console.log(`\n  [${persona}] ${rows.length}개`);
    const stepNumbers = [...new Set(rows.map(r => r.step_number).filter(n => n !== null))];
    console.log(`    step_number: ${stepNumbers.join(', ')}`);
  });

  console.log('\n\n3️⃣ step_number 증가 패턴 분석:');
  console.log('  (row_id 순서대로 step_number가 어떻게 변하는지)\n');

  let prevStepNumber = null;
  let prevStepType = null;
  let pattern = [];

  analysisData.slice(0, 50).forEach((row, idx) => {
    if (row.step_number !== null) {
      const change = prevStepNumber !== null ? row.step_number - prevStepNumber : 0;
      const info = `row${row.row_id}(${row.step_type}): step_number=${row.step_number} (${change >= 0 ? '+' : ''}${change})`;

      if (pattern.length < 20) {
        pattern.push(info);
      }

      prevStepNumber = row.step_number;
    }
    prevStepType = row.step_type;
  });

  pattern.forEach(p => console.log(`    ${p}`));

  console.log('\n\n4️⃣ parent_row_id 참조 패턴 분석:');
  console.log('  (자식이 부모를 어떻게 참조하는지)\n');

  const parentChildMap = new Map();
  analysisData.forEach(row => {
    if (row.parent_row_id !== null) {
      if (!parentChildMap.has(row.parent_row_id)) {
        parentChildMap.set(row.parent_row_id, []);
      }
      parentChildMap.get(row.parent_row_id).push(row.row_id);
    }
  });

  console.log('  부모 → 자식 관계 (처음 10개):');
  let count = 0;
  for (const [parent, children] of parentChildMap.entries()) {
    if (count++ >= 10) break;
    console.log(`    parent_row_id=${parent} → children=[${children.join(', ')}]`);
  }

  console.log('\n\n5️⃣ 트리 구조 시각화 (처음 20개만):');
  const rootNodes = analysisData.filter(r => r.parent_row_id === null).slice(0, 5);

  function printTree(nodeRowId, indent = 0) {
    const node = analysisData.find(r => r.row_id === nodeRowId);
    if (!node) return;

    const prefix = '  '.repeat(indent);
    console.log(`${prefix}├─ row${node.row_id} [${node.step_type}] step_number=${node.step_number}`);

    const children = analysisData.filter(r => r.parent_row_id === nodeRowId);
    children.forEach(child => {
      if (indent < 3) { // 깊이 제한
        printTree(child.row_id, indent + 1);
      }
    });
  }

  rootNodes.forEach(root => {
    console.log(`\n  Root: row${root.row_id}`);
    printTree(root.row_id, 0);
  });

  console.log('\n\n' + '='.repeat(120));
  console.log('✅ 패턴 분석 완료!\n');
}

analyzeStepsPattern().catch(console.error);
