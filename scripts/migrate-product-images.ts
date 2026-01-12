// @ts-nocheck
/**
 * [DEPRECATED] product_images → files + product_files 마이그레이션 스크립트
 *
 * ProductImage 모델이 삭제되어 이 스크립트는 더 이상 사용되지 않습니다.
 * 마이그레이션이 이미 완료되었습니다.
 *
 * 1. imweb URL에서 파일 다운로드
 * 2. GCS 버킷에 업로드 (products/{hash}.{ext} 형태)
 * 3. files 테이블 INSERT
 * 4. product_files 테이블 INSERT
 *
 * 실행: npx ts-node scripts/migrate-product-images.ts
 */

console.log('⚠️ 이 스크립트는 더 이상 사용되지 않습니다. ProductImage 모델이 삭제되었습니다.');
process.exit(0);

/* eslint-disable */

import { PrismaClient } from '@prisma/client';
import { Storage } from '@google-cloud/storage';
import * as crypto from 'crypto';
import * as path from 'path';

const prisma = new PrismaClient();

// GCS 설정
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});
const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'api-dev-biocom-uploads';

/**
 * URL에서 파일 다운로드
 */
async function downloadFile(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`다운로드 실패: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = response.headers.get('content-type') || 'image/png';

  return { buffer, mimeType };
}

/**
 * GCS에 파일 업로드
 */
async function uploadToGCS(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
    },
    public: true,
  });

  const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
  return publicUrl;
}

/**
 * MIME 타입에서 확장자 추출
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
  };
  return mimeToExt[mimeType] || '.png';
}

/**
 * URL에서 확장자 추출
 */
function getExtensionFromUrl(url: string): string {
  const urlPath = new URL(url).pathname;
  const ext = path.extname(urlPath).toLowerCase();
  return ext || '.png';
}

async function main() {
  console.log('🚀 product_images → files + product_files 마이그레이션 시작...\n');

  // 1. product_images 전체 조회
  const productImages = await prisma.productImage.findMany({
    orderBy: { id: 'asc' },
  });

  console.log(`📦 마이그레이션 대상: ${productImages.length}개\n`);

  let successCount = 0;
  let failCount = 0;

  for (const image of productImages) {
    try {
      console.log(`[${image.id}] 처리 중: ${image.altText || '이름없음'}`);

      // 2. imweb URL에서 파일 다운로드
      console.log(`  ↓ 다운로드: ${image.imageUrl}`);
      const { buffer, mimeType } = await downloadFile(image.imageUrl);
      console.log(`  ✓ 다운로드 완료 (${(buffer.length / 1024).toFixed(1)}KB, ${mimeType})`);

      // 3. 파일명 생성 (products/{hash}.{ext})
      const ext = getExtensionFromUrl(image.imageUrl) || getExtensionFromMimeType(mimeType);
      const hash = crypto.randomBytes(16).toString('hex');
      const storedName = `products/${hash}${ext}`;

      // 4. GCS 업로드
      console.log(`  ↑ GCS 업로드: ${storedName}`);
      const publicUrl = await uploadToGCS(buffer, storedName, mimeType);
      console.log(`  ✓ 업로드 완료: ${publicUrl}`);

      // 5. files 테이블 INSERT
      const originalName = image.altText
        ? `${image.altText}${ext}`
        : `product_${image.productId}${ext}`;

      const fileRecord = await prisma.file.create({
        data: {
          originalName,
          storedName,
          filePath: publicUrl,
          fileSize: buffer.length,
          mimeType,
          storageType: 'gcs',
          createdAt: image.createdAt,
        },
      });
      console.log(`  ✓ files 테이블 INSERT (id: ${fileRecord.id})`);

      // 6. product_files 테이블 INSERT
      const productFile = await prisma.productFile.create({
        data: {
          productId: image.productId,
          fileId: fileRecord.id,
          imageType: 'MAIN', // 기존 MAIN → MAIN
          sortOrder: image.sortOrder,
          altText: image.altText,
          createdAt: image.createdAt,
        },
      });
      console.log(`  ✓ product_files 테이블 INSERT (id: ${productFile.id})`);

      successCount++;
      console.log(`  ✅ 완료!\n`);

    } catch (error) {
      failCount++;
      console.error(`  ❌ 실패: ${error.message}\n`);
    }
  }

  // 7. 검증
  console.log('─'.repeat(50));
  console.log('📊 마이그레이션 결과');
  console.log('─'.repeat(50));
  console.log(`총 대상: ${productImages.length}개`);
  console.log(`성공: ${successCount}개`);
  console.log(`실패: ${failCount}개`);

  const productFilesCount = await prisma.productFile.count();
  console.log(`\n🔍 검증: product_files 테이블 레코드 수: ${productFilesCount}개`);

  if (productFilesCount === productImages.length) {
    console.log('✅ 마이그레이션 완료! 데이터 개수 일치');
  } else {
    console.log('⚠️ 주의: 데이터 개수 불일치');
  }
}

main()
  .catch((e) => {
    console.error('❌ 마이그레이션 실행 중 오류 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
