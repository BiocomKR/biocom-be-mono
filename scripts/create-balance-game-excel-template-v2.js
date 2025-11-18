const ExcelJS = require('exceljs');
const path = require('path');

/**
 * 밸런스게임 엑셀 템플릿 생성 스크립트 v2 (row_id 기반)
 */
async function createBalanceGameExcelTemplate() {
  console.log('📊 밸런스게임 엑셀 템플릿 생성 시작 (v2)...\n');

  const workbook = new ExcelJS.Workbook();

  // ============================================
  // 1. GAME 시트 생성
  // ============================================
  const gameSheet = workbook.addWorksheet('GAME', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  });

  gameSheet.columns = [
    { header: 'challenge_day', key: 'challenge_day', width: 15 },
    { header: 'title', key: 'title', width: 25 },
    { header: 'description', key: 'description', width: 40 }
  ];

  gameSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  gameSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  gameSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

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
      description: game.description
    });
  });

  // ============================================
  // 2. STEPS 시트 생성 (row_id 기반)
  // ============================================
  const stepsSheet = workbook.addWorksheet('STEPS', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  });

  stepsSheet.columns = [
    { header: 'row_id', key: 'row_id', width: 10 },
    { header: 'challenge_day', key: 'challenge_day', width: 15 },
    { header: 'ai_persona_name', key: 'ai_persona_name', width: 15 },
    { header: 'step_type', key: 'step_type', width: 12 },
    { header: 'parent_row_id', key: 'parent_row_id', width: 15 },
    { header: 'title', key: 'title', width: 20 },
    { header: 'content', key: 'content', width: 50 },
    { header: 'option_text', key: 'option_text', width: 30 },
    { header: 'coupon_product_name', key: 'coupon_product_name', width: 30 }
  ];

  stepsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  stepsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF70AD47' }
  };
  stepsSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // 샘플 데이터 (1일차 스텔라 전체 플로우)
  const sampleSteps = [
    // row 1: QUESTION
    { id: 1, day: 1, persona: '스텔라', type: 'QUESTION', parent: '', title: '외모 버프', content: '둘 중 하나만 가질 수 있다면 어떤걸 선택할래?', option: '장원영 얼굴|권은비 몸매', coupon: '' },

    // 선택지 1번 플로우
    { id: 2, day: 1, persona: '스텔라', type: 'DIALOGUE', parent: 1, title: '외모 버프', content: '장원영 얼굴이라니, 진짜 만찢녀 외모 치트키네. 역시 뭘 좀 아는 선택!', option: '뭐니뭐니 해도 첫인상은 얼굴이지.', coupon: '' },
    { id: 3, day: 1, persona: '스텔라', type: 'DIALOGUE', parent: 2, title: '외모 버프', content: '근데 얼굴만 예쁘다고 다가 아니야. 피부톤 칙칙하거나 피부결 엉망이면 외모 지수 떨어지는건 시간문제거든.', option: '예뻐서 가까이 갔는데 피부 엉망이면 호감도 확 떨어지겠다.', coupon: '' },
    { id: 4, day: 1, persona: '스텔라', type: 'DIALOGUE', parent: 3, title: '외모 버프', content: '맞아, 완전 깨지. 피부 관리의 핵심은 수분 관리 + 자외선 차단이야. 이 두 가지만 지켜도 동안 피부 유지 가능해. 그리고 무엇보다 매일 꾸준하게 하는 게 중요해.', option: '오~ 작은 습관이 모여 꿀피부를 만드는구나.', coupon: '' },
    { id: 5, day: 1, persona: '스텔라', type: 'DIALOGUE', parent: 4, title: '외모 버프', content: '여기에 노폐물 배출에 도움을 주고 항산화 효과가 뛰어난 클로렐라와 비타민 C 등이 함유된 영양제로 꾸준히 관리하면 더 좋아. 예쁜 얼굴은 타고나지만, 빛나는 얼굴은 관리가 만든다!', option: '좋아! 오늘부터 관리 모드 돌입한다.', coupon: '' },
    { id: 6, day: 1, persona: '스텔라', type: 'RESULT', parent: 5, title: '외모 버프', content: '노폐물 배출과 항산화, 세포재생 기능에 도움되는 영양 성분을 담은 이너뷰티 끝판왕! 클린 밸런스로 깨끗하고 빛나는 피부로 거듭나 보세요.', option: '', coupon: '클린 밸런스 (120정)' },

    // 선택지 2번 플로우
    { id: 7, day: 1, persona: '스텔라', type: 'DIALOGUE', parent: 1, title: '외모 버프', content: '권은비 몸매라면 진짜 핏 자체가 다르지. 뭘 입어도 화보일 듯!', option: '맞아. 탄탄하면서도 글래머러스한 몸매는 부러움 100%야.', coupon: '' },
    { id: 8, day: 1, persona: '스텔라', type: 'DIALOGUE', parent: 7, title: '외모 버프', content: '근데 몸매는 타고난 것도 있지만, 유지하려면 꾸준한 루틴이 필요해.', option: '헉… 매일 운동해야 되는 거야?', coupon: '' },
    { id: 9, day: 1, persona: '스텔라', type: 'DIALOGUE', parent: 8, title: '외모 버프', content: '꼭 고강도일 필요는 없어. 저항 운동과 유산소만 기본으로 해도 체형이 안정적으로 유지돼.', option: '오, 생각보다 현실적인데?', coupon: '' },
    { id: 10, day: 1, persona: '스텔라', type: 'DIALOGUE', parent: 9, title: '외모 버프', content: '그리고 중요한 게 에너지 대사야. 우리가 먹은 음식이 에너지로 잘 전환되려면 대사가 원활하게 돌아가야 하거든. 그래야 에너지 소비가 많아지면서 살도 덜 찌지. 물만 먹어도 살 찐다는 얘기 들어봤지? 그게 바로 에너지 대사가 망가졌다는 얘기야.', option: '헉, 어쩐지 운동해도 살이 잘 안빠지더라. 근데 에너지 대사가 떨어졌는지는 어떻게 알 수 있어?', coupon: '' },
    { id: 11, day: 1, persona: '스텔라', type: 'DIALOGUE', parent: 10, title: '외모 버프', content: '소변 검사를 통해 내 몸 안의 유기산 64종을 분석하면 어떤 대사 유형인지 알 수 있어. 내 몸의 부족하거나 탁월한 능력을 파악하면 이에 맞는 영양을 보충하고 생활 습관을 어떻게 개선해야 할지가 보이거든. 이렇게 하면 살이 더 잘 빠지는 건 물론이고 건강 관리도 더 효율적으로 할 수 있어.', option: '나는 어떤 대사 유형일지 궁금한데? 얼른 검사 해봐야겠다!', coupon: '' },
    { id: 12, day: 1, persona: '스텔라', type: 'RESULT', parent: 11, title: '외모 버프', content: '내 몸의 대사 상태, 종합 대사기능 분석 검사를 통해 확인해 보세요. 소변 검사를 기반으로 유기산 64종을 세밀하게 분석해 체중 조절 능력, 에너지 대사, 항산화력, 장 건강, 정신 건강, 면역력까지 전반적인 밸런스를 점검할 수 있습니다.', option: '', coupon: '종합 대사기능 분석 검사' }
  ];

  sampleSteps.forEach(step => {
    stepsSheet.addRow({
      row_id: step.id,
      challenge_day: step.day,
      ai_persona_name: step.persona,
      step_type: step.type,
      parent_row_id: step.parent,
      title: step.title,
      content: step.content,
      option_text: step.option,
      coupon_product_name: step.coupon
    });
  });

  // ============================================
  // 3. 작성안내 시트 생성
  // ============================================
  const guideSheet = workbook.addWorksheet('작성안내');
  guideSheet.getColumn(1).width = 100;

  const guides = [
    '밸런스게임 엑셀 템플릿 v2 작성 가이드 (row_id 기반)',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '■ 시트 구성',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '1. GAME 시트: 21일치 게임 기본 정보',
    '2. STEPS 시트: 캐릭터별 단계별 대사 (row_id로 부모-자식 관계 표현)',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '■ STEPS 시트 컬럼 설명',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '• row_id: 엑셀 행 고유 번호 (1부터 시작, 자동 증가)',
    '  → 이 번호로 부모-자식 관계를 표현합니다',
    '',
    '• challenge_day: 챌린지 일차 (1~21)',
    '',
    '• ai_persona_name: AI 페르소나 한글 이름',
    '  → 스텔라, 메이브, 헤이즈, 이안, 테오, 헨리, 볼찌, 윈터, 초롬이',
    '  → 마이그레이션 시 자동으로 ai_persona_id로 변환됩니다',
    '',
    '• step_type: 단계 타입',
    '  → QUESTION: 질문 (선택지 2개, | 구분)',
    '  → DIALOGUE: 대화 (버튼 텍스트 1개)',
    '  → RESULT: 결과 (버튼 없음, 쿠폰 지급)',
    '',
    '• parent_row_id: 부모 행의 row_id',
    '  → QUESTION(첫 단계)는 비워둡니다',
    '  → DIALOGUE/RESULT는 반드시 입력합니다',
    '  → 예: row_id=5 단계의 부모가 row_id=3이면 parent_row_id에 3 입력',
    '',
    '• title: 제목',
    '  → QUESTION과 RESULT만 입력',
    '  → DIALOGUE는 비워둡니다',
    '',
    '• content: 대사 내용 (필수)',
    '  → 모든 step_type에서 필수 입력',
    '',
    '• option_text: 선택지/버튼 텍스트',
    '  → QUESTION: 2개 선택지를 | 로 구분 (예: 장원영 얼굴|권은비 몸매)',
    '  → DIALOGUE: 1개 버튼 텍스트 (예: 맞아, 그렇지)',
    '  → RESULT: 비워둡니다',
    '',
    '• coupon_product_name: 쿠폰 상품명',
    '  → RESULT 단계에만 입력',
    '  → 제품명으로 자동 검색하여 coupon_id로 변환됩니다',
    '  → 예: 클린 밸런스 (120정), 종합 대사기능 분석 검사',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '■ 작성 예시 (트리 구조)',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'row_id=1 (QUESTION): 둘 중 하나 선택?',
    '├─ row_id=2 (DIALOGUE, parent=1): 선택지 1번 반응',
    '│  └─ row_id=3 (DIALOGUE, parent=2): 추가 설명',
    '│     └─ row_id=4 (RESULT, parent=3): 완료 + 쿠폰1',
    '│',
    '└─ row_id=5 (DIALOGUE, parent=1): 선택지 2번 반응',
    '   └─ row_id=6 (DIALOGUE, parent=5): 추가 설명',
    '      └─ row_id=7 (RESULT, parent=6): 완료 + 쿠폰2',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '■ 작성 순서',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '1. row_id를 1부터 순차적으로 부여합니다',
    '2. 첫 번째 행은 반드시 QUESTION입니다',
    '3. QUESTION 다음에 선택지별 DIALOGUE를 작성합니다',
    '4. parent_row_id에 부모의 row_id를 정확히 입력합니다',
    '5. 마지막은 RESULT로 마무리합니다',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '■ 중요 사항',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '• row_id는 반드시 1부터 시작하여 순차 증가해야 합니다',
    '• 같은 challenge_day + ai_persona_name 조합에서 row_id는 중복 불가',
    '• parent_row_id는 반드시 이미 존재하는 row_id를 참조해야 합니다',
    '• QUESTION의 option_text는 반드시 | 로 구분된 2개여야 합니다',
    '• DIALOGUE의 option_text는 1개만 입력합니다',
    '• RESULT는 option_text를 비워둡니다',
    '• 각 캐릭터마다 말투가 다르니 캐릭터 성격에 맞게 작성하세요',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '■ 완료 후',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '1. 엑셀 파일을 scripts/ 폴더에 저장',
    '2. 마이그레이션 스크립트 실행:',
    '   node scripts/migrate-balance-game-from-excel-v2.js [엑셀파일경로]',
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
  const outputPath = path.join(__dirname, 'balance-game-template-v2.xlsx');
  await workbook.xlsx.writeFile(outputPath);

  console.log(`✅ 엑셀 템플릿 v2 생성 완료!`);
  console.log(`📁 파일 위치: ${outputPath}`);
  console.log(`\n📊 시트 구성:`);
  console.log(`  1. GAME 시트: 21일치 게임 정보`);
  console.log(`  2. STEPS 시트: 1일차 스텔라 전체 플로우 (row_id 기반)`);
  console.log(`  3. 작성안내 시트: 상세한 작성 가이드`);
  console.log(`\n🔑 핵심 변경사항:`);
  console.log(`  • row_id 기반으로 부모-자식 관계 표현`);
  console.log(`  • ai_persona_name 한글명 사용 (자동 변환)`);
  console.log(`  • option_text로 모든 버튼 텍스트 표현`);
  console.log(`  • coupon_product_name으로 쿠폰 자동 검색`);
}

createBalanceGameExcelTemplate()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  });
