import { PrismaClient, SolutionScreenType, SolutionScreenVersionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('시드 데이터 생성 시작...');

  // 1. HealthTypeAnimal 조회
  const animals = await prisma.healthTypeAnimal.findMany({
    select: { id: true, healthType: true, typeName: true, animalName: true },
  });
  console.log('HealthTypeAnimals:', animals);

  // 배 빵빵 펭귄 (GUT_HEALTH) 찾기
  const penguin = animals.find((a) => a.healthType === 'GUT_HEALTH');
  if (!penguin) {
    console.log('GUT_HEALTH 동물이 없습니다. 시드 데이터를 건너뜁니다.');
    return;
  }
  console.log(`펭귄 찾음: ID=${penguin.id}, healthType=${penguin.healthType}`);

  // 2. 솔루션 화면 생성 - 펭귄(GUT_HEALTH) 식단/영양제
  const healthTypeKey = penguin.healthType.toLowerCase(); // gut_health
  const screenData = [
    {
      screenKey: `healthType:${healthTypeKey}:diet:original`,
      screenType: SolutionScreenType.DIET_ORIGINAL,
      healthTypeAnimalId: penguin.id,
    },
    {
      screenKey: `healthType:${healthTypeKey}:diet:slow-aging`,
      screenType: SolutionScreenType.DIET_SLOW_AGING,
      healthTypeAnimalId: penguin.id,
    },
    {
      screenKey: `healthType:${healthTypeKey}:supplement:set`,
      screenType: SolutionScreenType.SUPPLEMENT_SET,
      healthTypeAnimalId: penguin.id,
    },
    {
      screenKey: `healthType:${healthTypeKey}:supplement:single`,
      screenType: SolutionScreenType.SUPPLEMENT_SINGLE,
      healthTypeAnimalId: penguin.id,
    },
    {
      screenKey: `healthType:${healthTypeKey}:set:formula`,
      screenType: SolutionScreenType.SET_DETAIL,
      healthTypeAnimalId: penguin.id,
    },
  ];

  for (const screen of screenData) {
    await prisma.solutionScreen.upsert({
      where: { screenKey: screen.screenKey },
      update: {},
      create: screen,
    });
  }
  console.log(`화면 ${screenData.length}개 생성/업데이트 완료`);

  // 4. 펭귄 오리지널 식단 DRAFT 버전 생성
  const dietOriginalScreen = await prisma.solutionScreen.findUnique({
    where: { screenKey: `healthType:${healthTypeKey}:diet:original` },
  });

  if (dietOriginalScreen) {
    const dietPayload = {
      schemaVersion: 1,
      title: '오리지널 식단',
      description: '지방 함량이 높고 순탄수화물을 낮춘 키토제닉 라인업',
      infoText: '음식물과민증 4-5단계 해당하는 식품을 제외한 결과입니다',
      menuCount: 3,
      menus: [
        {
          name: '훈제오리 & 들깨크림리조또',
          calories: 226,
          nutrients: { carb: '순탄수:17g', protein: '단백질:27g', fat: '지방:46g' },
          tags: ['오리고기', '대두', '설탕', '컬리플라워', '양파', '무', '대파', '표고버섯', '다시마', '들깨', '우유', '쌀', '부추'],
        },
        {
          name: '저당 키토 라자냐',
          calories: 223,
          nutrients: { carb: '순탄수:20.6g', protein: '단백질:57g', fat: '지방:29g' },
          tags: ['토마토', '치즈', '양파', '소고기', '마늘', '와인', '우유', '올리브유', '바질', '계란', '대두', '파슬리'],
        },
        {
          name: '우삼겹 규동 & 브로콜리',
          calories: 326,
          nutrients: { carb: '순탄수:13g', protein: '단백질:22g', fat: '지방:33g' },
          tags: ['소고기', '컬리플라워', '브로콜리', '쌀', '대두', '천일염', '효모', '우유', '밀'],
        },
      ],
      cta: {
        primary: { label: '장바구니', type: 'ADD_CART' },
        secondary: { label: '구매하기', type: 'BUY' },
      },
    };

    // 기존 DRAFT 삭제 후 새로 생성
    await prisma.solutionScreenVersion.deleteMany({
      where: { screenId: dietOriginalScreen.id, status: SolutionScreenVersionStatus.DRAFT },
    });

    await prisma.solutionScreenVersion.create({
      data: {
        screenId: dietOriginalScreen.id,
        status: SolutionScreenVersionStatus.DRAFT,
        payload: dietPayload,
        schemaVersion: 1,
        createdBy: 1, // 관리자 ID
      },
    });
    console.log('펭귄 오리지널 식단 DRAFT 버전 생성 완료');
  }

  // 5. 펭귄 영양제 종합세트 DRAFT 버전 생성
  const supplementSetScreen = await prisma.solutionScreen.findUnique({
    where: { screenKey: `healthType:${healthTypeKey}:supplement:set` },
  });

  if (supplementSetScreen) {
    const supplementSetPayload = {
      schemaVersion: 1,
      title: '맞춤 포뮬러',
      productNames: '바이오 밸런스 + 클린 밸런스 + 당당케어',
      description:
        '바이오 밸런스, 클린 밸런스, 당당케어 세 제품을 함께 복용하면 단순 합산이 아닌 배수 효과가 나타납니다. 각 제품의 성분들이 서로 다른 경로로 협력하여 배 빵빵 펭귄 유형의 근본 원인을 해결합니다.',
      products: [{ productId: 101 }, { productId: 102 }, { productId: 103 }],
      synergyEffects: [
        {
          order: 1,
          title: '장벽 3중 강화 시스템',
          items: [
            { productId: 101, bullets: ['아연+마그네슘이 밀착연접 단백질 합성'] },
            { productId: 102, bullets: ['비타민A가 점액층 두껍게 형성'] },
            { productId: 103, bullets: ['비타민B군이 장 세포 재생 에너지 공급', '→ 3단계 방어벽 완성으로 장누수 완화'] },
          ],
        },
        {
          order: 2,
          title: '독소 완전 제거 루트',
          items: [
            { productId: 101, bullets: ['셀레늄+망간+몰리브덴이 장내 독소 중화'] },
            { productId: 102, bullets: ['클로렐라가 독소 흡착하여 체외 배출'] },
            { label: '공통', bullets: ['비타민C+E가 혈액 속 염증 물질 제거', '→ 장-피부 축 염증 차단으로 턱 트러블 개선'] },
          ],
        },
        {
          order: 3,
          title: 'SIBO 유해균 이중 억제',
          items: [
            { productId: 101, bullets: ['비타민D가 항균 펩타이드 생성'] },
            { productId: 102, bullets: ['아연이 유해균 증식 억제'] },
            { productId: 103, bullets: ['크롬+바나바잎이 혈당 조절로 유해균 먹이 차단', '→ 복부 팽만과 가스 생성 근본 해결'] },
          ],
        },
        {
          order: 4,
          title: '세포 재생 가속화',
          items: [
            { productId: 101, bullets: ['아연이 DNA 합성 촉진'] },
            { productId: 102, bullets: ['비타민A+C가 콜라겐 합성 지원'] },
            { productId: 103, bullets: ['비타민B군(B2,B3,B6,B9)이 세포 분열 에너지 공급', '→ 손상된 장 점막 빠른 회복'] },
          ],
        },
      ],
      detailScreenKey: `healthType:${healthTypeKey}:set:formula`,
    };

    await prisma.solutionScreenVersion.deleteMany({
      where: { screenId: supplementSetScreen.id, status: SolutionScreenVersionStatus.DRAFT },
    });

    await prisma.solutionScreenVersion.create({
      data: {
        screenId: supplementSetScreen.id,
        status: SolutionScreenVersionStatus.DRAFT,
        payload: supplementSetPayload,
        schemaVersion: 1,
        createdBy: 1,
      },
    });
    console.log('펭귄 영양제 종합세트 DRAFT 버전 생성 완료');
  }

  // 6. 펭귄 영양제 단품 DRAFT 버전 생성
  const supplementSingleScreen = await prisma.solutionScreen.findUnique({
    where: { screenKey: `healthType:${healthTypeKey}:supplement:single` },
  });

  if (supplementSingleScreen) {
    const supplementSinglePayload = {
      schemaVersion: 1,
      title: '영양제 단품',
      products: [
        {
          productId: 101,
          recommendRank: 1,
          rankLabel: '장벽 복구',
          shortDescription:
            '장벽을 복구해 장누수 증후군을 개선하는 아연, 마그네슘, 비타민D와 유해균이 만드는 독소를 제거하고 장벽 손상을 막는 셀레늄, 망간, 몰리브덴, 크롬이 모두 들어있습니다.',
          dosage: '복용법| 1일 1회, 1회 3정',
          detailScreenKey: `healthType:${healthTypeKey}:product:101`,
          ingredientMechanismCount: 7,
          ingredientGroups: [
            {
              groupTitle: null,
              ingredients: [
                {
                  ingredientKey: 'zinc',
                  bullets: ['장벽 세포 간 이음새를 촘촘하게 결합', '유해균 독소나 염증 유발 물질의 혈관 누수 방지'],
                },
                {
                  ingredientKey: 'magnesium',
                  bullets: ['장 점막 세포의 정상적인 기능과 회복에 도움', '유해균 독소나 염증 유발 물질의 혈관 누수 방지'],
                },
              ],
            },
            {
              groupTitle: 'ON 스위치 낮추기 - 염증 생성 차단',
              ingredients: [
                {
                  ingredientKey: 'selenium',
                  bullets: ['강력한 항산화 작용으로, 유해균 독소와 장내 염증 감소', '세포 손상을 방지해 장벽 회복 환경 조성'],
                },
              ],
            },
          ],
        },
        {
          productId: 102,
          recommendRank: 2,
          rankLabel: '장 독소 배출',
          shortDescription:
            '장내 독소를 직접 흡착 배출하는 클로렐라와 장벽 회복을 돕는 아연, 비타민 A가 들어있습니다. 또한, 비타민 C, E 항산화 성분과 세포 재생을 돕는 비타민 B군(B3, B9)이 독소로 인한 염증을 막고 장-피부 축을 개선합니다.',
          dosage: '복용법| 1일 2회, 1회 2정 섭취',
          detailScreenKey: `healthType:${healthTypeKey}:product:102`,
          ingredientMechanismCount: 7,
          ingredientGroups: [
            {
              groupTitle: null,
              ingredients: [
                {
                  ingredientKey: 'chlorella',
                  bullets: ['유해균 독소 및 노폐물에 흡착하여 체외로 배출', '독소로 인한 장내 염증 부담 감소', '장벽 회복 환경 조성'],
                },
                {
                  ingredientKey: 'vitamin_e',
                  bullets: ['독소로 인한 산화 스트레스로부터 장 점막 세포 손상 방지', '비타민 C와 함께 장내 염증 반응 감소에 기여'],
                },
              ],
            },
          ],
        },
        {
          productId: 103,
          recommendRank: 3,
          rankLabel: '유해균 감소',
          shortDescription:
            '유해균의 먹이가 되는 식후 혈당 상승을 억제하는 바나바잎추출물과 크롬이 들어있습니다. 또한, 비타민 B군이 탄수화물 대사를 촉진해 유해균 먹이를 차단하고 장벽 회복과 에너지 생성을 도와 근본적인 장 건강 개선에 도움을 줍니다.',
          dosage: '복용법| 1일 2회, 1회 2정 섭취',
          detailScreenKey: `healthType:${healthTypeKey}:product:103`,
          ingredientMechanismCount: 7,
          ingredientGroups: [
            {
              groupTitle: null,
              ingredients: [
                {
                  ingredientKey: 'corosolic_acid',
                  bullets: ['식후 혈당 상승 억제, 혈당 조절에 도움', '유해균의 주된 먹이(당) 공급 차단'],
                },
                {
                  ingredientKey: 'chromium',
                  bullets: ['인슐린 작용을 도와 안정적 혈당 유지에 도움', '혈당 조절에 관여하여 유해균 먹이(당) 차단에 도움'],
                },
              ],
            },
          ],
        },
      ],
    };

    await prisma.solutionScreenVersion.deleteMany({
      where: { screenId: supplementSingleScreen.id, status: SolutionScreenVersionStatus.DRAFT },
    });

    await prisma.solutionScreenVersion.create({
      data: {
        screenId: supplementSingleScreen.id,
        status: SolutionScreenVersionStatus.DRAFT,
        payload: supplementSinglePayload,
        schemaVersion: 1,
        createdBy: 1,
      },
    });
    console.log('펭귄 영양제 단품 DRAFT 버전 생성 완료');
  }

  console.log('시드 데이터 생성 완료!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
