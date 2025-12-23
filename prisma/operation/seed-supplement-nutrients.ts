import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 영양제 성분 시드 데이터
 * 각 영양제별 성분명 (br 태그로 줄바꿈 위치 지정)
 */
const supplementNutrients: Record<string, string[]> = {
  // 바이오 밸런스 (장벽 복구)
  '바이오 밸런스': [
    '마그네슘',
    '아연',
    '셀레늄',
    '몰리브덴',
    '망간',
    '크롬',
    '비타민D',
    '비타민B7',
  ],

  // 클린 밸런스 (독소 배출)
  '클린 밸런스': [
    '아연',
    '구리',
    '클로렐라',
    '비타민A',
    '나이아신',
    '비타민C',
    '비타민E',
    '비타민B9',
  ],

  // 당당케어 (혈당 관리)
  '당당케어': [
    '코로솔산',
    '포스콜린',
    'HCA',
    '비타민B1',
    '비타민B2',
    '비타민B3',
    '비타민B5',
    '비타민B6',
    '비타민B7',
    '비타민C',
    '크롬',
    '비타민B12',
    '비타민B9',
  ],

  // 다래케어 (알레르기 케어)
  '다래케어': [
    '아연',
    '요오드',
    '은행잎<br>추출물',
    '다래<br>추출물',
  ],

  // 영데이즈 (항산화)
  '영데이즈': [
    '아연',
    '구아검<br>가수분해물',
    'SOD<br>효소',
    '카탈레이즈<br>효소',
    'L글루타치온<br>효모',
    '비타민C',
    '비타민E',
  ],

  // 뉴로 마스터 (수면/스트레스)
  '뉴로 마스터': [
    '글리신',
    'L-트립토판',
    'L-테아닌',
    '멜라토닌',
    'GABA',
    '마그네슘',
    'L-글루타민',
    '비타민B6',
    '비타민B12',
    '레몬밤<br>추출분말',
    '흑하랑상추<br>추출분말',
    '감태<br>추출물',
  ],

  // 메타드림 (대사 개선)
  '메타드림': [
    '비타민B1',
    '비타민B2',
    '비타민B3',
    '비타민B5',
    '비타민B6',
    '비타민B7',
    '비타민C',
    '크롬',
    '비타민B12',
    '비타민B9',
  ],

  // 리셋데이 (장 건강)
  '리셋데이': [
    '글루텐<br>분해효소',
    '알파 CD',
    '난소화성<br>말토덱스트린',
    '차전자피<br>분말',
    '낙산균',
  ],

  // 썬화이버 (식이섬유)
  '썬화이버': [
    '난소화성<br>말토덱스트린',
  ],
};

async function main() {
  console.log('영양제 성분 시드 시작...\n');

  // 영양제 상품 조회
  const products = await prisma.product.findMany({
    where: { categoryCode: 'SUPPLEMENT' },
    select: { id: true, name: true },
  });

  let totalCreated = 0;
  let totalUpdated = 0;

  for (const product of products) {
    const nutrients = supplementNutrients[product.name];

    if (!nutrients) {
      console.log(`⏭️  ${product.name}: 성분 데이터 없음 (스킵)`);
      continue;
    }

    console.log(`📦 ${product.name} (ID: ${product.id})`);

    for (const nutrientName of nutrients) {
      const existing = await prisma.supplementNutrient.findFirst({
        where: {
          productId: product.id,
          nutrientName,
        },
      });

      if (existing) {
        totalUpdated++;
        console.log(`   ✓ ${nutrientName} (기존)`);
      } else {
        await prisma.supplementNutrient.create({
          data: {
            productId: product.id,
            nutrientName,
          },
        });
        totalCreated++;
        console.log(`   ✅ ${nutrientName} (생성)`);
      }
    }
    console.log('');
  }

  console.log('영양제 성분 시드 완료!');
  console.log(`생성: ${totalCreated}개, 기존: ${totalUpdated}개`);
}

main()
  .catch((e) => {
    console.error('시드 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
