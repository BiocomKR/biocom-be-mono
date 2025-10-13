const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * 카테고리 데이터 마이그레이션 스크립트
 * categoryId → categoryCode, categoryName으로 변환
 *
 * 안전한 마이그레이션:
 * 1. 기존 데이터 보존
 * 2. 새 컬럼에만 데이터 입력
 * 3. 실행 전 백업 권장
 */

async function main() {
  try {
    console.log('🔄 카테고리 데이터 마이그레이션 시작...');

    // 1. 현재 Product와 Category 데이터 확인
    const products = await prisma.product.findMany({
      include: {
        category: true
      }
    });

    console.log(`📊 총 ${products.length}개의 상품 발견`);

    if (products.length === 0) {
      console.log('⚠️  마이그레이션할 상품이 없습니다.');
      return;
    }

    // 2. 카테고리별 매핑 정보 출력
    const categoryMapping = new Map();
    products.forEach(product => {
      if (product.category) {
        const key = product.categoryId;
        if (!categoryMapping.has(key)) {
          categoryMapping.set(key, {
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug,
            count: 0
          });
        }
        categoryMapping.get(key).count++;
      }
    });

    console.log('\n📋 카테고리 매핑 정보:');
    categoryMapping.forEach((info, categoryId) => {
      console.log(`  ID ${categoryId}: "${info.name}" (${info.count}개 상품)`);
    });

    // 3. 카테고리명을 기반으로 코드 생성 로직
    function generateCategoryCode(categoryName) {
      // 영양제, 건강식품 등의 한글명을 간단한 코드로 변환
      const codeMap = {
        '영양제': 'SUPPLEMENT',
        '건강식품': 'HEALTH_FOOD',
        '건강 보조 식품': 'HEALTH_SUPPLEMENT',
        '비타민': 'VITAMIN',
        '프로바이오틱스': 'PROBIOTICS'
      };

      return codeMap[categoryName] || 'OTHER';
    }

    // 4. 실제 마이그레이션 실행
    console.log('\n🚀 데이터 마이그레이션 실행...');

    let updatedCount = 0;
    for (const product of products) {
      if (product.category && !product.categoryCode) {
        const categoryCode = generateCategoryCode(product.category.name);
        const categoryName = product.category.name;

        await prisma.product.update({
          where: { id: product.id },
          data: {
            categoryCode: categoryCode,
            categoryName: categoryName
          }
        });

        console.log(`  ✅ 상품 "${product.name}": ${categoryName} → ${categoryCode}`);
        updatedCount++;
      }
    }

    console.log(`\n🎉 마이그레이션 완료! ${updatedCount}개 상품 업데이트됨`);

    // 5. 결과 확인
    const updatedProducts = await prisma.product.findMany({
      where: {
        categoryCode: { not: null }
      },
      select: {
        id: true,
        name: true,
        categoryCode: true,
        categoryName: true,
        categoryId: true // 기존 데이터도 확인
      }
    });

    console.log('\n📋 마이그레이션 결과 확인:');
    updatedProducts.forEach(product => {
      console.log(`  ID ${product.id}: ${product.name}`);
      console.log(`    기존: categoryId=${product.categoryId}`);
      console.log(`    신규: ${product.categoryCode} (${product.categoryName})`);
    });

  } catch (error) {
    console.error('❌ 마이그레이션 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
if (require.main === module) {
  main()
    .catch((error) => {
      console.error('마이그레이션 실패:', error);
      process.exit(1);
    });
}

module.exports = { main };