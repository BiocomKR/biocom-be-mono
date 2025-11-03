const axios = require('axios');

const BASE_URL = 'http://localhost:10804';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsImlhdCI6MTc2MjE0MTU2NywiZXhwIjoxNzYyMTUyMzY3fQ.J1pTMZQdX5M6j_kY9x8oGyOflm01F4fUpuOZCk01PN0';

async function testBeautyStatistics() {
  try {
    console.log('📊 뷰티 통계 조회 테스트');
    console.log('');

    const response = await axios.get(`${BASE_URL}/api/tracking/statistics/beauty`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });

    console.log('✅ 통계 조회 성공');
    console.log('');

    const { summary, detailData } = response.data.data;

    // 종합 통계
    console.log('=== 종합 통계 ===');
    console.log(`평균 점수: ${summary.score}점`);
    console.log(`전주 대비: ${summary.prevWeekDiff > 0 ? '+' : ''}${summary.prevWeekDiff}점`);
    console.log(`일별 점수: ${summary.weekScore.map(d => `${d.date}: ${d.value}점`).join(', ')}`);
    console.log('');

    // 이너뷰티 상세
    console.log('=== 이너뷰티 ===');
    console.log(`평균 점수: ${detailData.innerBeauty.score}점`);
    console.log(`전주 대비: ${detailData.innerBeauty.prevWeekDiff > 0 ? '+' : ''}${detailData.innerBeauty.prevWeekDiff}점`);
    console.log(`일별 점수: ${detailData.innerBeauty.weekScore.map(d => `${d.date}: ${d.value}점`).join(', ')}`);
    console.log(`질문별 평균:`);
    detailData.innerBeauty.answer.forEach(a => {
      console.log(`  - 질문${a.no}: ${a.score}점`);
    });
    console.log('');

    // 아우터뷰티 상세
    console.log('=== 아우터뷰티 ===');
    console.log(`평균 점수: ${detailData.outerBeauty.score}점`);
    console.log(`전주 대비: ${detailData.outerBeauty.prevWeekDiff > 0 ? '+' : ''}${detailData.outerBeauty.prevWeekDiff}점`);
    console.log(`일별 점수: ${detailData.outerBeauty.weekScore.map(d => `${d.date}: ${d.value}점`).join(', ')}`);
    console.log(`질문별 평균:`);
    detailData.outerBeauty.answer.forEach(a => {
      console.log(`  - 질문${a.no}: ${a.score}점`);
    });
    console.log('');

    console.log('🎉 테스트 완료!');

  } catch (error) {
    console.error('❌ 에러 발생:', error.response?.data || error.message);
  }
}

testBeautyStatistics();
