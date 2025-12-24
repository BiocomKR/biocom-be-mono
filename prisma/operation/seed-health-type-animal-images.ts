import { PrismaClient } from '@prisma/client';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * 건강유형 동물 이미지 업데이트 시드
 * assets/3)animal 폴더의 이미지를 GCS에 업로드하고 DB 업데이트
 *
 * 이미지 매핑:
 * - fox.png, penguin.png, polarbear.png, hedgehog.png → THUMBNAIL
 * - thumb_*.jpg → DESCRIPTION (sortOrder: 0)
 * - result_*.png → DESCRIPTION (sortOrder: 1)
 *
 * 실행 방법:
 * npx ts-node prisma/operation/seed-health-type-animal-images.ts
 */

// GCS 설정
const BUCKET_NAME = 'api-dev-biocom-uploads';
const GCS_FOLDER = 'health-type-animals';
const LOCAL_ASSETS_PATH = '/Users/shinwoo/Desktop/Biocom/repo/assets/3)animal';

interface AnimalImageMapping {
  healthType: string;
  animalId: number;
  thumbnail: string;       // 기본 동물 이미지 (THUMBNAIL)
  description0: string;    // thumb_*.jpg (DESCRIPTION sortOrder 0)
  description1: string;    // result_*.png (DESCRIPTION sortOrder 1)
}

const animalMappings: AnimalImageMapping[] = [
  {
    healthType: 'SKIN_HEALTH',
    animalId: 1,
    thumbnail: 'fox.png',
    description0: 'thumb_fox.jpg',
    description1: 'result_fox.png',
  },
  {
    healthType: 'METABOLISM',
    animalId: 2,
    thumbnail: 'polarbear.png',
    description0: 'thumb_bear.jpg',
    description1: 'result_bear.png',
  },
  {
    healthType: 'GUT_HEALTH',
    animalId: 3,
    thumbnail: 'penguin.png',
    description0: 'thumb_penguin.jpg',
    description1: 'result_penguin.png',
  },
  {
    healthType: 'IMMUNE_BALANCE',
    animalId: 4,
    thumbnail: 'hedgehog.png',
    description0: 'thumb_hedgehog.jpg',
    description1: 'result_hedgehog.png',
  },
];

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return 'image/png';
  }
}

/**
 * 로컬 이미지를 GCS에 업로드하고 URL 반환
 */
async function uploadImageToGCS(
  storage: Storage,
  imageFile: string,
  animalId: number,
  imageType: string,
): Promise<string | null> {
  const localPath = path.join(LOCAL_ASSETS_PATH, imageFile);

  if (!fs.existsSync(localPath)) {
    console.log(`   ⚠️ 이미지 파일 없음: ${localPath}`);
    return null;
  }

  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const ext = path.extname(imageFile);
    const timestamp = Date.now().toString(16);
    const destination = `${GCS_FOLDER}/${animalId}/${imageType.toLowerCase()}_${timestamp}${ext}`;

    // 업로드
    await bucket.upload(localPath, {
      destination,
      metadata: {
        contentType: getMimeType(imageFile),
      },
    });

    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;
    console.log(`   ✅ 업로드: ${imageFile} → ${destination}`);
    return publicUrl;
  } catch (error) {
    console.error(`   ❌ 업로드 실패: ${imageFile}`, error.message);
    return null;
  }
}

/**
 * File 레코드 생성
 */
async function createFileRecord(
  imageUrl: string,
  originalName: string,
  mimeType: string,
): Promise<number> {
  const file = await prisma.file.create({
    data: {
      storedName: path.basename(imageUrl),
      originalName,
      mimeType,
      fileSize: 0,
      filePath: imageUrl,
      storageType: 'GCS',
    },
  });
  return file.id;
}

async function main() {
  console.log('🐾 건강유형 동물 이미지 업데이트 시작...\n');
  console.log(`📁 로컬 이미지 경로: ${LOCAL_ASSETS_PATH}`);
  console.log(`☁️  GCS 버킷: ${BUCKET_NAME}/${GCS_FOLDER}\n`);

  // GCS 초기화
  const storage = new Storage();

  // 로컬 이미지 폴더 확인
  if (!fs.existsSync(LOCAL_ASSETS_PATH)) {
    console.error(`❌ 이미지 폴더가 없습니다: ${LOCAL_ASSETS_PATH}`);
    process.exit(1);
  }

  for (const mapping of animalMappings) {
    console.log(`\n🦊 ${mapping.healthType} (ID: ${mapping.animalId}) 처리 중...`);

    // 기존 이미지 관계 삭제
    const deleted = await prisma.healthTypeAnimalFile.deleteMany({
      where: { healthTypeAnimalId: mapping.animalId },
    });
    console.log(`   🗑️ 기존 이미지 관계 ${deleted.count}개 삭제`);

    const now = new Date();

    // 1. THUMBNAIL 업로드 (기본 동물 이미지)
    const thumbnailUrl = await uploadImageToGCS(storage, mapping.thumbnail, mapping.animalId, 'thumbnail');
    if (thumbnailUrl) {
      const fileId = await createFileRecord(thumbnailUrl, mapping.thumbnail, getMimeType(mapping.thumbnail));
      await prisma.healthTypeAnimalFile.create({
        data: {
          healthTypeAnimalId: mapping.animalId,
          fileId,
          imageType: 'THUMBNAIL',
          sortOrder: 0,
          createdAt: now,
        },
      });
      console.log(`   📷 THUMBNAIL 등록 완료`);
    }

    // 2. DESCRIPTION sortOrder 0 (thumb_*.jpg)
    const desc0Url = await uploadImageToGCS(storage, mapping.description0, mapping.animalId, 'description');
    if (desc0Url) {
      const fileId = await createFileRecord(desc0Url, mapping.description0, getMimeType(mapping.description0));
      await prisma.healthTypeAnimalFile.create({
        data: {
          healthTypeAnimalId: mapping.animalId,
          fileId,
          imageType: 'DESCRIPTION',
          sortOrder: 0,
          createdAt: now,
        },
      });
      console.log(`   📷 DESCRIPTION[0] 등록 완료`);
    }

    // 3. DESCRIPTION sortOrder 1 (result_*.png)
    const desc1Url = await uploadImageToGCS(storage, mapping.description1, mapping.animalId, 'description');
    if (desc1Url) {
      const fileId = await createFileRecord(desc1Url, mapping.description1, getMimeType(mapping.description1));
      await prisma.healthTypeAnimalFile.create({
        data: {
          healthTypeAnimalId: mapping.animalId,
          fileId,
          imageType: 'DESCRIPTION',
          sortOrder: 1,
          createdAt: now,
        },
      });
      console.log(`   📷 DESCRIPTION[1] 등록 완료`);
    }

    console.log(`   ✅ ${mapping.healthType} 완료`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 건강유형 동물 이미지 업데이트 완료!');
  console.log('='.repeat(60));

  // 결과 확인
  console.log('\n📋 업데이트 결과:');
  const animals = await prisma.healthTypeAnimal.findMany({
    include: {
      images: {
        include: { file: true },
        orderBy: [{ imageType: 'asc' }, { sortOrder: 'asc' }],
      },
    },
    orderBy: { id: 'asc' },
  });

  for (const animal of animals) {
    console.log(`\n   ${animal.animalName} (${animal.healthType}):`);
    for (const img of animal.images) {
      console.log(`      - ${img.imageType}[${img.sortOrder}]: ${img.file?.filePath}`);
    }
  }
}

main()
  .catch((e) => {
    console.error('시드 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
