const axios = require('axios');

const BASE_URL = 'http://localhost:10804';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsImlhdCI6MTc2MjE0MTU2NywiZXhwIjoxNzYyMTUyMzY3fQ.J1pTMZQdX5M6j_kY9x8oGyOflm01F4fUpuOZCk01PN0';

async function checkDate() {
  try {
    console.log('🔍 뷰티 기록 날짜 확인');
    console.log('현재 시스템 날짜:', new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
    console.log('');

    // 오늘 기록 조회
    const response = await axios.get(`${BASE_URL}/tracking/records`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      params: { recordType: 'BEAUTY' }
    });

    if (response.data.data.length > 0) {
      const record = response.data.data[0];
      console.log('✅ 기록 조회 성공');
      console.log('- 기록 ID:', record.id);
      console.log('- 날짜 (DB):', record.date);
      console.log('- 예상 날짜: 2025-11-03');
      console.log('');

      if (record.date.startsWith('2025-11-03')) {
        console.log('🎉 날짜 저장 정상! (2025-11-03)');
      } else {
        console.log('❌ 날짜 저장 오류! DB값:', record.date);
      }
    } else {
      console.log('❌ 기록 없음');
    }
  } catch (error) {
    console.error('에러:', error.response?.data || error.message);
  }
}

checkDate();
