/**
 * 쿠폰 이미지 업로드 및 DB 업데이트 스크립트
 *
 * 사용법: npx ts-node prisma/operation/upload-coupon-images.ts
 */

import { PrismaClient } from '@prisma/client';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// 이미지 파일명 -> 쿠폰명 매핑
const IMAGE_TO_COUPON_MAP: Record<string, string[]> = {
  'bio_balance_20off.png': ['바이오 밸런스'],
  'clean_balance_20off.png': ['클린 밸런스'],
  'cortisol_analysis_20off.png': ['종합 호르몬균형 분석'],
  'dangdang_care_20off.png': ['당당케어', '혈당관리엔 당당케어'],
  'darae_care_20off.png': ['다래케어'],
  'meta_dream_20off.png': ['메타드림'],
  'metabolism_analysis_20off.png': ['종합 대사기능 분석'],
  'neuro_master_20off.png': ['뉴로 마스터'],
  'pungsung_balance_20off.png': ['풍성 밸런스'],
  'reset_day_20off.png': ['리셋데이'],
  'sunfiber_20off.png': ['썬화이버'],
  'young_days_20off.png': ['영데이즈'],
};

async function main() {
  const couponImagesDir = path.join(process.env.HOME || '', 'Downloads/coupon');

  // GCS 클라이언트 초기화
  const storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'api-dev-biocom',
    keyFilename: './google-service-account-key-dev.json',
  });

  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'api-dev-biocom-uploads';
  const bucket = storage.bucket(bucketName);

  console.log('=== 쿠폰 이미지 업로드 시작 ===\n');

  // 모든 쿠폰 조회
  const coupons = await prisma.coupon.findMany({
    select: { id: true, name: true, imageUrl: true },
  });

  console.log(`총 ${coupons.length}개 쿠폰 조회됨\n`);

  for (const [filename, couponKeywords] of Object.entries(IMAGE_TO_COUPON_MAP)) {
    const imagePath = path.join(couponImagesDir, filename);

    if (!fs.existsSync(imagePath)) {
      console.log(`[SKIP] 이미지 파일 없음: ${filename}`);
      continue;
    }

    // 해당 키워드가 포함된 쿠폰 찾기
    const matchingCoupons = coupons.filter(c =>
      couponKeywords.some(keyword => c.name.includes(keyword))
    );

    if (matchingCoupons.length === 0) {
      console.log(`[SKIP] 매칭되는 쿠폰 없음: ${filename} (키워드: ${couponKeywords.join(', ')})`);
      continue;
    }

    // GCS에 이미지 업로드
    const gcsFileName = `coupons/${filename}`;

    try {
      await bucket.upload(imagePath, {
        destination: gcsFileName,
        metadata: {
          contentType: 'image/png',
        },
      });

      const imageUrl = `https://storage.googleapis.com/${bucketName}/${gcsFileName}`;
      console.log(`[UPLOAD] ${filename} -> ${imageUrl}`);

      // 매칭되는 모든 쿠폰에 이미지 URL 업데이트
      for (const coupon of matchingCoupons) {
        await prisma.coupon.update({
          where: { id: coupon.id },
          data: { imageUrl },
        });
        console.log(`  [UPDATE] ID ${coupon.id}: ${coupon.name}`);
      }
    } catch (error) {
      console.error(`[ERROR] ${filename} 업로드 실패:`, error);
    }
  }

  console.log('\n=== 완료 ===');

  // 결과 확인
  const updatedCoupons = await prisma.coupon.findMany({
    select: { id: true, name: true, imageUrl: true },
    orderBy: { id: 'asc' },
  });

  console.log('\n=== 업데이트 결과 ===');
  for (const c of updatedCoupons) {
    console.log(`ID ${c.id}: ${c.name} -> ${c.imageUrl || '(없음)'}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
