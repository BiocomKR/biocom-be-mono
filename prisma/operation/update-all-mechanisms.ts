import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// 예민한 고슴도치 (healthTypeAnimalId: 4)
// ============================================

// 다래케어 - 예민한 고슴도치용
const hedgehog_daraeCare = [
  {
    name: '다래\n추출물',
    summary: '면역 과민반응을 조절하는 핵심 성분',
    sortOrder: 1,
    descriptions: ['면역 균형(Th17/Treg)을 조절하여 과민해진 면역계 안정화'],
    ingredientKey: 'kiwi'
  },
  {
    name: '아연',
    summary: '장벽 복구로 면역 안정화 기반을 마련하는 핵심 미네랄',
    sortOrder: 2,
    descriptions: [
      '장벽 세포 간 이음새를 촘촘하게 결합하여 장누수 개선',
      'T세포 기능 정상화로 면역 조절에 도움'
    ],
    ingredientKey: 'zinc'
  }
];

// 바이오 밸런스 - 예민한 고슴도치용 (7개 성분)
const hedgehog_bioBalance = [
  {
    name: '아연',
    summary: '느슨해진 장벽을 강화하는 장누수 회복의 핵심 미네랄',
    sortOrder: 1,
    descriptions: [
      '장벽 세포 간 이음새를 촘촘하게 결합',
      '유해균 독소나 염증 유발 물질의 혈관 누수 방지',
      '면역 시스템의 핵심인 T세포 분화 및 기능 정상화'
    ],
    ingredientKey: 'zinc'
  },
  {
    name: '마그네슘',
    summary: '장벽 복구와 염증 억제로 면역 안정화의 핵심 미네랄',
    sortOrder: 2,
    descriptions: [
      '염증 반응(NF-κB 경로) 억제로 면역계 진정',
      '장 점막 세포 회복으로 면역 과민 반응의 출발점 차단',
      '장벽 세포 간 이음새 생성에 필요한 단백질 합성에 도움'
    ],
    ingredientKey: 'magnesium'
  },
  {
    name: '비타민 D',
    summary: '면역 균형 조절 및 장벽 방어 강화의 핵심 비타민',
    sortOrder: 3,
    descriptions: [
      '면역 시스템(Th17/Treg) 균형 조절로 과민 반응 정상화',
      '장벽 세포 간 이음새를 촘촘하게 결합해 방어벽 기능 강화',
      '장내 염증 반응 조절로 면역계 안정 환경 조성'
    ],
    ingredientKey: 'vitamin_d'
  },
  {
    name: '셀레늄',
    summary: '독소 제거 및 염증 반응 억제의 핵심 미네랄',
    sortOrder: 4,
    descriptions: [
      '강력한 항산화 효소(GPx) 활성화로 독소 중화',
      '염증성 사이토카인(IL-6, TNF-α) 억제로 면역 과민 반응 완화',
      '면역 과민 반응으로 발생한 산화 스트레스 제거'
    ],
    ingredientKey: 'selenium'
  },
  {
    name: '몰리브덴',
    summary: '독소 해독으로 면역 부담 감소의 핵심 미네랄',
    sortOrder: 5,
    descriptions: [
      '해독 효소 활성화로 면역 자극 독소 제거',
      '장내 유해균 독소 중화 및 배출',
      '장내 염증 부담 감소로 면역계 안정화'
    ],
    ingredientKey: 'molybdenum'
  },
  {
    name: '망간',
    summary: '독소로 인한 활성산소 제거 및 장벽 복구를 보조하는 미네랄',
    sortOrder: 6,
    descriptions: [
      '항산화 효소의 구성 성분으로 독소 제거',
      '면역 과민 반응으로 발생한 활성산소 제거',
      '장내 염증 환경 개선으로 면역 안정 지원'
    ],
    ingredientKey: 'manganese'
  },
  {
    name: '크롬',
    summary: '혈당 조절에 관여하여 염증 물질 억제의 핵심 미네랄',
    sortOrder: 7,
    descriptions: [
      '인슐린 작용을 도와 안정적 혈당 유지에 도움',
      '혈당 스파이크 방지로 염증 물질(AGEs) 생성 억제',
      '당화 스트레스 감소로 면역 부담 완화'
    ],
    ingredientKey: 'chromium'
  }
];

// 클린 밸런스 - 예민한 고슴도치용 (7개 성분)
const hedgehog_cleanBalance = [
  {
    name: '클로렐라',
    summary: '독소 흡착 배출로 면역 부담을 감소시키는 핵심 물질',
    sortOrder: 1,
    descriptions: [
      '면역계를 자극하는 장 독소(LPS)를 흡착하여 체외 배출',
      '장내 독소 제거로 면역 과민 반응 요인 차단',
      '장벽 회복 환경 조성으로 면역 안정화에 도움'
    ],
    ingredientKey: 'chlorella'
  },
  {
    name: '비타민 E',
    summary: '세포막 보호 및 염증 매개물질 억제의 핵심 비타민',
    sortOrder: 2,
    descriptions: [
      '산화 스트레스로부터 장 점막 및 피부 세포 보호',
      '염증 매개물질 감소로 면역 과민 반응 완화',
      '비타민C와 함께 항산화 시너지로 면역 부담 감소'
    ],
    ingredientKey: 'vitamin_e'
  },
  {
    name: '비타민 A',
    summary: '피부 장벽 강화로 외부 자극 방어력 증가의 핵심 비타민',
    sortOrder: 3,
    descriptions: [
      '피부 각질 정상화로 외부 자극에 대한 피부 방어력 증가',
      '장 점막 보호층(뮤신)을 두껍게 형성하는데 도움',
      '장-피부 축 개선으로 가려움과 붉어짐 완화'
    ],
    ingredientKey: 'vitamin_a'
  },
  {
    name: '비타민 C',
    summary: '독소 제거와 항산화로 면역 부담 감소의 핵심 비타민',
    sortOrder: 4,
    descriptions: [
      '강력한 항산화로 염증 및 산화 스트레스 억제',
      '독소로 인한 장내 염증 억제',
      '면역 세포 기능 정상화에 도움'
    ],
    ingredientKey: 'vitamin_c'
  },
  {
    name: '아연',
    summary: '피부 재생 및 장벽 복구의 핵심 미네랄',
    sortOrder: 5,
    descriptions: [
      '피부 재생 촉진으로 자극에 대한 방어력 증가',
      '장벽 세포 간 이음새 강화로 면역 안정화 기반 마련',
      '면역 세포 기능 정상화'
    ],
    ingredientKey: 'zinc'
  },
  {
    name: '비타민 B9(엽산)',
    summary: '장 점막 세포 재생으로 면역 안정화 지원의 핵심 비타민',
    sortOrder: 6,
    descriptions: [
      '장 점막 세포의 DNA 합성에 도움',
      '손상된 장벽의 신속한 재생으로 면역 안정화 기반 마련'
    ],
    ingredientKey: 'vitamin_b9'
  },
  {
    name: '비타민 B3(나이아신)',
    summary: '장 점막 회복 및 염증 억제의 핵심 비타민',
    sortOrder: 7,
    descriptions: [
      '손상된 장 점막 세포의 회복 및 재생',
      '세포 에너지 대사 활성화',
      '염증 억제(COX-2 발현 감소)로 면역 과민 반응 완화'
    ],
    ingredientKey: 'vitamin_b3'
  }
];

// ============================================
// 배 빵빵 펭귄 (healthTypeAnimalId: 3)
// ============================================

// 바이오 밸런스 - 배 빵빵 펭귄용 (7개 성분)
const penguin_bioBalance = [
  {
    name: '아연',
    summary: '느슨해진 장벽을 강화하는 장누수 회복의 핵심 미네랄',
    sortOrder: 1,
    descriptions: [
      '장벽 세포 간 이음새를 촘촘하게 결합',
      '유해균 독소나 염증 유발 물질의 혈관 누수 방지'
    ],
    ingredientKey: 'zinc'
  },
  {
    name: '마그네슘',
    summary: '느슨해진 장벽을 강화하는 장누수 회복의 핵심 미네랄',
    sortOrder: 2,
    descriptions: [
      '장 점막 세포의 기능 회복에 도움',
      '유해균 독소나 염증 유발 물질의 혈관 누수 방지'
    ],
    ingredientKey: 'magnesium'
  },
  {
    name: '비타민 D',
    summary: '장 면역 기능과 장벽 세포 방어 기능의 핵심 비타민',
    sortOrder: 3,
    descriptions: [
      '장 면역 시스템을 조절',
      '장 상피 세포의 방어벽 기능을 강화',
      '장내 염증 반응 조절'
    ],
    ingredientKey: 'vitamin_d'
  },
  {
    name: '셀레늄',
    summary: '장 독소 및 염증 유발 물질 제거의 핵심 미네랄',
    sortOrder: 4,
    descriptions: [
      '항산화 작용으로, 유해균과 장내 염증 감소',
      '세포 손상을 방지해 장벽 회복 환경 조성'
    ],
    ingredientKey: 'selenium'
  },
  {
    name: '몰리브덴',
    summary: '장 독소 및 염증 유발 물질 제거의 핵심 미네랄',
    sortOrder: 5,
    descriptions: [
      '해독 과정에 관여하여 독소 제거',
      '유해균 독소를 중화하고 배출',
      '장내 염증 부담을 줄여 장벽 회복 환경 조성'
    ],
    ingredientKey: 'molybdenum'
  },
  {
    name: '망간',
    summary: '독소로 인한 활성산소 제거 및 장벽을 복구하는 미네랄',
    sortOrder: 6,
    descriptions: [
      '항산화 효소의 구성 성분으로 독소 제거',
      '면역 과민 반응으로 발생한 활성산소 제거',
      '장내 염증 환경 개선으로 면역 안정 지원'
    ],
    ingredientKey: 'manganese'
  },
  {
    name: '크롬',
    summary: '혈당 조절에 관여하여 유해균 먹이 차단에 도움을 주는 미네랄',
    sortOrder: 7,
    descriptions: [
      '인슐린 작용을 도와 안정적 혈당 유지에 도움',
      '유해균 먹이(당) 차단에 도움'
    ],
    ingredientKey: 'chromium'
  }
];

// 클린 밸런스 - 배 빵빵 펭귄용 (7개 성분)
const penguin_cleanBalance = [
  {
    name: '클로렐라',
    summary: '장내 독소와 노폐물을 흡착 배출하는 핵심 성분',
    sortOrder: 1,
    descriptions: [
      '유해균 독소 및 노폐물에 흡착하여 체외로 배출',
      '독소로 인한 장내 염증 부담 감소',
      '장벽 회복 환경 조성'
    ],
    ingredientKey: 'chlorella'
  },
  {
    name: '비타민 E',
    summary: '세포막을 보호하여 독소 제거를 돕는 항산화 물질',
    sortOrder: 2,
    descriptions: [
      '독소로 인한 산화 스트레스로부터 장 점막 세포 손상 방지',
      '비타민 C와 함께 장내 염증 반응 감소에 기여'
    ],
    ingredientKey: 'vitamin_e'
  },
  {
    name: '비타민 A',
    summary: '장 점막 재생과 피부 트러블 개선의 핵심 비타민',
    sortOrder: 3,
    descriptions: [
      '손상된 장 점막의 재생과 회복에 직접 도움',
      '장-피부 축 개선에 기여, 턱 트러블 완화에 도움'
    ],
    ingredientKey: 'vitamin_a'
  },
  {
    name: '비타민 C',
    summary: '독소 제거와 장벽 복구를 돕는 핵심 비타민',
    sortOrder: 4,
    descriptions: [
      '유해균 독소로 인한 장내 염증 및 산화 억제',
      '장벽 회복에 필수적인 콜라겐 합성 촉진'
    ],
    ingredientKey: 'vitamin_c'
  },
  {
    name: '아연',
    summary: '느슨해진 장벽을 강화하는 장누수 회복의 핵심 미네랄',
    sortOrder: 5,
    descriptions: [
      '장벽 세포 간 이음새를 촘촘하게 결합',
      '유해균 독소나 염증 유발 물질의 혈관 누수 방지'
    ],
    ingredientKey: 'zinc'
  },
  {
    name: '비타민 B9(엽산)',
    summary: '손상된 장 점막 세포의 신속한 재생을 돕는 핵심 비타민',
    sortOrder: 6,
    descriptions: [
      '새로운 세포 분열과 성장에 필수적',
      '손상된 장 점막 세포의 신속한 재생에 도움'
    ],
    ingredientKey: 'vitamin_b9'
  },
  {
    name: '비타민 B3(나이아신)',
    summary: '장 점막 세포 회복과 에너지 생성의 핵심 비타민',
    sortOrder: 7,
    descriptions: [
      '염증으로 손상된 장 점막 세포의 회복에 도움',
      '장 건강 저하로 인한 에너지 저하 개선에 기여'
    ],
    ingredientKey: 'vitamin_b3'
  }
];

// 당당케어 - 배 빵빵 펭귄용 (13개 성분)
const penguin_dangdangCare = [
  {
    name: '바나바잎추출물\n(코로솔산)',
    summary: '식후 혈당 상승을 억제하는 유해균 먹이 차단의 핵심 성분',
    sortOrder: 1,
    descriptions: [
      '식후 혈당 상승 억제, 혈당 조절에 도움',
      '유해균의 주된 먹이(당) 공급 차단'
    ],
    ingredientKey: 'corosolic_acid'
  },
  {
    name: '크롬',
    summary: '혈당 조절에 관여하여 유해균 먹이 차단에 도움을 주는 물질',
    sortOrder: 2,
    descriptions: [
      '인슐린 작용을 도와 안정적 혈당 유지에 도움',
      '유해균 먹이(당) 차단에 도움'
    ],
    ingredientKey: 'chromium'
  },
  {
    name: 'HCA\n(가르시니아캄보지아추출물)',
    summary: '탄수화물 대사 관리를 도와 유해균 먹이 차단을 보조하는 물질',
    sortOrder: 3,
    descriptions: [
      '탄수화물이 지방으로 합성되는 것 억제에 도움',
      '혈당 부담을 줄여 유해균 증식 환경 개선(유해균 먹이 차단)에 도움'
    ],
    ingredientKey: 'hca'
  },
  {
    name: '비타민 B1(티아민)',
    summary: '탄수화물 대사 촉진으로 유해균 먹이 차단을 돕는 핵심 효소',
    sortOrder: 4,
    descriptions: [
      '탄수화물 대사 및 에너지 생성의 핵심 조효소',
      '탄수화물이 유해균 먹이가 아닌 에너지로 전환되도록 도움'
    ],
    ingredientKey: 'vitamin_b1'
  },
  {
    name: '포스콜린\n(콜레우스포스콜리추출물)',
    summary: '신진대사 촉진으로 혈당 조절 및 에너지를 생성하는 물질',
    sortOrder: 5,
    descriptions: [
      '신진대사 촉진으로 전반적인 대사 건강 개선에 도움',
      '혈당 조절(유해균 먹이 차단) 및 에너지 저하 개선에 간접 기여'
    ],
    ingredientKey: 'forskolin'
  },
  {
    name: '비타민 B2',
    summary: '장 점막 재생(장벽 복구) 및 에너지 대사를 돕는 물질',
    sortOrder: 6,
    descriptions: [
      '에너지 대사 활성화로 에너지 저하 개선에 도움',
      '손상된 장 점막 세포의 재생 과정에 도움'
    ],
    ingredientKey: 'vitamin_b2'
  },
  {
    name: '비타민 B3(나이아신)',
    summary: '장 점막 세포 회복(장벽 복구)과 에너지 생성을 돕는 물질',
    sortOrder: 7,
    descriptions: [
      '염증으로 손상된 장 점막 세포의 회복 및 재생에 도움',
      '장 건강 저하로 인한 에너지 저하 개선에 기여'
    ],
    ingredientKey: 'vitamin_b3'
  },
  {
    name: '비타민 B5',
    summary: '에너지 대사 효율을 높여 에너지 저하 개선을 돕는 물질',
    sortOrder: 8,
    descriptions: [
      '탄단지 대사 및 에너지 생성에 관여',
      '에너지 생성 효율을 높여 에너지 저하 개선에 기여'
    ],
    ingredientKey: 'vitamin_b5'
  },
  {
    name: '비타민 B6',
    summary: '장 점막 세포 재생 및 에너지 대사를 돕는 물질',
    sortOrder: 9,
    descriptions: [
      '단백질 대사의 조효소로, 장 점막 세포 재료 공급에 도움',
      '에너지 대사에 관여하여 에너지 저하 개선에 도움'
    ],
    ingredientKey: 'vitamin_b6'
  },
  {
    name: '비타민 B7',
    summary: '장-피부 축 개선 및 에너지 대사를 돕는 물질',
    sortOrder: 10,
    descriptions: [
      '피부 건강 유지에 기여',
      '장-피부 축 문제(턱 트러블) 개선에 도움',
      '에너지 대사를 지원하여 에너지 저하 개선에 도움'
    ],
    ingredientKey: 'vitamin_b7'
  },
  {
    name: '비타민 B9(엽산)',
    summary: '손상된 장 점막 세포의 신속한 재생을 돕는 핵심 물질',
    sortOrder: 11,
    descriptions: [
      '새로운 세포 분열과 성장에 필수적',
      '손상된 장 점막 세포의 신속한 재생 지원'
    ],
    ingredientKey: 'vitamin_b9'
  },
  {
    name: '비타민 B12',
    summary: '장 점막 세포 재생 및 에너지 저하 개선을 돕는 물질',
    sortOrder: 12,
    descriptions: [
      '에너지 저하 증상 개선에 기여',
      '손상된 장 점막 세포 재생 및 신경 세포 기능 유지에 도움'
    ],
    ingredientKey: 'vitamin_b12'
  },
  {
    name: '비타민 C',
    summary: '독소 제거 및 장벽 복구를 돕는 핵심 비타민',
    sortOrder: 13,
    descriptions: [
      '유해균 독소로 인한 장내 염증 및 산화 스트레스 억제',
      '장벽 회복에 필수적인 콜라겐 합성 촉진'
    ],
    ingredientKey: 'vitamin_c'
  }
];

// ============================================
// 화끈한 불여우 (healthTypeAnimalId: 1)
// ============================================

// 바이오 밸런스 - 화끈한 불여우용 (7개 성분)
const fox_bioBalance = [
  {
    name: '비타민 D',
    summary: '염증 해소 물질 생성에 도움을 주는 핵심 비타민',
    sortOrder: 1,
    descriptions: [
      '염증 해소 물질(SPMs) 생성 효소 활성화',
      '레졸빈, 프로텍틴 등 염증 해소 물질 생성 촉진'
    ],
    ingredientKey: 'vitamin_d'
  },
  {
    name: '마그네슘',
    summary: '염증 해소 물질 생성에 도움을 주는 핵심 보조인자',
    sortOrder: 2,
    descriptions: [
      '지방산 대사 효소의 필수 보조인자',
      '오메가-3를 염증 해소 물질(SPMs)로 전환하는 과정에 필수'
    ],
    ingredientKey: 'magnesium'
  },
  {
    name: '아연',
    summary: '염증 해소 효소 활성화 및 면역 정상화의 핵심 미네랄',
    sortOrder: 3,
    descriptions: [
      '염증을 해소하는 효소(A20) 활성화',
      '면역 세포(T세포) 기능 정상화로 염증 종료 신호 촉진'
    ],
    ingredientKey: 'zinc'
  },
  {
    name: '셀레늄',
    summary: '염증성 신호물질을 억제하는 핵심 미네랄',
    sortOrder: 4,
    descriptions: [
      '강력한 항산화 효소(GPx) 활성화로 산화 스트레스 제거',
      '염증성 신호물질(IL-6, TNF-α) 직접 억제',
      '염증 신호 전달 경로(NF-κB) 차단'
    ],
    ingredientKey: 'selenium'
  },
  {
    name: '망간',
    summary: '활성산소 제거로 염증 촉발을 원천 차단하는 핵심 미네랄',
    sortOrder: 5,
    descriptions: [
      '항산화 효소(MnSOD)의 핵심 성분',
      '가장 유독한 활성 산소(슈퍼옥사이드 라디칼)를 1차적으로 제거'
    ],
    ingredientKey: 'manganese'
  },
  {
    name: '몰리브덴',
    summary: '독소 해독 효소의 필수 보조인자',
    sortOrder: 6,
    descriptions: [
      '해독 효소(이황산염/알데하이드 산화효소) 활성화',
      '장내 유해균 독소 및 염증 부담 감소'
    ],
    ingredientKey: 'molybdenum'
  },
  {
    name: '크롬',
    summary: '혈당 조절로 염증 유발 물질 생성 억제의 핵심 미네랄',
    sortOrder: 7,
    descriptions: [
      '혈당 스파이크 방지로 최종당화산물(AGEs) 생성 억제',
      '당화 스트레스로 인한 염증 차단'
    ],
    ingredientKey: 'chromium'
  }
];

// 클린 밸런스 - 화끈한 불여우용 (6개 성분)
const fox_cleanBalance = [
  {
    name: '클로렐라',
    summary: '염증 유발 독소를 흡착 후 배출하는 핵심 물질',
    sortOrder: 1,
    descriptions: [
      '염증 유발 내독소(LPS) 직접 흡착하여 체외 배출',
      '장에서 흡수되는 독소 차단으로 염증 촉발 원천 제거',
      '중금속 등 염증 유발 물질 제거'
    ],
    ingredientKey: 'chlorella'
  },
  {
    name: '비타민 E',
    summary: '염증 매개 물질의 생성을 억제하는 핵심 비타민',
    sortOrder: 2,
    descriptions: [
      '염증 매개물질(프로스타글란딘 E2) 생성 억제',
      '세포막 보호로 염증 신호 차단',
      '항산화로 염증 촉발 산화 스트레스 제거'
    ],
    ingredientKey: 'vitamin_e'
  },
  {
    name: '비타민 C',
    summary: '염증성 신호물질 생성을 억제하는 핵심 비타민',
    sortOrder: 3,
    descriptions: [
      '염증성 신호물질(IL-6, TNF-α) 생성 억제',
      '강력한 항산화로 염증 신호 차단',
      '염증 신호 전달 경로(NF-κB) 억제로 염증 반응 차단'
    ],
    ingredientKey: 'vitamin_c'
  },
  {
    name: '아연',
    summary: '염증 해소 효소 활성화 및 면역 정상화의 핵심 미네랄',
    sortOrder: 4,
    descriptions: [
      '염증을 해소하는 효소(A20) 활성화',
      '면역 세포(T세포) 기능 정상화로 염증 종료 신호 촉진'
    ],
    ingredientKey: 'zinc'
  },
  {
    name: '비타민 B9(엽산)',
    summary: '염증 유발 물질 차단과 세포 재생의 핵심 비타민',
    sortOrder: 5,
    descriptions: [
      '호모시스테인을 메티오닌으로 전환하여 염증 유발 물질 제거',
      '염증성 사이토카인(IL-6, TNF-α) 분비 억제',
      'DNA 합성 촉진으로 염증 손상 세포를 신속히 재생'
    ],
    ingredientKey: 'vitamin_b9'
  },
  {
    name: '비타민 B3(나이아신)',
    summary: '염증 억제 및 세포 에너지 생성의 핵심 비타민',
    sortOrder: 6,
    descriptions: [
      '염증 유발 효소(COX-2) 발현 감소',
      '세포 에너지 대사 활성화'
    ],
    ingredientKey: 'vitamin_b3'
  }
];

// 영데이즈 - 화끈한 불여우용 (5개 성분)
const fox_youngdays = [
  {
    name: 'SOD\n효소',
    summary: '염증을 유발하는 활성산소 1차 제거의 핵심 물질',
    sortOrder: 1,
    descriptions: [
      '활성산소를 덜 유해한 과산화수소로 전환',
      '염증 신호의 출발점 차단'
    ],
    ingredientKey: 'sod'
  },
  {
    name: '카탈레이즈\n효소',
    summary: '활성산소에서 전환된 과산화수소를 최종 분해하는 핵심 물질',
    sortOrder: 2,
    descriptions: [
      'SOD효소가 전환한 과산화수소를 물과 산소로 완전 분해',
      '염증 촉발 환경 차단'
    ],
    ingredientKey: 'catalase'
  },
  {
    name: '비타민 E',
    summary: '세포를 보호하는 항산화 네트워크의 핵심 비타민',
    sortOrder: 3,
    descriptions: [
      '지용성 항산화제로 세포막에서 활성산소 직접 차단',
      '세포막의 산화 방지(세포 손상 차단)'
    ],
    ingredientKey: 'vitamin_e'
  },
  {
    name: '비타민 C',
    summary: '세포를 보호하는 항산화 네트워크의 핵심 비타민',
    sortOrder: 4,
    descriptions: [
      '수용성 항산화제로 세포 외부(혈액, 세포질)에서 활성산소 차단',
      '산화된 비타민E를 항산화 물질로 재활용',
      '글루타치온과 함께 세포의 수용성 방어막 구축'
    ],
    ingredientKey: 'vitamin_c'
  },
  {
    name: 'L글루타치온\n효모',
    summary: '항산화 네트워크의 핵심 물질이자 가장 강력한 항산화제',
    sortOrder: 5,
    descriptions: [
      '체내 가장 강력한 항산화제로 활성산소를 직접 중화',
      '산화된 비타민C를 항산화 물질로 재활용',
      '체내 독소와 결합하여 몸 밖으로 배출'
    ],
    ingredientKey: 'glutathione'
  }
];

// ============================================
// 동면 중인 북극곰 (healthTypeAnimalId: 2)
// ============================================

// 당당케어 - 동면 중인 북극곰용 (13개 성분)
const bear_dangdangCare = [
  {
    name: '바나바잎추출물\n(코로솔산)',
    summary: '식후 혈당 상승 억제를 위한 핵심 기능성 성분',
    sortOrder: 1,
    descriptions: [
      '식후 혈당 상승 억제에 필수인 포도당 수송체(GLUT4) 증가',
      '알파-글루코시다제 억제로 포도당 신생 속도 감소'
    ],
    ingredientKey: 'corosolic_acid'
  },
  {
    name: '크롬',
    summary: '인슐린 저항성 개선의 핵심 물질',
    sortOrder: 2,
    descriptions: [
      '인슐린 수용체 감수성 증가로 세포 내 포도당 흡수 촉진',
      '바나바잎추출물과 함께 상승 효과'
    ],
    ingredientKey: 'chromium'
  },
  {
    name: 'HCA\n(가르시니아캄보지아추출물)',
    summary: '지방 합성 억제 및 식욕 조절을 위한 핵심 기능성 성분',
    sortOrder: 3,
    descriptions: [
      'HCA가 지방 합성 효소(ATP citrate lyase) 억제',
      '과잉 탄수화물이 지방으로 전환되는 과정 차단',
      '세로토닌 증가로 식욕 및 탄수화물 갈망 감소에 도움'
    ],
    ingredientKey: 'hca'
  },
  {
    name: '포스콜린\n(콜레우스포스콜리추출물)',
    summary: '지방 분해 촉진 및 대사율 증가를 위한 핵심 기능성 성분',
    sortOrder: 4,
    descriptions: [
      '세포 내 cAMP 수치 증가로 지방 분해 효소 활성화',
      '피하지방과 내장지방을 에너지로 전환하는데 도움'
    ],
    ingredientKey: 'forskolin'
  },
  {
    name: '비타민 B1(티아민)',
    summary: '탄수화물 대사의 핵심 비타민',
    sortOrder: 5,
    descriptions: [
      '탄수화물 대사의 첫 단계 효소 활성화',
      '포도당(혈당)을 아세틸CoA로 전환하여 에너지 생산에 도움'
    ],
    ingredientKey: 'vitamin_b1'
  },
  {
    name: '비타민 B2',
    summary: '탄수화물과 지방 대사의 핵심 비타민',
    sortOrder: 6,
    descriptions: [
      '지방산 대사 첫 단계 효소의 구성 성분',
      '미토콘드리아 에너지 생산 촉진으로 대사 속도 증가'
    ],
    ingredientKey: 'vitamin_b2'
  },
  {
    name: '비타민 B3(나이아신)',
    summary: '인슐린 저항성 개선 및 에너지 대사의 핵심 비타민',
    sortOrder: 7,
    descriptions: [
      'NAD+ 보조효소 생성으로 에너지 대사 촉진',
      '지방산과 콜레스테롤 대사 개선에 도움',
      '인슐린 감수성 증가와 혈당 조절 능력 향상에 도움'
    ],
    ingredientKey: 'vitamin_b3'
  },
  {
    name: '비타민 B5',
    summary: '탄단지 대사의 핵심 비타민',
    sortOrder: 8,
    descriptions: [
      '탄단지 대사에 필수인 코엔자임A 합성의 필수 성분',
      '지방산 분해 과정의 필수 재료',
      '부신 호르몬 합성으로 스트레스성 혈당 상승 조절'
    ],
    ingredientKey: 'vitamin_b5'
  },
  {
    name: '비타민 B6',
    summary: '단백질 및 탄수화물 대사의 핵심 비타민',
    sortOrder: 9,
    descriptions: [
      '근육 합성을 위한 단백질 대사 효소 활성화',
      '운동, 공복 시 글리코겐 분해 효소 활성화',
      '신경전달물질 합성으로 식욕 조절에 도움'
    ],
    ingredientKey: 'vitamin_b6'
  },
  {
    name: '비타민 B7',
    summary: '탄단지 대사의 핵심 비타민',
    sortOrder: 10,
    descriptions: [
      '탄단지 대사 효소(카르복실화) 활성화로 대사 속도 증가',
      '탄수화물 대사 효소(글루코키나제) 활성화로 혈당 스파이크 방지',
      '단백질 대사를 촉진하여 근육 합성 및 모발/피부 구조 강화'
    ],
    ingredientKey: 'vitamin_b7'
  },
  {
    name: '비타민 B9(엽산)',
    summary: '세포 재생 및 혈관 건강을 위한 핵심 비타민',
    sortOrder: 11,
    descriptions: [
      'DNA 합성에 필수로 작용하여 노화된 세포 재생',
      '혈관 독소인 호모시스테인 제거',
      '만성 염증 감소로 인슐린 저항성 개선에 도움'
    ],
    ingredientKey: 'vitamin_b9'
  },
  {
    name: '비타민 B12',
    summary: '지방 대사 촉진 및 신경 기능 유지를 위한 핵심 비타민',
    sortOrder: 12,
    descriptions: [
      '지방산 대사 과정의 필수 조효소',
      '신경전달물질 대사 개선을 통해 식욕 조절에 도움',
      '혈관 독소인 호모시스테인 제거'
    ],
    ingredientKey: 'vitamin_b12'
  },
  {
    name: '비타민 C',
    summary: '항산화 작용을 통한 인슐린 저항성 개선의 핵심 비타민',
    sortOrder: 13,
    descriptions: [
      '산화 스트레스로 망가진 인슐린 수용체 보호',
      '혈관과 피부 조직의 산화를 막아 탄력 유지에 도움',
      '스트레스 호르몬(코르티솔)에 의한 혈당 상승 조절'
    ],
    ingredientKey: 'vitamin_c'
  }
];

// 뉴로마스터 - 동면 중인 북극곰용 (2개 성분)
const bear_neuroMaster = [
  {
    name: '요오드',
    summary: '기초 대사량을 결정하는 갑상선 호르몬(T4)의 핵심 원료',
    sortOrder: 1,
    descriptions: [
      '갑상선 호르몬(T4)을 생성하여 기초 대사량 증가',
      '세포 내 에너지 공장인 미토콘드리아 수 증가',
      '세포의 산소 소비를 촉진하여 체온 상승'
    ],
    ingredientKey: 'iodine'
  },
  {
    name: '은행잎\n추출물',
    summary: '혈행 개선을 통해 대사 효율을 높이는 핵심 기능성 성분',
    sortOrder: 2,
    descriptions: [
      '혈관 확장과 혈류 흐름을 개선해 세포에 에너지 공급',
      '세포 내 산소 공급 증가로 에너지 대사 효율 개선'
    ],
    ingredientKey: 'ginkgo'
  }
];

// 바이오 밸런스 - 동면 중인 북극곰용 (7개 성분)
const bear_bioBalance = [
  {
    name: '크롬',
    summary: '인슐린 저항성 개선의 핵심 미네랄',
    sortOrder: 1,
    descriptions: [
      '세포 내 포도당 흡수를 촉진해 식후 혈당 상승 억제에 도움',
      '잉여 포도당이 체지방으로 전환되는 과정 차단'
    ],
    ingredientKey: 'chromium'
  },
  {
    name: '셀레늄',
    summary: '염증 억제와 갑상선 호르몬 활성화의 핵심 미네랄',
    sortOrder: 2,
    descriptions: [
      '염증성 신호물질(IL-6, TNF-α) 차단으로 인슐린 저항성 개선에 도움',
      '갑상선 호르몬 활성화(T4 → T3)의 필수 성분'
    ],
    ingredientKey: 'selenium'
  },
  {
    name: '마그네슘',
    summary: '인슐린 저항성 개선과 에너지 대사의 핵심 미네랄',
    sortOrder: 3,
    descriptions: [
      '인슐린 수용체 활성화로 혈당 조절에 도움',
      '세포의 에너지 생산과 포도당 대사 효소의 필수 조효소'
    ],
    ingredientKey: 'magnesium'
  },
  {
    name: '아연',
    summary: '인슐린 수용체 기능 개선의 핵심 미네랄',
    sortOrder: 4,
    descriptions: [
      '인슐린 수용체(IRS-1/PI3K/Akt) 신호를 강화해 혈당 조절에 도움',
      '활성형 갑상선 호르몬(T3)의 세포 결합에 도움'
    ],
    ingredientKey: 'zinc'
  },
  {
    name: '비타민 D',
    summary: '인슐린 분비 개선과 호르몬 민감도 조절의 핵심 비타민',
    sortOrder: 5,
    descriptions: [
      '췌장 베타 세포의 기능을 최적화해 인슐린 분비 개선',
      '염증(NF-κB) 억제로 인슐린 저항성 개선에 도움',
      '인슐린 및 갑상선 호르몬 수용체 발현을 증가시켜 대사 효율 개선'
    ],
    ingredientKey: 'vitamin_d'
  },
  {
    name: '망간',
    summary: '활성산소를 제거해 인슐린 신호 전달을 보호하는 핵심 미네랄',
    sortOrder: 6,
    descriptions: [
      '세포 손상을 막는 항산화 효소(MnSOD)의 구성 물질',
      '산화 스트레스로부터 인슐린 신호 전달 경로 보호',
      '활성산소를 제거하여 세포 노화 방지와 대사량 개선에 도움'
    ],
    ingredientKey: 'manganese'
  },
  {
    name: '몰리브덴',
    summary: '독소 해독으로 염증 부담을 감소시키는 핵심 미네랄',
    sortOrder: 7,
    descriptions: [
      '해독 효소(설파이트 옥시다제) 활성화로 대사 방해 유해 물질 제거',
      '체내 독소 중화 및 배출을 통해 만성 염증 반응 감소',
      '영양소 흡수와 대사가 원활한 환경 조성'
    ],
    ingredientKey: 'molybdenum'
  }
];

// ============================================
// 업데이트 함수
// ============================================

async function updateAllMechanisms() {
  console.log('전체 mechanisms 데이터 업데이트 시작...\n');

  const updates = [
    // 예민한 고슴도치 (ID: 4)
    { healthTypeAnimalId: 4, productName: '다래케어', mechanisms: hedgehog_daraeCare },
    { healthTypeAnimalId: 4, productName: '바이오 밸런스', mechanisms: hedgehog_bioBalance },
    { healthTypeAnimalId: 4, productName: '클린 밸런스', mechanisms: hedgehog_cleanBalance },

    // 배 빵빵 펭귄 (ID: 3)
    { healthTypeAnimalId: 3, productName: '바이오 밸런스', mechanisms: penguin_bioBalance },
    { healthTypeAnimalId: 3, productName: '클린 밸런스', mechanisms: penguin_cleanBalance },
    { healthTypeAnimalId: 3, productName: '당당케어', mechanisms: penguin_dangdangCare },

    // 화끈한 불여우 (ID: 1)
    { healthTypeAnimalId: 1, productName: '바이오 밸런스', mechanisms: fox_bioBalance },
    { healthTypeAnimalId: 1, productName: '클린 밸런스', mechanisms: fox_cleanBalance },
    { healthTypeAnimalId: 1, productName: '영데이즈', mechanisms: fox_youngdays },

    // 동면 중인 북극곰 (ID: 2)
    { healthTypeAnimalId: 2, productName: '당당케어', mechanisms: bear_dangdangCare },
    { healthTypeAnimalId: 2, productName: '뉴로 마스터', mechanisms: bear_neuroMaster },
    { healthTypeAnimalId: 2, productName: '바이오 밸런스', mechanisms: bear_bioBalance },
  ];

  for (const update of updates) {
    const product = await prisma.healthTypeAnimalProduct.findFirst({
      where: {
        healthTypeAnimalId: update.healthTypeAnimalId,
        product: { name: update.productName },
        type: 'SUPPLEMENT'
      },
      include: { product: true }
    });

    if (product) {
      await prisma.healthTypeAnimalProduct.update({
        where: { id: product.id },
        data: { mechanisms: update.mechanisms }
      });
      console.log(`✅ [ID:${update.healthTypeAnimalId}] ${update.productName}: ${update.mechanisms.length}개 성분 업데이트`);
    } else {
      console.log(`❌ [ID:${update.healthTypeAnimalId}] ${update.productName}: 제품을 찾을 수 없음`);
    }
  }

  console.log('\n✅ 전체 mechanisms 데이터 업데이트 완료');
}

updateAllMechanisms()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
