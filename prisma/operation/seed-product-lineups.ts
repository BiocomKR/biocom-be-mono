import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 식단 라인업 시드 데이터
 * 팀키토 도시락 라인업 (오리지널, 시그니처, 저속노화, 저포드맵)
 *
 * TODO: imageUrl을 운영 GCS로 교체 필요
 */
const productLineups = [
  {
    key: 'ORIGINAL',
    name: '오리지널',
    description:
      '정제된 탄수화물 대신 단백질과 건강한 지방 위주로 구성하여, 장내 유해균이 과도하게 증식할 수 있는 영양 공급을 자연스럽게 조절합니다. 장 점막을 느슨하게 만드는 글루텐을 배제하여 장 건강 회복을 돕습니다.',
    imageUrl:
      'https://storage.googleapis.com/api-dev-biocom-uploads/matchum_solution/lineup/오리지널.webp',
    sortOrder: 1,
  },
  {
    key: 'SIGNATURE',
    name: '시그니처',
    description:
      '인슐린 저항성 개선에 도움을 주면서도, 엄격한 식단이 부담스러울 때 편안하게 선택할 수 있는 라인업입니다. 현미 등 건강한 탄수화물을 사용하여 급격한 혈당 변화는 막아주되, 저탄수화물 식단에 우리 몸이 서서히 적응할 수 있도록 돕습니다.',
    imageUrl:
      'https://storage.googleapis.com/api-dev-biocom-uploads/matchum_solution/lineup/시그니처.webp',
    sortOrder: 2,
  },
  {
    key: 'SLOW_AGING',
    name: '저속노화',
    description:
      '염증 해소에 꼭 필요한 오메가-3와 다양한 항산화 성분을 풍부하게 담았습니다. 만성 염증으로 지친 몸에 \'소방관\' 역할을 하는 영양소를 공급하여, 체내 회복 시스템이 정상적으로 작동하도록 돕습니다.',
    imageUrl:
      'https://storage.googleapis.com/api-dev-biocom-uploads/matchum_solution/lineup/저속노화.webp',
    sortOrder: 3,
  },
  {
    key: 'LOW_FODMAP',
    name: '저포드맵',
    description:
      '소장에서 쉽게 발효되어 가스를 만드는 포드맵(FODMAP) 성분을 최소화했습니다. 식사 후 복부 팽만감을 유발하는 SIBO(소장 내 세균 과다 증식)의 환경적 요인을 조절하여, 장이 편안하게 쉴 수 있는 상태를 만들어줍니다.',
    imageUrl:
      'https://storage.googleapis.com/api-dev-biocom-uploads/matchum_solution/lineup/저포드맵.webp',
    sortOrder: 4,
  },
];

async function main() {
  console.log('식단 라인업 시드 시작...\n');

  let created = 0;
  let updated = 0;

  for (const lineup of productLineups) {
    const existing = await prisma.productLineup.findUnique({
      where: { key: lineup.key },
    });

    if (existing) {
      // 기존 데이터 업데이트
      await prisma.productLineup.update({
        where: { id: existing.id },
        data: {
          name: lineup.name,
          description: lineup.description,
          imageUrl: lineup.imageUrl,
          sortOrder: lineup.sortOrder,
          isActive: true,
        },
      });
      console.log(`✅ 업데이트: ${lineup.name} (key: ${lineup.key})`);
      updated++;
    } else {
      // 신규 생성
      const createdLineup = await prisma.productLineup.create({
        data: {
          key: lineup.key,
          name: lineup.name,
          description: lineup.description,
          imageUrl: lineup.imageUrl,
          sortOrder: lineup.sortOrder,
          isActive: true,
        },
      });
      console.log(`✅ 생성: ${lineup.name} (ID: ${createdLineup.id}, key: ${lineup.key})`);
      created++;
    }
  }

  console.log('\n식단 라인업 시드 완료!');
  console.log(`생성: ${created}개, 업데이트: ${updated}개`);
}

main()
  .catch((e) => {
    console.error('시드 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
