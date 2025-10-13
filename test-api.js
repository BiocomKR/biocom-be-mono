const axios = require('axios');

async function testAPI() {
  try {
    // 1. 로그인
    console.log('1. 로그인 시도...');
    const loginResponse = await axios.post('http://localhost:10804/api/auth/signin', {
      email: 'user@example.com',
      password: 'Password123!'
    });

    const token = loginResponse.data.data.accessToken;
    console.log('✅ 로그인 성공!');
    console.log('JWT Token:', token);

    // 2. 상품 목록 조회
    console.log('\n2. 상품 목록 조회...');
    const productsResponse = await axios.get('http://localhost:10804/api/shop/products', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = productsResponse.data.data;
    console.log(`✅ 조회 성공! 총 ${data.totalCount}개 상품, ${data.categoryCount}개 카테고리`);

    // 3. 각 카테고리별로 첫 번째 상품의 가격 확인
    console.log('\n3. 각 카테고리별 첫 번째 상품의 가격 정보:');
    data.categories.forEach(category => {
      if (category.products.length > 0) {
        const firstProduct = category.products[0];
        console.log(`\n[${category.categoryName}] ${firstProduct.name}`);
        console.log(`  - ID: ${firstProduct.id}`);
        console.log(`  - 정가: ${firstProduct.originalPrice || 'null'} 원`);
        console.log(`  - 판매가: ${firstProduct.price || 'null'} 원`);
      }
    });

  } catch (error) {
    console.error('❌ 에러 발생:', error.response ? error.response.data : error.message);
  }
}

testAPI();