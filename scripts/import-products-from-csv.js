const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importProducts() {
  try {
    // CSV 파일 읽기
    const csvPath = '/Users/daegilchoi/Desktop/기타.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');

    // 헤더 제거
    lines.shift();

    // SKU 생성 헬퍼 함수
    function generateSKU(category, index) {
      const timestamp = Date.now().toString().slice(-6);
      return `${category.toUpperCase()}_${timestamp}_${index}`;
    }

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === ',,,,,,') continue;

      // CSV 파싱 (쉼표로 분리)
      const parts = line.split(',');

      // 데이터 추출
      const category = parts[0]?.trim() || '';
      const productName = parts[1]?.trim() || '';
      const imageUrl = parts[2]?.trim() || '';
      const originalPrice = parseInt(parts[3]) || 0;
      const discountedPrice = parseInt(parts[4]) || 0;
      const description = parts[5]?.trim() || '';

      // 유효성 검사
      if (!category || !productName) {
        console.log(`⚠️ 행 ${i + 2}: 필수 데이터 누락 (카테고리 또는 상품명)`);
        continue;
      }

      // 카테고리 코드 매핑
      const categoryMapping = {
        '검사권': { code: 'HEALTH_CHECK', name: '건강검진' },
        '해외영양제': { code: 'SUPPLEMENT', name: '영양제' },
        '챌린지': { code: 'CHALLENGE', name: '챌린지 프로그램' }
      };

      const categoryInfo = categoryMapping[category] || {
        code: 'OTHER',
        name: category
      };

      // SKU 생성 (고유값 보장)
      const sku = generateSKU(categoryInfo.code, i);

      // 할인율 계산
      let discountRate = 0;
      if (originalPrice > 0 && discountedPrice > 0 && discountedPrice < originalPrice) {
        discountRate = Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
      }

      try {
        // 1. Product 생성
        const product = await prisma.product.create({
          data: {
            sku: sku,
            name: productName,
            description: description || null,
            categoryCode: categoryInfo.code,
            categoryName: categoryInfo.name,
            discountRate: discountRate,
            productType: 'SINGLE',
            status: 'ACTIVE',
            isFeatured: false,
            viewCount: 0,
            productInfo: {
              importedFrom: 'CSV',
              importDate: new Date().toISOString(),
              originalCategory: category
            }
          }
        });

        console.log(`✅ 상품 등록 성공: ${productName} (ID: ${product.id}, SKU: ${sku})`);

        // 2. ProductOption 생성 (기본 옵션)
        const productOption = await prisma.productOption.create({
          data: {
            productId: product.id,
            sku: `${sku}_OPT1`,
            optionName: '기본',
            optionValue: '기본 옵션',
            price: discountedPrice > 0 ? discountedPrice : originalPrice,
            maxOrderQty: 10,
            isActive: true,
            sortOrder: 0
          }
        });

        console.log(`  ├─ 옵션 생성: 기본 옵션 (가격: ${productOption.price}원)`);

        // 3. ProductImage 생성 (이미지 URL이 있는 경우)
        if (imageUrl) {
          const productImage = await prisma.productImage.create({
            data: {
              productId: product.id,
              imageUrl: imageUrl,
              imageType: 'MAIN',
              sortOrder: 0,
              altText: productName
            }
          });

          console.log(`  └─ 이미지 등록: ${imageUrl.substring(0, 50)}...`);
        }

        successCount++;

      } catch (error) {
        console.error(`❌ 상품 등록 실패 [${productName}]:`, error.message);
        errorCount++;
      }
    }

    console.log('\n=== 임포트 완료 ===');
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);

    // 등록된 상품 확인
    const totalProducts = await prisma.product.count();
    console.log(`\n📊 전체 상품 수: ${totalProducts}개`);

    // 카테고리별 상품 수 확인
    const categories = await prisma.product.groupBy({
      by: ['categoryName'],
      _count: {
        id: true
      }
    });

    console.log('\n📂 카테고리별 상품 수:');
    categories.forEach(cat => {
      console.log(`  - ${cat.categoryName}: ${cat._count.id}개`);
    });

  } catch (error) {
    console.error('스크립트 실행 중 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
console.log('🚀 CSV 파일에서 상품 데이터 임포트 시작...\n');
importProducts();