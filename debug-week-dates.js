// 주간 날짜 계산 디버깅

function getWeekDateRange() {
  const today = new Date();
  const endDate = new Date(today); // 오늘을 종료일로

  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 6); // 오늘부터 역산 7일

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

function generateWeekDates(startDate) {
  const dates = [];
  const current = new Date(startDate);

  for (let i = 0; i < 7; i++) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

console.log('=== 주간 날짜 계산 디버깅 ===');
console.log('현재 시간:', new Date().toISOString());

const { startDate, endDate } = getWeekDateRange();
console.log('시작일:', startDate);
console.log('종료일:', endDate);

const weekDates = generateWeekDates(startDate);
console.log('7일 배열:', weekDates);

console.log('\n실제 데이터: 2025-09-17에만 기록 있음');
console.log('배열에 2025-09-18 포함 여부:', weekDates.includes('2025-09-18'));