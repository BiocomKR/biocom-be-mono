/**
 * 맞춤솔루션 관련 테이블 시딩 스크립트
 *
 * 개발 서버 데이터를 운영 서버에 옮기기 위한 스크립트
 * 데이터가 하드코딩되어 있어 JSON 파일 복사 불필요
 *
 * 시딩 순서 (관계 테이블 고려):
 * 1. ProductLineup (상품 라인업)
 * 2. HealthTypeAnimal (건강 타입 동물)
 * 3. HealthTypeAnimalProduct (건강 타입 동물 - 상품 매핑)
 *
 * 사용법:
 *   npx ts-node prisma/seed-solution.ts
 *
 * 주의: 이 스크립트는 기존 데이터를 삭제하고 새로 생성합니다.
 *       운영 환경에서 실행 시 주의하세요.
 *
 * 데이터 기준: 2025-12-27 개발 DB
 */

import { PrismaClient } from '@prisma/client';
import { getNowKST } from '../src/common/utils/kst-date.util';

const prisma = new PrismaClient();

// ============================================================
// 1. ProductLineup 데이터
// ============================================================
const PRODUCT_LINEUPS = [
  {
    key: 'ORIGINAL',
    name: '오리지널',
    description: '정제된 탄수화물 대신 단백질과 건강한 지방 위주로 구성하여, 장내 유해균이 과도하게 증식할 수 있는 영양 공급을 자연스럽게 조절합니다. 장 점막을 느슨하게 만드는 글루텐을 배제하여 장 건강 회복을 돕습니다.',
    imageUrl: 'https://storage.googleapis.com/api-dev-biocom-uploads/matchum_solution/lineup/오리지널.webp',
    sortOrder: 1,
  },
  {
    key: 'SIGNATURE',
    name: '시그니처',
    description: '인슐린 저항성 개선에 도움을 주면서도, 엄격한 식단이 부담스러울 때 편안하게 선택할 수 있는 라인업입니다. 현미 등 건강한 탄수화물을 사용하여 급격한 혈당 변화는 막아주되, 저탄수화물 식단에 우리 몸이 서서히 적응할 수 있도록 돕습니다.',
    imageUrl: 'https://storage.googleapis.com/api-dev-biocom-uploads/matchum_solution/lineup/시그니처.webp',
    sortOrder: 2,
  },
  {
    key: 'SLOW_AGING',
    name: '저속노화',
    description: "염증 해소에 꼭 필요한 오메가-3와 다양한 항산화 성분을 풍부하게 담았습니다. 만성 염증으로 지친 몸에 '소방관' 역할을 하는 영양소를 공급하여, 체내 회복 시스템이 정상적으로 작동하도록 돕습니다.",
    imageUrl: 'https://storage.googleapis.com/api-dev-biocom-uploads/matchum_solution/lineup/저속노화.webp',
    sortOrder: 3,
  },
  {
    key: 'LOW_FODMAP',
    name: '저포드맵',
    description: '소장에서 쉽게 발효되어 가스를 만드는 포드맵(FODMAP) 성분을 최소화했습니다. 식사 후 복부 팽만감을 유발하는 SIBO(소장 내 세균 과다 증식)의 환경적 요인을 조절하여, 장이 편안하게 쉴 수 있는 상태를 만들어줍니다.',
    imageUrl: 'https://storage.googleapis.com/api-dev-biocom-uploads/matchum_solution/lineup/저포드맵.webp',
    sortOrder: 4,
  },
];

// ============================================================
// 2. HealthTypeAnimal 데이터
// ============================================================
const HEALTH_TYPE_ANIMALS = [
  {
    healthType: 'GUT_HEALTH',
    typeName: '장형',
    animalName: '배 빵빵 펭귄',
    catchphrase: '장속 가스 폭풍을\n잔잔 모드로 돌려야 해요.',
    symptoms: '배에 가스가 자주 찬다\n      변비나 설사가 잦다\n      배가 자주 아프다\n      소화가 잘 안 된다\n      트림이 자주 나온다',
    description: '장내 미생물 불균형으로 장-피부 축(Gut-Skin Axis)에 문제가 생긴 장 건강 저하형입니다.',
    solution: "(1) 장벽 복구(바이오 밸런스) (2) 독소 제거(바이오 밸런스, 클린 밸런스) (3) 유해균 먹이 차단(당당케어)을 '동시에' 진행해야 빠르게 개선될 수 있습니다. 아연과 마그네슘이 장벽 틈을 메우고, 클로렐라가 독소를 배출하며, 혈당 조절로 유해균 증식을 억제합니다. 지연성 알러지 식품, 고포드맵 식품, 가공 식품을 제한을 병행하면 장과 피부 건강을 근본적으로 개선할 수 있습니다.",
    metadata: {
      synergyEffects: [
        { number: '①', title: '장벽 3중 강화 시스템', items: [{ productName: '바이오 밸런스', description: '아연+마그네슘이 밀착연접 단백질 합성' }, { productName: '클린 밸런스', description: '비타민A가 점액층 두껍게 형성' }, { productName: '당당케어', description: '비타민B군이 장 세포 재생 에너지 공급' }], summary: '→ 3단계 방어벽 완성으로 장누수 완화', sortOrder: 1 },
        { number: '②', title: '독소 완전 제거 루트', items: [{ productName: '바이오 밸런스', description: '셀레늄+망간+몰리브덴이 장내 독소 중화' }, { productName: '클린 밸런스', description: '클로렐라가 독소 흡착하여 체외 배출' }, { productName: null, description: '비타민C+E가 혈액 속 염증 물질 제거' }], summary: '→ 장-피부 축 염증 차단으로 턱 트러블 개선', sortOrder: 2 },
        { number: '③', title: '장내 유해균 이중 억제', items: [{ productName: '바이오 밸런스', description: '비타민D가 항균 펩타이드 생성' }, { productName: '클린 밸런스', description: '아연이 유해균 증식 억제' }, { productName: '당당케어', description: '크롬+바나바잎이 혈당 조절로 유해균 먹이 차단' }], summary: '→ 복부 팽만과 가스 생성 근본 해결', sortOrder: 3 },
        { number: '④', title: '세포 재생 가속화', items: [{ productName: '바이오 밸런스', description: '아연이 DNA 합성 촉진' }, { productName: '클린 밸런스', description: '비타민A+C가 콜라겐 합성 지원' }, { productName: '당당케어', description: '비타민B군(B₂,B₃,B₆,B₉)이 세포 분열 에너지 공급' }], summary: '→ 손상된 장 점막 빠른 회복', sortOrder: 4 },
      ],
      intakeGuide: {
        diet: { routine: "최소 2주간 점심은 '저포드맵', 저녁은 '오리지널'로 고정하여 섭취하세요.", synergy: '점심에는 가스가 찰 수 있는 발효 원인 자체를 차단하고, 저녁에는 유해균의 활성도를 낮추는 식단을 섭취함으로써 하루 24시간 내내 장이 팽창하지 않고 휴식하는 선순환 환경이 완성됩니다.' },
        supplement: { formula: '바이오 밸런스, 클린 밸런스, 당당케어 세 제품을 함께 복용하면 단순 합산이 아닌 배수 효과가 나타납니다. 장벽 복구 → 독소 제거 → 유해균 먹이 차단으로 3단계 선순환 시스템이 작동하여 장누수증후군과 SIBO를 근본적으로 해결합니다.' },
      },
      dietRecommendation: { lunch: { lineupKey: 'LOW_FODMAP', priority: 1 }, dinner: { lineupKey: 'ORIGINAL', priority: 2 } },
    },
  },
  {
    healthType: 'IMMUNE_BALANCE',
    typeName: '면역형',
    animalName: '예민한 고슴도치',
    catchphrase: '몸속 경보 시스템을\n잔잔 모드로 돌려야 해요.',
    symptoms: '피부가 자주 간지럽다\n      알레르기가 있다\n      피부가 쉽게 붓는다\n      가려움으로 긁은 자국이 있다\n      피부에 열감이 느껴진다',
    description: '우리 몸을 지키는 면역계가 너무 예민해져, 사소한 자극에도 피부에 가려움과 붉은 반응을 일으키는 면역 과민 반응형입니다.',
    solution: "(1) 면역 과민 반응 개선(다래케어) (2) 장벽 복구(바이오 밸런스, 다래케어) (3) 독소 제거(클린 밸런스, 바이오 밸런스)를 '동시에' 진행해야 빠르게 개선될 수 있습니다. 다래추출물이 과민해진 면역 반응 스위치를 내리고, 아연과 마그네슘이 장벽을 복구하며, 클로렐라가 독소를 배출합니다. 지연성 알러지 식품을 즉시 중단하고, 스트레스 관리와 충분한 수면을 병행하면 면역계와 피부 건강을 근본적으로 개선할 수 있습니다.",
    metadata: {
      synergyEffects: [
        { number: '①', title: '면역 이중 안정화 시스템', items: [{ productName: '다래케어', description: '다래추출물이 면역 과민 반응 스위치 직접 OFF' }, { productName: '바이오 밸런스', description: '비타민D가 면역 균형(Th17/Treg) 조절로 근본 정상화' }, { productName: null, description: '아연이 장벽 복구로 면역 과민 상태의 출발점 차단' }], summary: '→ 2단계 면역 조절로 사소한 자극에도 반응하던 면역계 정상화', sortOrder: 1 },
        { number: '②', title: '장벽 3중 복구 시스템', items: [{ productName: '다래케어', description: '아연 8.5mg이 밀착연접 단백질 합성' }, { productName: '바이오 밸런스', description: '아연 12mg + 마그네슘 315mg이 장벽 세포 간 이음새 촘촘하게 결합' }, { productName: '클린 밸런스', description: '비타민A가 장 점막 보호층(뮤신) 두껍게 형성' }], summary: "→ 장누수 완화로 면역 '전군 비상 경계령' 해제", sortOrder: 2 },
        { number: '③', title: '면역 자극 독소 완전 제거', items: [{ productName: '바이오 밸런스', description: '셀레늄+망간+몰리브덴이 장내 독소 중화' }, { productName: '클린 밸런스', description: '클로렐라가 면역 자극 내독소(LPS) 흡착하여 체외 배출' }, { productName: null, description: '비타민C+E가 항산화로 염증 물질 제거' }], summary: '→ 면역계 부담 직접 감소로 과민 반응 완화', sortOrder: 3 },
        { number: '④', title: '피부 장벽 강화로 자극 방어', items: [{ productName: '클린 밸런스', description: '비타민A가 피부 각질 정상화로 외부 자극 방어력 증가' }, { productName: null, description: '아연이 피부 재생 촉진으로 자극 내성 증가' }, { productName: '클린 밸런스', description: '비타민C+E가 피부 세포 보호 및 염증 완화' }], summary: '→ 외부 자극에도 쉽게 흔들리지 않는 탄탄한 방어막 형성', sortOrder: 4 },
      ],
      intakeGuide: {
        diet: { routine: "최소 2주간 점심은 '저포드맵', 저녁은 '저속노화'로 고정하여 섭취하세요.", synergy: "점심에는 면역계에 '휴식'을 주고, 저녁에는 방어벽을 '재건'하는 영양소를 공급합니다. 이 두 가지 과정이 맞물려 외부 자극에도 쉽게 흔들리지 않는 탄탄한 방어막을 형성합니다." },
        supplement: { formula: '다래케어, 바이오 밸런스, 클린 밸런스 세 제품을 함께 복용하면 면역계를 다각도로 안정화합니다. 과민 반응 직접 조절 → 장벽 복구 → 독소 제거로 3단계 시너지가 작동하여 사소한 자극에도 반응하던 면역계가 정상화됩니다.' },
      },
      dietRecommendation: { lunch: { lineupKey: 'LOW_FODMAP', priority: 1 }, dinner: { lineupKey: 'SLOW_AGING', priority: 2 } },
    },
  },
  {
    healthType: 'SKIN_HEALTH',
    typeName: '염증형',
    animalName: '화끈한 불여우',
    catchphrase: '몸속 불씨를\n진정 모드로 돌려야 해요.',
    symptoms: '피부가 자주 붉어지고 가렵다\n      얼굴에 뾰루지가 잘 생긴다\n      생리통이 심하다\n      갑자기 얼굴이 달아오른다\n      속이 자주 더부룩하다',
    description: '염증 스위치가 남들보다 쉽게 켜지고(ON) 잘 꺼지지 않는(OFF) 유형입니다.',
    solution: "(1) 염증 ON 스위치 차단, 염증 OFF 스위치 활성화(바이오 밸런스) (2) 염증 유발 독소 제거(클린 밸런스) (3) 염증 진압과 세포 보호(영데이즈)를 '동시에' 진행해야 빠르게 개선될 수 있습니다. 비타민D와 마그네슘이 염증 해소 시스템을 활성화하고, 셀레늄과 망간이 염증 생성을 억제하며, 클로렐라가 염증 유발 독소를 배출하고, SOD효소가 급성 염증을 진압합니다. 지연성 알러지 식품과 정제 탄수화물 섭취를 줄이고, 오메가-3 섭취와 충분한 수면을 병행하면 염증을 근본적으로 개선할 수 있습니다.",
    metadata: {
      synergyEffects: [
        { number: '①', title: '염증 해소 시스템 완벽 구축', items: [{ productName: '바이오 밸런스', description: '비타민D+마그네슘이 염증 해소 물질(SPMs) 생성 효소 활성화' }, { productName: '클린 밸런스', description: '비타민E+C가 오메가-3 산화 방지 및 재생 시스템 구축' }, { productName: '영데이즈', description: '비타민E+C+글루타치온이 항산화 네트워크로 오메가-3 완벽 보호' }], summary: '→ 염증을 끄는 시스템 완벽 작동으로 잔불까지 완전 소화', sortOrder: 1 },
        { number: '②', title: '이중 항산화 시스템 구축', items: [{ productName: '영데이즈', description: 'SOD+카탈레이즈가 활성산소 1차 대량 제거 (효소 방어)' }, { productName: '클린 밸런스', description: '비타민E+C가 항산화 네트워크 강화로 시너지 효과 극대화' }, { productName: '바이오 밸런스', description: '셀레늄+망간이 항산화 효소 활성화로 1차 방어 지원' }], summary: '→ 1차+2차 이중 방어로 활성산소 완전 차단하여 세포 완벽 보호', sortOrder: 2 },
        { number: '③', title: '독소 완전 제거 루트', items: [{ productName: '바이오 밸런스', description: '셀레늄+망간+몰리브덴이 장내 독소 중화' }, { productName: '클린 밸런스', description: '클로렐라가 염증 유발 내독소(LPS) 흡착하여 체외 배출' }, { productName: '영데이즈', description: '글루타치온이 독소 결합 및 배출로 염증 환경 정리' }], summary: '→ 독소 완전 제거로 염증 재발 원천 차단', sortOrder: 3 },
        { number: '④', title: '염증 생성 3중 차단 시스템', items: [{ productName: '바이오 밸런스', description: '셀레늄+망간이 염증성 신호물질 및 활성산소 직접 제거' }, { productName: '클린 밸런스', description: '비타민E+C가 염증 매개물질 생성 억제 및 염증 신호 차단' }, { productName: '영데이즈', description: 'SOD+카탈레이즈가 염증 촉발 활성산소 2단계 완전 제거' }], summary: '→ 3중 차단으로 염증 생성 원천 봉쇄', sortOrder: 4 },
      ],
      intakeGuide: {
        diet: { routine: "최소 2주간 점심은 '저속노화', 저녁은 '저포드맵'으로 고정하여 섭취하세요.", synergy: "점심에는 염증을 가라앉히는 유효 성분을 적극적으로 채워주고, 저녁에는 자극을 비워주는 식단을 병행함으로써 '진정(Calming)'과 '회복(Recovery)'이 동시에 이루어지는 입체적인 관리가 가능합니다." },
        supplement: { formula: '바이오 밸런스, 클린 밸런스, 영데이즈 세 제품을 함께 복용하면 염증을 다각도로 완전 제어합니다. 양방향 염증 제어 → 독소 제거 → 이중 항산화 시스템 구축으로 염증 생성을 원천 봉쇄하고 잔불까지 완전 소화합니다.' },
      },
      dietRecommendation: { lunch: { lineupKey: 'SLOW_AGING', priority: 1 }, dinner: { lineupKey: 'LOW_FODMAP', priority: 2 } },
    },
  },
  {
    healthType: 'METABOLISM',
    typeName: '대사형',
    animalName: '동면 중인 북극곰',
    catchphrase: '몸속 에너지 대사를\n활성 모드로 바꿔야 해요.',
    symptoms: '쉽게 피로해지고 기운이 없다\n      살이 잘 빠지지 않는다\n      단 것이 자주 당긴다\n      피부 탄력이 떨어졌다\n      집중력이 자주 흐려진다',
    description: '인슐린 저항성으로 피부 노화와 탄력 저하뿐 아니라 만성 피로를 겪는 유형입니다.',
    solution: "(1) 인슐린 저항성 개선(당당케어) (2) 기초 대사 증가(뉴로마스터) (3) 만성 염증 제거(바이오 밸런스)를 '동시에' 진행해야 빠르게 개선될 수 있습니다. 코로솔산과 비타민B군이 인슐린 감수성을 회복하고, 요오드가 갑상선 호르몬을 생성해 기초 대사량 증가에 도움을 주며, 셀레늄과 망간이 인슐린 저항성을 악화시키는 염증을 제거합니다. 지연성 알러지 식품과 정제 탄수화물 섭취를 줄이고, 규칙적인 운동과 충분한 수면을 병행하면 대사를 근본적으로 회복할 수 있습니다.",
    metadata: {
      synergyEffects: [
        { number: '①', title: '인슐린 저항성 개선', items: [{ productName: '당당케어', description: '코로솔산과 크롬이 세포의 포도당 흡수 촉진' }, { productName: '당당케어', description: 'HCA가 높은 혈당이 체지방으로 저장되는 것을 차단' }, { productName: '당당케어', description: '비타민B군 8종이 에너지 대사 활성화' }], summary: '→ 멈춰있던 세포가 다시 당을 받아들이기 시작', sortOrder: 1 },
        { number: '②', title: '갑상선 호르몬 생성', items: [{ productName: '뉴로마스터', description: '요오드가 갑상선 호르몬(T4) 생성' }, { productName: '뉴로마스터', description: '은행잎추출물이 혈액 순환 개선' }, { productName: '뉴로마스터', description: '세포 에너지 공급 극대화' }], summary: '→ 대사 호르몬 T4 생성되지만 활성화 필요', sortOrder: 2 },
        { number: '③', title: '호르몬 활성화 + 염증 제거', items: [{ productName: '바이오 밸런스', description: '셀레늄, 아연, 마그네슘, 비타민D가 T4를 활성형 T3로 전환 후 작용 증폭' }, { productName: '바이오 밸런스', description: '셀레늄과 망간이 염증 차단하여 인슐린 저항성 악화 방지' }], summary: '→ T4→T3 전환으로 갑상선 호르몬 완전 활성화', sortOrder: 3 },
        { number: '④', title: '3단계 시너지 효과', items: [{ productName: '당당케어', description: '인슐린 저항성 개선으로 대사 기반 마련' }, { productName: null, description: '뉴로마스터 + 바이오 밸런스가 T4 생성 후 T3로 전환하여 기초 대사량 증가' }, { productName: '바이오 밸런스', description: '염증 제거로 대사 방해 요인 차단' }], summary: '→ 대사가 근본적으로 회복되어 피로·쉽게 찌는 체질·피부 노화 개선', sortOrder: 4 },
      ],
      intakeGuide: {
        diet: { routine: "최소 2주간 점심은 '오리지널', 저녁은 '시그니처'로 고정하여 섭취하세요.", synergy: '활동량이 많은 점심에는 오리지널로 강력한 대사 자극을 주어 인슐린 민감성을 높이고, 저녁에는 시그니처로 지속 가능한 관리를 이어갑니다. 이 조합은 몸이 무리 없이 저탄수화물 환경에 적응하게 하여, 포기하지 않고 끝까지 대사 체질을 개선하도록 이끌어줍니다.' },
        supplement: { formula: '당당케어, 뉴로마스터, 바이오 밸런스 세 제품을 동시에 복용하면 대사 개선을 위한 최적의 환경이 조성됩니다. 뉴로마스터가 생성한 갑상선 호르몬 T4는 바이오 밸런스의 셀레늄, 아연, 마그네슘, 비타민D가 활성형 T3로 전환해야 비로소 제대로 작동하며, 당당케어는 인슐린 저항성 개선에 도움을 줍니다.' },
      },
      dietRecommendation: { lunch: { lineupKey: 'ORIGINAL', priority: 1 }, dinner: { lineupKey: 'SIGNATURE', priority: 2 } },
    },
  },
];

// ============================================================
// 3. HealthTypeAnimalProduct 데이터 (현재 데이터베이스 기준)
// type: SUPPLEMENT | DIET | FORMULA | CONDITIONAL
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HEALTH_TYPE_ANIMAL_PRODUCTS: Record<string, any[]> = {
  SKIN_HEALTH: [
    // SUPPLEMENT 타입 (displayOrder: 1~3)
    { productId: 4, type: 'SUPPLEMENT', priority: 1, keyword: '염증 개선', displayOrder: 1, recommendReason: '염증 ON/OFF 스위치를 모두 제어하는 성분이 조합되어 있습니다. 셀레늄과 망간이 염증 생성을 직접 억제하고, 비타민D, 아연, 마그네슘이 염증 해소 시스템을 활성화합니다.', dosage: '1일 1회, 1회 3정 섭취', mechanisms: [{ name: '비타민 D', summary: '염증 해소 물질 생성에 도움을 주는 핵심 비타민', sortOrder: 1, descriptions: ['염증 해소 물질(SPMs) 생성 효소 활성화', '레졸빈, 프로텍틴 등 염증 해소 물질 생성 촉진'], ingredientKey: 'vitamin_d' }, { name: '마그네슘', summary: '염증 해소 물질 생성에 도움을 주는 핵심 보조인자', sortOrder: 2, descriptions: ['지방산 대사 효소의 필수 보조인자', '오메가-3를 염증 해소 물질(SPMs)로 전환하는 과정에 필수'], ingredientKey: 'magnesium' }, { name: '아연', summary: '염증 해소 효소 활성화 및 면역 정상화의 핵심 미네랄', sortOrder: 3, descriptions: ['염증을 해소하는 효소(A20) 활성화', '면역 세포(T세포) 기능 정상화로 염증 종료 신호 촉진'], ingredientKey: 'zinc' }, { name: '셀레늄', summary: '염증성 신호물질을 억제하는 핵심 미네랄', sortOrder: 4, descriptions: ['강력한 항산화 효소(GPx) 활성화로 산화 스트레스 제거', '염증성 신호물질(IL-6, TNF-α) 직접 억제', '염증 신호 전달 경로(NF-κB) 차단'], ingredientKey: 'selenium' }, { name: '망간', summary: '활성산소 제거로 염증 촉발을 원천 차단하는 핵심 미네랄', sortOrder: 5, descriptions: ['항산화 효소(MnSOD)의 핵심 성분', '가장 유독한 활성 산소(슈퍼옥사이드 라디칼)를 1차적으로 제거'], ingredientKey: 'manganese' }, { name: '몰리브덴', summary: '독소 해독 효소의 필수 보조인자', sortOrder: 6, descriptions: ['해독 효소(이황산염/알데하이드 산화효소) 활성화', '장내 유해균 독소 및 염증 부담 감소'], ingredientKey: 'molybdenum' }, { name: '크롬', summary: '혈당 조절로 염증 유발 물질 생성 억제의 핵심 미네랄', sortOrder: 7, descriptions: ['혈당 스파이크 방지로 최종당화산물(AGEs) 생성 억제', '당화 스트레스로 인한 염증 차단'], ingredientKey: 'chromium' }] },
    { productId: 5, type: 'SUPPLEMENT', priority: 2, keyword: '독소 배출', displayOrder: 2, recommendReason: '염증 유발 독소를 직접 흡착하여 배출하는 성분으로 구성되어 있습니다. 클로렐라가 장내 내독소(LPS)를 흡착 배출하고, 비타민 E와 비타민 C가 염증 매개 물질을 차단합니다.', dosage: '1일 2회, 1회 2정 섭취', mechanisms: [{ name: '클로렐라', summary: '염증 유발 독소를 흡착 후 배출하는 핵심 물질', sortOrder: 1, descriptions: ['염증 유발 내독소(LPS) 직접 흡착하여 체외 배출', '장에서 흡수되는 독소 차단으로 염증 촉발 원천 제거', '중금속 등 염증 유발 물질 제거'], ingredientKey: 'chlorella' }, { name: '비타민 E', summary: '염증 매개 물질의 생성을 억제하는 핵심 비타민', sortOrder: 2, descriptions: ['염증 매개물질(프로스타글란딘 E2) 생성 억제', '세포막 보호로 염증 신호 차단', '항산화로 염증 촉발 산화 스트레스 제거'], ingredientKey: 'vitamin_e' }, { name: '비타민 C', summary: '염증성 신호물질 생성을 억제하는 핵심 비타민', sortOrder: 3, descriptions: ['염증성 신호물질(IL-6, TNF-α) 생성 억제', '강력한 항산화로 염증 신호 차단', '염증 신호 전달 경로(NF-κB) 억제로 염증 반응 차단'], ingredientKey: 'vitamin_c' }, { name: '아연', summary: '염증 해소 효소 활성화 및 면역 정상화의 핵심 미네랄', sortOrder: 4, descriptions: ['염증을 해소하는 효소(A20) 활성화', '면역 세포(T세포) 기능 정상화로 염증 종료 신호 촉진'], ingredientKey: 'zinc' }, { name: '비타민 B9(엽산)', summary: '염증 유발 물질 차단과 세포 재생의 핵심 비타민', sortOrder: 5, descriptions: ['호모시스테인을 메티오닌으로 전환하여 염증 유발 물질 제거', '염증성 사이토카인(IL-6, TNF-α) 분비 억제', 'DNA 합성 촉진으로 염증 손상 세포를 신속히 재생'], ingredientKey: 'vitamin_b9' }, { name: '비타민 B3(나이아신)', summary: '염증 억제 및 세포 에너지 생성의 핵심 비타민', sortOrder: 6, descriptions: ['염증 유발 효소(COX-2) 발현 감소', '세포 에너지 대사 활성화'], ingredientKey: 'vitamin_b3' }] },
    { productId: 7, type: 'SUPPLEMENT', priority: 3, keyword: '세포 보호', displayOrder: 3, recommendReason: '급성 염증으로부터 세포를 보호하는 항산화 시스템의 구성 성분이 모두 포함되어 있습니다. SOD 효소가 염증을 유발하는 활성산소를 1차로 제거하고 비타민 E, 비타민 C, 글루타치온이 활성산소로 부터 세포를 보호하는 2차 방어막(항산화 네트워크)을 형성합니다.', dosage: '1일 1회, 1회 1포 섭취', mechanisms: [{ name: 'SOD\n효소', summary: '염증을 유발하는 활성산소 1차 제거의 핵심 물질', sortOrder: 1, descriptions: ['활성산소를 덜 유해한 과산화수소로 전환', '염증 신호의 출발점 차단'], ingredientKey: 'sod' }, { name: '카탈레이즈\n효소', summary: '활성산소에서 전환된 과산화수소를 최종 분해하는 핵심 물질', sortOrder: 2, descriptions: ['SOD효소가 전환한 과산화수소를 물과 산소로 완전 분해', '염증 촉발 환경 차단'], ingredientKey: 'catalase' }, { name: '비타민 E', summary: '세포를 보호하는 항산화 네트워크의 핵심 비타민', sortOrder: 3, descriptions: ['지용성 항산화제로 세포막에서 활성산소 직접 차단', '세포막의 산화 방지(세포 손상 차단)'], ingredientKey: 'vitamin_e' }, { name: '비타민 C', summary: '세포를 보호하는 항산화 네트워크의 핵심 비타민', sortOrder: 4, descriptions: ['수용성 항산화제로 세포 외부(혈액, 세포질)에서 활성산소 차단', '산화된 비타민E를 항산화 물질로 재활용', '글루타치온과 함께 세포의 수용성 방어막 구축'], ingredientKey: 'vitamin_c' }, { name: 'L글루타치온\n효모', summary: '항산화 네트워크의 핵심 물질이자 가장 강력한 항산화제', sortOrder: 5, descriptions: ['체내 가장 강력한 항산화제로 활성산소를 직접 중화', '산화된 비타민C를 항산화 물질로 재활용', '체내 독소와 결합하여 몸 밖으로 배출'], ingredientKey: 'glutathione' }] },
    // FORMULA 타입 (displayOrder: 4)
    { productId: 48, type: 'FORMULA', priority: null, keyword: '맞춤솔루션', displayOrder: 4, recommendReason: null, dosage: null, mechanisms: { formulaName: '바이오 밸런스 + 클린 밸런스 + 영데이즈', formulaDescription: '염증을 다각도로 완전 제어합니다. 양방향 염증 제어 → 독소 제거 → 이중 항산화 시스템 구축으로 염증 생성을 원천 봉쇄하고 잔불까지 완전 소화합니다.', synergyEffects: [{ title: '염증 해소 시스템 완벽 구축', result: '염증을 끄는 시스템 완벽 작동으로 잔불까지 완전 소화', items: [{ product: '바이오 밸런스', effect: '비타민D+마그네슘이 염증 해소 물질(SPMs) 생성 효소 활성화' }, { product: '클린 밸런스', effect: '비타민E+C가 오메가-3 산화 방지 및 재생 시스템 구축' }, { product: '영데이즈', effect: '비타민E+C+글루타치온이 항산화 네트워크로 오메가-3 완벽 보호' }] }, { title: '이중 항산화 시스템 구축', result: '1차+2차 이중 방어로 활성산소 완전 차단하여 세포 완벽 보호', items: [{ product: '영데이즈', effect: 'SOD+카탈레이즈가 활성산소 1차 대량 제거 (효소 방어)' }, { product: '영데이즈', effect: '비타민C+E+글루타치온이 2차 방어막 형성 (항산화 네트워크)' }, { product: '바이오 밸런스', effect: '셀레늄+망간이 항산화 효소 활성화로 1차 방어 지원' }] }, { title: '독소 완전 제거 루트', result: '독소 완전 제거로 염증 재발 원천 차단', items: [{ product: '바이오 밸런스', effect: '셀레늄+망간+몰리브덴이 장내 독소 중화' }, { product: '클린 밸런스', effect: '클로렐라가 염증 유발 내독소(LPS) 흡착하여 체외 배출' }, { product: '영데이즈', effect: '글루타치온이 독소 결합 및 배출로 염증 환경 정리' }] }, { title: '염증 생성 3중 차단 시스템', result: '3중 차단으로 염증 생성 원천 봉쇄', items: [{ product: '바이오 밸런스', effect: '셀레늄+망간이 염증성 신호물질 및 활성산소 직접 제거' }, { product: '클린 밸런스', effect: '비타민E+C가 염증 매개물질 생성 억제 및 염증 신호 차단' }, { product: '영데이즈', effect: 'SOD+카탈레이즈가 염증 촉발 활성산소 2단계 완전 제거' }] }] } },
    // CONDITIONAL 타입 (displayOrder: 201~202)
    { productId: 41, type: 'CONDITIONAL', priority: 1, keyword: '수면 개선', displayOrder: 201, recommendReason: '수면 문진 결과, 입면의 어려움뿐만 아니라 수면 도중 깨거나 깊게 잠들지 못하는 문제가 확인됩니다. 메타드림은 1단계(입면 준비), 2단계(생체 리듬 회복), 그리고 3단계(숙면 지속)의 체계적인 3-Step 설계를 따릅니다.', dosage: '1일 1회, 1회 1포 섭취', mechanisms: [{ name: 'GABA', summary: '뇌의 흥분을 억제하는 신경 전달 물질', sortOrder: 1, descriptions: ['억제성 신호로 잠들기 전 복잡한 생각과 불안감을 진정', '수면을 방해하는 뇌의 과활성 상태 안정화'], ingredientKey: 'gaba' }, { name: '레몬밤\n추출분말', summary: 'GABA 분해를 막아 진정 효과를 지속시키는 식물성 원료', sortOrder: 2, descriptions: ['로즈마린산 성분이 체내 GABA 분해 효소(GABA-T) 활성을 억제', '심리적 안정감을 수면 내내 유지하여 편안한 상태 유도'], ingredientKey: 'lemon_balm' }, { name: '마그네슘', summary: '신경과 근육의 긴장을 풀어주는 핵심 미네랄', sortOrder: 3, descriptions: ['뇌의 각성 스위치인 NMDA 수용체의 활성을 억제', '경직된 근육을 이완하여 편안한 신체 수면 환경 조성'], ingredientKey: 'magnesium' }, { name: 'L-테아닌', summary: '뇌파를 안정시켜 편안함을 유도하는 아미노산', sortOrder: 4, descriptions: ['안정될 때의 뇌파인 알파파 발생을 유도하여 긴장 완화', '스트레스로 인한 흥분을 가라앉히고 입면 최적화'], ingredientKey: 'l_theanine' }, { name: '멜라토닌', summary: '생체 리듬을 관장하는 핵심 수면 호르몬', sortOrder: 5, descriptions: ["밤과 낮을 구별해 자연스러운 '수면 스위치' 작동", '수면 중 항산화 작용으로 뇌세포 회복 및 노폐물 청소에 도움'], ingredientKey: 'melatonin' }, { name: 'L-트립토판', summary: '수면 호르몬(멜라토닌)의 재료가 되는 아미노산', sortOrder: 6, descriptions: ['체내에서 행복 호르몬(세로토닌)과 수면 호르몬(멜라토닌)으로 전환', '깊은 잠을 잘 수 있도록 수면-각성 리듬 조절에 기여'], ingredientKey: 'l_tryptophan' }, { name: '비타민 B6', summary: '멜라토닌 생성을 돕는 필수 조효소 비타민', sortOrder: 7, descriptions: ['트립토판이 멜라토닌으로 전환되는 대사 과정의 필수 촉매제', '신경계를 안정시켜 예민함을 줄이고 수면 환경 조성'], ingredientKey: 'vitamin_b6' }, { name: '비타민 B12', summary: '신경 세포 기능 유지와 리듬을 조절하는 비타민', sortOrder: 8, descriptions: ['수면 리듬을 관장하는 생체 시계의 정상적인 작동 지원', '신경 과민을 방지하고 정서적 안정감 유지'], ingredientKey: 'vitamin_b12' }, { name: '글리신', summary: '심부 체온을 낮춰 깊은 잠을 지속시키는 아미노산', sortOrder: 9, descriptions: ['수면 중 체온을 낮게 유지하여 뇌가 깸 없이 휴식하도록 유도', '수면 단계를 안정적으로 유지하여 수면 도중 각성 방지'], ingredientKey: 'glycine' }, { name: 'L-글루타민', summary: '장과 뇌의 회복을 돕는 아미노산', sortOrder: 10, descriptions: ['수면 중 뇌의 에너지원을 공급하고 신경 안정을 지원', '스트레스로 예민해진 장-뇌 축(Gut-Brain Axis) 안정화'], ingredientKey: 'l_glutamine' }, { name: '흑하랑상추\n추출분말', summary: '숙면을 돕는 락투신 성분이 풍부한 천연 소재', sortOrder: 11, descriptions: ['일반 상추 대비 124배 많은 락투신이 신경 진정 작용', '긴장을 풀고 자연스러운 졸음을 유도하는 데 도움'], ingredientKey: 'black_lettuce' }, { name: '감태\n추출물', summary: '깊은 잠을 유도하는 해양 유래 성분', sortOrder: 12, descriptions: ['해양 폴리페놀인 플로로탄닌이 입면 후 각성 현상 억제', '자고 일어나서도 개운함을 느낄 수 있도록 수면의 질 개선'], ingredientKey: 'ecklonia_cava' }] },
    { productId: 42, type: 'CONDITIONAL', priority: 2, keyword: '글루텐 과민 개선', displayOrder: 202, recommendReason: '음식물 과민증 검사에서 글루텐에 높은 반응(4~5단계)을 보이고 있습니다. 밀가루는 장벽을 허물고 염증을 일으키는 강력한 공격 인자가 됩니다. 글루텐 분해 효소로 공격 인자를 제거하고, 낙산균으로 장 점막을 방어하여 장이 받는 충격을 최소화해야 합니다.', dosage: '1일 1회, 1회 1포 섭취', mechanisms: [{ name: '글루텐\n분해 효소', summary: '글루텐 결합을 끊어 소화 부담을 줄이는 효소', sortOrder: 1, descriptions: ['소화되지 않은 단백질 찌꺼기가 장벽을 자극해 생기는 염증 억제', '체내에 독소가 쌓이는 것을 막아 근본적인 피부 트러블 원인 차단'], ingredientKey: 'gluten_enzyme' }, { name: '낙산균', summary: '장벽을 복구해 독소 유입을 막는 유익균', sortOrder: 2, descriptions: ["장 점막 세포의 에너지원이 되어 '새는 장(Leaky Gut)' 현상 방어", '장내 유해 물질이 혈관을 타고 피부로 번지는 것을 1차적으로 봉쇄'], ingredientKey: 'butyric_acid_bacteria' }, { name: '알파 CD', summary: '가공식품의 나쁜 기름과 노폐물을 흡착하는 식이섬유', sortOrder: 3, descriptions: ['소화기 내 지방 성분과 찌꺼기를 감싸서 배출', '혈중으로 흡수되는 나쁜 지방을 줄여 피부 유분 밸런스 유지 도움'], ingredientKey: 'alpha_cd' }, { name: '난소화성\n말토덱스트린', summary: '식후 혈당 상승을 방지해 피부 자극을 줄이는 수용성 식이섬유', sortOrder: 4, descriptions: ['밀가루 섭취 후 급격한 혈당 상승(스파이크)을 억제', '인슐린 과다 분비로 인한 피지 과다 및 염증성 피부 반응 감소'], ingredientKey: 'resistant_maltodextrin' }, { name: '차전자피\n분말', summary: '독소와 묵은 변을 빠르게 배출하는 식이섬유', sortOrder: 5, descriptions: ['수분을 흡수해 팽창하며 장내 틈새에 낀 노폐물까지 흡착해 배설', '장내 부패 독소가 재흡수되어 피부로 올라오지 않도록 신속히 제거'], ingredientKey: 'psyllium_husk' }] },
  ],
  METABOLISM: [
    // SUPPLEMENT 타입 (displayOrder: 1~3)
    { productId: 1, type: 'SUPPLEMENT', priority: 1, keyword: '혈당 조절', displayOrder: 1, recommendReason: '인슐린 저항성의 원인인 식후 혈당 상승 억제와 대사 개선을 위한 최적의 조합입니다. 코로솔산과 크롬이 세포의 포도당 흡수를 촉진하여 인슐린 저항성 개선에 도움을 주며, HCA가 높은 혈당이 체지방으로 저장되지 않도록 막아줍니다. 비타민B군과 포스콜린은 지방 대사를 개선합니다.', dosage: '1일 2회, 1회 2정 섭취', mechanisms: [{ name: '바나바잎추출물\n(코로솔산)', summary: '식후 혈당 상승 억제를 위한 핵심 기능성 성분', sortOrder: 1, descriptions: ['식후 혈당 상승 억제에 필수인 포도당 수송체(GLUT4) 증가', '알파-글루코시다제 억제로 포도당 신생 속도 감소'], ingredientKey: 'corosolic_acid' }, { name: '크롬', summary: '인슐린 저항성 개선의 핵심 물질', sortOrder: 2, descriptions: ['인슐린 수용체 감수성 증가로 세포 내 포도당 흡수 촉진', '바나바잎추출물과 함께 상승 효과'], ingredientKey: 'chromium' }, { name: 'HCA\n(가르시니아캄보지아추출물)', summary: '지방 합성 억제 및 식욕 조절을 위한 핵심 기능성 성분', sortOrder: 3, descriptions: ['HCA가 지방 합성 효소(ATP citrate lyase) 억제', '과잉 탄수화물이 지방으로 전환되는 과정 차단', '세로토닌 증가로 식욕 및 탄수화물 갈망 감소에 도움'], ingredientKey: 'hca' }, { name: '포스콜린\n(콜레우스포스콜리추출물)', summary: '지방 분해 촉진 및 대사율 증가를 위한 핵심 기능성 성분', sortOrder: 4, descriptions: ['세포 내 cAMP 수치 증가로 지방 분해 효소 활성화', '피하지방과 내장지방을 에너지로 전환하는데 도움'], ingredientKey: 'forskolin' }] },
    { productId: 6, type: 'SUPPLEMENT', priority: 2, keyword: '대사량 증가', displayOrder: 2, recommendReason: '저하된 대사 기능을 개선하기 위한 최적의 조합입니다. 요오드가 갑상선 호르몬인 T4를 생성해 기초대사량을 높이고, 은행잎추출물이 혈행을 개선하여 세포 에너지 공급과 대사량을 증가시킵니다.', dosage: '1일 1회, 2정 섭취', mechanisms: [{ name: '요오드', summary: '기초 대사량을 결정하는 갑상선 호르몬(T4)의 핵심 원료', sortOrder: 1, descriptions: ['갑상선 호르몬(T4)을 생성하여 기초 대사량 증가', '세포 내 에너지 공장인 미토콘드리아 수 증가', '세포의 산소 소비를 촉진하여 체온 상승'], ingredientKey: 'iodine' }, { name: '은행잎\n추출물', summary: '혈행 개선을 통해 대사 효율을 높이는 핵심 기능성 성분', sortOrder: 2, descriptions: ['혈관 확장과 혈류 흐름을 개선해 세포에 에너지 공급', '세포 내 산소 공급 증가로 에너지 대사 효율 개선'], ingredientKey: 'ginkgo' }] },
    { productId: 4, type: 'SUPPLEMENT', priority: 3, keyword: '대사 시너지', displayOrder: 3, recommendReason: '만성 염증 제거로 인슐린 저항성 악화를 차단하고, 갑상선 호르몬 활성화를 지원하는 이중 기능 제품입니다. 셀레늄과 망간이 인슐린 수용체를 손상시키는 염증을 제거하며, 셀레늄, 아연, 마그네슘, 비타민D가 갑상선 호르몬 활성화를 도와 기초 대사량을 극대화합니다.', dosage: '1일 1회, 1회 3정 섭취', mechanisms: [{ name: '크롬', summary: '인슐린 저항성 개선의 핵심 미네랄', sortOrder: 1, descriptions: ['세포 내 포도당 흡수를 촉진해 식후 혈당 상승 억제에 도움', '잉여 포도당이 체지방으로 전환되는 과정 차단'], ingredientKey: 'chromium' }, { name: '셀레늄', summary: '염증 억제와 갑상선 호르몬 활성화의 핵심 미네랄', sortOrder: 2, descriptions: ['염증성 신호물질(IL-6, TNF-α) 차단으로 인슐린 저항성 개선에 도움', '갑상선 호르몬 활성화(T4 → T3)의 필수 성분'], ingredientKey: 'selenium' }, { name: '마그네슘', summary: '인슐린 저항성 개선과 에너지 대사의 핵심 미네랄', sortOrder: 3, descriptions: ['인슐린 수용체 활성화로 혈당 조절에 도움', '세포의 에너지 생산과 포도당 대사 효소의 필수 조효소'], ingredientKey: 'magnesium' }, { name: '아연', summary: '인슐린 수용체 기능 개선의 핵심 미네랄', sortOrder: 4, descriptions: ['인슐린 수용체(IRS-1/PI3K/Akt) 신호를 강화해 혈당 조절에 도움', '활성형 갑상선 호르몬(T3)의 세포 결합에 도움'], ingredientKey: 'zinc' }, { name: '비타민 D', summary: '인슐린 분비 개선과 호르몬 민감도 조절의 핵심 비타민', sortOrder: 5, descriptions: ['췌장 베타 세포의 기능을 최적화해 인슐린 분비 개선', '염증(NF-κB) 억제로 인슐린 저항성 개선에 도움', '인슐린 및 갑상선 호르몬 수용체 발현을 증가시켜 대사 효율 개선'], ingredientKey: 'vitamin_d' }, { name: '망간', summary: '활성산소를 제거해 인슐린 신호 전달을 보호하는 핵심 미네랄', sortOrder: 6, descriptions: ['세포 손상을 막는 항산화 효소(MnSOD)의 구성 물질', '산화 스트레스로부터 인슐린 신호 전달 경로 보호', '활성산소를 제거하여 세포 노화 방지와 대사량 개선에 도움'], ingredientKey: 'manganese' }, { name: '몰리브덴', summary: '독소 해독으로 염증 부담을 감소시키는 핵심 미네랄', sortOrder: 7, descriptions: ['해독 효소(설파이트 옥시다제) 활성화로 대사 방해 유해 물질 제거', '체내 독소 중화 및 배출을 통해 만성 염증 반응 감소', '영양소 흡수와 대사가 원활한 환경 조성'], ingredientKey: 'molybdenum' }] },
    // DIET 타입 - 오리지널 (displayOrder: 101~104)
    { productId: 19, type: 'DIET', priority: 1, keyword: '오리지널', displayOrder: 101, recommendReason: '탄수화물 섭취를 최소화하여 우리 몸이 당 대신 지방을 태우도록 대사 스위치를 강하게 켜줍니다. 인슐린 저항성의 핵심 원인인 혈당 스파이크를 가장 확실하게 잡아주어, 무거워진 대사 흐름을 활성화하고 인슐린 기능을 정상화하는 데 집중합니다.', dosage: '점심 식사로 섭취', mechanisms: [] },
    { productId: 20, type: 'DIET', priority: 1, keyword: '오리지널', displayOrder: 102, recommendReason: '탄수화물 섭취를 최소화하여 우리 몸이 당 대신 지방을 태우도록 대사 스위치를 강하게 켜줍니다. 인슐린 저항성의 핵심 원인인 혈당 스파이크를 가장 확실하게 잡아주어, 무거워진 대사 흐름을 활성화하고 인슐린 기능을 정상화하는 데 집중합니다.', dosage: '점심 식사로 섭취', mechanisms: [] },
    { productId: 21, type: 'DIET', priority: 1, keyword: '오리지널', displayOrder: 103, recommendReason: '탄수화물 섭취를 최소화하여 우리 몸이 당 대신 지방을 태우도록 대사 스위치를 강하게 켜줍니다. 인슐린 저항성의 핵심 원인인 혈당 스파이크를 가장 확실하게 잡아주어, 무거워진 대사 흐름을 활성화하고 인슐린 기능을 정상화하는 데 집중합니다.', dosage: '점심 식사로 섭취', mechanisms: [] },
    { productId: 22, type: 'DIET', priority: 1, keyword: '오리지널', displayOrder: 104, recommendReason: '탄수화물 섭취를 최소화하여 우리 몸이 당 대신 지방을 태우도록 대사 스위치를 강하게 켜줍니다. 인슐린 저항성의 핵심 원인인 혈당 스파이크를 가장 확실하게 잡아주어, 무거워진 대사 흐름을 활성화하고 인슐린 기능을 정상화하는 데 집중합니다.', dosage: '점심 식사로 섭취', mechanisms: [] },
    // DIET 타입 - 시그니처 (displayOrder: 105~109)
    { productId: 14, type: 'DIET', priority: 2, keyword: '시그니처', displayOrder: 105, recommendReason: '인슐린 저항성 개선에 도움을 주면서도, 엄격한 식단이 부담스러울 때 편안하게 선택할 수 있는 라인업입니다. 현미 등 건강한 탄수화물을 사용하여 급격한 혈당 변화는 막아주되, 저탄수화물 식단에 우리 몸이 서서히 적응할 수 있도록 돕습니다.', dosage: '저녁 식사로 섭취', mechanisms: [] },
    { productId: 15, type: 'DIET', priority: 2, keyword: '시그니처', displayOrder: 106, recommendReason: '인슐린 저항성 개선에 도움을 주면서도, 엄격한 식단이 부담스러울 때 편안하게 선택할 수 있는 라인업입니다. 현미 등 건강한 탄수화물을 사용하여 급격한 혈당 변화는 막아주되, 저탄수화물 식단에 우리 몸이 서서히 적응할 수 있도록 돕습니다.', dosage: '저녁 식사로 섭취', mechanisms: [] },
    { productId: 16, type: 'DIET', priority: 2, keyword: '시그니처', displayOrder: 107, recommendReason: '인슐린 저항성 개선에 도움을 주면서도, 엄격한 식단이 부담스러울 때 편안하게 선택할 수 있는 라인업입니다. 현미 등 건강한 탄수화물을 사용하여 급격한 혈당 변화는 막아주되, 저탄수화물 식단에 우리 몸이 서서히 적응할 수 있도록 돕습니다.', dosage: '저녁 식사로 섭취', mechanisms: [] },
    { productId: 17, type: 'DIET', priority: 2, keyword: '시그니처', displayOrder: 108, recommendReason: '인슐린 저항성 개선에 도움을 주면서도, 엄격한 식단이 부담스러울 때 편안하게 선택할 수 있는 라인업입니다. 현미 등 건강한 탄수화물을 사용하여 급격한 혈당 변화는 막아주되, 저탄수화물 식단에 우리 몸이 서서히 적응할 수 있도록 돕습니다.', dosage: '저녁 식사로 섭취', mechanisms: [] },
    { productId: 18, type: 'DIET', priority: 2, keyword: '시그니처', displayOrder: 109, recommendReason: '인슐린 저항성 개선에 도움을 주면서도, 엄격한 식단이 부담스러울 때 편안하게 선택할 수 있는 라인업입니다. 현미 등 건강한 탄수화물을 사용하여 급격한 혈당 변화는 막아주되, 저탄수화물 식단에 우리 몸이 서서히 적응할 수 있도록 돕습니다.', dosage: '저녁 식사로 섭취', mechanisms: [] },
    // FORMULA 타입 (displayOrder: 110)
    { productId: 49, type: 'FORMULA', priority: null, keyword: '맞춤솔루션', displayOrder: 110, recommendReason: null, dosage: null, mechanisms: { formulaName: '당당케어 + 뉴로마스터 + 바이오 밸런스', formulaDescription: '대사 개선을 위한 최적의 환경이 조성됩니다. 뉴로마스터가 생성한 갑상선 호르몬 T4는 바이오 밸런스의 셀레늄, 아연, 마그네슘, 비타민D가 활성형 T3로 전환해야 비로소 제대로 작동하며, 당당케어는 인슐린 저항성 개선에 도움을 줍니다.', synergyEffects: [{ title: '인슐린 저항성 개선', result: '멈춰있던 세포가 다시 당을 받아들이기 시작', items: [{ product: '당당케어', effect: '코로솔산과 크롬이 세포의 포도당 흡수 촉진' }, { product: '당당케어', effect: 'HCA가 높은 혈당이 체지방으로 저장되는 것을 차단' }, { product: '당당케어', effect: '비타민B군 8종이 에너지 대사 활성화' }] }, { title: '갑상선 호르몬 생성', result: '대사 호르몬 T4 생성되지만 활성화 필요', items: [{ product: '뉴로마스터', effect: '요오드가 갑상선 호르몬(T4) 생성' }, { product: '뉴로마스터', effect: '은행잎추출물이 혈액 순환 개선' }, { product: '뉴로마스터', effect: '세포 에너지 공급 극대화' }] }, { title: '호르몬 활성화 + 염증 제거', result: 'T4→T3 전환으로 갑상선 호르몬 완전 활성화', items: [{ product: '바이오 밸런스', effect: '셀레늄, 아연, 마그네슘, 비타민D가 T4를 활성형 T3로 전환 후 작용 증폭' }, { product: '바이오 밸런스', effect: '셀레늄과 망간이 염증 차단하여 인슐린 저항성 악화 방지' }] }, { title: '3단계 시너지 효과', result: '대사가 근본적으로 회복되어 피로·쉽게 찌는 체질·피부 노화 개선', items: [{ product: '당당케어', effect: '인슐린 저항성 개선으로 대사 기반 마련' }, { product: '뉴로마스터 + 바이오 밸런스', effect: 'T4 생성 후 T3로 전환하여 기초 대사량 증가' }, { product: '바이오 밸런스', effect: '염증 제거로 대사 방해 요인 차단' }] }] } },
  ],
  GUT_HEALTH: [
    // SUPPLEMENT 타입 (displayOrder: 1~3)
    { productId: 4, type: 'SUPPLEMENT', priority: 1, keyword: '장벽 복구', displayOrder: 1, recommendReason: '장벽을 복구해 장누수 증후군을 개선하는 아연, 마그네슘, 비타민D와 유해균이 만드는 독소를 제거하고 장벽 손상을 막는 셀레늄, 망간, 몰리브덴, 크롬이 모두 들어있습니다. 이 성분들을 한 번에 섭취할 때 더 큰 시너지 효과를 만들어낼 수 있습니다.', dosage: '1일 1회, 1회 3정 섭취', mechanisms: [{ name: '아연', summary: '느슨해진 장벽을 강화하는 장누수 회복의 핵심 미네랄', sortOrder: 1, descriptions: ['장벽 세포 간 이음새를 촘촘하게 결합', '유해균 독소나 염증 유발 물질의 혈관 누수 방지'], ingredientKey: 'zinc' }, { name: '마그네슘', summary: '느슨해진 장벽을 강화하는 장누수 회복의 핵심 미네랄', sortOrder: 2, descriptions: ['장 점막 세포의 정상적인 기능과 회복에 도움', '유해균 독소나 염증 유발 물질의 혈관 누수 방지'], ingredientKey: 'magnesium' }, { name: '비타민 D', summary: '장 면역 기능과 장벽 세포 방어 기능의 핵심 비타민', sortOrder: 3, descriptions: ['장 면역 시스템을 조절', '장 상피 세포의 방어벽 기능을 강화', '장내 염증 반응 조절'], ingredientKey: 'vitamin_d' }, { name: '셀레늄', summary: '장 독소 및 염증 유발 물질 제거의 핵심 미네랄', sortOrder: 4, descriptions: ['강력한 항산화 작용으로, 유해균 독소와 장내 염증 감소', '세포 손상을 방지해 장벽 회복 환경 조성'], ingredientKey: 'selenium' }, { name: '몰리브덴', summary: '장 독소 및 염증 유발 물질 제거의 핵심 미네랄', sortOrder: 5, descriptions: ['해독 과정에 관여하여 독소 제거에 도움', '유해균 독소를 중화하고 배출하는 과정에 도움', '장내 염증 부담을 줄여 장벽 회복 환경 조성'], ingredientKey: 'molybdenum' }, { name: '망간', summary: '독소로 인한 활성산소 제거 및 장벽 복구를 보조하는 미네랄', sortOrder: 6, descriptions: ['항산화 효소의 구성 성분으로 독소 제거', '면역 과민 반응으로 발생한 활성산소 제거', '장내 염증 환경 개선으로 면역 안정 지원'], ingredientKey: 'manganese' }, { name: '크롬', summary: '혈당 조절에 관여하여 유해균 먹이(당) 차단에 도움을 주는 미네랄', sortOrder: 7, descriptions: ['인슐린 작용을 도와 안정적 혈당 유지에 도움', '혈당 조절에 관여하여 유해균 먹이(당) 차단에 도움'], ingredientKey: 'chromium' }] },
    { productId: 5, type: 'SUPPLEMENT', priority: 2, keyword: '장 독소 배출', displayOrder: 2, recommendReason: '장내 독소를 직접 흡착 배출하는 클로렐라와 장벽 회복을 돕는 아연, 비타민 A가 들어있습니다. 또한, 비타민 C, E 항산화 성분과 세포 재생을 돕는 비타민 B군(B3, B9)이 독소로 인한 염증을 막고 장-피부 축을 개선하여 시너지 효과를 냅니다.', dosage: '1일 2회, 1회 2정 섭취', mechanisms: [{ name: '클로렐라', summary: '장내 독소와 노폐물을 흡착 배출하는 독소 제거의 핵심 성분', sortOrder: 1, descriptions: ['유해균 독소 및 노폐물에 흡착하여 체외로 배출', '독소로 인한 장내 염증 부담 감소', '장벽 회복 환경 조성'], ingredientKey: 'chlorella' }, { name: '비타민 E', summary: '세포막을 보호하여 독소 제거를 돕는 항산화 물질', sortOrder: 2, descriptions: ['독소로 인한 산화 스트레스로부터 장 점막 세포 손상 방지', '비타민 C와 함께 장내 염증 반응 감소에 기여'], ingredientKey: 'vitamin_e' }, { name: '비타민 A', summary: '손상된 장 점막 재생과 피부 트러블 개선의 핵심 비타민', sortOrder: 3, descriptions: ['손상된 장 점막의 재생과 회복에 직접 도움', '장-피부 축 개선에 기여, 턱 트러블 완화에 도움'], ingredientKey: 'vitamin_a' }, { name: '비타민 C', summary: '독소 제거와 장벽 복구(콜라겐 합성)를 돕는 핵심 비타민', sortOrder: 4, descriptions: ['유해균 독소로 인한 장내 염증 및 산화 스트레스 억제', '장벽 회복에 필수적인 콜라겐 합성 촉진'], ingredientKey: 'vitamin_c' }, { name: '아연', summary: '느슨해진 장벽을 강화하는 장누수 회복의 핵심 미네랄', sortOrder: 5, descriptions: ['장벽 세포 간 이음새를 촘촘하게 결합', '유해균 독소나 염증 유발 물질의 혈관 누수 방지'], ingredientKey: 'zinc' }, { name: '비타민 B9(엽산)', summary: '손상된 장 점막 세포의 신속한 재생을 돕는 핵심 비타민', sortOrder: 6, descriptions: ['새로운 세포 분열과 성장에 필수적', '손상된 장 점막 세포의 신속한 재생에 도움'], ingredientKey: 'vitamin_b9' }, { name: '비타민 B3(나이아신)', summary: '장 점막 세포 회복(장벽 복구)과 에너지 생성의 핵심 비타민', sortOrder: 7, descriptions: ['염증으로 손상된 장 점막 세포의 회복 및 재생에 도움', '장 건강 저하로 인한 에너지 저하 개선에 기여'], ingredientKey: 'vitamin_b3' }] },
    { productId: 1, type: 'SUPPLEMENT', priority: 3, keyword: '유해균 감소', displayOrder: 3, recommendReason: '유해균의 먹이가 되는 식후 혈당 상승을 억제하는 바나바잎추출물과 크롬이 들어있습니다. 또한, 비타민 B군이 탄수화물 대사를 촉진해 유해균 먹이를 차단하고 장벽 회복(B2, B3, B6, B9)과 에너지 생성을 도와 근본적인 장 건강 개선에 시너지 효과를 냅니다.', dosage: '1일 2회, 1회 2정 섭취', mechanisms: [{ name: '바나바잎추출물', summary: '식후 혈당 상승을 억제하는 유해균 먹이 차단의 핵심 성분', sortOrder: 1, descriptions: ['식후 혈당 상승 억제, 혈당 조절에 도움', '유해균의 주된 먹이(당) 공급 차단'], ingredientKey: 'banaba' }, { name: '크롬', summary: '혈당 조절에 관여하여 유해균 먹이(당) 차단에 도움을 주는 물질', sortOrder: 2, descriptions: ['인슐린 작용을 도와 안정적 혈당 유지에 도움', '혈당 조절에 관여하여 유해균 먹이(당) 차단에 도움'], ingredientKey: 'chromium' }, { name: '가르시니아캄보지아추출물', summary: '탄수화물 대사 관리를 도와 유해균 먹이 차단을 보조하는 물질', sortOrder: 3, descriptions: ['탄수화물이 지방으로 합성되는 것 억제에 도움', '혈당 부담을 줄여 유해균 증식 환경 개선에 도움'], ingredientKey: 'garcinia' }, { name: '비타민 B1(티아민)', summary: '탄수화물 대사 촉진으로 유해균 먹이 차단을 돕는 핵심 조효소', sortOrder: 4, descriptions: ['탄수화물 대사 및 에너지 생성의 핵심 조효소', '탄수화물이 유해균 먹이가 아닌 에너지로 전환되도록 도움'], ingredientKey: 'vitamin_b1' }] },
    // DIET 타입 - 저포드맵 (displayOrder: 101~104)
    { productId: 35, type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 101, recommendReason: '소장에서 쉽게 발효되어 가스를 만드는 포드맵(FODMAP) 성분을 최소화했습니다. 식사 후 복부 팽만감을 유발하는 SIBO(소장 내 세균 과다 증식)의 환경적 요인을 조절하여, 장이 편안하게 쉴 수 있는 상태를 만들어줍니다.', dosage: '점심 식사로 섭취', mechanisms: [] },
    { productId: 36, type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 102, recommendReason: '소장에서 쉽게 발효되어 가스를 만드는 포드맵(FODMAP) 성분을 최소화했습니다. 식사 후 복부 팽만감을 유발하는 SIBO(소장 내 세균 과다 증식)의 환경적 요인을 조절하여, 장이 편안하게 쉴 수 있는 상태를 만들어줍니다.', dosage: '점심 식사로 섭취', mechanisms: [] },
    { productId: 37, type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 103, recommendReason: '소장에서 쉽게 발효되어 가스를 만드는 포드맵(FODMAP) 성분을 최소화했습니다. 식사 후 복부 팽만감을 유발하는 SIBO(소장 내 세균 과다 증식)의 환경적 요인을 조절하여, 장이 편안하게 쉴 수 있는 상태를 만들어줍니다.', dosage: '점심 식사로 섭취', mechanisms: [] },
    { productId: 38, type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 104, recommendReason: '소장에서 쉽게 발효되어 가스를 만드는 포드맵(FODMAP) 성분을 최소화했습니다. 식사 후 복부 팽만감을 유발하는 SIBO(소장 내 세균 과다 증식)의 환경적 요인을 조절하여, 장이 편안하게 쉴 수 있는 상태를 만들어줍니다.', dosage: '점심 식사로 섭취', mechanisms: [] },
    // DIET 타입 - 오리지널 (displayOrder: 105~108)
    { productId: 19, type: 'DIET', priority: 2, keyword: '오리지널', displayOrder: 105, recommendReason: '정제된 탄수화물 대신 단백질과 건강한 지방 위주로 구성하여, 장내 유해균이 과도하게 증식할 수 있는 영양 공급을 자연스럽게 조절합니다. 장 점막을 느슨하게 만드는 글루텐을 배제하여 장 건강 회복을 돕습니다.', dosage: '저녁 식사로 섭취', mechanisms: [] },
    { productId: 20, type: 'DIET', priority: 2, keyword: '오리지널', displayOrder: 106, recommendReason: '정제된 탄수화물 대신 단백질과 건강한 지방 위주로 구성하여, 장내 유해균이 과도하게 증식할 수 있는 영양 공급을 자연스럽게 조절합니다. 장 점막을 느슨하게 만드는 글루텐을 배제하여 장 건강 회복을 돕습니다.', dosage: '저녁 식사로 섭취', mechanisms: [] },
    { productId: 21, type: 'DIET', priority: 2, keyword: '오리지널', displayOrder: 107, recommendReason: '정제된 탄수화물 대신 단백질과 건강한 지방 위주로 구성하여, 장내 유해균이 과도하게 증식할 수 있는 영양 공급을 자연스럽게 조절합니다. 장 점막을 느슨하게 만드는 글루텐을 배제하여 장 건강 회복을 돕습니다.', dosage: '저녁 식사로 섭취', mechanisms: [] },
    { productId: 22, type: 'DIET', priority: 2, keyword: '오리지널', displayOrder: 108, recommendReason: '정제된 탄수화물 대신 단백질과 건강한 지방 위주로 구성하여, 장내 유해균이 과도하게 증식할 수 있는 영양 공급을 자연스럽게 조절합니다. 장 점막을 느슨하게 만드는 글루텐을 배제하여 장 건강 회복을 돕습니다.', dosage: '저녁 식사로 섭취', mechanisms: [] },
    // FORMULA 타입 (displayOrder: 109)
    { productId: 50, type: 'FORMULA', priority: null, keyword: '맞춤솔루션', displayOrder: 109, recommendReason: null, dosage: null, mechanisms: { formulaName: '바이오 밸런스 + 클린 밸런스 + 당당케어', formulaDescription: '장벽 복구 → 독소 제거 → 유해균 먹이 차단으로 3단계 선순환 시스템이 작동하여 장누수증후군과 SIBO를 근본적으로 해결합니다.', synergyEffects: [{ title: '장벽 3중 강화 시스템', result: '3단계 방어벽 완성으로 장누수 완화', items: [{ product: '바이오 밸런스', effect: '아연+마그네슘이 밀착연접 단백질 합성' }, { product: '클린 밸런스', effect: '비타민A가 점액층 두껍게 형성' }, { product: '당당케어', effect: '비타민B군이 장 세포 재생 에너지 공급' }] }, { title: '독소 완전 제거 루트', result: '장-피부 축 염증 차단으로 턱 트러블 개선', items: [{ product: '바이오 밸런스', effect: '셀레늄+망간+몰리브덴이 장내 독소 중화' }, { product: '클린 밸런스', effect: '클로렐라가 독소 흡착하여 체외 배출' }, { product: null, effect: '비타민C+E가 혈액 속 염증 물질 제거' }] }, { title: '장내 유해균 이중 억제', result: '복부 팽만과 가스 생성 근본 해결', items: [{ product: '바이오 밸런스', effect: '비타민D가 항균 펩타이드 생성' }, { product: '클린 밸런스', effect: '아연이 유해균 증식 억제' }, { product: '당당케어', effect: '크롬+바나바잎이 혈당 조절로 유해균 먹이 차단' }] }, { title: '세포 재생 가속화', result: '손상된 장 점막 빠른 회복', items: [{ product: '바이오 밸런스', effect: '아연이 DNA 합성 촉진' }, { product: '클린 밸런스', effect: '비타민A+C가 콜라겐 합성 지원' }, { product: '당당케어', effect: '비타민B군(B₂,B₃,B₆,B₉)이 세포 분열 에너지 공급' }] }] } },
  ],
  IMMUNE_BALANCE: [
    // SUPPLEMENT 타입 (displayOrder: 1~3)
    { productId: 9, type: 'SUPPLEMENT', priority: 1, keyword: '면역 과민 개선', displayOrder: 1, recommendReason: '면역 과민반응에 의한 피부상태 개선에 도움을 줄 수 있는 다래추출물이 들어있습니다. 예민해진 면역계의 과민 반응 스위치를 직접 내려주고, 아연이 장벽을 복구하여 면역 반응 안정화의 기반을 마련합니다.', dosage: '1일 2회, 1회 3정 섭취', mechanisms: [{ name: '다래추출물분말', summary: '면역 과민반응을 조절하는 핵심 성분', sortOrder: 1, descriptions: ['면역 균형(Th17/Treg)을 조절하여 과민해진 면역계 안정화'], ingredientKey: 'kiwi' }, { name: '아연', summary: '장벽 복구로 면역 안정화 기반을 마련하는 핵심 미네랄', sortOrder: 2, descriptions: ['장벽 세포 간 이음새를 촘촘하게 결합하여 장누수 개선', 'T세포 기능 정상화로 면역 조절에 도움'], ingredientKey: 'zinc' }] },
    { productId: 4, type: 'SUPPLEMENT', priority: 2, keyword: '장벽 복구', displayOrder: 2, recommendReason: '장벽을 복구하는 아연, 마그네슘, 비타민D와 독소를 제거하는 셀레늄, 망간, 몰리브덴이 모두 들어있습니다. 장 점막 손상으로 과민해진 면역계를 안정화시키고, 독소와 염증 물질을 제거하여 면역 부담을 줄입니다.', dosage: '1일 1회, 1회 3정 섭취', mechanisms: [{ name: '아연', summary: '느슨해진 장벽을 강화하는 장누수 회복의 핵심 미네랄', sortOrder: 1, descriptions: ['장벽 세포 간 이음새를 촘촘하게 결합', '유해균 독소나 염증 유발 물질의 혈관 누수 방지', '면역 시스템의 핵심인 T세포 분화 및 기능 정상화'], ingredientKey: 'zinc' }, { name: '마그네슘', summary: '장벽 복구와 염증 억제로 면역 안정화의 핵심 미네랄', sortOrder: 2, descriptions: ['염증 반응(NF-κB 경로) 억제로 면역계 진정', '장 점막 세포 회복으로 면역 과민 반응의 출발점 차단', '장벽 세포 간 이음새 생성에 필요한 단백질 합성에 도움'], ingredientKey: 'magnesium' }, { name: '비타민 D', summary: '면역 균형 조절 및 장벽 방어 강화의 핵심 비타민', sortOrder: 3, descriptions: ['면역 시스템(Th17/Treg) 균형 조절로 과민 반응 정상화', '장벽 세포 간 이음새를 촘촘하게 결합해 방어벽 기능 강화', '장내 염증 반응 조절로 면역계 안정 환경 조성'], ingredientKey: 'vitamin_d' }, { name: '셀레늄', summary: '독소 제거 및 염증 반응 억제의 핵심 미네랄', sortOrder: 4, descriptions: ['강력한 항산화 효소(GPx) 활성화로 독소 중화', '염증성 사이토카인(IL-6, TNF-α) 억제로 면역 과민 반응 완화', '면역 과민 반응으로 발생한 산화 스트레스 제거'], ingredientKey: 'selenium' }] },
    { productId: 5, type: 'SUPPLEMENT', priority: 3, keyword: '장 독소 배출', displayOrder: 3, recommendReason: '장내 독소를 직접 흡착 배출하는 클로렐라와 피부 장벽을 강화하는 비타민A, 항산화 성분인 비타민C, E, 아연이 들어있습니다. 면역계를 자극하는 독소를 제거하고, 강화된 피부 장벽으로 외부 자극에 대한 방어력을 높입니다.', dosage: '1일 2회, 1회 2정 섭취', mechanisms: [{ name: '클로렐라', summary: '독소 흡착 배출로 면역 부담을 감소시키는 핵심 물질', sortOrder: 1, descriptions: ['면역계를 자극하는 장 독소(LPS)를 흡착하여 체외 배출', '장내 독소 제거로 면역 과민 반응 요인 차단', '장벽 회복 환경 조성으로 면역 안정화에 도움'], ingredientKey: 'chlorella' }, { name: '비타민 E', summary: '세포막 보호 및 염증 매개물질 억제의 핵심 비타민', sortOrder: 2, descriptions: ['산화 스트레스로부터 장 점막 및 피부 세포 보호', '염증 매개물질(프로스타글란딘 E2) 감소로 면역 과민 반응 완화', '비타민C와 함께 항산화 시너지로 면역 부담 감소'], ingredientKey: 'vitamin_e' }, { name: '비타민 A', summary: '피부 장벽 강화로 외부 자극 방어력 증가의 핵심 비타민', sortOrder: 3, descriptions: ['피부 각질 정상화로 외부 자극에 대한 피부 방어력 증가', '장 점막 보호층(뮤신)을 두껍게 형성하는데 도움', '장-피부 축 개선으로 가려움과 붉어짐 완화'], ingredientKey: 'vitamin_a' }] },
    // DIET 타입 - 저포드맵 (displayOrder: 101~104)
    { productId: 35, type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 101, recommendReason: "면역계에 '휴식'을 주는 식단입니다. 소장에서 쉽게 발효되는 포드맵(FODMAP) 성분을 최소화하여 장내 가스 생성과 팽만감을 줄이고, 면역계를 자극하는 장내 환경을 개선합니다.", dosage: '점심 식사로 섭취', mechanisms: [] },
    { productId: 36, type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 102, recommendReason: "면역계에 '휴식'을 주는 식단입니다. 소장에서 쉽게 발효되는 포드맵(FODMAP) 성분을 최소화하여 장내 가스 생성과 팽만감을 줄이고, 면역계를 자극하는 장내 환경을 개선합니다.", dosage: '점심 식사로 섭취', mechanisms: [] },
    { productId: 37, type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 103, recommendReason: "면역계에 '휴식'을 주는 식단입니다. 소장에서 쉽게 발효되는 포드맵(FODMAP) 성분을 최소화하여 장내 가스 생성과 팽만감을 줄이고, 면역계를 자극하는 장내 환경을 개선합니다.", dosage: '점심 식사로 섭취', mechanisms: [] },
    { productId: 38, type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 104, recommendReason: "면역계에 '휴식'을 주는 식단입니다. 소장에서 쉽게 발효되는 포드맵(FODMAP) 성분을 최소화하여 장내 가스 생성과 팽만감을 줄이고, 면역계를 자극하는 장내 환경을 개선합니다.", dosage: '점심 식사로 섭취', mechanisms: [] },
    // DIET 타입 - 저속노화 (displayOrder: 105~108)
    { productId: 27, type: 'DIET', priority: 2, keyword: '저속노화', displayOrder: 105, recommendReason: "방어벽을 '재건'하는 영양소를 공급합니다. 염증 해소에 필요한 오메가-3와 다양한 항산화 성분을 풍부하게 담아, 면역계가 과민하게 반응하는 원인인 만성 염증을 개선합니다.", dosage: '저녁 식사로 섭취', mechanisms: [] },
    { productId: 28, type: 'DIET', priority: 2, keyword: '저속노화', displayOrder: 106, recommendReason: "방어벽을 '재건'하는 영양소를 공급합니다. 염증 해소에 필요한 오메가-3와 다양한 항산화 성분을 풍부하게 담아, 면역계가 과민하게 반응하는 원인인 만성 염증을 개선합니다.", dosage: '저녁 식사로 섭취', mechanisms: [] },
    { productId: 29, type: 'DIET', priority: 2, keyword: '저속노화', displayOrder: 107, recommendReason: "방어벽을 '재건'하는 영양소를 공급합니다. 염증 해소에 필요한 오메가-3와 다양한 항산화 성분을 풍부하게 담아, 면역계가 과민하게 반응하는 원인인 만성 염증을 개선합니다.", dosage: '저녁 식사로 섭취', mechanisms: [] },
    { productId: 30, type: 'DIET', priority: 2, keyword: '저속노화', displayOrder: 108, recommendReason: "방어벽을 '재건'하는 영양소를 공급합니다. 염증 해소에 필요한 오메가-3와 다양한 항산화 성분을 풍부하게 담아, 면역계가 과민하게 반응하는 원인인 만성 염증을 개선합니다.", dosage: '저녁 식사로 섭취', mechanisms: [] },
    // FORMULA 타입 (displayOrder: 109)
    { productId: 51, type: 'FORMULA', priority: null, keyword: '맞춤솔루션', displayOrder: 109, recommendReason: null, dosage: null, mechanisms: { formulaName: '다래케어 + 바이오 밸런스 + 클린 밸런스', formulaDescription: '면역계를 다각도로 안정화합니다. 과민 반응 직접 조절 → 장벽 복구 → 독소 제거로 3단계 시너지가 작동하여 사소한 자극에도 반응하던 면역계가 정상화됩니다.', synergyEffects: [{ title: '면역 이중 안정화 시스템', result: '2단계 면역 조절로 사소한 자극에도 반응하던 면역계 정상화', items: [{ product: '다래케어', effect: '다래추출물이 면역 과민 반응 스위치 직접 OFF' }, { product: '바이오 밸런스', effect: '비타민D가 면역 균형(Th17/Treg) 조절로 근본 정상화' }, { product: null, effect: '아연이 장벽 복구로 면역 과민 상태의 출발점 차단' }] }, { title: '장벽 3중 복구 시스템', result: "장누수 완화로 면역 '전군 비상 경계령' 해제", items: [{ product: '다래케어', effect: '아연 8.5mg이 밀착연접 단백질 합성' }, { product: '바이오 밸런스', effect: '아연 12mg + 마그네슘 315mg이 장벽 세포 간 이음새 촘촘하게 결합' }, { product: '클린 밸런스', effect: '비타민A가 장 점막 보호층(뮤신) 두껍게 형성' }] }, { title: '면역 자극 독소 완전 제거', result: '면역계 부담 직접 감소로 과민 반응 완화', items: [{ product: '바이오 밸런스', effect: '셀레늄+망간+몰리브덴이 장내 독소 중화' }, { product: '클린 밸런스', effect: '클로렐라가 면역 자극 내독소(LPS) 흡착하여 체외 배출' }, { product: null, effect: '비타민C+E가 항산화로 염증 물질 제거' }] }, { title: '피부 장벽 강화로 자극 방어', result: '외부 자극에도 쉽게 흔들리지 않는 탄탄한 방어막 형성', items: [{ product: '클린 밸런스', effect: '비타민A가 피부 각질 정상화로 외부 자극 방어력 증가' }, { product: null, effect: '아연이 피부 재생 촉진으로 자극 내성 증가' }, { product: '클린 밸런스', effect: '비타민C+E가 피부 세포 보호 및 염증 완화' }] }] } },
  ],
};

// ============================================================
// 시딩 함수들
// ============================================================

async function seedProductLineups() {
  console.log('\n📌 1. ProductLineup 시딩 중...');
  const now = getNowKST();

  for (const lineup of PRODUCT_LINEUPS) {
    await prisma.productLineup.upsert({
      where: { key: lineup.key },
      update: {
        name: lineup.name,
        description: lineup.description,
        imageUrl: lineup.imageUrl,
        sortOrder: lineup.sortOrder,
        isActive: true,
        updatedAt: now,
      },
      create: {
        key: lineup.key,
        name: lineup.name,
        description: lineup.description,
        imageUrl: lineup.imageUrl,
        sortOrder: lineup.sortOrder,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    console.log(`  ✅ ProductLineup: ${lineup.key} (${lineup.name})`);
  }

  console.log(`✅ ProductLineup ${PRODUCT_LINEUPS.length}개 시딩 완료`);
}

async function seedHealthTypeAnimals() {
  console.log('\n📌 2. HealthTypeAnimal 시딩 중...');
  const now = getNowKST();

  for (const animal of HEALTH_TYPE_ANIMALS) {
    await prisma.healthTypeAnimal.upsert({
      where: { healthType: animal.healthType },
      update: {
        typeName: animal.typeName,
        animalName: animal.animalName,
        catchphrase: animal.catchphrase,
        symptoms: animal.symptoms,
        description: animal.description,
        solution: animal.solution,
        metadata: animal.metadata,
        isActive: true,
        updatedAt: now,
      },
      create: {
        healthType: animal.healthType,
        typeName: animal.typeName,
        animalName: animal.animalName,
        catchphrase: animal.catchphrase,
        symptoms: animal.symptoms,
        description: animal.description,
        solution: animal.solution,
        metadata: animal.metadata,
        isActive: true,
        createdAt: now,
      },
    });
    console.log(`  ✅ HealthTypeAnimal: ${animal.healthType} (${animal.animalName})`);
  }

  console.log(`✅ HealthTypeAnimal ${HEALTH_TYPE_ANIMALS.length}개 시딩 완료`);
}

async function seedHealthTypeAnimalProducts() {
  console.log('\n📌 3. HealthTypeAnimalProduct 시딩 중...');
  const now = getNowKST();

  // 기존 데이터 삭제
  await prisma.healthTypeAnimalProduct.deleteMany({});
  console.log('  ⚠️ 기존 HealthTypeAnimalProduct 데이터 삭제');

  let totalCount = 0;

  for (const [healthType, products] of Object.entries(HEALTH_TYPE_ANIMAL_PRODUCTS)) {
    const healthTypeAnimal = await prisma.healthTypeAnimal.findFirst({
      where: { healthType },
    });

    if (!healthTypeAnimal) {
      console.error(`  ❌ HealthTypeAnimal not found: ${healthType}`);
      continue;
    }

    for (const product of products) {
      const productExists = await prisma.product.findUnique({
        where: { id: product.productId },
      });

      if (!productExists) {
        console.error(`  ❌ Product not found: ${product.productId}`);
        continue;
      }

      await prisma.healthTypeAnimalProduct.create({
        data: {
          healthTypeAnimalId: healthTypeAnimal.id,
          productId: product.productId,
          type: product.type,
          priority: product.priority,
          keyword: product.keyword,
          recommendReason: product.recommendReason,
          dosage: product.dosage,
          displayOrder: product.displayOrder,
          mechanisms: JSON.parse(JSON.stringify(product.mechanisms)),
          isActive: true,
          createdAt: now,
        },
      });
      totalCount++;
    }
    console.log(`  ✅ ${healthType}: ${products.length}개 상품 매핑`);
  }

  console.log(`✅ HealthTypeAnimalProduct ${totalCount}개 시딩 완료`);
}

async function main() {
  console.log('🚀 맞춤솔루션 시드 시작...\n');

  try {
    await seedProductLineups();
    await seedHealthTypeAnimals();
    await seedHealthTypeAnimalProducts();

    console.log('\n🎉 모든 맞춤솔루션 시드 완료!');

    // 결과 요약
    console.log('\n📊 시딩 결과 요약:');
    const lineupCount = await prisma.productLineup.count();
    const animalCount = await prisma.healthTypeAnimal.count();
    const productMappingCount = await prisma.healthTypeAnimalProduct.count();

    console.log(`  - ProductLineup: ${lineupCount}개`);
    console.log(`  - HealthTypeAnimal: ${animalCount}개`);
    console.log(`  - HealthTypeAnimalProduct: ${productMappingCount}개`);

  } catch (error) {
    console.error('❌ 시드 실행 중 오류:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ 에러 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
