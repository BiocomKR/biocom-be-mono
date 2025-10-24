/**
 * 건강 유형별 동물 캐릭터 시드 데이터
 * 설문 결과에 따라 4가지 건강 유형으로 분류하고 각 유형별 동물 캐릭터 정보를 저장
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 건강 유형별 동물 캐릭터 데이터
 */
const healthTypeAnimals = [
  {
    healthType: 'SKIN_HEALTH',
    typeName: '염증형',
    animalName: '화끈한 불여우',
    catchphrase: '화끈한 불여우',
    symptoms: `
      피부가 자주 붉어지고 가렵다
      얼굴에 뾰루지가 잘 생긴다
      생리통이 심하다
      갑자기 얼굴이 달아오른다
      속이 자주 더부룩하다
    `.trim(),
  },
  {
    healthType: 'METABOLISM',
    typeName: '대사형',
    animalName: '동면 중인 북극곰',
    catchphrase: '동면 중인 북극곰',
    symptoms: `
      요즘 특히 피곤하다
      작은 일에도 쉽게 지친다
      살이 잘 찐다
      얼굴이 잘 붓는다
      아침에 일어나기 힘들다
    `.trim(),
  },
  {
    healthType: 'GUT_HEALTH',
    typeName: '장형',
    animalName: '배 빵빵 펭귄',
    catchphrase: '배 빵빵 펭귄',
    symptoms: `
      배에 가스가 자주 찬다
      변비나 설사가 잦다
      배가 자주 아프다
      소화가 잘 안 된다
      트림이 자주 나온다
    `.trim(),
  },
  {
    healthType: 'IMMUNE_BALANCE',
    typeName: '면역형',
    animalName: '예민한 고슴도치',
    catchphrase: '예민한 고슴도치',
    symptoms: `
      환절기만 되면 감기에 걸린다
      입술이나 입안이 자주 헌다
      코막힘이나 콧물이 자주 난다
      몸이 자주 으슬으슬하다
      목이 자주 아프다
    `.trim(),
  },
];

async function main() {
  console.log('🌱 건강 유형별 동물 캐릭터 시드 시작...');

  // 기존 데이터 삭제
  await prisma.healthTypeAnimal.deleteMany({});
  console.log('✅ 기존 데이터 삭제 완료');

  // 새로운 데이터 삽입
  for (const animal of healthTypeAnimals) {
    const created = await prisma.healthTypeAnimal.create({
      data: {
        healthType: animal.healthType,
        typeName: animal.typeName,
        animalName: animal.animalName,
        catchphrase: animal.catchphrase,
        symptoms: animal.symptoms,
        createdAt: new Date(),
      },
    });
    console.log(`✅ ${created.typeName} (${created.animalName}) 생성 완료`);
  }

  console.log('🎉 건강 유형별 동물 캐릭터 시드 완료!');
}

main()
  .catch((e) => {
    console.error('❌ 시드 실행 중 오류 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
