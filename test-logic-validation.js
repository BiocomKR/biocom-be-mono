/**
 * 챌린지 시작일 계산 로직 검증
 * Node.js로 실행 (TypeScript import 문제 회피)
 */

// ========== 유틸 함수들 ==========

function isMonday(date) {
  return date.getDay() === 1;
}

function getAvailableStartDates(applicationDate) {
  const result = [];
  const today = new Date(applicationDate);
  today.setHours(0, 0, 0, 0);

  const nextMonday = new Date(today);
  const daysUntilNextMonday = (8 - today.getDay()) % 7 || 7;
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);

  for (let i = 0; i < 3; i++) {
    const monday = new Date(nextMonday);
    monday.setDate(nextMonday.getDate() + (i * 7));
    result.push(monday);
  }

  return result;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayName(date) {
  return ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
}

function calculateDeliveryArrivalDate(startDate) {
  const arrivalDate = new Date(startDate);
  arrivalDate.setDate(arrivalDate.getDate() - 3);
  return arrivalDate;
}

function calculateDeliveryStartDate(deliveryArrivalDate) {
  const startDate = new Date(deliveryArrivalDate);
  startDate.setDate(startDate.getDate() - 2);
  return startDate;
}

function calculateEndDate(startDate) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 20);
  return endDate;
}

// ========== 테스트 시나리오 ==========

console.log('='.repeat(60));
console.log('챌린지 날짜 계산 로직 검증');
console.log('='.repeat(60));

// 시나리오 1: 오늘이 2025-10-28 (화요일)
console.log('\n[시나리오 1] 신청일: 2025-10-28 (화요일)');
const today1 = new Date('2025-10-28');
const availableDates1 = getAvailableStartDates(today1);

console.log('\n선택 가능한 시작일 (다음주 월요일부터 3주):');
availableDates1.forEach((date, idx) => {
  console.log(`  ${idx + 1}. ${formatDate(date)} (${getDayName(date)}요일)`);
});

console.log('\n각 시작일에 대한 배송 날짜 계산:');
availableDates1.forEach((startDate, idx) => {
  const deliveryArrival = calculateDeliveryArrivalDate(startDate);
  const deliveryStart = calculateDeliveryStartDate(deliveryArrival);
  const endDate = calculateEndDate(startDate);

  console.log(`\n  옵션 ${idx + 1}: 시작일 ${formatDate(startDate)} (${getDayName(startDate)}요일)`);
  console.log(`    → 배송시작일: ${formatDate(deliveryStart)} (${getDayName(deliveryStart)}요일)`);
  console.log(`    → 배송도착일: ${formatDate(deliveryArrival)} (${getDayName(deliveryArrival)}요일)`);
  console.log(`    → 종료일: ${formatDate(endDate)} (${getDayName(endDate)}요일)`);
});

// 시나리오 2: 오늘이 2025-11-01 (토요일) - 주말
console.log('\n' + '='.repeat(60));
console.log('[시나리오 2] 신청일: 2025-11-01 (토요일) - 주말');
const today2 = new Date('2025-11-01');
const availableDates2 = getAvailableStartDates(today2);

console.log('\n선택 가능한 시작일:');
availableDates2.forEach((date, idx) => {
  console.log(`  ${idx + 1}. ${formatDate(date)} (${getDayName(date)}요일)`);
});

// 시나리오 3: 오늘이 2025-10-31 (금요일)
console.log('\n' + '='.repeat(60));
console.log('[시나리오 3] 신청일: 2025-10-31 (금요일)');
const today3 = new Date('2025-10-31');
const availableDates3 = getAvailableStartDates(today3);

console.log('\n선택 가능한 시작일:');
availableDates3.forEach((date, idx) => {
  console.log(`  ${idx + 1}. ${formatDate(date)} (${getDayName(date)}요일)`);
});

// 시나리오 4: 유효성 검증 테스트
console.log('\n' + '='.repeat(60));
console.log('[시나리오 4] 유효성 검증 테스트');
const testToday = new Date('2025-10-28');
const testDates = [
  new Date('2025-11-03'), // 다음주 월요일 - OK
  new Date('2025-11-04'), // 화요일 - FAIL (월요일 아님)
  new Date('2025-11-10'), // 다다음주 월요일 - OK
  new Date('2025-11-24'), // 4주차 월요일 - FAIL (3주 범위 초과)
  new Date('2025-10-27'), // 이번주 월요일 - FAIL (다음주부터)
];

console.log('\n신청일: 2025-10-28 기준');
testDates.forEach(testDate => {
  const isValid = isMonday(testDate) && availableDates1.some(d => formatDate(d) === formatDate(testDate));
  console.log(`  ${formatDate(testDate)} (${getDayName(testDate)}요일): ${isValid ? '✅ 유효' : '❌ 무효'}`);
});

// 시나리오 5: 공휴일이 포함된 케이스 (2025-10-09 한글날)
console.log('\n' + '='.repeat(60));
console.log('[시나리오 5] 공휴일이 포함된 케이스');
console.log('시작일: 2025-10-13 (월요일) 선택 시');

const startDate5 = new Date('2025-10-13');
const deliveryArrival5 = calculateDeliveryArrivalDate(startDate5); // 10-10 (금)
const deliveryStart5 = calculateDeliveryStartDate(deliveryArrival5); // 10-08 (수)

console.log(`  시작일: ${formatDate(startDate5)} (${getDayName(startDate5)}요일)`);
console.log(`  → 배송도착일 계산: ${formatDate(deliveryArrival5)} (${getDayName(deliveryArrival5)}요일)`);
console.log(`  → 배송시작일 계산: ${formatDate(deliveryStart5)} (${getDayName(deliveryStart5)}요일)`);
console.log(`\n  ⚠️  2025-10-09 (목요일)는 한글날 (공휴일)`);
console.log(`  ⚠️  2025-10-08 (수요일)는 대체공휴일`);
console.log(`  → 실제 배송도착일: API로 공휴일 체크 후 자동 조정됨`);
console.log(`  → 실제 배송시작일: API로 공휴일 체크 후 자동 조정됨`);

console.log('\n' + '='.repeat(60));
console.log('검증 완료');
console.log('='.repeat(60));
