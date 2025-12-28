import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 예민한 고슴도치 - 바이오 밸런스 mechanisms (7개)
const hedgehogBioBalanceMechanisms = [
  {
    name: '아연',
    summary: '느슨해진 장벽을 강화하는 장누수 회복의 핵심 미네랄',
    descriptions: [
      '장벽 세포 간 이음새를 촘촘하게 결합',
      '유해균 독소나 염증 유발 물질의 혈관 누수 방지',
      '면역 시스템의 핵심인 T세포 분화 및 기능 정상화',
    ],
    ingredientKey: 'zinc',
    sortOrder: 1,
  },
  {
    name: '마그네슘',
    summary: '장벽 복구와 염증 억제로 면역 안정화의 핵심 미네랄',
    descriptions: [
      '염증 반응(NF-κB 경로) 억제로 면역계 진정',
      '장 점막 세포 회복으로 면역 과민 반응의 출발점 차단',
      '장벽 세포 간 이음새 생성에 필요한 단백질 합성에 도움',
    ],
    ingredientKey: 'magnesium',
    sortOrder: 2,
  },
  {
    name: '비타민 D',
    summary: '면역 균형 조절 및 장벽 방어 강화의 핵심 비타민',
    descriptions: [
      '면역 시스템(Th17/Treg) 균형 조절로 과민 반응 정상화',
      '장벽 세포 간 이음새를 촘촘하게 결합해 방어벽 기능 강화',
      '장내 염증 반응 조절로 면역계 안정 환경 조성',
    ],
    ingredientKey: 'vitaminD',
    sortOrder: 3,
  },
  {
    name: '셀레늄',
    summary: '독소 제거 및 염증 반응 억제의 핵심 미네랄',
    descriptions: [
      '강력한 항산화 효소(GPx) 활성화로 독소 중화',
      '염증성 사이토카인(IL-6, TNF-α) 억제로 면역 과민 반응 완화',
      '면역 과민 반응으로 발생한 산화 스트레스 제거',
    ],
    ingredientKey: 'selenium',
    sortOrder: 4,
  },
  {
    name: '몰리브덴',
    summary: '독소 해독으로 면역 부담 감소의 핵심 미네랄',
    descriptions: [
      '해독 효소 활성화로 면역 자극 독소 제거',
      '장내 유해균 독소 중화 및 배출',
      '장내 염증 부담 감소로 면역계 안정화',
    ],
    ingredientKey: 'molybdenum',
    sortOrder: 5,
  },
  {
    name: '망간',
    summary: '독소로 인한 활성산소 제거 및 장벽 복구를 보조하는 미네랄',
    descriptions: [
      '항산화 효소의 구성 성분으로 독소 제거',
      '면역 과민 반응으로 발생한 활성산소 제거',
      '장내 염증 환경 개선으로 면역 안정 지원',
    ],
    ingredientKey: 'manganese',
    sortOrder: 6,
  },
  {
    name: '크롬',
    summary: '혈당 조절에 관여하여 염증 물질 억제의 핵심 미네랄',
    descriptions: [
      '인슐린 작용을 도와 안정적 혈당 유지에 도움',
      '혈당 스파이크 방지로 염증 물질(AGEs) 생성 억제',
      '당화 스트레스 감소로 면역 부담 완화',
    ],
    ingredientKey: 'chromium',
    sortOrder: 7,
  },
];

// 예민한 고슴도치 - 클린 밸런스 mechanisms (7개)
const hedgehogCleanBalanceMechanisms = [
  {
    name: '클로렐라',
    summary: '독소 흡착 배출로 면역 부담을 감소시키는 핵심 물질',
    descriptions: [
      '면역계를 자극하는 장 독소(LPS)를 흡착하여 체외 배출',
      '장내 독소 제거로 면역 과민 반응 요인 차단',
      '장벽 회복 환경 조성으로 면역 안정화에 도움',
    ],
    ingredientKey: 'chlorella',
    sortOrder: 1,
  },
  {
    name: '비타민 E',
    summary: '세포막 보호 및 염증 매개물질 억제의 핵심 비타민',
    descriptions: [
      '산화 스트레스로부터 장 점막 및 피부 세포 보호',
      '염증 매개물질(프로스타글란딘 E2) 감소로 면역 과민 반응 완화',
      '비타민C와 함께 항산화 시너지로 면역 부담 감소',
    ],
    ingredientKey: 'vitaminE',
    sortOrder: 2,
  },
  {
    name: '비타민 A',
    summary: '피부 장벽 강화로 외부 자극 방어력 증가의 핵심 비타민',
    descriptions: [
      '피부 각질 정상화로 외부 자극에 대한 피부 방어력 증가',
      '장 점막 보호층(뮤신)을 두껍게 형성하는데 도움',
      '장-피부 축 개선으로 가려움과 붉어짐 완화',
    ],
    ingredientKey: 'vitaminA',
    sortOrder: 3,
  },
  {
    name: '비타민 C',
    summary: '독소 제거와 항산화로 면역 부담 감소의 핵심 비타민',
    descriptions: [
      '강력한 항산화로 염증 및 산화 스트레스 억제',
      '독소로 인한 장내 염증 억제',
      '면역 세포 기능 정상화에 도움',
    ],
    ingredientKey: 'vitaminC',
    sortOrder: 4,
  },
  {
    name: '아연',
    summary: '피부 재생 및 장벽 복구의 핵심 미네랄',
    descriptions: [
      '피부 재생 촉진으로 자극에 대한 방어력 증가',
      '장벽 세포 간 이음새 강화로 면역 안정화 기반 마련',
      '면역 세포 기능 정상화',
    ],
    ingredientKey: 'zinc',
    sortOrder: 5,
  },
  {
    name: '비타민 B9(엽산)',
    summary: '장 점막 세포 재생으로 면역 안정화 지원의 핵심 비타민',
    descriptions: [
      '장 점막 세포의 DNA 합성에 도움',
      '손상된 장벽의 신속한 재생으로 면역 안정화 기반 마련',
    ],
    ingredientKey: 'vitaminB9',
    sortOrder: 6,
  },
  {
    name: '비타민 B3(나이아신)',
    summary: '장 점막 회복 및 염증 억제의 핵심 비타민',
    descriptions: [
      '손상된 장 점막 세포의 회복 및 재생',
      '세포 에너지 대사 활성화',
      '염증 억제(COX-2 발현 감소)로 면역 과민 반응 완화',
    ],
    ingredientKey: 'vitaminB3',
    sortOrder: 7,
  },
];

// 배 빵빵 펭귄 - 당당케어 mechanisms (13개)
const penguinDangdangMechanisms = [
  {
    name: '바나바잎추출물',
    summary: '식후 혈당 상승을 억제하는 유해균 먹이 차단의 핵심 성분',
    descriptions: [
      '식후 혈당 상승 억제, 혈당 조절에 도움',
      '유해균의 주된 먹이(당) 공급 차단',
    ],
    ingredientKey: 'banaba',
    sortOrder: 1,
  },
  {
    name: '크롬',
    summary: '혈당 조절에 관여하여 유해균 먹이(당) 차단에 도움을 주는 물질',
    descriptions: [
      '인슐린 작용을 도와 안정적 혈당 유지에 도움',
      '혈당 조절에 관여하여 유해균 먹이(당) 차단에 도움',
    ],
    ingredientKey: 'chromium',
    sortOrder: 2,
  },
  {
    name: '가르시니아캄보지아추출물',
    summary: '탄수화물 대사 관리를 도와 유해균 먹이 차단을 보조하는 물질',
    descriptions: [
      '탄수화물이 지방으로 합성되는 것 억제에 도움',
      '혈당 부담을 줄여 유해균 증식 환경 개선(유해균 먹이 차단)에 도움',
    ],
    ingredientKey: 'garcinia',
    sortOrder: 3,
  },
  {
    name: '비타민 B1(티아민)',
    summary: '탄수화물 대사 촉진으로 유해균 먹이 차단을 돕는 핵심 조효소',
    descriptions: [
      '탄수화물 대사 및 에너지 생성의 핵심 조효소',
      '탄수화물이 유해균 먹이가 아닌 에너지로 전환(유해균 먹이 차단)되도록 도움',
    ],
    ingredientKey: 'vitaminB1',
    sortOrder: 4,
  },
  {
    name: '콜레우스포스콜리추출물(포스콜린)',
    summary: '신진대사 촉진으로 혈당 조절 및 에너지 생성을 보조하는 물질',
    descriptions: [
      '신진대사 촉진으로 전반적인 대사 건강 개선에 도움',
      '혈당 조절(유해균 먹이 차단) 및 에너지 저하 개선에 간접 기여',
    ],
    ingredientKey: 'forskolin',
    sortOrder: 5,
  },
  {
    name: '비타민 B2(리보플라빈)',
    summary: '장 점막 재생(장벽 복구) 및 에너지 대사를 돕는 물질',
    descriptions: [
      '에너지 대사 활성화로 에너지 저하 개선에 도움',
      '손상된 장 점막 세포의 재생 과정에 도움',
    ],
    ingredientKey: 'vitaminB2',
    sortOrder: 6,
  },
  {
    name: '비타민 B3(나이아신)',
    summary: '장 점막 세포 회복(장벽 복구)과 에너지 생성을 돕는 물질',
    descriptions: [
      '염증으로 손상된 장 점막 세포의 회복 및 재생에 도움',
      '장 건강 저하로 인한 에너지 저하 개선에 기여',
    ],
    ingredientKey: 'vitaminB3',
    sortOrder: 7,
  },
  {
    name: '비타민 B5(판토텐산)',
    summary: '에너지 대사 효율을 높여 에너지 저하 개선을 돕는 물질',
    descriptions: [
      '탄단지 대사 및 에너지 생성에 관여',
      '에너지 생성 효율을 높여 에너지 저하 개선에 기여',
    ],
    ingredientKey: 'vitaminB5',
    sortOrder: 8,
  },
  {
    name: '비타민 B6(피리독신)',
    summary: '장 점막 세포 재생 및 에너지 대사를 돕는 물질',
    descriptions: [
      '단백질 대사의 조효소로, 장 점막 세포 재료 공급에 도움',
      '에너지 대사에 관여하여 에너지 저하 개선에 도움',
    ],
    ingredientKey: 'vitaminB6',
    sortOrder: 9,
  },
  {
    name: '비타민 B7(비오틴)',
    summary: '장-피부 축 개선 및 에너지 대사를 돕는 물질',
    descriptions: [
      '피부 건강 유지에 기여',
      '장-피부 축 문제(턱 트러블) 개선에 도움',
      '에너지 대사를 지원하여 에너지 저하 개선에 도움',
    ],
    ingredientKey: 'vitaminB7',
    sortOrder: 10,
  },
  {
    name: '비타민 B9(엽산)',
    summary: '손상된 장 점막 세포의 신속한 재생을 돕는 핵심 물질',
    descriptions: [
      '새로운 세포 분열과 성장에 필수적',
      '손상된 장 점막 세포의 신속한 재생 지원',
    ],
    ingredientKey: 'vitaminB9',
    sortOrder: 11,
  },
  {
    name: '비타민 B12(코발라민)',
    summary: '장 점막 세포 재생 및 에너지 저하 개선을 돕는 물질',
    descriptions: [
      '에너지 저하 증상 개선에 기여',
      '손상된 장 점막 세포 재생 및 신경 세포 기능 유지에 도움',
    ],
    ingredientKey: 'vitaminB12',
    sortOrder: 12,
  },
  {
    name: '비타민 C',
    summary: '독소 제거 및 장벽 복구(콜라겐 합성)를 돕는 핵심 비타민',
    descriptions: [
      '유해균 독소로 인한 장내 염증 및 산화 스트레스 억제',
      '장벽 회복에 필수적인 콜라겐 합성 촉진',
    ],
    ingredientKey: 'vitaminC',
    sortOrder: 13,
  },
];

// 동면 중인 북극곰 - 당당케어 mechanisms (13개)
const bearDangdangMechanisms = [
  {
    name: '바나바잎추출물\n(코로솔산)',
    summary: '식후 혈당 상승 억제를 위한 핵심 기능성 성분',
    descriptions: [
      '식후 혈당 상승 억제에 필수인 포도당 수송체(GLUT4) 증가',
      '알파-글루코시다제 억제로 포도당 신생 속도 감소',
    ],
    ingredientKey: 'banaba',
    sortOrder: 1,
  },
  {
    name: '크롬',
    summary: '인슐린 저항성 개선의 핵심 물질',
    descriptions: [
      '인슐린 수용체 감수성 증가로 세포 내 포도당 흡수 촉진',
      '바나바잎추출물과 함께 상승 효과',
    ],
    ingredientKey: 'chromium',
    sortOrder: 2,
  },
  {
    name: 'HCA\n(가르시니아캄보지아추출물)',
    summary: '지방 합성 억제 및 식욕 조절을 위한 핵심 기능성 성분',
    descriptions: [
      'HCA가 지방 합성 효소(ATP citrate lyase) 억제',
      '과잉 탄수화물이 지방으로 전환되는 과정 차단',
      '세로토닌 증가로 식욕 및 탄수화물 갈망 감소에 도움',
    ],
    ingredientKey: 'hca',
    sortOrder: 3,
  },
  {
    name: '포스콜린\n(콜레우스포스콜리추출물)',
    summary: '지방 분해 촉진 및 대사율 증가를 위한 핵심 기능성 성분',
    descriptions: [
      '세포 내 cAMP 수치 증가로 지방 분해 효소 활성화',
      '피하지방과 내장지방을 에너지로 전환하는데 도움',
    ],
    ingredientKey: 'forskolin',
    sortOrder: 4,
  },
  {
    name: '비타민 B1(티아민)',
    summary: '탄수화물 대사의 핵심 비타민',
    descriptions: [
      '탄수화물 대사의 첫 단계 효소 활성화',
      '포도당(혈당)을 아세틸CoA로 전환하여 에너지 생산에 도움',
    ],
    ingredientKey: 'vitaminB1',
    sortOrder: 5,
  },
  {
    name: '비타민 B2(리보플라빈)',
    summary: '탄수화물과 지방 대사의 핵심 비타민',
    descriptions: [
      '지방산 대사 첫 단계 효소의 구성 성분',
      '미토콘드리아 에너지 생산 촉진으로 대사 속도 증가',
    ],
    ingredientKey: 'vitaminB2',
    sortOrder: 6,
  },
  {
    name: '비타민 B3(나이아신)',
    summary: '인슐린 저항성 개선 및 에너지 대사의 핵심 비타민',
    descriptions: [
      'NAD+ 보조효소 생성으로 에너지 대사 촉진',
      '지방산과 콜레스테롤 대사 개선에 도움',
      '인슐린 감수성 증가와 혈당 조절 능력 향상에 도움',
    ],
    ingredientKey: 'vitaminB3',
    sortOrder: 7,
  },
  {
    name: '비타민 B5(판토텐산)',
    summary: '탄단지 대사의 핵심 비타민',
    descriptions: [
      '탄단지 대사에 필수인 코엔자임A 합성의 필수 성분',
      '지방산 분해 과정의 필수 재료',
      '부신 호르몬 합성으로 스트레스성 혈당 상승 조절',
    ],
    ingredientKey: 'vitaminB5',
    sortOrder: 8,
  },
  {
    name: '비타민 B6(피리독신)',
    summary: '단백질 및 탄수화물 대사의 핵심 비타민',
    descriptions: [
      '근육 합성을 위한 단백질 대사 효소 활성화',
      '운동, 공복 시 글리코겐 분해 효소 활성화로 에너지 생성에 도움',
      '신경전달물질 합성으로 식욕 조절에 도움',
    ],
    ingredientKey: 'vitaminB6',
    sortOrder: 9,
  },
  {
    name: '비타민 B7(비오틴)',
    summary: '탄단지 대사의 핵심 비타민',
    descriptions: [
      '탄단지 대사 효소(카르복실화) 활성화로 대사 속도 증가',
      '탄수화물 대사 효소(글루코키나제) 활성화로 혈당 스파이크 방지',
      '단백질 대사를 촉진하여 근육 합성 및 모발/피부 구조 강화',
    ],
    ingredientKey: 'vitaminB7',
    sortOrder: 10,
  },
  {
    name: '비타민 B9(엽산)',
    summary: '세포 재생 및 혈관 건강을 위한 핵심 비타민',
    descriptions: [
      'DNA 합성에 필수로 작용하여 노화된 세포 재생',
      '혈관 독소인 호모시스테인 제거',
      '만성 염증 감소로 인슐린 저항성 개선에 도움',
    ],
    ingredientKey: 'vitaminB9',
    sortOrder: 11,
  },
  {
    name: '비타민 B12(코발라민)',
    summary: '지방 대사 촉진 및 신경 기능 유지를 위한 핵심 비타민',
    descriptions: [
      '지방산 대사 과정의 필수 조효소',
      '신경전달물질 대사 개선을 통해 식욕 조절에 도움',
      '혈관 독소인 호모시스테인 제거',
    ],
    ingredientKey: 'vitaminB12',
    sortOrder: 12,
  },
  {
    name: '비타민 C',
    summary: '항산화 작용을 통한 인슐린 저항성 개선의 핵심 비타민',
    descriptions: [
      '산화 스트레스로 망가진 인슐린 수용체 보호',
      '혈관과 피부 조직의 산화를 막아 탄력 유지에 도움',
      '스트레스 호르몬(코르티솔)에 의한 혈당 상승 조절',
    ],
    ingredientKey: 'vitaminC',
    sortOrder: 13,
  },
];

async function main() {
  console.log('==========================================');
  console.log('SUPPLEMENT mechanisms 데이터 업데이트');
  console.log('==========================================\n');

  // 1. 예민한 고슴도치 - 바이오 밸런스 (healthTypeAnimalId: 4, productId: 4)
  console.log('1. 예민한 고슴도치 - 바이오 밸런스 업데이트...');
  const hedgehogBio = await prisma.healthTypeAnimalProduct.findFirst({
    where: {
      healthTypeAnimalId: 4,
      productId: 4,
      type: 'SUPPLEMENT',
    },
  });

  if (hedgehogBio) {
    await prisma.healthTypeAnimalProduct.update({
      where: { id: hedgehogBio.id },
      data: { mechanisms: hedgehogBioBalanceMechanisms },
    });
    console.log(`  ✅ ID:${hedgehogBio.id} 업데이트 완료 (4개 → 7개)`);
  } else {
    console.log('  ❌ 레코드를 찾을 수 없습니다.');
  }

  // 2. 예민한 고슴도치 - 클린 밸런스 (healthTypeAnimalId: 4, productId: 5)
  console.log('\n2. 예민한 고슴도치 - 클린 밸런스 업데이트...');
  const hedgehogClean = await prisma.healthTypeAnimalProduct.findFirst({
    where: {
      healthTypeAnimalId: 4,
      productId: 5,
      type: 'SUPPLEMENT',
    },
  });

  if (hedgehogClean) {
    await prisma.healthTypeAnimalProduct.update({
      where: { id: hedgehogClean.id },
      data: { mechanisms: hedgehogCleanBalanceMechanisms },
    });
    console.log(`  ✅ ID:${hedgehogClean.id} 업데이트 완료 (3개 → 7개)`);
  } else {
    console.log('  ❌ 레코드를 찾을 수 없습니다.');
  }

  // 3. 배 빵빵 펭귄 - 당당케어 (healthTypeAnimalId: 3, productId: 1)
  console.log('\n3. 배 빵빵 펭귄 - 당당케어 업데이트...');
  const penguinDangdang = await prisma.healthTypeAnimalProduct.findFirst({
    where: {
      healthTypeAnimalId: 3,
      productId: 1,
      type: 'SUPPLEMENT',
    },
  });

  if (penguinDangdang) {
    await prisma.healthTypeAnimalProduct.update({
      where: { id: penguinDangdang.id },
      data: { mechanisms: penguinDangdangMechanisms },
    });
    console.log(`  ✅ ID:${penguinDangdang.id} 업데이트 완료 (4개 → 13개)`);
  } else {
    console.log('  ❌ 레코드를 찾을 수 없습니다.');
  }

  // 4. 동면 중인 북극곰 - 당당케어 (healthTypeAnimalId: 2, productId: 1)
  console.log('\n4. 동면 중인 북극곰 - 당당케어 업데이트...');
  const bearDangdang = await prisma.healthTypeAnimalProduct.findFirst({
    where: {
      healthTypeAnimalId: 2,
      productId: 1,
      type: 'SUPPLEMENT',
    },
  });

  if (bearDangdang) {
    await prisma.healthTypeAnimalProduct.update({
      where: { id: bearDangdang.id },
      data: { mechanisms: bearDangdangMechanisms },
    });
    console.log(`  ✅ ID:${bearDangdang.id} 업데이트 완료 (4개 → 13개)`);
  } else {
    console.log('  ❌ 레코드를 찾을 수 없습니다.');
  }

  console.log('\n==========================================');
  console.log('SUPPLEMENT mechanisms 업데이트 완료!');
  console.log('==========================================');
}

main()
  .catch((e) => {
    console.error('에러:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
