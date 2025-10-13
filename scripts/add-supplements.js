const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// CSV parser for complex data with JSON fields
function parseComplexCSV(csvText) {
  const lines = csvText.trim().split('\n');

  // Remove BOM if present
  const firstLine = lines[0].replace(/^\ufeff/, '');
  const headers = firstLine.split(',').map(h => h.trim());

  const records = [];

  for (let i = 1; i < lines.length; i++) {
    // For complex data with JSON, we need to manually parse
    const line = lines[i];

    // Split by comma but be careful with JSON content
    let currentField = '';
    let inQuotes = false;
    let braceCount = 0;
    let fields = [];

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === '{' && !inQuotes) {
        braceCount++;
      } else if (char === '}' && !inQuotes) {
        braceCount--;
      } else if (char === ',' && !inQuotes && braceCount === 0) {
        fields.push(currentField.trim());
        currentField = '';
        continue;
      }

      currentField += char;
    }

    // Add the last field
    fields.push(currentField.trim());

    const record = {};
    headers.forEach((header, index) => {
      record[header] = fields[index] || '';
    });

    records.push(record);
  }

  return records;
}

async function main() {
  try {
    console.log('🚀 영양제 데이터 추가 시작...');

    // 1. 영양제 카테고리 확인/생성
    let healthFoodCategory = await prisma.category.findFirst({
      where: { slug: 'health-food' }
    });

    if (!healthFoodCategory) {
      console.log('📂 영양제 카테고리 생성 중...');
      healthFoodCategory = await prisma.category.create({
        data: {
          name: '영양제',
          slug: 'health-food',
          path: '/health-food/',
          depth: 0,
          sortOrder: 1,
          isActive: true,
        }
      });
      console.log('✅ 영양제 카테고리 생성 완료:', healthFoodCategory.id);
    } else {
      console.log('✅ 영양제 카테고리 존재:', healthFoodCategory.id);
    }

    // 2. CSV 파일 읽기
    const csvPath = '/Users/daegilchoi/Desktop/영양제엑셀csv.csv';
    const csvData = fs.readFileSync(csvPath, 'utf-8');

    // CSV 파싱
    const records = parseComplexCSV(csvData);

    console.log(`📊 총 ${records.length}개의 영양제 데이터 발견`);

    // 3. 각 영양제 데이터 처리
    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      // CSV에서 첫 번째 필드명에 BOM이 포함될 수 있음
      const categoryField = Object.keys(record)[0];
      const category = record[categoryField];
      const productName = record['상품명 ']?.trim() || record['상품명']?.trim();
      const imageUrl = record['상품이미지'];
      const originalPrice = parseInt(record['정상판매가']);
      const salePrice = parseInt(record['할인판매가']);
      const description = record['설명'];
      const dosageInfo = record['dosage_info'];

      if (!productName) {
        console.log(`⚠️  ${i + 1}번째 상품명이 없어서 스킵합니다.`);
        continue;
      }

      console.log(`\n🔄 ${i + 1}. "${productName}" 처리 중...`);

      // 중복 상품 확인
      const existingProduct = await prisma.product.findFirst({
        where: { name: productName }
      });

      if (existingProduct) {
        console.log(`   ⚠️  이미 존재하는 상품입니다. 스킵.`);
        continue;
      }

      // SKU 생성 (SUPP_001, SUPP_002, ...)
      const sku = `SUPP_${String(i + 1).padStart(3, '0')}`;

      // JSON 파싱 안전하게 처리
      let parsedDosageInfo = null;
      if (dosageInfo) {
        try {
          // JSON 문자열 정리 (잘못된 따옴표 등 수정)
          const cleanedJson = dosageInfo
            .replace(/"""/g, '"')  // 3중 따옴표를 단일 따옴표로
            .replace(/""([^"]*)""/g, '"$1"')  // 이중 따옴표를 단일 따옴표로
            .replace(/[\r\n]/g, '')  // 줄바꿈 제거
            .replace(/\s+/g, ' ')  // 여러 공백을 하나로
            .trim();

          console.log(`   🔧 JSON 파싱 시도: ${cleanedJson}`);
          parsedDosageInfo = JSON.parse(cleanedJson);
        } catch (jsonError) {
          console.log(`   ⚠️  JSON 파싱 실패, 문자열로 저장: ${jsonError.message}`);
          parsedDosageInfo = { raw: dosageInfo };
        }
      }

      // 상품 생성
      const product = await prisma.product.create({
        data: {
          sku: sku,
          categoryId: healthFoodCategory.id,
          name: productName,
          slug: productName.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9\-가-힣]/g, '')  // 한글도 허용
            .replace(/\-+/g, '-'),
          description: description,
          productType: 'SINGLE',
          productInfo: parsedDosageInfo,
          status: 'ACTIVE',
          isFeatured: false,
          viewCount: 0,
        }
      });

      console.log(`   ✅ 상품 생성 완료: ID ${product.id}, SKU: ${sku}`);

      // 상품 옵션 생성 (단일 옵션)
      const optionSku = `${sku}_DEFAULT`;
      await prisma.productOption.create({
        data: {
          productId: product.id,
          sku: optionSku,
          optionName: '기본',
          optionValue: '1개',
          price: salePrice,
          maxOrderQty: 10,
          isActive: true,
          sortOrder: 1,
        }
      });

      console.log(`   ✅ 상품 옵션 생성 완료: ${optionSku}, 가격: ${salePrice}원`);

      // 상품 이미지 추가
      if (imageUrl) {
        await prisma.productImage.create({
          data: {
            productId: product.id,
            imageUrl: imageUrl,
            imageType: 'MAIN',
            sortOrder: 1,
            altText: productName,
          }
        });
        console.log(`   ✅ 상품 이미지 추가 완료`);
      }
    }

    console.log('\n🎉 모든 영양제 데이터 추가 완료!');

    // 결과 확인
    const totalProducts = await prisma.product.count({
      where: { categoryId: healthFoodCategory.id }
    });
    console.log(`📊 총 ${totalProducts}개의 영양제 상품이 등록되었습니다.`);

  } catch (error) {
    console.error('❌ 에러 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();