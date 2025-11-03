/**
 * 뷰티 기록 간단 테스트
 * 1건 등록 + 중복 등록 + 포인트 확인
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:10804/api';
const accessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsImlhdCI6MTc2MjE0MTU2NywiZXhwIjoxNzYyMTUyMzY3fQ.J1pTMZQdX5M6j_kY9x8oGyOflm01F4fUpuOZCk01PN0';

// 테스트 데이터
const testData = {
  innerBeauty: [
    { no: 1, score: 20 },
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
};

// 점수 계산
const innerScore = testData.innerBeauty.reduce((sum, q) => sum + q.score, 0);
const outerScore = testData.outerBeauty.reduce((sum, q) => sum + q.score, 0);
const totalScore = innerScore + outerScore;

console.log('\n🚀 뷰티 기록 테스트 시작');
console.log(`이너뷰티: ${innerScore}점, 아우터뷰티: ${outerScore}점, 총점: ${totalScore}점`);

// 사용자 포인트 조회
async function getUserPoints() {
  try {
    const response = await axios.get(`${BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return response.data.data.points;
  } catch (error) {
    console.error('❌ 포인트 조회 실패:', error.response?.data || error.message);
    return null;
  }
}

// 1차 등록
async function firstRegister() {
  console.log('\n=== 1차 등록 (오늘 날짜) ===');

  const pointsBefore = await getUserPoints();
  console.log(`등록 전 포인트: ${pointsBefore}점`);

  try {
    const response = await axios.post(
      `${BASE_URL}/tracking/records/beauty`,
      testData,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    console.log(`✅ 1차 등록 성공`);
    console.log(`- 기록 ID: ${response.data.id}`);
    console.log(`- 획득 포인트: ${response.data.pointsEarned}점`);

    const pointsAfter = await getUserPoints();
    console.log(`등록 후 포인트: ${pointsAfter}점`);
    console.log(`포인트 증가량: ${pointsAfter - pointsBefore}점`);

    return response.data;
  } catch (error) {
    console.error('❌ 1차 등록 실패:', error.response?.data || error.message);
    return null;
  }
}

// 2차 등록 (중복 체크)
async function secondRegister() {
  console.log('\n=== 2차 등록 (중복 체크) ===');

  const pointsBefore = await getUserPoints();
  console.log(`등록 전 포인트: ${pointsBefore}점`);

  try {
    const response = await axios.post(
      `${BASE_URL}/tracking/records/beauty`,
      testData,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    console.log(`❌ 2차 등록 성공 (문제! 중복 방지 안됨)`);
    console.log(`- 획득 포인트: ${response.data.pointsEarned}점`);

    const pointsAfter = await getUserPoints();
    console.log(`등록 후 포인트: ${pointsAfter}점`);
    console.log(`포인트 증가량: ${pointsAfter - pointsBefore}점`);

  } catch (error) {
    if (error.response?.data?.message?.includes('이미') ||
        error.response?.data?.message?.includes('완료')) {
      console.log(`✅ 중복 등록 방지 성공`);
      console.log(`- 에러 메시지: ${error.response.data.message}`);

      const pointsAfter = await getUserPoints();
      console.log(`등록 후 포인트: ${pointsAfter}점 (변동 없음)`);
    } else {
      console.error('❌ 2차 등록 실패 (예상치 못한 에러):', error.response?.data || error.message);
    }
  }
}

// 검증
function validate(firstResult) {
  console.log('\n=== 검증 결과 ===');

  const checks = [
    { name: '1차 등록 성공', pass: firstResult !== null },
    { name: '포인트 100점 지급', pass: firstResult?.pointsEarned === 100 },
  ];

  checks.forEach(check => {
    console.log(`${check.pass ? '✅' : '❌'} ${check.name}`);
  });
}

// 메인 실행
async function main() {
  const firstResult = await firstRegister();
  await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
  await secondRegister();
  validate(firstResult);

  console.log('\n🎉 테스트 완료!\n');
}

main();
