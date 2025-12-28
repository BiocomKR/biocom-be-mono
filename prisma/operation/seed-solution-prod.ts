import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 운영 DB용 맞춤솔루션 시드 스크립트
 *
 * seed-solution.ts와 달리 이름 기반으로 상품을 찾아서 연결합니다.
 * 어떤 DB에서든 실행 가능합니다.
 *
 * 실행 방법:
 * DATABASE_URL="..." npx ts-node prisma/operation/seed-solution-prod.ts
 *
 * 주의: 기존 health_type_animal_products 데이터를 삭제하고 새로 생성합니다.
 */

// ============================================================
// FORMULA 상품 데이터
// ============================================================
const FORMULA_PRODUCTS = [
  { sku: 'FORMULA_SKIN_HEALTH', name: '맞춤솔루션', healthType: 'SKIN_HEALTH' },
  { sku: 'FORMULA_METABOLISM', name: '맞춤솔루션', healthType: 'METABOLISM' },
  { sku: 'FORMULA_GUT_HEALTH', name: '맞춤솔루션', healthType: 'GUT_HEALTH' },
  { sku: 'FORMULA_IMMUNE_BALANCE', name: '맞춤솔루션', healthType: 'IMMUNE_BALANCE' },
];

// ============================================================
// 동물별 상품 연결 데이터 (이름 기반)
// ============================================================
interface ProductMapping {
  productName: string;
  type: 'SUPPLEMENT' | 'DIET' | 'FORMULA' | 'CONDITIONAL';
  priority: number | null;
  keyword: string;
  displayOrder: number;
  recommendReason?: string | null;
  dosage?: string | null;
  mechanisms?: any;
  lineupKey?: string; // DIET인 경우 라인업 키
}

const HEALTH_TYPE_PRODUCTS: Record<string, ProductMapping[]> = {
  SKIN_HEALTH: [
    // SUPPLEMENT
    { productName: '바이오 밸런스', type: 'SUPPLEMENT', priority: 1, keyword: '염증 개선', displayOrder: 1, recommendReason: '염증 ON/OFF 스위치를 모두 제어하는 성분이 조합되어 있습니다.', dosage: '1일 1회, 1회 3정 섭취' },
    { productName: '클린 밸런스', type: 'SUPPLEMENT', priority: 2, keyword: '독소 배출', displayOrder: 2, recommendReason: '염증 유발 독소를 직접 흡착하여 배출하는 성분으로 구성되어 있습니다.', dosage: '1일 2회, 1회 2정 섭취' },
    { productName: '영데이즈', type: 'SUPPLEMENT', priority: 3, keyword: '세포 보호', displayOrder: 3, recommendReason: '급성 염증으로부터 세포를 보호하는 항산화 시스템의 구성 성분이 모두 포함되어 있습니다.', dosage: '1일 1회, 1회 1포 섭취' },
    // FORMULA
    { productName: '맞춤솔루션', type: 'FORMULA', priority: null, keyword: '맞춤솔루션', displayOrder: 4, lineupKey: 'FORMULA_SKIN_HEALTH' },
    // DIET - 저속노화 (점심)
    { productName: '수비드간장치킨', type: 'DIET', priority: 1, keyword: '저속노화', displayOrder: 101, lineupKey: 'SLOW_AGING', recommendReason: '점심에는 염증을 가라앉히는 유효 성분을 적극적으로 채워줍니다.', dosage: '점심 식사로 섭취' },
    { productName: '시트러스대구', type: 'DIET', priority: 1, keyword: '저속노화', displayOrder: 102, lineupKey: 'SLOW_AGING', recommendReason: '점심에는 염증을 가라앉히는 유효 성분을 적극적으로 채워줍니다.', dosage: '점심 식사로 섭취' },
    { productName: '로제 닭갈비', type: 'DIET', priority: 1, keyword: '저속노화', displayOrder: 103, lineupKey: 'SLOW_AGING', recommendReason: '점심에는 염증을 가라앉히는 유효 성분을 적극적으로 채워줍니다.', dosage: '점심 식사로 섭취' },
    { productName: '미소버터 대구 조림', type: 'DIET', priority: 1, keyword: '저속노화', displayOrder: 104, lineupKey: 'SLOW_AGING', recommendReason: '점심에는 염증을 가라앉히는 유효 성분을 적극적으로 채워줍니다.', dosage: '점심 식사로 섭취' },
    { productName: '미소버터 연어 조림', type: 'DIET', priority: 1, keyword: '저속노화', displayOrder: 105, lineupKey: 'SLOW_AGING', recommendReason: '점심에는 염증을 가라앉히는 유효 성분을 적극적으로 채워줍니다.', dosage: '점심 식사로 섭취' },
    { productName: '코코넛치킨 커리', type: 'DIET', priority: 1, keyword: '저속노화', displayOrder: 106, lineupKey: 'SLOW_AGING', recommendReason: '점심에는 염증을 가라앉히는 유효 성분을 적극적으로 채워줍니다.', dosage: '점심 식사로 섭취' },
    { productName: '아라비아따 오리 찜', type: 'DIET', priority: 1, keyword: '저속노화', displayOrder: 107, lineupKey: 'SLOW_AGING', recommendReason: '점심에는 염증을 가라앉히는 유효 성분을 적극적으로 채워줍니다.', dosage: '점심 식사로 섭취' },
    // DIET - 저포드맵 (저녁)
    { productName: '치킨스튜&두부', type: 'DIET', priority: 2, keyword: '저포드맵', displayOrder: 201, lineupKey: 'LOW_FODMAP', recommendReason: '저녁에는 자극을 비워주는 식단을 병행합니다.', dosage: '저녁 식사로 섭취' },
    { productName: '비프스튜&두부', type: 'DIET', priority: 2, keyword: '저포드맵', displayOrder: 202, lineupKey: 'LOW_FODMAP', recommendReason: '저녁에는 자극을 비워주는 식단을 병행합니다.', dosage: '저녁 식사로 섭취' },
    { productName: '순살갈비찜&두부', type: 'DIET', priority: 2, keyword: '저포드맵', displayOrder: 203, lineupKey: 'LOW_FODMAP', recommendReason: '저녁에는 자극을 비워주는 식단을 병행합니다.', dosage: '저녁 식사로 섭취' },
    { productName: '수비드닭다리살&오믈렛', type: 'DIET', priority: 2, keyword: '저포드맵', displayOrder: 204, lineupKey: 'LOW_FODMAP', recommendReason: '저녁에는 자극을 비워주는 식단을 병행합니다.', dosage: '저녁 식사로 섭취' },
    { productName: '수비드목살&오믈렛', type: 'DIET', priority: 2, keyword: '저포드맵', displayOrder: 205, lineupKey: 'LOW_FODMAP', recommendReason: '저녁에는 자극을 비워주는 식단을 병행합니다.', dosage: '저녁 식사로 섭취' },
    { productName: '순살삼계찜닭&두부', type: 'DIET', priority: 2, keyword: '저포드맵', displayOrder: 206, lineupKey: 'LOW_FODMAP', recommendReason: '저녁에는 자극을 비워주는 식단을 병행합니다.', dosage: '저녁 식사로 섭취' },
    { productName: '오리불고기&두부', type: 'DIET', priority: 2, keyword: '저포드맵', displayOrder: 207, lineupKey: 'LOW_FODMAP', recommendReason: '저녁에는 자극을 비워주는 식단을 병행합니다.', dosage: '저녁 식사로 섭취' },
    // CONDITIONAL
    { productName: '메타드림', type: 'CONDITIONAL', priority: 1, keyword: '수면 개선', displayOrder: 301, recommendReason: '수면 문진 결과, 수면의 질 개선이 필요합니다.', dosage: '1일 1회, 1회 1포 섭취' },
    { productName: '리셋데이', type: 'CONDITIONAL', priority: 2, keyword: '글루텐 과민 개선', displayOrder: 302, recommendReason: '글루텐에 높은 반응을 보이고 있습니다.', dosage: '1일 1회, 1회 1포 섭취' },
  ],
  METABOLISM: [
    // SUPPLEMENT
    { productName: '당당케어', type: 'SUPPLEMENT', priority: 1, keyword: '혈당 조절', displayOrder: 1, recommendReason: '인슐린 저항성의 원인인 식후 혈당 상승 억제와 대사 개선을 위한 최적의 조합입니다.', dosage: '1일 2회, 1회 2정 섭취' },
    { productName: '뉴로 마스터', type: 'SUPPLEMENT', priority: 2, keyword: '대사량 증가', displayOrder: 2, recommendReason: '저하된 대사 기능을 개선하기 위한 최적의 조합입니다.', dosage: '1일 1회, 2정 섭취' },
    { productName: '바이오 밸런스', type: 'SUPPLEMENT', priority: 3, keyword: '대사 시너지', displayOrder: 3, recommendReason: '만성 염증 제거로 인슐린 저항성 악화를 차단하고, 갑상선 호르몬 활성화를 지원합니다.', dosage: '1일 1회, 1회 3정 섭취' },
    // FORMULA
    { productName: '맞춤솔루션', type: 'FORMULA', priority: null, keyword: '맞춤솔루션', displayOrder: 4, lineupKey: 'FORMULA_METABOLISM' },
    // DIET - 오리지널 (점심)
    { productName: '수비드 통삼겹 된장 덮밥', type: 'DIET', priority: 1, keyword: '오리지널', displayOrder: 101, lineupKey: 'ORIGINAL', recommendReason: '탄수화물 섭취를 최소화하여 인슐린 저항성 개선에 집중합니다.', dosage: '점심 식사로 섭취' },
    { productName: '수비드 통삼겹 들기름 두부면 막국수', type: 'DIET', priority: 1, keyword: '오리지널', displayOrder: 102, lineupKey: 'ORIGINAL', recommendReason: '탄수화물 섭취를 최소화하여 인슐린 저항성 개선에 집중합니다.', dosage: '점심 식사로 섭취' },
    { productName: '훈제오리 들깨 크림 리조또', type: 'DIET', priority: 1, keyword: '오리지널', displayOrder: 103, lineupKey: 'ORIGINAL', recommendReason: '탄수화물 섭취를 최소화하여 인슐린 저항성 개선에 집중합니다.', dosage: '점심 식사로 섭취' },
    { productName: '우삼겹 규동&브로콜리', type: 'DIET', priority: 1, keyword: '오리지널', displayOrder: 104, lineupKey: 'ORIGINAL', recommendReason: '탄수화물 섭취를 최소화하여 인슐린 저항성 개선에 집중합니다.', dosage: '점심 식사로 섭취' },
    { productName: '우삼겹 오일 파스타', type: 'DIET', priority: 1, keyword: '오리지널', displayOrder: 105, lineupKey: 'ORIGINAL', recommendReason: '탄수화물 섭취를 최소화하여 인슐린 저항성 개선에 집중합니다.', dosage: '점심 식사로 섭취' },
    { productName: 'b.t.s. 치킨 치즈 리조또', type: 'DIET', priority: 1, keyword: '오리지널', displayOrder: 106, lineupKey: 'ORIGINAL', recommendReason: '탄수화물 섭취를 최소화하여 인슐린 저항성 개선에 집중합니다.', dosage: '점심 식사로 섭취' },
    { productName: '소고기 버섯 들깨 덮밥', type: 'DIET', priority: 1, keyword: '오리지널', displayOrder: 107, lineupKey: 'ORIGINAL', recommendReason: '탄수화물 섭취를 최소화하여 인슐린 저항성 개선에 집중합니다.', dosage: '점심 식사로 섭취' },
    { productName: '저당 두부면 라자냐', type: 'DIET', priority: 1, keyword: '오리지널', displayOrder: 108, lineupKey: 'ORIGINAL', recommendReason: '탄수화물 섭취를 최소화하여 인슐린 저항성 개선에 집중합니다.', dosage: '점심 식사로 섭취' },
    // DIET - 시그니처 (저녁)
    { productName: '강남역 호랑이 삼겹', type: 'DIET', priority: 2, keyword: '시그니처', displayOrder: 201, lineupKey: 'SIGNATURE', recommendReason: '저녁에는 시그니처로 지속 가능한 관리를 이어갑니다.', dosage: '저녁 식사로 섭취' },
    { productName: '항아리 차돌 된장', type: 'DIET', priority: 2, keyword: '시그니처', displayOrder: 202, lineupKey: 'SIGNATURE', recommendReason: '저녁에는 시그니처로 지속 가능한 관리를 이어갑니다.', dosage: '저녁 식사로 섭취' },
    { productName: '수원 왕갈비 통 닭목살', type: 'DIET', priority: 2, keyword: '시그니처', displayOrder: 203, lineupKey: 'SIGNATURE', recommendReason: '저녁에는 시그니처로 지속 가능한 관리를 이어갑니다.', dosage: '저녁 식사로 섭취' },
    { productName: '수랏간 삼치 솥밥', type: 'DIET', priority: 2, keyword: '시그니처', displayOrder: 204, lineupKey: 'SIGNATURE', recommendReason: '저녁에는 시그니처로 지속 가능한 관리를 이어갑니다.', dosage: '저녁 식사로 섭취' },
    { productName: '기사식당 최강 제육', type: 'DIET', priority: 2, keyword: '시그니처', displayOrder: 205, lineupKey: 'SIGNATURE', recommendReason: '저녁에는 시그니처로 지속 가능한 관리를 이어갑니다.', dosage: '저녁 식사로 섭취' },
    { productName: '춘천 들깨 닭갈비', type: 'DIET', priority: 2, keyword: '시그니처', displayOrder: 206, lineupKey: 'SIGNATURE', recommendReason: '저녁에는 시그니처로 지속 가능한 관리를 이어갑니다.', dosage: '저녁 식사로 섭취' },
  ],
  GUT_HEALTH: [
    // SUPPLEMENT
    { productName: '바이오 밸런스', type: 'SUPPLEMENT', priority: 1, keyword: '장벽 복구', displayOrder: 1, recommendReason: '장벽을 복구해 장누수 증후군을 개선합니다.', dosage: '1일 1회, 1회 3정 섭취' },
    { productName: '클린 밸런스', type: 'SUPPLEMENT', priority: 2, keyword: '장 독소 배출', displayOrder: 2, recommendReason: '장내 독소를 직접 흡착 배출합니다.', dosage: '1일 2회, 1회 2정 섭취' },
    { productName: '당당케어', type: 'SUPPLEMENT', priority: 3, keyword: '유해균 감소', displayOrder: 3, recommendReason: '유해균의 먹이가 되는 식후 혈당 상승을 억제합니다.', dosage: '1일 2회, 1회 2정 섭취' },
    // FORMULA
    { productName: '맞춤솔루션', type: 'FORMULA', priority: null, keyword: '맞춤솔루션', displayOrder: 4, lineupKey: 'FORMULA_GUT_HEALTH' },
    // DIET - 저포드맵 (점심)
    { productName: '치킨스튜&두부', type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 101, lineupKey: 'LOW_FODMAP', recommendReason: '소장에서 발효되는 포드맵 성분을 최소화했습니다.', dosage: '점심 식사로 섭취' },
    { productName: '비프스튜&두부', type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 102, lineupKey: 'LOW_FODMAP', recommendReason: '소장에서 발효되는 포드맵 성분을 최소화했습니다.', dosage: '점심 식사로 섭취' },
    { productName: '순살갈비찜&두부', type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 103, lineupKey: 'LOW_FODMAP', recommendReason: '소장에서 발효되는 포드맵 성분을 최소화했습니다.', dosage: '점심 식사로 섭취' },
    { productName: '수비드닭다리살&오믈렛', type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 104, lineupKey: 'LOW_FODMAP', recommendReason: '소장에서 발효되는 포드맵 성분을 최소화했습니다.', dosage: '점심 식사로 섭취' },
    // DIET - 오리지널 (저녁)
    { productName: '수비드 통삼겹 된장 덮밥', type: 'DIET', priority: 2, keyword: '오리지널', displayOrder: 201, lineupKey: 'ORIGINAL', recommendReason: '장내 유해균 증식을 자연스럽게 조절합니다.', dosage: '저녁 식사로 섭취' },
    { productName: '수비드 통삼겹 들기름 두부면 막국수', type: 'DIET', priority: 2, keyword: '오리지널', displayOrder: 202, lineupKey: 'ORIGINAL', recommendReason: '장내 유해균 증식을 자연스럽게 조절합니다.', dosage: '저녁 식사로 섭취' },
    { productName: '훈제오리 들깨 크림 리조또', type: 'DIET', priority: 2, keyword: '오리지널', displayOrder: 203, lineupKey: 'ORIGINAL', recommendReason: '장내 유해균 증식을 자연스럽게 조절합니다.', dosage: '저녁 식사로 섭취' },
    { productName: '우삼겹 오일 파스타', type: 'DIET', priority: 2, keyword: '오리지널', displayOrder: 204, lineupKey: 'ORIGINAL', recommendReason: '장내 유해균 증식을 자연스럽게 조절합니다.', dosage: '저녁 식사로 섭취' },
  ],
  IMMUNE_BALANCE: [
    // SUPPLEMENT
    { productName: '다래케어', type: 'SUPPLEMENT', priority: 1, keyword: '면역 과민 개선', displayOrder: 1, recommendReason: '면역 과민반응에 의한 피부상태 개선에 도움을 줍니다.', dosage: '1일 2회, 1회 3정 섭취' },
    { productName: '바이오 밸런스', type: 'SUPPLEMENT', priority: 2, keyword: '장벽 복구', displayOrder: 2, recommendReason: '장벽을 복구하여 면역계를 안정화시킵니다.', dosage: '1일 1회, 1회 3정 섭취' },
    { productName: '클린 밸런스', type: 'SUPPLEMENT', priority: 3, keyword: '장 독소 배출', displayOrder: 3, recommendReason: '면역계를 자극하는 독소를 제거합니다.', dosage: '1일 2회, 1회 2정 섭취' },
    // FORMULA
    { productName: '맞춤솔루션', type: 'FORMULA', priority: null, keyword: '맞춤솔루션', displayOrder: 4, lineupKey: 'FORMULA_IMMUNE_BALANCE' },
    // DIET - 저포드맵 (점심)
    { productName: '치킨스튜&두부', type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 101, lineupKey: 'LOW_FODMAP', recommendReason: "면역계에 '휴식'을 주는 식단입니다.", dosage: '점심 식사로 섭취' },
    { productName: '비프스튜&두부', type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 102, lineupKey: 'LOW_FODMAP', recommendReason: "면역계에 '휴식'을 주는 식단입니다.", dosage: '점심 식사로 섭취' },
    { productName: '순살갈비찜&두부', type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 103, lineupKey: 'LOW_FODMAP', recommendReason: "면역계에 '휴식'을 주는 식단입니다.", dosage: '점심 식사로 섭취' },
    { productName: '수비드닭다리살&오믈렛', type: 'DIET', priority: 1, keyword: '저포드맵', displayOrder: 104, lineupKey: 'LOW_FODMAP', recommendReason: "면역계에 '휴식'을 주는 식단입니다.", dosage: '점심 식사로 섭취' },
    // DIET - 저속노화 (저녁)
    { productName: '수비드간장치킨', type: 'DIET', priority: 2, keyword: '저속노화', displayOrder: 201, lineupKey: 'SLOW_AGING', recommendReason: "방어벽을 '재건'하는 영양소를 공급합니다.", dosage: '저녁 식사로 섭취' },
    { productName: '시트러스대구', type: 'DIET', priority: 2, keyword: '저속노화', displayOrder: 202, lineupKey: 'SLOW_AGING', recommendReason: "방어벽을 '재건'하는 영양소를 공급합니다.", dosage: '저녁 식사로 섭취' },
    { productName: '로제 닭갈비', type: 'DIET', priority: 2, keyword: '저속노화', displayOrder: 203, lineupKey: 'SLOW_AGING', recommendReason: "방어벽을 '재건'하는 영양소를 공급합니다.", dosage: '저녁 식사로 섭취' },
    { productName: '미소버터 대구 조림', type: 'DIET', priority: 2, keyword: '저속노화', displayOrder: 204, lineupKey: 'SLOW_AGING', recommendReason: "방어벽을 '재건'하는 영양소를 공급합니다.", dosage: '저녁 식사로 섭취' },
  ],
};

async function findProductByName(name: string): Promise<{ id: number; name: string } | null> {
  return prisma.product.findFirst({
    where: { name },
    select: { id: true, name: true },
  });
}

async function findFormulaBySku(sku: string): Promise<{ id: number; name: string } | null> {
  return prisma.product.findFirst({
    where: { sku },
    select: { id: true, name: true },
  });
}

async function seedFormulaProducts() {
  console.log('\n📌 1. FORMULA 상품 생성...');
  const now = new Date();

  for (const formula of FORMULA_PRODUCTS) {
    const existing = await prisma.product.findFirst({
      where: { sku: formula.sku },
    });

    if (existing) {
      console.log(`  ⏭️ 이미 존재: ${formula.sku} (ID: ${existing.id})`);
      continue;
    }

    const created = await prisma.product.create({
      data: {
        sku: formula.sku,
        name: formula.name,
        description: `${formula.healthType} 맞춤솔루션`,
        categoryCode: 'FORMULA',
        categoryName: '맞춤솔루션',
        productType: 'SET',
        price: 0,
        status: 'ACTIVE',
        shippingPolicy: 'FREE',
        shippingFee: 0,
        createdAt: now,
      },
    });
    console.log(`  ✅ 생성: ${formula.sku} (ID: ${created.id})`);
  }
}

async function seedHealthTypeAnimalProducts() {
  console.log('\n📌 2. HealthTypeAnimalProduct 시딩...');
  const now = new Date();

  // 기존 DIET, FORMULA 타입만 삭제 (SUPPLEMENT, CONDITIONAL은 유지)
  const deleteResult = await prisma.healthTypeAnimalProduct.deleteMany({
    where: { type: { in: ['DIET', 'FORMULA'] } },
  });
  console.log(`  ⚠️ 기존 DIET/FORMULA 데이터 ${deleteResult.count}개 삭제`);

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const [healthType, products] of Object.entries(HEALTH_TYPE_PRODUCTS)) {
    const animal = await prisma.healthTypeAnimal.findFirst({
      where: { healthType },
    });

    if (!animal) {
      console.error(`  ❌ HealthTypeAnimal not found: ${healthType}`);
      continue;
    }

    console.log(`\n  --- ${animal.animalName} (${healthType}) ---`);

    for (const mapping of products) {
      // SUPPLEMENT, CONDITIONAL은 이미 있으면 스킵
      if (mapping.type === 'SUPPLEMENT' || mapping.type === 'CONDITIONAL') {
        const existing = await prisma.healthTypeAnimalProduct.findFirst({
          where: {
            healthTypeAnimalId: animal.id,
            type: mapping.type,
            product: { name: mapping.productName },
          },
        });
        if (existing) {
          console.log(`    ⏭️ ${mapping.type} 이미 존재: ${mapping.productName}`);
          totalSkipped++;
          continue;
        }
      }

      // 상품 찾기
      let product;
      if (mapping.type === 'FORMULA') {
        product = await findFormulaBySku(mapping.lineupKey!);
      } else {
        product = await findProductByName(mapping.productName);
      }

      if (!product) {
        console.error(`    ❌ 상품 없음: ${mapping.productName}`);
        continue;
      }

      await prisma.healthTypeAnimalProduct.create({
        data: {
          healthTypeAnimalId: animal.id,
          productId: product.id,
          type: mapping.type,
          priority: mapping.priority,
          keyword: mapping.keyword,
          recommendReason: mapping.recommendReason,
          dosage: mapping.dosage,
          displayOrder: mapping.displayOrder,
          mechanisms: mapping.mechanisms || {},
          isActive: true,
          createdAt: now,
        },
      });
      console.log(`    ✅ ${mapping.type}: ${mapping.productName} (ID: ${product.id})`);
      totalCreated++;
    }
  }

  console.log(`\n  📊 생성: ${totalCreated}개, 스킵: ${totalSkipped}개`);
}

async function main() {
  console.log('🚀 운영 DB 맞춤솔루션 시드 시작...\n');

  try {
    await seedFormulaProducts();
    await seedHealthTypeAnimalProducts();

    // 결과 요약
    console.log('\n📊 시딩 결과 요약:');
    const formulaCount = await prisma.product.count({ where: { categoryCode: 'FORMULA' } });
    const mappingCount = await prisma.healthTypeAnimalProduct.count();

    console.log(`  - FORMULA 상품: ${formulaCount}개`);
    console.log(`  - HealthTypeAnimalProduct: ${mappingCount}개`);

    // 동물별 상세
    console.log('\n📋 동물별 상품 매핑:');
    const animals = await prisma.healthTypeAnimal.findMany({ orderBy: { id: 'asc' } });
    for (const animal of animals) {
      const counts = await prisma.healthTypeAnimalProduct.groupBy({
        by: ['type'],
        where: { healthTypeAnimalId: animal.id },
        _count: true,
      });
      const summary = counts.map((c) => `${c.type}:${c._count}`).join(', ');
      console.log(`  - ${animal.animalName}: ${summary}`);
    }

    console.log('\n🎉 운영 DB 맞춤솔루션 시드 완료!');
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
