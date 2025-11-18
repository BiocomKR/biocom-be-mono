const ExcelJS = require('exceljs');
const path = require('path');

/**
 * 밸런스게임 엑셀 템플릿 생성 스크립트
 */
async function createBalanceGameExcelTemplate() {
  console.log('📊 밸런스게임 엑셀 템플릿 생성 시작...\n');

  const workbook = new ExcelJS.Workbook();

  // ============================================
  // 1. GAME 시트 생성
  // ============================================
  const gameSheet = workbook.addWorksheet('GAME', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  });

  // 헤더 설정
  gameSheet.columns = [
    { header: 'challenge_day', key: 'challenge_day', width: 15 },
    { header: 'title', key: 'title', width: 25 },
    { header: 'description', key: 'description', width: 40 },
    { header: 'thumbnail_url', key: 'thumbnail_url', width: 60 },
    { header: 'background_url', key: 'background_url', width: 60 }
  ];

  // 헤더 스타일
  gameSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  gameSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  gameSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // 샘플 데이터 (21일치)
  const games = [
    { day: 1, title: '첫날의 선택', description: '건강한 시작을 위한 첫 번째 선택입니다.' },
    { day: 2, title: '아침의 딜레마', description: '건강한 아침을 위한 선택을 해보세요.' },
    { day: 3, title: '영양소의 선택', description: '오늘 필요한 영양소를 선택해보세요.' },
    { day: 4, title: '운동 vs 휴식', description: '몸과 마음을 위한 선택을 해보세요.' },
    { day: 5, title: '건강한 간식', description: '건강과 맛 두 마리 토끼를 잡아보세요.' },
    { day: 6, title: '물 vs 차', description: '오늘의 수분 섭취 방법을 선택하세요.' },
    { day: 7, title: '일주일의 마무리', description: '일주일 동안의 노력을 돌아보세요.' },
    { day: 8, title: '새로운 주의 시작', description: '2주차를 맞이하는 마음가짐을 선택하세요.' },
    { day: 9, title: '건강한 저녁', description: '하루를 마무리하는 건강한 선택을 하세요.' },
    { day: 10, title: '중간점검', description: '챌린지 중간 지점에서의 선택입니다.' },
    { day: 11, title: '새로운 습관', description: '지금까지 만든 습관을 더 발전시켜보세요.' },
    { day: 12, title: '건강한 점심', description: '에너지를 충전하는 선택을 하세요.' },
    { day: 13, title: '스트레스 관리', description: '마음 건강을 위한 선택을 해보세요.' },
    { day: 14, title: '2주 완주', description: '여기까지 온 당신을 축하합니다!' },
    { day: 15, title: '3주차 시작', description: '마지막 주를 힘차게 시작해봅시다.' },
    { day: 16, title: '영양 밸런스', description: '균형잡힌 영양 섭취를 위한 선택입니다.' },
    { day: 17, title: '수면의 중요성', description: '충분한 휴식을 위한 선택을 하세요.' },
    { day: 18, title: '건강한 저녁', description: '하루를 건강하게 마무리하세요.' },
    { day: 19, title: '거의 다 왔어요', description: '이제 곧 완주입니다!' },
    { day: 20, title: '마지막 날', description: '드디어 마지막 날입니다!' },
    { day: 21, title: '완주 축하', description: '21일 챌린지 완주를 축하합니다!' }
  ];

  games.forEach(game => {
    gameSheet.addRow({
      challenge_day: game.day,
      title: game.title,
      description: game.description,
      thumbnail_url: `https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-day${game.day}.png`,
      background_url: `https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-bg${game.day}.png`
    });
  });

  // ============================================
  // 2. STEPS 시트 생성
  // ============================================
  const stepsSheet = workbook.addWorksheet('STEPS', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  });

  // 헤더 설정
  stepsSheet.columns = [
    { header: 'challenge_day', key: 'challenge_day', width: 15 },
    { header: 'ai_persona_name', key: 'ai_persona_name', width: 15 },
    { header: 'step_number', key: 'step_number', width: 12 },
    { header: 'step_type', key: 'step_type', width: 12 },
    { header: 'parent_step_number', key: 'parent_step_number', width: 18 },
    { header: 'parent_selected_option', key: 'parent_selected_option', width: 20 },
    { header: 'selected_option', key: 'selected_option', width: 15 },
    { header: 'title', key: 'title', width: 20 },
    { header: 'content', key: 'content', width: 50 },
    { header: 'option_1_text', key: 'option_1_text', width: 25 },
    { header: 'option_2_text', key: 'option_2_text', width: 25 },
    { header: 'coupon_product_name', key: 'coupon_product_name', width: 30 }
  ];

  // 헤더 스타일
  stepsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  stepsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF70AD47' }
  };
  stepsSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // 샘플 데이터 (1일차 스텔라, 메이브)
  const sampleSteps = [
    // 스텔라 - 선택지 1
    { day: 1, persona: '스텔라', step: 1, type: 'QUESTION', parent: '', parentOpt: '', selOpt: '', title: '첫날의 선택', content: '건강한 아침을 시작하려면 무엇을 선택하겠어?', opt1: '채소 위주 식단', opt2: '단백질 위주 식단', coupon: '' },
    { day: 1, persona: '스텔라', step: 2, type: 'DIALOGUE', parent: 1, parentOpt: '', selOpt: 1, title: '', content: '좋은 선택이야. 채소는 비타민이 풍부하지.', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '스텔라', step: 3, type: 'DIALOGUE', parent: 2, parentOpt: 1, selOpt: '', title: '', content: '특히 아침에 먹는 채소는 소화에 좋아.', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '스텔라', step: 4, type: 'DIALOGUE', parent: 3, parentOpt: 1, selOpt: '', title: '', content: '하루 시작을 가볍게 하는 데 도움이 되지.', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '스텔라', step: 5, type: 'DIALOGUE', parent: 4, parentOpt: 1, selOpt: '', title: '', content: '꾸준히 먹으면 건강이 눈에 띄게 좋아질 거야.', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '스텔라', step: 6, type: 'RESULT', parent: 5, parentOpt: 1, selOpt: '', title: '완료!', content: '클린 밸런스로 더 건강하게 관리해보자.', opt1: '', opt2: '', coupon: '클린 밸런스 (120정)' },
    // 스텔라 - 선택지 2
    { day: 1, persona: '스텔라', step: 2, type: 'DIALOGUE', parent: 1, parentOpt: '', selOpt: 2, title: '', content: '단백질 선택도 나쁘지 않네.', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '스텔라', step: 3, type: 'DIALOGUE', parent: 2, parentOpt: 2, selOpt: '', title: '', content: '아침에 단백질은 에너지를 높여줘.', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '스텔라', step: 4, type: 'DIALOGUE', parent: 3, parentOpt: 2, selOpt: '', title: '', content: '집중력도 올라가고 좋지.', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '스텔라', step: 5, type: 'DIALOGUE', parent: 4, parentOpt: 2, selOpt: '', title: '', content: '균형잡힌 식단이 중요해.', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '스텔라', step: 6, type: 'RESULT', parent: 5, parentOpt: 2, selOpt: '', title: '완료!', content: '다래케어로 영양을 보충하는 것도 좋아.', opt1: '', opt2: '', coupon: '다래케어 (180정)' },

    // 메이브 - 선택지 1
    { day: 1, persona: '메이브', step: 1, type: 'QUESTION', parent: '', parentOpt: '', selOpt: '', title: '첫날의 선택~!', content: '건강한 아침 시작하려면 뭐 먹을래~?', opt1: '채소 위주 식단!', opt2: '단백질 위주 식단!', coupon: '' },
    { day: 1, persona: '메이브', step: 2, type: 'DIALOGUE', parent: 1, parentOpt: '', selOpt: 1, title: '', content: '와~ 채소 완전 좋지~!', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '메이브', step: 3, type: 'DIALOGUE', parent: 2, parentOpt: 1, selOpt: '', title: '', content: '비타민 가득가득해서 피부에 완전 좋아~!', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '메이브', step: 4, type: 'DIALOGUE', parent: 3, parentOpt: 1, selOpt: '', title: '', content: '나도 매일 채소 먹는데 진짜 좋더라~!', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '메이브', step: 5, type: 'DIALOGUE', parent: 4, parentOpt: 1, selOpt: '', title: '', content: '같이 건강해지자~!', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '메이브', step: 6, type: 'RESULT', parent: 5, parentOpt: 1, selOpt: '', title: '완료!', content: '클린 밸런스로 더 예뻐지자~!', opt1: '', opt2: '', coupon: '클린 밸런스 (120정)' },
    // 메이브 - 선택지 2
    { day: 1, persona: '메이브', step: 2, type: 'DIALOGUE', parent: 1, parentOpt: '', selOpt: 2, title: '', content: '오~ 단백질 완전 좋은 선택이야~!', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '메이브', step: 3, type: 'DIALOGUE', parent: 2, parentOpt: 2, selOpt: '', title: '', content: '에너지 뿜뿜해져서 완전 좋아~!', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '메이브', step: 4, type: 'DIALOGUE', parent: 3, parentOpt: 2, selOpt: '', title: '', content: '나도 운동할 때 단백질 챙겨먹어~!', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '메이브', step: 5, type: 'DIALOGUE', parent: 4, parentOpt: 2, selOpt: '', title: '', content: '같이 건강미인 되자~!', opt1: '', opt2: '', coupon: '' },
    { day: 1, persona: '메이브', step: 6, type: 'RESULT', parent: 5, parentOpt: 2, selOpt: '', title: '완료!', content: '다래케어로 영양 챙기는 것도 좋아~!', opt1: '', opt2: '', coupon: '다래케어 (180정)' }
  ];

  sampleSteps.forEach(step => {
    stepsSheet.addRow({
      challenge_day: step.day,
      ai_persona_name: step.persona,
      step_number: step.step,
      step_type: step.type,
      parent_step_number: step.parent,
      parent_selected_option: step.parentOpt,
      selected_option: step.selOpt,
      title: step.title,
      content: step.content,
      option_1_text: step.opt1,
      option_2_text: step.opt2,
      coupon_product_name: step.coupon
    });
  });

  // ============================================
  // 3. 작성안내 시트 생성
  // ============================================
  const guideSheet = workbook.addWorksheet('작성안내');
  guideSheet.getColumn(1).width = 80;

  const guides = [
    '밸런스게임 엑셀 템플릿 작성 가이드',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '■ 시트 구성',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '1. GAME 시트: 21일치 게임 기본 정보',
    '2. STEPS 시트: 캐릭터별 단계별 대사',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '■ GAME 시트 컬럼 설명',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '• challenge_day: 챌린지 일차 (1~21)',
    '• title: 게임 제목',
    '• description: 게임 설명',
    '• thumbnail_url: 대표 이미지 URL',
    '• background_url: 배경 이미지 URL',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '■ STEPS 시트 컬럼 설명',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '• challenge_day: 챌린지 일차 (1~21)',
    '• ai_persona_name: AI 페르소나 이름',
    '  → 스텔라, 메이브, 헤이즈, 이안, 테오, 헨리, 볼찌, 윈터, 초롬이',
    '• step_number: 단계 번호 (1부터 시작, 가변적)',
    '• step_type: 단계 타입',
    '  → QUESTION: 질문 (1단계, 선택지 2개)',
    '  → DIALOGUE: 대화 (중간 대사)',
    '  → RESULT: 결과 (마지막 단계, 쿠폰 지급)',
    '• parent_step_number: 부모 단계 번호 (1단계는 비워둠)',
    '• parent_selected_option: 부모가 몇 번 선택지인지 (부모 특정용)',
    '  → 같은 step_number가 여러 개일 때 구분',
    '• selected_option: 현재 단계에서 선택한 옵션 (1 또는 2)',
    '  → QUESTION 바로 다음 DIALOGUE만 입력',
    '• title: 제목 (1단계와 RESULT 단계만 입력)',
    '• content: 대사 내용 (필수)',
    '• option_1_text: 선택지 1 텍스트 (1단계만 입력)',
    '• option_2_text: 선택지 2 텍스트 (1단계만 입력)',
    '• coupon_product_name: 쿠폰 상품명 (RESULT 단계만 입력)',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '■ 작성 예시 (단계 구조)',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '1. QUESTION (step 1) → 선택지 2개 제시',
    '2. DIALOGUE (step 2, selected_option=1) → 선택1에 대한 반응',
    '3. DIALOGUE (step 3, parent=2, parent_selected_option=1) → 추가 설명',
    '4. DIALOGUE (step 4, parent=3, parent_selected_option=1) → 추가 설명',
    '5. RESULT (step 6, parent=4, parent_selected_option=1) → 완료 + 쿠폰',
    '6. DIALOGUE (step 2, selected_option=2) → 선택2에 대한 반응',
    '7. DIALOGUE (step 3, parent=2, parent_selected_option=2) → 추가 설명',
    '8. DIALOGUE (step 4, parent=3, parent_selected_option=2) → 추가 설명',
    '9. RESULT (step 6, parent=4, parent_selected_option=2) → 완료 + 쿠폰',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '■ 주의사항',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '• 단계 수는 가변적입니다 (최소 3단계부터)',
    '• 같은 step_number가 여러 개 있을 수 있습니다 (선택지별 분기)',
    '• parent_selected_option으로 정확한 부모를 지정하세요',
    '• 각 캐릭터마다 말투가 다르니 캐릭터 성격에 맞게 작성하세요',
    '• STEPS 시트의 1일차 샘플을 참고하세요',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '■ 완료 후',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '1. 엑셀 파일을 scripts/ 폴더에 저장',
    '2. 마이그레이션 스크립트 실행:',
    '   node scripts/migrate-balance-game-from-excel.js [엑셀파일경로]',
    '3. DB에 자동으로 데이터 적재 완료!'
  ];

  guides.forEach((guide, index) => {
    const row = guideSheet.addRow([guide]);
    if (index === 0) {
      row.font = { bold: true, size: 16, color: { argb: 'FF0066CC' } };
    } else if (guide.startsWith('■')) {
      row.font = { bold: true, size: 12 };
    } else if (guide.startsWith('•')) {
      row.font = { size: 11 };
    }
  });

  // ============================================
  // 파일 저장
  // ============================================
  const outputPath = path.join(__dirname, 'balance-game-template.xlsx');
  await workbook.xlsx.writeFile(outputPath);

  console.log(`✅ 엑셀 템플릿 생성 완료!`);
  console.log(`📁 파일 위치: ${outputPath}`);
  console.log(`\n📊 시트 구성:`);
  console.log(`  1. GAME 시트: 21일치 게임 정보 (샘플 포함)`);
  console.log(`  2. STEPS 시트: 1일차 샘플 (스텔라, 메이브)`);
  console.log(`  3. 작성안내 시트: 상세한 작성 가이드`);
}

// 실행
createBalanceGameExcelTemplate()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  });
