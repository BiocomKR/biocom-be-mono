import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('기초 데이터 마이그레이션 시작...');

  try {
    // 1. Mission 테이블에 기본 미션들이 있는지 확인하고 없으면 생성
    const missions = await ensureMissions();
    
    // 2. 각 미션별로 스케줄 데이터 삽입
    await migrateQuizzes(missions.QUIZ);
    await migrateDailyMissions(missions.DAILY_MISSION);
    await migrateContents(missions.DAILY_CONTENT);
    
    console.log('✅ 모든 데이터 마이그레이션 완료!');
  } catch (error) {
    console.error('❌ 마이그레이션 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function ensureMissions() {
  // QUIZ 미션 확인/생성
  const quizMission = await prisma.mission.upsert({
    where: { code: 'QUIZ' },
    update: {},
    create: {
      code: 'QUIZ',
      name: '오늘의 퀴즈',
      description: '매일 건강 관련 퀴즈를 풀어보세요',
      points: 200,
      requireUpload: false,
      sortOrder: 3,
      isActive: true,
      category: 'DAILY',
      dailyLimit: 1,
      totalDays: 21
    }
  });

  // DAILY_MISSION 미션 확인/생성
  const dailyMission = await prisma.mission.upsert({
    where: { code: 'DAILY_MISSION' },
    update: {},
    create: {
      code: 'DAILY_MISSION',
      name: '1일 1미션',
      description: '매일 특별한 미션을 수행해보세요',
      points: 100,
      requireUpload: true,
      sortOrder: 4,
      isActive: true,
      category: 'SPECIAL',
      dailyLimit: 1,
      totalDays: 21
    }
  });

  // DAILY_CONTENT 미션 확인/생성
  const contentMission = await prisma.mission.upsert({
    where: { code: 'DAILY_CONTENT' },
    update: {},
    create: {
      code: 'DAILY_CONTENT',
      name: '오늘의 컨텐츠',
      description: '매일 새로운 건강 정보를 확인하세요',
      points: 200,
      requireUpload: false,
      sortOrder: 5,
      isActive: true,
      category: 'DAILY',
      dailyLimit: 1,
      totalDays: 21
    }
  });

  return {
    QUIZ: quizMission,
    DAILY_MISSION: dailyMission,
    DAILY_CONTENT: contentMission
  };
}

async function migrateQuizzes(quizMission: any) {
  console.log('📝 퀴즈 데이터 마이그레이션 시작...');
  
  const quizData = [
    {
      day: 1,
      question: 'Q.다음 중 지연성 알러지와 관련이 없는 것은?',
      options: [
        { label: "복통", value: 1 },
        { label: "피부 트러블", value: 2 },
        { label: "아낙필락시스 쇼크", value: 3 },
        { label: "염증", value: 4 }
      ],
      answer: 3,
      explanation: '지연성 알러지는 24시간에서 72시간 후 염증, 복통, 피부 트러블 등을 유발합니다.'
    },
    {
      day: 2,
      question: 'Q.다음 중 면역 과민을 유발하는 라이프 스타일과 관련이 없는 것은?',
      options: [
        { label: "인스턴트 식품 섭취", value: 1 },
        { label: "운동 부족", value: 2 },
        { label: "수면 부족", value: 3 },
        { label: "규칙적인 식습관", value: 4 }
      ],
      answer: 4,
      explanation: '면역 과민을 유발하는 습관에는 운동,수면 부족 및 인스턴트 식품 섭취 등이 있습니다.'
    },
    {
      day: 3,
      question: 'Q.다음 중 장 누수 증후군과 관련된 증상이 아닌 것은?',
      options: [
        { label: "손발 저림", value: 1 },
        { label: "만성 피로", value: 2 },
        { label: "피부 트러블", value: 3 },
        { label: "컨디션 저하", value: 4 }
      ],
      answer: 1,
      explanation: '장 누수는 피부 트러블, 만성 피로, 컨디션 저하 등 전신 염증 반응을 유발합니다.'
    },
    {
      day: 4,
      question: 'Q.건강한 장을 위해서 피해야하는 것은?',
      options: [
        { label: "적절한 수면", value: 1 },
        { label: "수분 섭취", value: 2 },
        { label: "당 섭취", value: 3 },
        { label: "규칙적인 운동", value: 4 }
      ],
      answer: 3,
      explanation: '당 섭취는 유해균 증식을 유발하여 장 건강을 해칠 수 있습니다.'
    },
    {
      day: 5,
      question: 'Q. 소장 내 세균 과증식 (SIBO) 의 증상이 아닌 것은 ?',
      options: [
        { label: "경련", value: 1 },
        { label: "아토피 피부염", value: 2 },
        { label: "만성 피로", value: 3 },
        { label: "브레인 포그", value: 4 }
      ],
      answer: 1,
      explanation: '소장 내 세균 과증식은 장누수를 유발하여\n피부 트러블, 만성피로, 브레인포그 등 전신염증 반응을 유발합니다.'
    },
    {
      day: 6,
      question: 'Q. 포드맵 식품이 아닌 것은?',
      options: [
        { label: "양파", value: 1 },
        { label: "강낭콩", value: 2 },
        { label: "요거트", value: 3 },
        { label: "돼지고기", value: 4 }
      ],
      answer: 4,
      explanation: '포드맵 식품에는 마늘,양파,강낭콩,유제품 및 당 알코올 식품 등이 포함됩니다.'
    },
    {
      day: 7,
      question: 'Q. 침 속 유해균이 음식에 닿고 2배 증식하는데 걸리는 시간은?',
      options: [
        { label: "20분", value: 1 },
        { label: "40분", value: 2 },
        { label: "1시간", value: 3 },
        { label: "6시간", value: 4 }
      ],
      answer: 1,
      explanation: '유해균이 음식에 닿고 2배가 되는데는 20분 정도가 소요됩니다.\n식품 위생을 통해 SIBO를 예방하세요.'
    },
    {
      day: 8,
      question: 'Q. 다음 중 소장 내 세균 과증식에 도움이 되는 식품은?',
      options: [
        { label: "고포드맵 식품", value: 1 },
        { label: "인스턴트 식품", value: 2 },
        { label: "가수분해 구아검", value: 3 },
        { label: "식이섬유 섭취", value: 4 }
      ],
      answer: 3,
      explanation: '가수분해 구아검은 저포드맵 프리바이오틱스로, 소장에서 발효되지 않고\n 대장에서 유익균의 먹이로 작용해 소장 내 세균 과증식을 억제합니다.'
    },
    {
      day: 9,
      question: 'Q. 다음 중 대사에 속하지 않는 것은?',
      options: [
        { label: "소화", value: 1 },
        { label: "흡수", value: 2 },
        { label: "배설", value: 3 },
        { label: "호흡", value: 4 }
      ],
      answer: 4,
      explanation: '대사는 영양분을 분해·합성해 에너지와 신체 구성 물질을 만들고 불필요한 물질을\n 배출하는 과정입니다. 호흡은 에너지 생성에 필요하지만, 대사 과정 자체에는 포함되지 않습니다.'
    },
    {
      day: 10,
      question: 'Q. 혈당 조절을 위한 방법으로 옳지 않은 것은?',
      options: [
        { label: "저탄고지 식단", value: 1 },
        { label: "알코올 섭취", value: 2 },
        { label: "간헐적 단식", value: 3 },
        { label: "건강한 지방 섭취", value: 4 }
      ],
      answer: 2,
      explanation: '혈당 조절을 위해서는 저탄수화물 식단과 간헐적 단식이 도움이 됩니다\n. 대표적으로는 저탄고지와 키토제닉이 있습니다.'
    },
    {
      day: 11,
      question: 'Q. 다음 중 염증을 줄이는 것에 도움이 되는 식품은?',
      options: [
        { label: "식용유", value: 1 },
        { label: "포도씨유", value: 2 },
        { label: "올리브유", value: 3 },
        { label: "카놀라유", value: 4 }
      ],
      answer: 3,
      explanation: '올리브유는 오메가-6 지방산 함량이 낮고 항염증 성분이 풍부해 염증 감소에\n 효과적입니다. 반면, 식용유, 포도씨유, 카놀라유는 오메가-6 함량이 높아 염증을 유발할 수 있습니다.'
    },
    {
      day: 12,
      question: 'Q 림프관을 통한 노페물 배출에 도움이 되지 않는 것은?',
      options: [
        { label: "마사지", value: 1 },
        { label: "근력 운동", value: 2 },
        { label: "유산소 운동", value: 3 },
        { label: "가공 식품 섭취", value: 4 }
      ],
      answer: 4,
      explanation: '마사지, 근력 운동, 유산소 운동은 림프 순환을 촉진해 노폐물 배출에 도움이 됩니다.\n 반면, 가공식품 섭취는 염증을 유발하고 림프계 건강에 부정적인 영향을 줄 수 있습니다.'
    },
    {
      day: 13,
      question: 'Q 인슐린 저항성을 낮추는 것에 도움이 되는 것은?',
      options: [
        { label: "고탄수화물 식단", value: 1 },
        { label: "충분한 수면", value: 2 },
        { label: "밀가루 섭취", value: 3 },
        { label: "가공식품 섭취", value: 4 }
      ],
      answer: 2,
      explanation: '충분한 수면, 저탄수화물 식단, 간헐적 단식은 인슐린 저항성을 낮추는 데 효과적입니다.\n 고탄수화물 식단, 밀가루, 가공식품은 인슐린 저항성을 악화시킬 수 있습니다.'
    },
    {
      day: 14,
      question: 'Q. 다음 중 스트레스 저하에 도움이 되는 것은?',
      options: [
        { label: "산책", value: 1 },
        { label: "단 음식", value: 2 },
        { label: "알코올", value: 3 },
        { label: "카페인", value: 4 }
      ],
      answer: 1,
      explanation: '산책, 심호흡, 명상, 취미 활동 등은 스트레스 해소에 효과적입니다.\n 반면, 고당 식품, 카페인 과다 섭취, 흡연은 스트레스를 악화시킬 수 있습니다.'
    },
    {
      day: 15,
      question: 'Q.다음 중 미토콘드리아가 건강을 위한 솔루션으로 옳지 않은 것은?',
      options: [
        { label: "간헐적 단식", value: 1 },
        { label: "적절한 수면", value: 2 },
        { label: "가공식품 섭취", value: 3 },
        { label: "유산소 운동", value: 4 }
      ],
      answer: 3,
      explanation: '미토콘드리아 건강을 위해서는 간헐적 단식, 적절한 수면, 유산소 운동 및 중강도의 근력운동이 도움이 됩니다.'
    },
    {
      day: 16,
      question: 'Q.다음 중 활성 산소 과다 생성을 촉진하는 원인이 아닌 것은?',
      options: [
        { label: "간헐적 단식", value: 1 },
        { label: "과식", value: 2 },
        { label: "수면 부족", value: 3 },
        { label: "스트레스", value: 4 }
      ],
      answer: 1,
      explanation: '과식, 수면 부족, 스트레스는 활성 산소의 과다 생성을 촉진합니다.'
    },
    {
      day: 17,
      question: 'Q.다음 중 대사이질성의 원인에 포함되지 않는 요소는?',
      options: [
        { label: "유전학", value: 1 },
        { label: "장내미생물", value: 2 },
        { label: "식이섭취", value: 3 },
        { label: "내향적 성격", value: 4 }
      ],
      answer: 4,
      explanation: '대사이질성의 원인으로는 유전학, 후성 유전학, 장내미생물, 생활 습관, 식이 섭취, 환경 노출 등의 요소가 있습니다.'
    },
    {
      day: 18,
      question: 'Q.다음 중 바이오해킹에 대한 설명으로 적절하지 않은 것은?',
      options: [
        { label: "신체 최적화", value: 1 },
        { label: "과학적 신체 분석", value: 2 },
        { label: "민간 요법", value: 3 },
        { label: "두뇌 최적화", value: 4 }
      ],
      answer: 3,
      explanation: '바이오해킹이란 자신의 신체를 과학적으로 분석하여 맞춤형 개인 솔루션을 통해 신체와 두뇌를 최적화하는 것입니다.'
    },
    {
      day: 19,
      question: 'Q.다음 중 바이오컴의 스트레스 노화 검사를 통해 알 수 있는 항목이 아닌 것은?',
      options: [
        { label: "기상 피로도", value: 1 },
        { label: "골격근 수치", value: 2 },
        { label: "스트레스 관리 능력", value: 3 },
        { label: "스트레스 상태", value: 4 }
      ],
      answer: 2,
      explanation: '바이오컴의 스트레스 노화 호르몬 검사를 통해서 기상피로도, 스트레스 관리 능력, 스트레스 상태 및 호르몬 나이와 호르몬 균형을 확인할 수 있습니다.'
    },
    {
      day: 20,
      question: 'Q.다음 중 중금속 축적으로 인한 증상이 아닌 것은?',
      options: [
        { label: "피부 노화", value: 1 },
        { label: "자가면역 질환", value: 2 },
        { label: "피부 트러블", value: 3 },
        { label: "체중 증가", value: 4 }
      ],
      answer: 2,
      explanation: '영양 중금속의 축적은 전신 염증을 일으켜 피부 노화, 트러블, 체중 증가와 같은 증상이 나타날 수 있습니다.'
    },
    {
      day: 21,
      question: 'Q.다음 중 이너뷰티에 악영향을 미치는 요인이 아닌 것은?',
      options: [
        { label: "장 누수 증후군", value: 1 },
        { label: "면역 과민 반응", value: 2 },
        { label: "고포드맵 식품", value: 3 },
        { label: "건강 주권", value: 4 }
      ],
      answer: 4,
      explanation: '건강 주권이란 내 건강의 주인이 되는 것으로, 자신의 건강과 관련된 결정, 정보, 치료 등을 스스로 통제하고 책임지는 권리입니다.'
    }
  ];

  for (const quiz of quizData) {
    await prisma.missionSchedule.create({
      data: {
        missionId: quizMission.id,
        day: quiz.day,
        title: `Day ${quiz.day} - 오늘의 퀴즈`,
        description: '오늘의 건강 지식을 테스트해보세요',
        type: 'QUIZ',
        data: {
          question: quiz.question,
          options: quiz.options,
          answer: quiz.answer,
          explanation: quiz.explanation
        },
        points: 200
      }
    });
  }
  
  console.log(`✅ ${quizData.length}개의 퀴즈 데이터 삽입 완료`);
}

async function migrateDailyMissions(dailyMission: any) {
  console.log('🎯 1일1미션 데이터 마이그레이션 시작...');
  
  const missionData = [
    {
      day: 1,
      title: '햇빛 보며 산책하기',
      description: '오늘은 햇살 아래를 걸어볼까요? 따뜻한 햇살과 함께 걷는 시간은 마음까지 환하게 밝혀줘요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/a1bdba24fa18f.jpg',
      reason: '햇빛은 비타민 D 생성을 돕고, 스트레스를 줄여 피부 재생과 염증 완화에 효과적입니다.',
      method: '산책 중 자연 풍경이나 셀카 사진을 공유해주세요.'
    },
    {
      day: 2,
      title: '10분 명상',
      description: '잠시 멈추고 조용히 눈을 감아보세요. 나에게 집중하는 10분이 오늘 하루를 바꿔줄 거예요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/7c984b9d7a047.jpg',
      reason: '명상은 스트레스를 완화하고 자율신경을 안정시켜 피부 염증 반응을 줄여줍니다.',
      method: '명상 공간, 타이머, 또는 앱 화면을 공유해주세요.'
    },
    {
      day: 3,
      title: '허브티 한 잔 마시기',
      description: '커피 대신 따뜻한 허브티 한 잔으로 여유를 즐겨보세요. 은은한 향이 마음을 감싸줘요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/2960e048f7887.jpg',
      reason: '허브티는 항산화 효과가 있어 피부 진정과 트러블 완화에 도움을 줍니다.',
      method: '마신 허브티 사진이나 잔을 공유해주세요.'
    },
    {
      day: 4,
      title: '수면 전 명상 음악',
      description: '오늘 밤은 음악과 함께 릴렉스하는 시간을 가져보세요. 부드러운 소리가 마음을 감싸 안아줄 거예요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/34d3be6c4e27f.jpg',
      reason: '수면 질 향상은 피부 재생을 촉진하고 야간 트러블 회복에도 도움이 됩니다.',
      method: '수면 음악 재생화면 또는 듣는 공간 사진을 공유해주세요.'
    },
    {
      day: 5,
      title: '림프 순환',
      description: '다리를 벽에 기대고 5분간 휴식해보세요. 부기와 피로가 서서히 가라앉을 거예요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/bcd6f70b9850f.jpg',
      reason: '림프 순환을 도우면 노폐물 배출이 원활해지고 피부가 맑고 투명해져요.',
      method: '벽에 다리를 올린 자세 사진을 공유해주세요.'
    },
    {
      day: 6,
      title: '미소 연습',
      description: '거울 앞에서 환하게 웃어볼까요? 작은 미소 하나가 하루를 바꾸기도 해요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/e07955d77dd71.jpg',
      reason: '웃음은 엔도르핀 분비를 촉진해 스트레스를 완화하고 피부 염증을 줄여줍니다.',
      method: '밝게 웃는 셀카를 공유해주세요.'
    },
    {
      day: 7,
      title: '아침 감사 기록',
      description: '오늘 아침, 고마운 일 3가지를 떠올려보세요. 감사한 마음이 하루를 부드럽게 열어줘요.',
      verifyType: 'TEXT',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/dcda59a723b6e.jpg',
      reason: '긍정 감정은 자율신경을 안정시켜 피부 컨디션을 개선하고 면역력을 높입니다.',
      method: '감사한 일 3가지를 작성해주세요.'
    },
    {
      day: 8,
      title: '자연 속 산책하기',
      description: '숲길, 강가, 공원… 자연을 느낄 수 있는 곳에서 걸어보세요. 바람결과 햇살이 피부에도 스며들 거예요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/f83ffa59986cc.jpg',
      reason: '자연의 음이온은 스트레스를 낮추고 피부를 진정시키는 데 효과적입니다.',
      method: '자연 풍경이나 산책 중 셀카를 공유해주세요.'
    },
    {
      day: 9,
      title: '10분 스트레칭',
      description: '몸이 뻐근할 땐 천천히 스트레칭을 해보세요. 근육과 마음이 함께 풀릴 거예요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/feab8d3de0a84.jpg',
      reason: '혈액순환이 개선되면 피부에 영양 공급이 원활해지고 생기 있는 피부로 이어집니다.',
      method: '스트레칭 자세나 운동 중 사진을 공유해주세요.'
    },
    {
      day: 10,
      title: '맛있는 물 마시기',
      description: '오늘은 물을 맛있게 마셔볼까요? 따듯한 물에 소금한 꼬집 넣어서 마셔보세요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/3afc5fe0254a9.jpg',
      reason: '수분 섭취는 피부 보습을 유지하고, 노폐물 배출로 피부 컨디션을 맑게 합니다.',
      method: '맛있는 물 500ml 마신 컵 사진을 공유해주세요.'
    },
    {
      day: 11,
      title: '수면 전 책 읽기',
      description: '잠들기 전 스마트폰 대신 책 한 권을 펼쳐보세요. 활자 속 여백이 하루를 정리해줘요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/a9a556ef2ef1e.jpg',
      reason: '전자기기 대신 책을 보면 멜라토닌 분비가 원활해져 수면 질이 높아지고 피부 회복에 좋습니다.',
      method: '책 표지나 독서 공간 사진을 공유해주세요.'
    },
    {
      day: 12,
      title: '10분 명상',
      description: '잠시 멈추고 조용히 눈을 감아보세요. 나에게 집중하는 10분이 오늘 하루를 바꿔줄 거예요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/7c984b9d7a047.jpg',
      reason: '명상은 스트레스를 완화하고 자율신경을 안정시켜 피부 염증 반응을 줄여줍니다.',
      method: '명상 공간, 타이머, 또는 앱 화면을 공유해주세요.'
    },
    {
      day: 13,
      title: '디지털 휴식',
      description: '전자기기 없이 30분을 보내보세요. 생각이 맑아지고 눈도 마음도 편안해질 거예요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/6b7c863c1ced7.jpg',
      reason: '블루라이트 노출을 줄이면 피부의 산화 스트레스를 완화하고 피부 탄력 유지에 도움을 줍니다.',
      method: '전자기기 없이 한 활동 사진(산책, 독서 등)을 공유해주세요.'
    },
    {
      day: 14,
      title: '저녁 정리 시간',
      description: '하루를 돌아보며 오늘의 나를 정리해보세요. 작은 성취도 소중하게 느껴질 거예요.',
      verifyType: 'TEXT',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/98ba1aef542d1.jpg',
      reason: '하루를 정리하며 자율신경을 안정시키면 숙면에 도움이 되고 피부 회복력이 향상됩니다.',
      method: '이번주를 정리하는 간단한 글을 써보세요.'
    },
    {
      day: 15,
      title: '저강도 유산소',
      description: '가볍게 숨이 찰 정도로 움직여보세요. 땀이 살짝 맺히는 정도의 움직임이면 충분해요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/dfaa92c0f4e16.jpg',
      reason: '유산소 운동은 혈류를 원활히 해 피부에 산소와 영양을 충분히 전달해줍니다.',
      method: '만보계 캡처, 걷기나 자전거 타는 사진을 공유해주세요.'
    },
    {
      day: 16,
      title: '림프 순환',
      description: '다리를 벽에 기대고 5분간 휴식해보세요. 부기와 피로가 서서히 가라앉을 거예요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/bcd6f70b9850f.jpg',
      reason: '림프 순환을 도우면 노폐물 배출이 원활해지고 피부가 맑고 투명해져요.',
      method: '벽에 다리를 올린 자세 사진을 공유해주세요.'
    },
    {
      day: 17,
      title: '아침을 깨우는 물',
      description: '일어나자마자 마시는 물 한 잔이 하루의 리듬을 정리해줘요. 몸이 부드럽게 깨어날 거예요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/2cb014d826070.jpg',
      reason: '아침 수분 섭취는 밤새 잃은 수분을 보충해 피부 건조를 막고 유연성을 유지해줍니다.',
      method: '기상 후 물 500ml 마신 컵 사진을 공유해주세요.'
    },
    {
      day: 18,
      title: '수면 전 물 한 잔',
      description: '자기 전 물 한 잔으로 하루를 정리해보세요. 과하지 않게, 부드럽게 마시는 게 포인트예요.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/2fc1512802b37.jpg',
      reason: '수면 중 수분 공급은 탈수를 방지하고 아침의 푸석한 피부를 예방해줍니다.',
      method: '물컵 사진을 공유해주세요.'
    },
    {
      day: 19,
      title: '10분 스트레칭',
      description: '몸이 뻐근할 땐 천천히 스트레칭을 해보세요. 근육과 마음이 함께 풀릴 거예요.',
      verifyType: 'TEXT',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/feab8d3de0a84.jpg',
      reason: '혈액순환이 개선되면 피부에 영양 공급이 원활해지고 생기 있는 피부로 이어집니다.',
      method: '스트레칭 자세나 운동 중 사진을 공유해주세요.'
    },
    {
      day: 20,
      title: '아침 햇빛 쬐기',
      description: '아침 햇살을 5분만 쬐어보세요. 몸도 마음도 자연스럽게 깨어납니다.',
      verifyType: 'PHOTO',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/b9d0654af1a2b.jpg',
      reason: '아침 햇빛은 생체 리듬을 조절해 숙면과 피부 재생 리듬을 안정시켜줍니다.',
      method: '아침 햇살을 받는 풍경이나 셀카를 공유해주세요.'
    },
    {
      day: 21,
      title: '3주간의 성취 돌아보기',
      description: '21일 동안의 나, 고생 많았어요. 기억에 남는 순간을 떠올려 정리해보세요.',
      verifyType: 'TEXT',
      imageUrl: 'https://cdn.imweb.me/thumbnail/20250624/4ec9b440cde29.jpg',
      reason: '성취를 기록하면 긍정적인 감정이 형성되고 스트레스를 줄여 피부 컨디션 개선에 도움을 줍니다.',
      method: '챌린지 기간동안의 성취를 기록해주세요.'
    }
  ];

  for (const mission of missionData) {
    await prisma.missionSchedule.create({
      data: {
        missionId: dailyMission.id,
        day: mission.day,
        title: mission.title,
        description: mission.description,
        type: 'DAILY_MISSION',
        data: {
          verifyType: mission.verifyType,
          imageUrl: mission.imageUrl,
          reason: mission.reason,
          method: mission.method
        },
        points: 100
      }
    });
  }
  
  console.log(`✅ ${missionData.length}개의 1일1미션 데이터 삽입 완료`);
}

async function migrateContents(contentMission: any) {
  console.log('📺 컨텐츠 데이터 마이그레이션 시작...');
  
  const contentData = [
    {
      day: 1,
      title: '평생 아름다운 피부로 사는 방법을 모두 알려드릴게요.',
      description: '이너뷰티 챌린지에 오신 걸 환영합니다.\n3주동안 3배 더 좋아진 피부를 약속할게요.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1096809412',
      thumbnailUrl: 'https://cdn.imweb.me/thumbnail/20250624/3ee904b10eb2e.png',
      items: []
    },
    {
      day: 2,
      title: '오늘부터 이 음식만 끊어도 10살 어려 보입니다.',
      description: '남들이 좋다고 했던 음식, \n나에게는 독이 된다면?',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1096812496',
      thumbnailUrl: 'https://cdn.imweb.me/thumbnail/20250624/78dfe7c65e47a.png',
      items: []
    },
    {
      day: 3,
      title: '피부 트러블이 난다면 지금 당장 \'ㄷㄹㅊㅊㅁ\' 드세요.',
      description: '아무리 스킨케어 열심히 해도 \n트러블이 생기는 이유',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1096813681',
      thumbnailUrl: 'https://cdn.imweb.me/thumbnail/20250624/6a09df4f132ec.png',
      items: [
        {
          itemUrl: 'https://biocom.kr/HealthFood/?idx=225',
          remarks: null,
          itemName: '다래케어',
          sortOrder: 1,
          itemImageUrl: 'https://cdn.imweb.me/thumbnail/20250624/4a785bd1f6dac.jpg',
          itemDescription: '식약처 인정 프리미엄 다래와 건조효모 아연을 사용하여 면역과민반응 개선에 도움이 되는 제품입니다.'
        }
      ]
    },
    {
      day: 4,
      title: '염증에서 벗어나는 유일한 방법입니다.',
      description: '3주동안 이렇게 관리하면 \n피부 컨디션이 달라집니다.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1096811742',
      thumbnailUrl: 'https://cdn.imweb.me/thumbnail/20250624/1c5102ccaa08c.png',
      items: [
        {
          itemUrl: 'https://biocom.kr/shop_view/?idx=172',
          remarks: null,
          itemName: '클린 밸런스',
          sortOrder: 1,
          itemImageUrl: 'https://cdn.imweb.me/thumbnail/20250624/8ac3d69849507.jpg',
          itemDescription: '클린밸런스에는 클로렐라와 활성엽산, 황함유 아미노산과 각종 종합비타민이 포함된\n7중 기능성 제품입니다. 추가적으로 바실런스 코아귤런스 유익균과 프리바이오틱스인\n치커리 뿌리추출물, 맥주건조효모까지 포함되어 있습니다.'
        },
        {
          itemUrl: 'https://biocom.kr/shop_view/?idx=300',
          remarks: null,
          itemName: '영데이즈',
          sortOrder: 2,
          itemImageUrl: 'https://cdn.imweb.me/thumbnail/20250624/08b0707760953.jpg',
          itemDescription: '영데이즈는 고농도의 SOD 효소를 함유해 자연적인 항산화 과정보다 1만배 빠르게 진행되어 세포를 보호하는 강력한 항산화 제품입니다.\n비타민 C, E, 글루타치온, 코큐텐이 함께 함유되어 항산화 네트워크를 형성해 빈틈없이 세포를 보호합니다.\n리포좀 방식으로 제조되어 체내 흡수가 빠르고 소화 과정에서 위 손상이 적습니다.'
        }
      ]
    },
    {
      day: 5,
      title: '화장실 못 가는 분들은 꼭 보세요. 피부가 눈에 띄게 환해집니다.',
      description: '장-피부축의 개념을 알고 계신가요?\n장은 피부와 연결되어 있습니다.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1096815007',
      thumbnailUrl: 'https://cdn.imweb.me/thumbnail/20250624/43e21384a76c9.png',
      items: []
    },
    {
      day: 6,
      title: '탄력 저하, 노화, 홍조, 여드름. 결국 원인은 하나입니다.',
      description: '의외로 대부분 사람들이 앓고 있다는 이 증상, \n해당 되는지 영상으로 확인하세요.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1096816345',
      thumbnailUrl: 'https://cdn.imweb.me/thumbnail/20250624/8140241a5c955.png',
      items: [
        {
          itemUrl: 'https://biocom.kr/organicacid_store/?idx=259',
          remarks: null,
          itemName: '종합대사기능 검사',
          sortOrder: 1,
          itemImageUrl: 'https://cdn.imweb.me/thumbnail/20250624/3cc72503ba6a3.jpg',
          itemDescription: '종합 대사 기능 검사는 체중조절능력, 항산화능력, 장 건강, 에너지 생성능력, 정신 건강 및 집중력, 신체 방어 능력\n6개의 검사 결과를 통해 몸 속 대사 상태를 한눈에 확인 할 수 있는 검사입니다.'
        }
      ]
    },
    {
      day: 7,
      title: '이런 분들은 샐러드 먹지 마세요. 다음 날 피부 뒤집어집니다.',
      description: '평소에 이렇게 드신다면\n피부 트러블을 더 키울 수 있습니다.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1096816930',
      thumbnailUrl: 'https://cdn.imweb.me/thumbnail/20250624/67ddd5db5fd21.png',
      items: []
    },
    {
      day: 8,
      title: '자기 전 클렌징 보다 중요한 습관. 밥 먹을 때 이것 하나만 지키세요.',
      description: '지금 당장 냉장고에서 이것을 꺼내세요.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1096818404',
      thumbnailUrl: 'https://cdn.imweb.me/thumbnail/20250624/407fbd1549202.png',
      items: []
    },
    {
      day: 9,
      title: '프리바이오틱스 전부 효과 없습니다. 장과 피부를 동시에 개선해줄 아이템.',
      description: '남들이 좋다고 하는 유산균, \n내 몸에 맞게 드셔야 제대로 효과봅니다.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1098397543',
      thumbnailUrl: 'https://cdn.imweb.me/thumbnail/20250624/e784c382fd09f.png',
      items: []
    },
    {
      day: 10,
      title: '날씬한 사람들이 피부 좋은 이유',
      description: '피부가 망가지는 지름길 \'염증\'\n염증을 만들지 않는 비법입니다.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1098398621',
      thumbnailUrl: 'https://example.com/thumbnails/day10.jpg',
      items: []
    },
    {
      day: 11,
      title: '이 음식이 염증을 악화시킵니다.',
      description: '이 음식들만 피하셔도\n눈에 띄게 달라진  피부를 만나실겁니다.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1098399616',
      thumbnailUrl: 'https://example.com/thumbnails/day11.jpg',
      items: []
    },
    {
      day: 12,
      title: '이것만 관리해도 피부 좋아집니다.',
      description: '내 피부가 안 좋은 이유는\n이것이 막혀있기 때문?',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1098401287',
      thumbnailUrl: 'https://example.com/thumbnails/day12.jpg',
      items: []
    },
    {
      day: 13,
      title: '생리 전 여드름 나는 이유',
      description: '인간은 호르몬의 노예다?\n사실입니다.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1098401873',
      thumbnailUrl: 'https://example.com/thumbnails/day13.jpg',
      items: []
    },
    {
      day: 14,
      title: '이 중 하나만 자기 전에 꼭 해보세요',
      description: '만병의 근원인 스트레스, \n그 해소법을 모두 담았습니다.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1098402714',
      thumbnailUrl: 'https://example.com/thumbnails/day14.jpg',
      items: []
    },
    {
      day: 15,
      title: '피부 트러블, 체중 증가, 우울의 원인은 단 하나입니다.',
      description: '피부부터 다이어트까지 모든 문제를 결정하는 단 한가지 원인.\n미토콘드리아 개선 방법입니다.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1100478403',
      thumbnailUrl: 'https://example.com/thumbnails/day15.jpg',
      items: []
    },
    {
      day: 16,
      title: '피부는 ㅎㅅㅅㅅ가 많아질수록 늙어갑니다.',
      description: '늙어가는 피부를 막아줄 수 있는 유일한 치트키를 소개합니다.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1100478216',
      thumbnailUrl: 'https://example.com/thumbnails/day16.jpg',
      items: []
    },
    {
      day: 17,
      title: '여러분 피부의 주인은 누구인가요?',
      description: '내 상태를 직접 분석하는 모든 방법을 알려드립니다.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1100478812',
      thumbnailUrl: 'https://example.com/thumbnails/day17.jpg',
      items: []
    },
    {
      day: 18,
      title: '내 상태를 모르겠다면 꼭 보세요. 전신의 기능을 파악할 수 있는 방법입니다.',
      description: '피부를 얼마나 잘 유지할 수 있는지, 체중을 얼마나 잘 감량할 수 있는지\n직접 알아볼 수 있는 방법을 소개합니다.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1100477952',
      thumbnailUrl: 'https://example.com/thumbnails/day18.jpg',
      items: []
    },
    {
      day: 19,
      title: '수치에 따라 피부 컨디션이 달라집니다.',
      description: '현재 스트레스 상태, 스트레스 관리 능력을 알 수 있는 방법을 소개합니다',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1100477685',
      thumbnailUrl: 'https://example.com/thumbnails/day19.jpg',
      items: []
    },
    {
      day: 20,
      title: '나에게 필요한 영양소는 따로 있습니다.',
      description: '영양제 먹어도 효과 없었던 분들을 위한 영상입니다.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1100478701',
      thumbnailUrl: 'https://example.com/thumbnails/day20.jpg',
      items: []
    },
    {
      day: 21,
      title: '20강 내용을 다 모았습니다.',
      description: '시간 없으시면 이 영상 하나만 보세요. \n모든 내용을 요약한 영상입니다.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1100478554',
      thumbnailUrl: 'https://example.com/thumbnails/day21.jpg',
      items: []
    },
    {
      day: 22,
      title: '결국 피부를 살리는 핵심 열쇠는 이것입니다.',
      description: '지금까지 설명해온 이너뷰티의 핵심입니다.',
      contentType: 'VIDEO',
      contentUrl: 'https://vimeo.com/1098398233',
      thumbnailUrl: 'https://example.com/thumbnails/day10.jpg',
      items: []
    }
  ];

  // 22일차 데이터는 제외하고 21일까지만 삽입
  const validContentData = contentData.filter(content => content.day <= 21);

  for (const content of validContentData) {
    await prisma.missionSchedule.create({
      data: {
        missionId: contentMission.id,
        day: content.day,
        title: content.title,
        description: content.description,
        type: 'CONTENT',
        data: {
          contentType: content.contentType,
          contentUrl: content.contentUrl,
          thumbnailUrl: content.thumbnailUrl,
          items: content.items
        },
        points: 200
      }
    });
  }
  
  console.log(`✅ ${validContentData.length}개의 컨텐츠 데이터 삽입 완료`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });