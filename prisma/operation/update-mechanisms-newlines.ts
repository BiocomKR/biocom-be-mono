import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MechanismItem {
  name: string;
  summary: string;
  sortOrder: number;
  descriptions: string[];
  ingredientKey: string;
}

// 문서에서 <br> 태그가 있는 성분명 매핑
// DB에 저장된 현재 이름 -> 문서의 <br>을 \n으로 변환한 이름
const ingredientNameMappings: { [key: string]: string } = {
  // 다래케어
  '다래추출물분말': '다래\n추출물분말',
  // 영데이즈
  'SOD효소': 'SOD\n효소',
  '카탈레이즈 효소': '카탈레이즈\n효소',
  'L글루타치온': 'L글루타치온\n효모',
  // 뉴로마스터
  '은행잎추출물(플라보놀배당체)': '은행잎\n추출물',
  // 메타드림
  '레몬밤추출분말': '레몬밤\n추출분말',
  '흑하랑상추추출분말': '흑하랑상추\n추출분말',
  '감태추출물': '감태\n추출물',
  // 리셋데이
  '글루텐분해효소': '글루텐\n분해 효소',
  '난소화성말토덱스트린': '난소화성\n말토덱스트린',
  '차전자피분말': '차전자피\n분말',
};

async function updateMechanismsNewlines() {
  console.log('mechanisms JSON 성분명 줄바꿈 업데이트 시작...');

  // 모든 healthTypeAnimalProduct 조회
  const products = await prisma.healthTypeAnimalProduct.findMany();

  let updatedCount = 0;

  for (const product of products) {
    if (!product.mechanisms) continue;

    // 이미 객체 형태로 저장되어 있음
    const mechanisms = product.mechanisms as unknown as MechanismItem[];

    if (!Array.isArray(mechanisms)) {
      console.log(`ID ${product.id}: mechanisms가 배열이 아님`);
      continue;
    }

    let hasChanges = false;

    // 각 mechanism 아이템 순회
    for (const item of mechanisms) {
      if (!item.name) continue;

      // 매핑된 이름이 있는지 확인
      for (const [oldName, newName] of Object.entries(ingredientNameMappings)) {
        if (item.name === oldName) {
          console.log(`ID ${product.id}: "${item.name}" → "${newName}"`);
          item.name = newName;
          hasChanges = true;
          break;
        }
      }
    }

    if (hasChanges) {
      await prisma.healthTypeAnimalProduct.update({
        where: { id: product.id },
        data: { mechanisms: mechanisms as any }
      });
      updatedCount++;
      console.log(`ID ${product.id} 업데이트 완료`);
    }
  }

  console.log(`\n총 ${updatedCount}개 레코드 업데이트 완료`);
}

updateMechanismsNewlines()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
