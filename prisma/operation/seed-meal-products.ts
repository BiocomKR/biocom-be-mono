import { PrismaClient } from '@prisma/client';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * 팀키토 도시락 식단 상품 시드 데이터
 * 오리지널, 시그니처, 저속노화, 저포드맵 4개 라인업의 메뉴 등록
 *
 * 실행 방법:
 * npx ts-node prisma/operation/seed-meal-products.ts
 */

// GCS 설정
const BUCKET_NAME = 'api-dev-biocom-uploads';
const GCS_FOLDER = 'meal'; // meal 폴더에 업로드
const LOCAL_ASSETS_PATH = '/Users/shinwoo/Desktop/Biocom/repo/assets/meal';

interface MealProduct {
  name: string;
  price: number;
  originalPrice: number;
  status: 'ACTIVE' | 'INACTIVE';
  imageFile: string;
}

interface LineupData {
  lineupKey: string;
  lineupName: string;
  totalDiscountPrice: number;
  totalOriginalPrice: number;
  products: MealProduct[];
}

const mealLineups: LineupData[] = [
  {
    lineupKey: 'ORIGINAL',
    lineupName: '오리지널 식단',
    totalDiscountPrice: 71200,
    totalOriginalPrice: 82400,
    products: [
      { name: '수비드 통삽겹 된장 덮밥', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'pork-soybean.webp' },
      { name: '수비드 통삽겹 들기름 두부면 막국수', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'pork-tofu.webp' },
      { name: '훈제오리&들깨크림리조또', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'duck-risotto.webp' },
      { name: '우삼겹 규동&브로콜리', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'beef-broccoli.webp' },
      { name: '우삼겹 구이&두부면 오일 파스타', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'beef-oil.webp' },
      { name: 'b.t.s. 치킨 치즈 리조또', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'bts-chicken.webp' },
      { name: '소고기 버섯 들깨 덮밥', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'beef-mushroom.webp' },
      { name: '저당 키토 라자냐', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'rasagna.webp' },
    ],
  },
  {
    lineupKey: 'SIGNATURE',
    lineupName: '시그니처 식단',
    totalDiscountPrice: 59400,
    totalOriginalPrice: 67800,
    products: [
      { name: '강남역 호랑이 삼겹', price: 9900, originalPrice: 11300, status: 'ACTIVE', imageFile: 'gangnam-tiger.webp' },
      { name: '왕갈비통 닭목살', price: 9900, originalPrice: 11300, status: 'ACTIVE', imageFile: 'suwon-chicken.webp' },
      { name: '기사식당 최강 제육', price: 9900, originalPrice: 11300, status: 'ACTIVE', imageFile: 'spicy-pork-1.webp' },
      { name: '춘천 들깨 닭갈비', price: 9900, originalPrice: 11300, status: 'ACTIVE', imageFile: 'chuncheon-chicken.webp' },
      { name: '수랏간 삼치 솥밥', price: 9900, originalPrice: 11300, status: 'ACTIVE', imageFile: 'fish.webp' },
      { name: '항아리 차돌 된장', price: 9900, originalPrice: 11300, status: 'ACTIVE', imageFile: 'clay-pot.webp' },
    ],
  },
  {
    lineupKey: 'SLOW_AGING',
    lineupName: '저속노화 식단',
    totalDiscountPrice: 62300,
    totalOriginalPrice: 72100,
    products: [
      { name: '수비드간장치킨', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '수비드 간장치킨.webp' },
      { name: '시트러스대구', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '시트러스 대구 찜.webp' },
      { name: '로제 닭갈비', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '토마토 로제 닭갈비.webp' },
      { name: '미소버터 대구 조림', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '미소버터 대구 조림.webp' },
      { name: '미소버터 연어 조림', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '미소버터 연어 조림.webp' },
      { name: '코코넛치킨 커리', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '코코넛 크림 치킨 커리.webp' },
      { name: '아라비아따 오리 찜', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '아라비아따 오리 찜.webp' },
    ],
  },
  {
    lineupKey: 'LOW_FODMAP',
    lineupName: '저포드맵 식단',
    totalDiscountPrice: 62300,
    totalOriginalPrice: 72100,
    products: [
      { name: '치킨스튜&두부', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '토마토 치킨 스튜.webp' },
      { name: '비프스튜&두부', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '토마토 비프 스튜.webp' },
      { name: '순살갈비찜&두부', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '순살 갈비찜 두부.webp' },
      { name: '수비드닭다리살&오믈렛', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '간장 수비드 닭다리살 오믈렛.webp' },
      { name: '수비드목살&오믈렛', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '간장 수비드 목살 오믈렛.webp' },
      { name: '순살삼계찜닭&두부', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '순살 삼계찜닭 두부.webp' },
      { name: '오리불고기&두부', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '들깨 오리불고기 두부.webp' },
    ],
  },
];

function generateSku(lineupKey: string, index: number): string {
  return `MEAL_${lineupKey}_${String(index + 1).padStart(2, '0')}`;
}

/**
 * 로컬 이미지를 GCS에 업로드하고 URL 반환
 */
async function uploadImageToGCS(storage: Storage, imageFile: string): Promise<string | null> {
  const localPath = path.join(LOCAL_ASSETS_PATH, imageFile);

  if (!fs.existsSync(localPath)) {
    console.log(`      ⚠️ 이미지 파일 없음: ${localPath}`);
    return null;
  }

  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const destination = `${GCS_FOLDER}/${imageFile}`;

    // 이미 존재하는지 확인
    const file = bucket.file(destination);
    const [exists] = await file.exists();

    if (exists) {
      const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;
      console.log(`      ⏩ 이미 업로드됨: ${imageFile}`);
      return publicUrl;
    }

    // 업로드
    await bucket.upload(localPath, {
      destination,
      metadata: {
        contentType: 'image/webp',
      },
    });

    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${destination}`;
    console.log(`      ✅ 업로드 완료: ${imageFile}`);
    return publicUrl;
  } catch (error) {
    console.error(`      ❌ 업로드 실패: ${imageFile}`, error.message);
    return null;
  }
}

async function main() {
  console.log('🍱 팀키토 도시락 식단 상품 시드 시작...\n');
  console.log(`📁 로컬 이미지 경로: ${LOCAL_ASSETS_PATH}`);
  console.log(`☁️  GCS 버킷: ${BUCKET_NAME}/${GCS_FOLDER}\n`);

  // GCS 초기화
  const storage = new Storage();

  // 로컬 이미지 폴더 확인
  if (!fs.existsSync(LOCAL_ASSETS_PATH)) {
    console.error(`❌ 이미지 폴더가 없습니다: ${LOCAL_ASSETS_PATH}`);
    process.exit(1);
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalImagesUploaded = 0;

  for (const lineup of mealLineups) {
    console.log(`\n📋 ${lineup.lineupName} (${lineup.lineupKey}) 처리 중...`);
    console.log(`   식단 합계: 할인가 ₩${lineup.totalDiscountPrice.toLocaleString()} / 정가 ₩${lineup.totalOriginalPrice.toLocaleString()}`);

    const productLineup = await prisma.productLineup.findUnique({
      where: { key: lineup.lineupKey },
    });

    if (!productLineup) {
      console.log(`   ⚠️ 라인업을 찾을 수 없습니다: ${lineup.lineupKey}. 스킵합니다.`);
      totalSkipped += lineup.products.length;
      continue;
    }

    console.log(`   라인업 ID: ${productLineup.id}`);

    let lineupCreated = 0;
    let lineupUpdated = 0;

    for (let i = 0; i < lineup.products.length; i++) {
      const product = lineup.products[i];
      const sku = generateSku(lineup.lineupKey, i);

      // 이미지 업로드
      const imageUrl = await uploadImageToGCS(storage, product.imageFile);

      // 기존 상품 조회
      let existing = await prisma.product.findFirst({
        where: { sku },
      });

      if (!existing) {
        existing = await prisma.product.findFirst({
          where: {
            name: product.name,
            lineupId: productLineup.id,
          },
        });
      }

      const now = new Date();

      if (existing) {
        // 기존 데이터 업데이트
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            name: product.name,
            price: product.price,
            originalPrice: product.originalPrice,
            status: product.status,
            lineupId: productLineup.id,
            updatedAt: now,
          },
        });
        console.log(`   ✅ 업데이트: ${product.name} (ID: ${existing.id}, ₩${product.price.toLocaleString()})`);
        lineupUpdated++;

        // 이미지 처리
        if (imageUrl) {
          const existingFile = await prisma.productFile.findFirst({
            where: { productId: existing.id, imageType: 'MAIN' },
          });

          if (existingFile) {
            await prisma.file.update({
              where: { id: existingFile.fileId },
              data: { filePath: imageUrl },
            });
          } else {
            const file = await prisma.file.create({
              data: {
                storedName: product.imageFile,
                originalName: `${product.name} 메인 이미지`,
                mimeType: 'image/webp',
                fileSize: 0,
                filePath: imageUrl,
                storageType: 'GCS',
              },
            });
            await prisma.productFile.create({
              data: {
                productId: existing.id,
                fileId: file.id,
                imageType: 'MAIN',
                sortOrder: 0,
                createdAt: now,
                altText: product.name,
              },
            });
            totalImagesUploaded++;
          }
        }
      } else {
        // 신규 생성
        const createdProduct = await prisma.product.create({
          data: {
            sku,
            name: product.name,
            description: `${lineup.lineupName} - ${product.name}`,
            categoryCode: 'MEAL',
            categoryName: '도시락',
            productType: 'SINGLE',
            price: product.price,
            originalPrice: product.originalPrice,
            status: product.status,
            lineupId: productLineup.id,
            shippingPolicy: 'CONDITIONAL',
            shippingFee: 3000,
            createdAt: now,
          },
        });
        console.log(`   ✅ 생성: ${product.name} (ID: ${createdProduct.id}, SKU: ${sku}, ₩${product.price.toLocaleString()})`);
        lineupCreated++;

        // 이미지 등록
        if (imageUrl) {
          const file = await prisma.file.create({
            data: {
              storedName: product.imageFile,
              originalName: `${product.name} 메인 이미지`,
              mimeType: 'image/webp',
              fileSize: 0,
              filePath: imageUrl,
              storageType: 'GCS',
            },
          });
          await prisma.productFile.create({
            data: {
              productId: createdProduct.id,
              fileId: file.id,
              imageType: 'MAIN',
              sortOrder: 0,
              createdAt: now,
              altText: product.name,
            },
          });
          totalImagesUploaded++;
        }
      }
    }

    console.log(`   📊 ${lineup.lineupName} 결과: 생성 ${lineupCreated}개, 업데이트 ${lineupUpdated}개`);
    totalCreated += lineupCreated;
    totalUpdated += lineupUpdated;
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 팀키토 도시락 식단 상품 시드 완료!');
  console.log(`📊 총 결과: 생성 ${totalCreated}개, 업데이트 ${totalUpdated}개, 스킵 ${totalSkipped}개`);
  console.log(`🖼️  이미지 등록: ${totalImagesUploaded}개`);
  console.log('='.repeat(60));

  // 결과 요약
  console.log('\n📋 라인업별 상품 현황:');
  for (const lineup of mealLineups) {
    const count = await prisma.product.count({
      where: {
        lineup: { key: lineup.lineupKey },
        categoryCode: 'MEAL',
      },
    });
    const activeCount = await prisma.product.count({
      where: {
        lineup: { key: lineup.lineupKey },
        categoryCode: 'MEAL',
        status: 'ACTIVE',
      },
    });
    console.log(`   ${lineup.lineupName}: ${count}개 (활성: ${activeCount}개)`);
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
