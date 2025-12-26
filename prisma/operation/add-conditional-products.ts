import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 메타드림 mechanisms 데이터 (문서 기반)
const metaDreamMechanisms = [
  // 1단계: 입면 준비
  {
    name: 'GABA',
    summary: '뇌의 흥분을 억제하는 신경 전달 물질',
    sortOrder: 1,
    descriptions: [
      '억제성 신호로 잠들기 전 복잡한 생각과 불안감을 진정',
      '수면을 방해하는 뇌의 과활성 상태 안정화'
    ],
    ingredientKey: 'gaba'
  },
  {
    name: '레몬밤\n추출분말',
    summary: 'GABA 분해를 막아 진정 효과를 지속시키는 식물성 원료',
    sortOrder: 2,
    descriptions: [
      '로즈마린산 성분이 체내 GABA 분해 효소(GABA-T) 활성을 억제',
      '심리적 안정감을 수면 내내 유지하여 편안한 상태 유도'
    ],
    ingredientKey: 'lemon_balm'
  },
  {
    name: '마그네슘',
    summary: '신경과 근육의 긴장을 풀어주는 핵심 미네랄',
    sortOrder: 3,
    descriptions: [
      '뇌의 각성 스위치인 NMDA 수용체의 활성을 억제',
      '경직된 근육을 이완하여 편안한 신체 수면 환경 조성'
    ],
    ingredientKey: 'magnesium'
  },
  {
    name: 'L-테아닌',
    summary: '뇌파를 안정시켜 편안함을 유도하는 아미노산',
    sortOrder: 4,
    descriptions: [
      '안정될 때의 뇌파인 알파파 발생을 유도하여 긴장 완화',
      '스트레스로 인한 흥분을 가라앉히고 입면 최적화'
    ],
    ingredientKey: 'l_theanine'
  },
  // 2단계: 생체 리듬 회복
  {
    name: '멜라토닌',
    summary: '생체 리듬을 관장하는 핵심 수면 호르몬',
    sortOrder: 5,
    descriptions: [
      "밤과 낮을 구별해 자연스러운 '수면 스위치' 작동",
      '수면 중 항산화 작용으로 뇌세포 회복 및 노폐물 청소에 도움'
    ],
    ingredientKey: 'melatonin'
  },
  {
    name: 'L-트립토판',
    summary: '수면 호르몬(멜라토닌)의 재료가 되는 아미노산',
    sortOrder: 6,
    descriptions: [
      '체내에서 행복 호르몬(세로토닌)과 수면 호르몬(멜라토닌)으로 전환',
      '깊은 잠을 잘 수 있도록 수면-각성 리듬 조절에 기여'
    ],
    ingredientKey: 'l_tryptophan'
  },
  {
    name: '비타민 B6',
    summary: '멜라토닌 생성을 돕는 필수 조효소 비타민',
    sortOrder: 7,
    descriptions: [
      '트립토판이 멜라토닌으로 전환되는 대사 과정의 필수 촉매제',
      '신경계를 안정시켜 예민함을 줄이고 수면 환경 조성'
    ],
    ingredientKey: 'vitamin_b6'
  },
  {
    name: '비타민 B12',
    summary: '신경 세포 기능 유지와 리듬을 조절하는 비타민',
    sortOrder: 8,
    descriptions: [
      '수면 리듬을 관장하는 생체 시계의 정상적인 작동 지원',
      '신경 과민을 방지하고 정서적 안정감 유지'
    ],
    ingredientKey: 'vitamin_b12'
  },
  // 3단계: 숙면 지속
  {
    name: '글리신',
    summary: '심부 체온을 낮춰 깊은 잠을 지속시키는 아미노산',
    sortOrder: 9,
    descriptions: [
      '수면 중 체온을 낮게 유지하여 뇌가 깸 없이 휴식하도록 유도',
      '수면 단계를 안정적으로 유지하여 수면 도중 각성 방지'
    ],
    ingredientKey: 'glycine'
  },
  {
    name: 'L-글루타민',
    summary: '장과 뇌의 회복을 돕는 아미노산',
    sortOrder: 10,
    descriptions: [
      '수면 중 뇌의 에너지원을 공급하고 신경 안정을 지원',
      '스트레스로 예민해진 장-뇌 축(Gut-Brain Axis) 안정화'
    ],
    ingredientKey: 'l_glutamine'
  },
  {
    name: '흑하랑상추\n추출분말',
    summary: '숙면을 돕는 락투신 성분이 풍부한 천연 소재',
    sortOrder: 11,
    descriptions: [
      '일반 상추 대비 124배 많은 락투신이 신경 진정 작용',
      '긴장을 풀고 자연스러운 졸음을 유도하는 데 도움'
    ],
    ingredientKey: 'black_lettuce'
  },
  {
    name: '감태\n추출물',
    summary: '깊은 잠을 유도하는 해양 유래 성분',
    sortOrder: 12,
    descriptions: [
      '해양 폴리페놀인 플로로탄닌이 입면 후 각성 현상 억제',
      '자고 일어나서도 개운함을 느낄 수 있도록 수면의 질 개선'
    ],
    ingredientKey: 'ecklonia_cava'
  }
];

// 리셋데이 mechanisms 데이터 (문서 기반)
const resetDayMechanisms = [
  {
    name: '글루텐\n분해 효소',
    summary: '글루텐 결합을 끊어 소화 부담을 줄이는 효소',
    sortOrder: 1,
    descriptions: [
      '소화되지 않은 단백질 찌꺼기가 장벽을 자극해 생기는 염증 억제',
      '체내에 독소가 쌓이는 것을 막아 근본적인 피부 트러블 원인 차단'
    ],
    ingredientKey: 'gluten_enzyme'
  },
  {
    name: '낙산균',
    summary: '장벽을 복구해 독소 유입을 막는 유익균',
    sortOrder: 2,
    descriptions: [
      "장 점막 세포의 에너지원이 되어 '새는 장(Leaky Gut)' 현상 방어",
      '장내 유해 물질이 혈관을 타고 피부로 번지는 것을 1차적으로 봉쇄'
    ],
    ingredientKey: 'butyric_acid_bacteria'
  },
  {
    name: '알파 CD',
    summary: '가공식품의 나쁜 기름과 노폐물을 흡착하는 식이섬유',
    sortOrder: 3,
    descriptions: [
      '소화기 내 지방 성분과 찌꺼기를 감싸서 배출',
      '혈중으로 흡수되는 나쁜 지방을 줄여 피부 유분 밸런스 유지 도움'
    ],
    ingredientKey: 'alpha_cd'
  },
  {
    name: '난소화성\n말토덱스트린',
    summary: '식후 혈당 상승을 방지해 피부 자극을 줄이는 수용성 식이섬유',
    sortOrder: 4,
    descriptions: [
      '밀가루 섭취 후 급격한 혈당 상승(스파이크)을 억제',
      '인슐린 과다 분비로 인한 피지 과다 및 염증성 피부 반응 감소'
    ],
    ingredientKey: 'resistant_maltodextrin'
  },
  {
    name: '차전자피\n분말',
    summary: '독소와 묵은 변을 빠르게 배출하는 식이섬유',
    sortOrder: 5,
    descriptions: [
      '수분을 흡수해 팽창하며 장내 틈새에 낀 노폐물까지 흡착해 배설',
      '장내 부패 독소가 재흡수되어 피부로 올라오지 않도록 신속히 제거'
    ],
    ingredientKey: 'psyllium_husk'
  }
];

async function addConditionalProducts() {
  console.log('조건부 추천 제품 추가 시작...\n');

  // 1. 메타드림, 리셋데이 productId 확인
  const metaDream = await prisma.product.findFirst({
    where: { name: '메타드림' }
  });
  const resetDay = await prisma.product.findFirst({
    where: { name: '리셋데이' }
  });

  if (!metaDream) {
    console.log('❌ 메타드림 제품을 찾을 수 없습니다.');
    return;
  }
  if (!resetDay) {
    console.log('❌ 리셋데이 제품을 찾을 수 없습니다.');
    return;
  }

  console.log('메타드림 productId:', metaDream.id);
  console.log('리셋데이 productId:', resetDay.id);

  // 2. 모든 동물 유형 조회
  const animals = await prisma.healthTypeAnimal.findMany();
  console.log('\n동물 유형 수:', animals.length);

  // 3. 각 동물 유형에 메타드림/리셋데이 추가 (type: CONDITIONAL)
  for (const animal of animals) {
    // 메타드림 추가
    const existingMetaDream = await prisma.healthTypeAnimalProduct.findFirst({
      where: {
        healthTypeAnimalId: animal.id,
        productId: metaDream.id
      }
    });

    if (!existingMetaDream) {
      await prisma.healthTypeAnimalProduct.create({
        data: {
          healthTypeAnimalId: animal.id,
          productId: metaDream.id,
          type: 'CONDITIONAL',
          displayOrder: 201,  // CONDITIONAL은 200번대
          priority: 1,
          isActive: true,
          keyword: '수면 개선',
          recommendReason: "수면 문진 결과, 입면의 어려움뿐만 아니라 수면 도중 깨거나 깊게 잠들지 못하는 문제가 확인됩니다. 메타드림은 1단계(입면 준비), 2단계(생체 리듬 회복), 그리고 3단계(숙면 지속)의 체계적인 3-Step 설계를 따릅니다.",
          dosage: '1일 1회, 1회 1포 섭취',
          mechanisms: metaDreamMechanisms
        }
      });
      console.log(`✅ ${animal.animalName}에 메타드림 추가 완료`);
    } else {
      // 이미 존재하면 mechanisms만 업데이트
      await prisma.healthTypeAnimalProduct.update({
        where: { id: existingMetaDream.id },
        data: { mechanisms: metaDreamMechanisms }
      });
      console.log(`🔄 ${animal.animalName}의 메타드림 mechanisms 업데이트 완료`);
    }

    // 리셋데이 추가
    const existingResetDay = await prisma.healthTypeAnimalProduct.findFirst({
      where: {
        healthTypeAnimalId: animal.id,
        productId: resetDay.id
      }
    });

    if (!existingResetDay) {
      await prisma.healthTypeAnimalProduct.create({
        data: {
          healthTypeAnimalId: animal.id,
          productId: resetDay.id,
          type: 'CONDITIONAL',
          displayOrder: 202,  // CONDITIONAL은 200번대
          priority: 2,
          isActive: true,
          keyword: '글루텐 과민 개선',
          recommendReason: '음식물 과민증 검사에서 글루텐에 높은 반응(4~5단계)을 보이고 있습니다. 밀가루는 장벽을 허물고 염증을 일으키는 강력한 공격 인자가 됩니다. 글루텐 분해 효소로 공격 인자를 제거하고, 낙산균으로 장 점막을 방어하여 장이 받는 충격을 최소화해야 합니다.',
          dosage: '1일 1회, 1회 1포 섭취',
          mechanisms: resetDayMechanisms
        }
      });
      console.log(`✅ ${animal.animalName}에 리셋데이 추가 완료`);
    } else {
      // 이미 존재하면 mechanisms만 업데이트
      await prisma.healthTypeAnimalProduct.update({
        where: { id: existingResetDay.id },
        data: { mechanisms: resetDayMechanisms }
      });
      console.log(`🔄 ${animal.animalName}의 리셋데이 mechanisms 업데이트 완료`);
    }
  }

  console.log('\n✅ 조건부 추천 제품 추가 완료');
}

addConditionalProducts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
