const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkImportedProducts() {
  try {
    // 방금 임포트한 상품들 확인
    const recentProducts = await prisma.product.findMany({
      where: {
        categoryCode: {
          in: ['HEALTH_CHECK', 'SUPPLEMENT', 'CHALLENGE']
        }
      },
      include: {
        options: true,
        productFiles: {
          where: { imageType: 'MAIN' },
          include: { file: true },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log('=== 최근 등록된 상품 목록 ===\n');

    recentProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   - ID: ${product.id}`);
      console.log(`   - SKU: ${product.sku}`);
      console.log(`   - 카테고리: ${product.categoryName} (${product.categoryCode})`);
      console.log(`   - 할인율: ${product.discountRate || 0}%`);
      console.log(`   - 상태: ${product.status}`);

      if (product.options && product.options.length > 0) {
        console.log(`   - 옵션:`);
        product.options.forEach(opt => {
          console.log(`     * ${opt.optionName}: ${opt.price}원`);
        });
      }

      if (product.productFiles && product.productFiles.length > 0) {
        console.log(`   - 이미지: ${product.productFiles[0].file?.filePath?.substring(0, 50) || 'N/A'}...`);
      }

      console.log(`   - 등록일: ${product.createdAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      console.log();
    });

    // 카테고리별 통계
    const stats = await prisma.product.groupBy({
      by: ['categoryName', 'categoryCode'],
      _count: {
        id: true
      }
    });

    console.log('=== 카테고리별 상품 통계 ===\n');
    stats.forEach(stat => {
      console.log(`${stat.categoryName} (${stat.categoryCode}): ${stat._count.id}개`);
    });

    // 전체 상품 수
    const total = await prisma.product.count();
    console.log(`\n전체 상품 수: ${total}개`);

  } catch (error) {
    console.error('조회 중 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkImportedProducts();