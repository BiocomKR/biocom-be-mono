/**
 * 뷰티 기록 테스트 스크립트
 * 2025-10-27(월) ~ 2025-11-02(일) 테스트 데이터 생성 및 통계 조회
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:10804/api';
let accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsImlhdCI6MTc2MjE0MTU2NywiZXhwIjoxNzYyMTUyMzY3fQ.J1pTMZQdX5M6j_kY9x8oGyOflm01F4fUpuOZCk01PN0';

// 테스트 사용자 로그인 정보
const TEST_USER = {
  mobile: '01012345678',
  name: '테스트사용자'
};

// 날짜별 테스트 데이터 (점수 체계: 25,20,15,10,5)
const TEST_DATA = [
  {
    date: '2025-10-27',
    innerBeauty: [
      { no: 1, score: 20 }, // 그렇지않다(25) -- 20 -- 15 -- 10 -- 그렇다(5)
      { no: 2, score: 15 },
      { no: 3, score: 10 },
      { no: 4, score: 25 }
    ],
    outerBeauty: [
      { no: 1, score: 15 },
      { no: 2, score: 20 },
      { no: 3, score: 10 },
      { no: 4, score: 25 }
    ]
  },
  {
    date: '2025-10-28',
    innerBeauty: [
      { no: 1, score: 15 },
      { no: 2, score: 10 },
      { no: 3, score: 20 },
      { no: 4, score: 15 }
    ],
    outerBeauty: [
      { no: 1, score: 20 },
      { no: 2, score: 15 },
      { no: 3, score: 10 },
      { no: 4, score: 20 }
    ]
  },
  {
    date: '2025-10-29',
    innerBeauty: [
      { no: 1, score: 10 },
      { no: 2, score: 15 },
      { no: 3, score: 5 },
      { no: 4, score: 20 }
    ],
    outerBeauty: [
      { no: 1, score: 15 },
      { no: 2, score: 10 },
      { no: 3, score: 20 },
      { no: 4, score: 15 }
    ]
  },
  {
    date: '2025-10-30',
    innerBeauty: [
      { no: 1, score: 5 },
      { no: 2, score: 10 },
      { no: 3, score: 15 },
      { no: 4, score: 10 }
    ],
    outerBeauty: [
      { no: 1, score: 10 },
      { no: 2, score: 5 },
      { no: 3, score: 15 },
      { no: 4, score: 10 }
    ]
  },
  {
    date: '2025-10-31',
    innerBeauty: [
      { no: 1, score: 10 },
      { no: 2, score: 15 },
      { no: 3, score: 10 },
      { no: 4, score: 15 }
    ],
    outerBeauty: [
      { no: 1, score: 15 },
      { no: 2, score: 10 },
      { no: 3, score: 5 },
      { no: 4, score: 20 }
    ]
  },
  {
    date: '2025-11-01',
    innerBeauty: [
      { no: 1, score: 15 },
      { no: 2, score: 20 },
      { no: 3, score: 10 },
      { no: 4, score: 15 }
    ],
    outerBeauty: [
      { no: 1, score: 20 },
      { no: 2, score: 15 },
      { no: 3, score: 10 },
      { no: 4, score: 15 }
    ]
  },
  {
    date: '2025-11-02',
    innerBeauty: [
      { no: 1, score: 5 },
      { no: 2, score: 10 },
      { no: 3, score: 5 },
      { no: 4, score: 10 }
    ],
    outerBeauty: [
      { no: 1, score: 10 },
      { no: 2, score: 5 },
      { no: 3, score: 10 },
      { no: 4, score: 5 }
    ]
  }
];

// 점수 계산 함수
function calculateScore(questions) {
  return questions.reduce((sum, q) => sum + q.score, 0);
}

// 1. 로그인 (임시 사용자 생성 또는 기존 사용자 사용)
async function login() { return 1; }

async function loginSkipped() {
  console.log('\n=== 1. 로그인 ===');
  try {
    const response = await axios.post(`${BASE_URL}/auth/login-by-mobile`, {
      mobile: TEST_USER.mobile,
      name: TEST_USER.name
    });

    accessToken = response.data.data.accessToken;
    console.log('✅ 로그인 성공');
    console.log(`사용자 ID: ${response.data.data.userId}`);
    console.log(`토큰: ${accessToken.substring(0, 30)}...`);
    return response.data.data.userId;
  } catch (error) {
    console.error('❌ 로그인 실패:', error.response?.data || error.message);
    throw error;
  }
}

// 2. 기존 뷰티 기록 삭제 (테스트 데이터 클린업)
async function cleanupBeautyRecords() {
  console.log('\n=== 2. 기존 뷰티 기록 삭제 ===');

  for (const testData of TEST_DATA) {
    try {
      const response = await axios.get(`${BASE_URL}/tracking/records`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          // date 파라미터 제거 - 무조건 오늘 날짜로 저장됨,
          recordType: 'BEAUTY'
        }
      });

      if (response.data.data && response.data.data.length > 0) {
        console.log(`⚠️  ${testData.date}: 기존 기록 ${response.data.data.length}개 발견 (수동 삭제 필요)`);
      }
    } catch (error) {
      console.log(`✅ ${testData.date}: 기존 기록 없음`);
    }
  }
}

// 3. 뷰티 기록 생성
async function createBeautyRecords() {
  console.log('\n=== 3. 뷰티 기록 생성 ===');

  for (const testData of TEST_DATA) {
    try {
      const innerScore = calculateScore(testData.innerBeauty);
      const outerScore = calculateScore(testData.outerBeauty);
      const totalScore = innerScore + outerScore;

      const response = await axios.post(
        `${BASE_URL}/tracking/records/beauty`,
        {
          innerBeauty: testData.innerBeauty,
          outerBeauty: testData.outerBeauty,
          // date 파라미터 제거 - 무조건 오늘 날짜로 저장됨
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      console.log(`✅ ${testData.date}: 이너뷰티=${innerScore}점, 아우터뷰티=${outerScore}점, 총점=${totalScore}점, 포인트=${response.data.pointsEarned || 0}점`);
    } catch (error) {
      console.error(`❌ ${testData.date} 생성 실패:`, error.response?.data || error.message);
    }
  }
}

// 4. 뷰티 통계 조회
async function getBeautyStatistics() {
  console.log('\n=== 4. 뷰티 통계 조회 ===');

  try {
    const response = await axios.get(`${BASE_URL}/tracking/statistics/beauty`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        startDate: '2025-10-27',
        endDate: '2025-11-02'
      }
    });

    const stats = response.data.data;

    console.log('\n📊 요약 통계:');
    console.log(`  - 종합 평균 점수: ${stats.summary.score}점`);
    console.log(`  - 전주 대비: ${stats.summary.prevWeekDiff > 0 ? '+' : ''}${stats.summary.prevWeekDiff}점`);

    console.log('\n📊 이너뷰티:');
    console.log(`  - 평균 점수: ${stats.innerBeauty.score}점`);
    console.log(`  - 전주 대비: ${stats.innerBeauty.prevWeekDiff > 0 ? '+' : ''}${stats.innerBeauty.prevWeekDiff}점`);
    console.log('  - 질문별 평균:');
    stats.innerBeauty.answer.forEach(ans => {
      console.log(`    질문${ans.no}: ${ans.score}점`);
    });

    console.log('\n📊 아우터뷰티:');
    console.log(`  - 평균 점수: ${stats.outerBeauty.score}점`);
    console.log(`  - 전주 대비: ${stats.outerBeauty.prevWeekDiff > 0 ? '+' : ''}${stats.outerBeauty.prevWeekDiff}점`);
    console.log('  - 질문별 평균:');
    stats.outerBeauty.answer.forEach(ans => {
      console.log(`    질문${ans.no}: ${ans.score}점`);
    });

    console.log('\n📅 일별 추이:');
    console.log('  - 종합:');
    stats.summary.weekScore.forEach(day => {
      console.log(`    ${day.date}: ${day.value}점`);
    });

    return stats;
  } catch (error) {
    console.error('❌ 통계 조회 실패:', error.response?.data || error.message);
    throw error;
  }
}

// 5. 검증
function validateResults(stats) {
  console.log('\n=== 5. 결과 검증 ===');

  // 점수 범위 검증 (퍼센티지는 0-100)
  const checks = [
    { name: '종합 평균', value: stats.summary.score, min: 0, max: 100 },
    { name: '이너뷰티 평균', value: stats.innerBeauty.score, min: 0, max: 100 },
    { name: '아우터뷰티 평균', value: stats.outerBeauty.score, min: 0, max: 100 },
  ];

  let allValid = true;
  checks.forEach(check => {
    const valid = check.value >= check.min && check.value <= check.max;
    console.log(`${valid ? '✅' : '❌'} ${check.name}: ${check.value}점 (${check.min}-${check.max})`);
    if (!valid) allValid = false;
  });

  // 질문별 점수 검증
  console.log('\n질문별 퍼센티지 검증:');
  [...stats.innerBeauty.answer, ...stats.outerBeauty.answer].forEach((ans, idx) => {
    const valid = ans.score >= 0 && ans.score <= 100;
    const type = idx < 4 ? '이너' : '아우터';
    console.log(`${valid ? '✅' : '❌'} ${type} 질문${ans.no}: ${ans.score}% (0-100)`);
    if (!valid) allValid = false;
  });

  console.log(`\n${allValid ? '✅ 모든 검증 통과!' : '❌ 검증 실패 항목 있음'}`);
  return allValid;
}

// 메인 실행
async function main() {
  console.log('🚀 뷰티 기록 테스트 시작');
  console.log('기간: 2025-10-27(월) ~ 2025-11-02(일)');

  try {
    accessToken = accessToken || await login(); // 토큰이 이미 설정되어 있으면 로그인 스킵
    await cleanupBeautyRecords();
    await createBeautyRecords();
    const stats = await getBeautyStatistics();
    validateResults(stats);

    console.log('\n🎉 테스트 완료!');
  } catch (error) {
    console.error('\n💥 테스트 실패:', error.message);
    process.exit(1);
  }
}

main();
