/**
 * 동물 유형 설명 이미지 GCS 업로드 및 DB 매핑 스크립트
 *
 * 사용법: npx ts-node prisma/operation/upload-animal-description-images.ts
 */

import { PrismaClient } from '@prisma/client';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// GCS 설정
const BUCKET_NAME = 'api-dev-biocom-uploads';
const GCS_FOLDER = 'health-type-animals/description';

// 파일-동물유형 매핑
const FILE_MAPPING = [
  { fileName: 'lab_animal_result.png', healthType: 'GUT_HEALTH' },      // 배 빵빵 펭귄
  { fileName: 'lab_animal_result-1.png', healthType: 'IMMUNE_BALANCE' }, // 예민한 고슴도치
  { fileName: 'lab_animal_result-2.png', healthType: 'SKIN_HEALTH' },    // 화끈한 불여우
  { fileName: 'lab_animal_result-3.png', healthType: 'METABOLISM' },     // 동면 중인 북극곰
];

async function main() {
  console.log('🚀 동물 유형 설명 이미지 업로드 시작...\n');

  // GCS 클라이언트 초기화
  const storage = new Storage();
  const bucket = storage.bucket(BUCKET_NAME);

  // 소스 폴더 경로
  const sourceDir = path.resolve(__dirname, '../../../assets/유형분류결과');

  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ 소스 폴더가 존재하지 않습니다: ${sourceDir}`);
    process.exit(1);
  }

  for (const mapping of FILE_MAPPING) {
    const filePath = path.join(sourceDir, mapping.fileName);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ 파일이 존재하지 않습니다: ${filePath}`);
      continue;
    }

    console.log(`📁 처리 중: ${mapping.fileName} → ${mapping.healthType}`);

    // 1. health_type_animals에서 ID 조회
    const healthTypeAnimal = await prisma.healthTypeAnimal.findFirst({
      where: { healthType: mapping.healthType },
    });

    if (!healthTypeAnimal) {
      console.error(`  ❌ health_type_animal을 찾을 수 없습니다: ${mapping.healthType}`);
      continue;
    }

    console.log(`  ✅ healthTypeAnimalId: ${healthTypeAnimal.id} (${healthTypeAnimal.animalName})`);

    // 2. GCS에 업로드
    const gcsFileName = `${GCS_FOLDER}/${mapping.healthType.toLowerCase()}_description.png`;

    try {
      await bucket.upload(filePath, {
        destination: gcsFileName,
        metadata: {
          contentType: 'image/png',
        },
      });
      console.log(`  ✅ GCS 업로드 완료: ${gcsFileName}`);
    } catch (error) {
      console.error(`  ❌ GCS 업로드 실패:`, error);
      continue;
    }

    const gcsUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${gcsFileName}`;

    // 3. files 테이블에 저장
    const storedName = `${mapping.healthType.toLowerCase()}_description_${Date.now()}.png`;
    const file = await prisma.file.create({
      data: {
        originalName: mapping.fileName,
        storedName: storedName,
        filePath: gcsUrl,
        mimeType: 'image/png',
        fileSize: fs.statSync(filePath).size,
        storageType: 'gcs',
        createdAt: new Date(),
      },
    });
    console.log(`  ✅ File 생성: ID ${file.id}`);

    // 4. 기존 DESCRIPTION 이미지가 있으면 삭제
    const existingFiles = await prisma.healthTypeAnimalFile.findMany({
      where: {
        healthTypeAnimalId: healthTypeAnimal.id,
        imageType: 'DESCRIPTION',
        sortOrder: 0,
      },
    });

    if (existingFiles.length > 0) {
      await prisma.healthTypeAnimalFile.deleteMany({
        where: {
          healthTypeAnimalId: healthTypeAnimal.id,
          imageType: 'DESCRIPTION',
          sortOrder: 0,
        },
      });
      console.log(`  ⚠️ 기존 DESCRIPTION 이미지 ${existingFiles.length}개 삭제`);
    }

    // 5. health_type_animal_files에 매핑
    await prisma.healthTypeAnimalFile.create({
      data: {
        healthTypeAnimalId: healthTypeAnimal.id,
        fileId: file.id,
        imageType: 'DESCRIPTION',
        sortOrder: 0,
        createdAt: new Date(),
      },
    });
    console.log(`  ✅ HealthTypeAnimalFile 매핑 완료\n`);
  }

  console.log('🎉 모든 작업 완료!');
}

main()
  .catch((e) => {
    console.error('❌ 에러 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
