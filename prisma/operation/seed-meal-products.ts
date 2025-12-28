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
  ingredients?: string[];
  // 영양성분 (CSV 데이터 기반)
  calories?: number; // 칼로리 (kcal)
  protein?: number; // 단백질 (g)
  fat?: number; // 지방 (g)
  netCarbs?: number; // 순탄수화물 (g)
  fiber?: number; // 식이섬유 (g)
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
      { name: '수비드 통삼겹 된장 덮밥', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'pork-soybean.webp', ingredients: ['돼지고기', '된장', '대두', '두부', '마늘', '양파', '브로콜리', '시금치'], calories: 480, protein: 27, fat: 29, netCarbs: 24, fiber: 3 },
      { name: '수비드 통삼겹 들기름 두부면 막국수', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'pork-tofu.webp', ingredients: ['돼지고기', '두부', '대두', '들기름', '오이', '배', '참깨', '고춧가루'], calories: 714, protein: 44, fat: 50, netCarbs: 15, fiber: 6 },
      { name: '훈제오리&들깨크림리조또', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'duck-risotto.webp', ingredients: ['오리고기', '대두', '컬리플라워', '들깨', '우유', '쌀', '부추'], calories: 651, protein: 27, fat: 46, netCarbs: 17, fiber: 14 },
      { name: '우삼겹 규동&브로콜리', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'beef-broccoli.webp', ingredients: ['소고기', '브로콜리', '양파', '간장', '대두', '마늘', '생강', '참기름'], calories: 457, protein: 22, fat: 33, netCarbs: 13, fiber: 5 },
      { name: '우삼겹 구이&두부면 오일 파스타', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'beef-oil.webp', ingredients: ['대두', '소고기', '올리브유', '마늘', '우유', '치즈', '브로콜리', '닭고기'], calories: 802, protein: 44, fat: 64, netCarbs: 6, fiber: 7 },
      { name: 'b.t.s. 치킨 치즈 리조또', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'bts-chicken.webp', ingredients: ['닭고기', '치즈', '우유', '베이컨', '돼지고기', '토마토', '양파', '마늘'], calories: 475, protein: 46, fat: 22, netCarbs: 20, fiber: 4 },
      { name: '소고기 버섯 들깨 덮밥', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'beef-mushroom.webp', ingredients: ['소고기', '컬리플라워', '부추', '버섯', '들깨', '들기름', '마늘'], calories: 608, protein: 36, fat: 44, netCarbs: 5, fiber: 12.5 },
      { name: '저당 키토 라자냐', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: 'rasagna.webp', ingredients: ['토마토', '치즈', '양파', '소고기', '마늘', '와인', '우유', '올리브유', '바질', '닭고기', '대두', '파슬리'], calories: 604, protein: 57, fat: 29, netCarbs: 21, fiber: 9.4 },
    ],
  },
  {
    lineupKey: 'SIGNATURE',
    lineupName: '시그니처 식단',
    totalDiscountPrice: 59400,
    totalOriginalPrice: 67800,
    products: [
      { name: '강남역 호랑이 삼겹', price: 9900, originalPrice: 11300, status: 'ACTIVE', imageFile: 'gangnam-tiger.webp', ingredients: ['돼지고기', '브로콜리', '시금치', '참깨', '현미', '대두', '밀', '꽈리고추', '타피오카', '계피', '고춧가루'], calories: 687, protein: 28, fat: 51, netCarbs: 25, fiber: 6 },
      { name: '왕갈비통 닭목살', price: 9900, originalPrice: 11300, status: 'ACTIVE', imageFile: 'suwon-chicken.webp', ingredients: ['닭고기', '브로콜리', '시금치', '참깨', '현미', '대두', '밀', '꽈리고추', '타피오카', '계피', '후추'], calories: 402, protein: 36, fat: 18, netCarbs: 22, fiber: 1 },
      { name: '기사식당 최강 제육', price: 9900, originalPrice: 11300, status: 'ACTIVE', imageFile: 'spicy-pork-1.webp', ingredients: ['돼지고기', '브로콜리', '시금치', '참깨', '쌀', '고춧가루', '마늘', '양파', '대두', '밀', '들기름'], calories: 598, protein: 34, fat: 35, netCarbs: 32, fiber: 8 },
      { name: '춘천 들깨 닭갈비', price: 9900, originalPrice: 11300, status: 'ACTIVE', imageFile: 'chuncheon-chicken.webp', ingredients: ['닭고기', '들깨', '고춧가루', '양파', '마늘', '고구마', '양배추', '대두', '참기름'], calories: 351, protein: 48, fat: 19, netCarbs: 19, fiber: 5 },
      { name: '수랏간 삼치 솥밥', price: 9900, originalPrice: 11300, status: 'ACTIVE', imageFile: 'fish.webp', ingredients: ['삼치', '쌀', '고춧가루', '마늘', '양파', '대두', '밀', '들기름', '후추', '브로콜리', '시금치', '참깨', '대파', '표고버섯', '토마토'], calories: 289, protein: 28, fat: 8, netCarbs: 14, fiber: 5 },
      { name: '항아리 차돌 된장', price: 9900, originalPrice: 11300, status: 'ACTIVE', imageFile: 'clay-pot.webp', ingredients: ['소고기', '브로콜리', '시금치', '참깨', '대두', '양파', '쥬키니호박', '마늘', '고춧가루', '청양고추', '들기름', '대파'], calories: 429, protein: 25, fat: 27, netCarbs: 18, fiber: 4 },
    ],
  },
  {
    lineupKey: 'SLOW_AGING',
    lineupName: '저속노화 식단',
    totalDiscountPrice: 62300,
    totalOriginalPrice: 72100,
    products: [
      { name: '수비드간장치킨', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '수비드 간장치킨.webp', ingredients: ['닭고기', '간장', '대두', '마늘', '생강', '참기름', '브로콜리', '시금치'], calories: 293, protein: 25, fat: 9, netCarbs: 28, fiber: 7 },
      { name: '시트러스대구', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '시트러스 대구 찜.webp', ingredients: ['대구', '레몬', '오렌지', '올리브유', '마늘', '허브', '브로콜리'], calories: 311, protein: 19, fat: 11, netCarbs: 34, fiber: 9 },
      { name: '로제 닭갈비', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '토마토 로제 닭갈비.webp', ingredients: ['닭고기', '토마토', '우유', '치즈', '양파', '마늘', '고춧가루', '대두'], calories: 314, protein: 20, fat: 14, netCarbs: 26.8, fiber: 8.2 },
      { name: '미소버터 대구 조림', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '미소버터 대구 조림.webp', ingredients: ['대구', '미소', '버터', '우유', '대두', '마늘', '청경채'], calories: 237, protein: 21, fat: 9, netCarbs: 18, fiber: 8 },
      { name: '미소버터 연어 조림', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '미소버터 연어 조림.webp', ingredients: ['연어', '미소', '버터', '우유', '대두', '마늘', '브로콜리'], calories: 286, protein: 20, fat: 14, netCarbs: 20, fiber: 8 },
      { name: '코코넛치킨 커리', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '코코넛 크림 치킨 커리.webp', ingredients: ['닭고기', '코코넛밀크', '커리파우더', '양파', '마늘', '생강', '토마토'], calories: 332, protein: 21, fat: 16, netCarbs: 26, fiber: 10 },
      { name: '아라비아따 오리 찜', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '아라비아따 오리 찜.webp', ingredients: ['오리고기', '토마토', '마늘', '올리브유', '고추', '바질', '양파'], calories: 305, protein: 14, fat: 13, netCarbs: 33.6, fiber: 8.4 },
    ],
  },
  {
    lineupKey: 'LOW_FODMAP',
    lineupName: '저포드맵 식단',
    totalDiscountPrice: 62300,
    totalOriginalPrice: 72100,
    products: [
      { name: '치킨스튜&두부', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '토마토 치킨 스튜.webp', ingredients: ['닭고기', '토마토', '두부', '대두', '감자', '당근', '셀러리', '올리브유'], calories: 345, protein: 19, fat: 13, netCarbs: 38.4, fiber: 6.6 },
      { name: '비프스튜&두부', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '토마토 비프 스튜.webp', ingredients: ['소고기', '토마토', '두부', '대두', '감자', '당근', '셀러리', '올리브유'], calories: 347.4, protein: 15, fat: 15, netCarbs: 38.1, fiber: 6.9 },
      { name: '순살갈비찜&두부', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '순살 갈비찜 두부.webp', ingredients: ['소고기', '두부', '대두', '간장', '배', '마늘', '생강', '참기름'], calories: 342, protein: 26, fat: 10, netCarbs: 37, fiber: 1 },
      { name: '수비드닭다리살&오믈렛', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '간장 수비드 닭다리살 오믈렛.webp', ingredients: ['닭고기', '계란', '간장', '대두', '마늘', '버터', '우유', '파슬리'], calories: 424, protein: 28, fat: 16, netCarbs: 41, fiber: 1 },
      { name: '수비드목살&오믈렛', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '간장 수비드 목살 오믈렛.webp', ingredients: ['돼지고기', '계란', '간장', '대두', '마늘', '버터', '우유', '파슬리'], calories: 414, protein: 26, fat: 18, netCarbs: 37, fiber: 3 },
      { name: '순살삼계찜닭&두부', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '순살 삼계찜닭 두부.webp', ingredients: ['닭고기', '두부', '대두', '인삼', '대추', '마늘', '찹쌀', '생강'], calories: 342, protein: 25, fat: 10, netCarbs: 38, fiber: 1 },
      { name: '오리불고기&두부', price: 8900, originalPrice: 10300, status: 'ACTIVE', imageFile: '들깨 오리불고기 두부.webp', ingredients: ['오리고기', '두부', '대두', '들깨', '간장', '마늘', '생강', '참기름'], calories: 365, protein: 22, fat: 17, netCarbs: 31, fiber: 7 },
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
        const updateData: any = {
          name: product.name,
          price: product.price,
          originalPrice: product.originalPrice,
          status: product.status,
          lineupId: productLineup.id,
          updatedAt: now,
          // 영양성분 컬럼
          calories: product.calories,
          protein: product.protein,
          fat: product.fat,
          netCarbs: product.netCarbs,
          fiber: product.fiber,
        };
        // ingredients가 있으면 metadata에 추가
        if (product.ingredients) {
          updateData.metadata = { ingredients: product.ingredients };
        }
        await prisma.product.update({
          where: { id: existing.id },
          data: updateData,
        });
        console.log(`   ✅ 업데이트: ${product.name} (ID: ${existing.id}, ₩${product.price.toLocaleString()})${product.ingredients ? ' [+ingredients]' : ''}`);
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
        const createData: any = {
          sku,
          name: product.name,
          description: `${lineup.lineupName} - ${product.name}`,
          categoryCode: 'LUNCHBOX',
          categoryName: '도시락',
          productType: 'SINGLE',
          price: product.price,
          originalPrice: product.originalPrice,
          status: product.status,
          lineupId: productLineup.id,
          shippingPolicy: 'CONDITIONAL',
          shippingFee: 3000,
          createdAt: now,
          // 영양성분 컬럼
          calories: product.calories,
          protein: product.protein,
          fat: product.fat,
          netCarbs: product.netCarbs,
          fiber: product.fiber,
        };
        // ingredients가 있으면 metadata에 추가
        if (product.ingredients) {
          createData.metadata = { ingredients: product.ingredients };
        }
        const createdProduct = await prisma.product.create({
          data: createData,
        });
        console.log(`   ✅ 생성: ${product.name} (ID: ${createdProduct.id}, SKU: ${sku}, ₩${product.price.toLocaleString()})${product.ingredients ? ' [+ingredients]' : ''}`);
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
        categoryCode: 'LUNCHBOX',
      },
    });
    const activeCount = await prisma.product.count({
      where: {
        lineup: { key: lineup.lineupKey },
        categoryCode: 'LUNCHBOX',
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
