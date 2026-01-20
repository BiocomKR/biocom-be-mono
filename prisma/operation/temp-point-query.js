const { PrismaClient } = require('@prisma/client');
const crypto = require('node:crypto');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom'
    }
  }
});

const ENCRYPTION_KEY = 'b!@c@m2@25!@#$@creTkEy!2E45bT8@';

function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;
  try {
    let key;
    if (ENCRYPTION_KEY.length !== 32) {
      key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    } else {
      key = Buffer.from(ENCRYPTION_KEY);
    }
    const combined = Buffer.from(encryptedText, 'base64');
    const iv = combined.slice(0, 16);
    const tag = combined.slice(16, 32);
    const encrypted = combined.slice(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch { return encryptedText; }
}

async function main() {
  const endDate = new Date('2026-01-18T23:59:59Z');
  const DAILY_MAX = 1300;

  const pointHistory = await prisma.pointHistory.findMany({
    where: {
      amount: { gt: 0 },
      userId: { gte: 3, lte: 40 },
      createdAt: { lte: endDate }
    },
    include: {
      user: { select: { id: true, name: true } }
    },
    orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }]
  });

  const grouped = {};
  for (const ph of pointHistory) {
    const userId = ph.userId;
    const userName = decrypt(ph.user?.name || 'User ' + userId);
    const date = ph.createdAt.toISOString().split('T')[0];
    if (!grouped[userId]) grouped[userId] = { userName, dates: {} };
    if (!grouped[userId].dates[date]) grouped[userId].dates[date] = 0;
    grouped[userId].dates[date] += ph.amount;
  }

  const allDates = new Set();
  for (const u of Object.values(grouped)) {
    for (const d of Object.keys(u.dates)) allDates.add(d);
  }
  const sortedDates = Array.from(allDates).sort();
  const totalDays = sortedDates.length;
  const userIds = Object.keys(grouped).map(Number).sort((a, b) => a - b);
  const userCount = userIds.length;

  // DIET 하루 3회 초과분만 초과지급으로 계산
  const dietByUserDate = {};
  for (const ph of pointHistory) {
    if (ph.description === 'DIET 기록 완료') {
      const key = ph.userId + '_' + ph.createdAt.toISOString().split('T')[0];
      dietByUserDate[key] = (dietByUserDate[key] || 0) + 1;
    }
  }

  const userOverpay = {};
  for (const uid of userIds) {
    let overpay = 0;
    for (const date of sortedDates) {
      const key = uid + '_' + date;
      const dietCount = dietByUserDate[key] || 0;
      if (dietCount > 3) {
        overpay += (dietCount - 3) * 100; // DIET 100P
      }
    }
    userOverpay[uid] = overpay;
  }

  // 통계
  let grandTotal = 0;
  let totalOverpay = 0;
  for (const uid of userIds) {
    let userTotal = 0;
    for (const pts of Object.values(grouped[uid].dates)) userTotal += pts;
    grandTotal += userTotal;
    totalOverpay += userOverpay[uid];
  }

  const SELF_DECLARATION = 1300; // 자기선언문
  const maxPerPerson = DAILY_MAX * (sortedDates.length) + SELF_DECLARATION; // 일수 + 자기선언문
  const maxTotal = maxPerPerson * userCount;
  const actualPaid = grandTotal - totalOverpay;
  const payoutRate = ((actualPaid / maxTotal) * 100).toFixed(2);

  // 개요 출력
  console.log('항목\t값');
  console.log('1인당 최대 획득 포인트\t₩' + maxPerPerson.toLocaleString());
  console.log(userCount + '인 최대 획득 포인트\t₩' + maxTotal.toLocaleString());
  console.log('실 지급 포인트\t₩' + actualPaid.toLocaleString());
  console.log('초과 지급 포인트\t₩' + totalOverpay.toLocaleString());
  console.log('포인트 지급률 (%)\t' + payoutRate + '%');
  console.log('\t');

  // 일별 출력
  console.log('일자\t총 지급 포인트');
  for (const date of sortedDates) {
    let dayTotal = 0;
    for (const u of Object.values(grouped)) {
      const pts = u.dates[date] || 0;
      dayTotal += pts; // raw 값 (초과지급 포함)
    }
    const label = date.substring(5).replace('-', '-');
    console.log(label + '\t' + dayTotal.toLocaleString());
  }
  console.log('');

  // 일별 상세 테이블
  const dateLabels = sortedDates.map(d => d.substring(5).replace('-', '/'));
  console.log('user_id\t이름\t' + dateLabels.join('\t') + '\t합계');

  const dailyTotals = sortedDates.map(() => 0);
  let allTotal = 0;

  for (const uid of userIds) {
    const u = grouped[uid];
    let row = uid + '\t' + u.userName;
    let userSum = 0;
    sortedDates.forEach((date, i) => {
      const pts = u.dates[date] || 0;
      row += '\t' + (pts > 0 ? pts.toLocaleString() : '-');
      userSum += pts; // raw 값
      dailyTotals[i] += pts; // raw 값
    });
    allTotal += userSum;
    row += '\t' + userSum.toLocaleString();
    console.log(row);
  }

  // 합계 행
  let totalRow = '\t합계';
  dailyTotals.forEach(t => totalRow += '\t' + t.toLocaleString());
  totalRow += '\t' + allTotal.toLocaleString();
  console.log(totalRow);
  console.log('');

  // 유저별 합계
  console.log('user_id\t이름\t총적립\t비고');
  for (const uid of userIds) {
    const u = grouped[uid];
    let total = 0;
    for (const pts of Object.values(u.dates)) total += pts;
    const overpay = userOverpay[uid];
    const note = overpay > 0 ? '초과지급 -' + overpay.toLocaleString() : '';
    console.log(uid + '\t' + u.userName + '\t' + total.toLocaleString() + '\t' + note);
  }
  console.log('\t합계\t' + grandTotal.toLocaleString() + '\t');

  await prisma.$disconnect();
}
main();
