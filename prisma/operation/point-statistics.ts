/**
 * 포인트 통계 조회 스크립트
 *
 * 사용법:
 *   npx ts-node prisma/operation/point-statistics.ts [startUserId] [endUserId] [endDate]
 *
 * 예시:
 *   npx ts-node prisma/operation/point-statistics.ts 3 40 2026-01-06
 *   npx ts-node prisma/operation/point-statistics.ts 3 40  # 오늘까지
 *
 * 출력:
 *   - 요약 통계 (총 지급, 초과지급, 정산 포인트, 지급률)
 *   - 유저별 획득 포인트
 *   - 일별 획득 포인트
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// 암호화 설정
const algorithm = 'aes-256-gcm';
const ivLength = 16;
const tagLength = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY || 'b!@c@m2@25!@#$@creTkEy!2E45bT8@';
  if (key.length !== 32) {
    return crypto.createHash('sha256').update(key).digest();
  }
  return Buffer.from(key);
}

function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  try {
    const key = getKey();
    const combined = Buffer.from(encryptedText, 'base64');
    const iv = combined.slice(0, ivLength);
    const tag = combined.slice(ivLength, ivLength + tagLength);
    const encrypted = combined.slice(ivLength + tagLength);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    (decipher as any).setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return encryptedText;
  }
}

interface PointConfig {
  dailyMax: number; // 일일 최대 포인트
  selfDeclaration: number; // 자기선언문 포인트
  depthReport: number; // 심층리포트 포인트
  dietMaxPerDay: number; // DIET 하루 최대 횟수
}

const DEFAULT_CONFIG: PointConfig = {
  dailyMax: 1300,
  selfDeclaration: 1000,
  depthReport: 300,
  dietMaxPerDay: 3,
};

async function calculatePointStatistics(
  startUserId: number,
  endUserId: number,
  endDate?: string,
  config: PointConfig = DEFAULT_CONFIG,
) {
  const endDateTime = endDate ? new Date(`${endDate}T23:59:59.999Z`) : new Date();

  console.log('\n========================================');
  console.log('포인트 통계 조회');
  console.log('========================================');
  console.log(`조회 범위: user_id ${startUserId} ~ ${endUserId}`);
  console.log(`조회 기간: ~ ${endDate || '현재'}`);
  console.log('----------------------------------------\n');

  // 1. 전체 포인트 지급 내역 조회
  const allHistory = await prisma.pointHistory.findMany({
    where: {
      userId: { gte: startUserId, lte: endUserId },
      type: { in: ['EARN', 'EARNED'] },
      createdAt: { lt: endDateTime },
    },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // 2. DIET 초과지급 계산 (하루 3회 초과분)
  const dietExcess: Record<number, number> = {};
  const dietByUserDate: Record<string, number> = {};

  for (const item of allHistory) {
    if (item.description === 'DIET 기록 완료') {
      const dateKey = `${item.userId}_${item.createdAt.toISOString().split('T')[0]}`;
      dietByUserDate[dateKey] = (dietByUserDate[dateKey] || 0) + 1;
    }
  }

  for (const [key, count] of Object.entries(dietByUserDate)) {
    if (count > config.dietMaxPerDay) {
      const userId = parseInt(key.split('_')[0]);
      const excess = (count - config.dietMaxPerDay) * 100;
      dietExcess[userId] = (dietExcess[userId] || 0) + excess;
    }
  }

  const totalDietExcess = Object.values(dietExcess).reduce((a, b) => a + b, 0);

  // 3. 유저별 포인트 집계
  const userPoints: Record<number, { name: string; total: number; excess: number }> = {};

  for (const item of allHistory) {
    if (!userPoints[item.userId]) {
      userPoints[item.userId] = {
        name: decrypt(item.user?.name || ''),
        total: 0,
        excess: dietExcess[item.userId] || 0,
      };
    }
    userPoints[item.userId].total += item.amount;
  }

  // 4. 일별 포인트 집계
  const dailyPoints: Record<string, Record<number, number>> = {};

  for (const item of allHistory) {
    const date = item.createdAt.toISOString().split('T')[0];
    if (!dailyPoints[date]) dailyPoints[date] = {};
    dailyPoints[date][item.userId] = (dailyPoints[date][item.userId] || 0) + item.amount;
  }

  // DIET 초과분 차감 (첫 날짜에서)
  const dates = Object.keys(dailyPoints).sort();
  if (dates.length > 0) {
    const firstDate = dates[0];
    for (const [userId, excess] of Object.entries(dietExcess)) {
      const uid = parseInt(userId);
      if (dailyPoints[firstDate]?.[uid]) {
        dailyPoints[firstDate][uid] -= excess;
      }
    }
  }

  // 5. 통계 계산
  const userCount = Object.keys(userPoints).length;
  const totalDays = dates.length;
  const maxPerPerson = config.dailyMax * totalDays + config.selfDeclaration + config.depthReport;
  const maxTotal = maxPerPerson * userCount;
  const actualTotal = Object.values(userPoints).reduce((sum, u) => sum + u.total, 0);
  const adjustedTotal = actualTotal - totalDietExcess;
  const payoutRate = ((adjustedTotal / maxTotal) * 100).toFixed(2);

  // 6. 결과 출력
  console.log('## 요약');
  console.log('----------------------------------------');
  console.log(`참여 인원: ${userCount}명`);
  console.log(`챌린지 일수: ${totalDays}일`);
  console.log(`1인당 최대 획득 포인트: ${maxPerPerson.toLocaleString()}원`);
  console.log(`  (일일 ${config.dailyMax} × ${totalDays}일 + 자기선언문 ${config.selfDeclaration} + 심층리포트 ${config.depthReport})`);
  console.log(`${userCount}인 최대 획득 포인트: ${maxTotal.toLocaleString()}원`);
  console.log(`실 지급 포인트: ${actualTotal.toLocaleString()}원`);
  console.log(`초과 지급 포인트: ${totalDietExcess.toLocaleString()}원 (DIET 버그)`);
  console.log(`정산 지급 포인트: ${adjustedTotal.toLocaleString()}원`);
  console.log(`포인트 지급률: ${payoutRate}%`);
  console.log('----------------------------------------\n');

  console.log('## 유저별 획득 현황');
  console.log('----------------------------------------');
  console.log('| user_id | 이름 | 획득 포인트 | 비고 |');
  console.log('|---------|------|-------------|------|');

  const sortedUsers = Object.entries(userPoints).sort(([a], [b]) => parseInt(a) - parseInt(b));
  for (const [userId, data] of sortedUsers) {
    const adjusted = data.total - data.excess;
    const note = data.excess > 0 ? `초과지급 -${data.excess}` : '';
    console.log(`| ${userId} | ${data.name} | ${adjusted.toLocaleString()} | ${note} |`);
  }
  console.log('----------------------------------------\n');

  console.log('## 일별 획득 현황');
  console.log('----------------------------------------');

  // 헤더 생성
  const userIds = sortedUsers.map(([id]) => parseInt(id));
  let header = '| user_id | 이름 |';
  for (const date of dates) {
    header += ` ${date.substring(5)} |`;
  }
  header += ' 합계 |';
  console.log(header);

  let separator = '|---------|------|';
  for (let i = 0; i < dates.length; i++) separator += '------|';
  separator += '------|';
  console.log(separator);

  for (const [userId, data] of sortedUsers) {
    const uid = parseInt(userId);
    let row = `| ${userId} | ${data.name} |`;
    let total = 0;
    for (const date of dates) {
      const points = dailyPoints[date]?.[uid] || 0;
      total += points;
      row += ` ${points > 0 ? points.toLocaleString() : '-'} |`;
    }
    row += ` ${total.toLocaleString()} |`;
    console.log(row);
  }

  // 일별 합계
  let totalRow = '| | **합계** |';
  let grandTotal = 0;
  for (const date of dates) {
    let dayTotal = 0;
    for (const uid of userIds) {
      dayTotal += dailyPoints[date]?.[uid] || 0;
    }
    grandTotal += dayTotal;
    totalRow += ` **${dayTotal.toLocaleString()}** |`;
  }
  totalRow += ` **${grandTotal.toLocaleString()}** |`;
  console.log(totalRow);
  console.log('----------------------------------------\n');

  return {
    userCount,
    totalDays,
    maxPerPerson,
    maxTotal,
    actualTotal,
    totalDietExcess,
    adjustedTotal,
    payoutRate: parseFloat(payoutRate),
    userPoints,
    dailyPoints,
  };
}

// CLI 실행
async function main() {
  const args = process.argv.slice(2);
  const startUserId = parseInt(args[0]) || 3;
  const endUserId = parseInt(args[1]) || 40;
  const endDate = args[2] || undefined;

  try {
    await calculatePointStatistics(startUserId, endUserId, endDate);
  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
