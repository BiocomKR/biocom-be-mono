/**
 * 포인트 통계 조회 스크립트
 *
 * 사용법:
 *   npx ts-node prisma/operation/point-statistics.ts [startUserId] [endUserId] [endDate]
 *
 * 예시:
 *   npx ts-node prisma/operation/point-statistics.ts 3 40 2026-01-13
 *   npx ts-node prisma/operation/point-statistics.ts 3 40  # 오늘까지
 *
 * 출력:
 *   1. 개요 (1인당 최대, N인 최대, 실지급, 초과지급, 지급률, 일자별 총액)
 *   2. 유저별 합계
 *   3. 사용자별 일별 포인트
 *
 * 환경변수:
 *   DATABASE_URL: DB 연결 문자열 (운영 DB 사용 시 설정)
 *
 * ============================================
 * 📊 2026-01-14 기준 포인트 현황 (userId 3~40)
 * ============================================
 *
 * [개요]
 * 항목                      값
 * 1인당 최대 획득 포인트    ₩22,100
 * 38인 최대 획득 포인트     ₩839,800
 * 실 지급 포인트            ₩566,100
 * 초과 지급 포인트          ₩1,000
 * 포인트 지급률 (%)         67.29%
 *
 * [일자별 총 지급 포인트]
 * 일자    총 지급 포인트
 * 12-29   58,100
 * 12-30   42,100
 * 12-31   35,900
 * 01-01   35,000
 * 01-02   36,500
 * 01-03   29,700
 * 01-04   31,100
 * 01-05   39,600
 * 01-06   33,800
 * 01-07   31,300
 * 01-08   43,400
 * 01-09   30,400
 * 01-10   26,100
 * 01-11   27,000
 * 01-12   36,700
 * 01-13   29,400
 *
 * [사용자별 일별 포인트]
 * user_id 이름    12/29  12/30  12/31  01/01  01/02  01/03  01/04  01/05  01/06  01/07  01/08  01/09  01/10  01/11  01/12  01/13  합계
 * 3       양은혜  800    500    500    500    600    300    500    500    600    800    500    900    700    0      900    700    9,300
 * 4       변슬기  800    900    1,900  0      1,000  700    0      1,000  600    600    0      200    0      0      0      1,800  9,500
 * 5       이미연  1,200  1,900  1,100  1,000  1,300  1,000  1,100  1,500  1,300  900    1,000  700    2,100  700    1,200  900    18,900
 * 6       권예슬  1,000  900    600    700    700    0      600    300    0      600    400    300    600    0      0      500    7,200
 * 7       조혜린  1,200  1,100  800    1,100  1,300  800    1,200  1,200  1,200  1,100  1,300  1,000  900    900    1,600  1,300  18,000
 * 8       주민서  2,500  1,200  1,300  1,200  1,300  1,100  1,300  1,500  1,300  1,200  2,300  1,200  1,200  1,200  1,300  1,300  22,400
 * 9       박수연  2,000  1,300  1,300  1,200  1,300  1,200  1,300  1,500  1,300  1,200  2,300  1,100  1,300  1,200  1,300  1,300  22,100
 * 10      신영지  1,200  1,800  1,200  1,100  1,100  1,300  1,200  1,500  1,000  1,300  1,100  1,300  1,000  1,200  2,000  1,300  20,600
 * 11      김지현  2,100  500    1,200  400    500    0      100    1,000  1,600  400    0      0      2,200  0      1,300  -      11,300
 * 12      최시하  1,100  1,000  700    800    100    1,600  600    1,100  600    400    600    300    400    300    800    600    11,000
 * 13      석보민  1,300  1,100  1,200  1,100  200    1,200  1,200  1,100  700    1,200  1,300  600    900    1,000  1,100  300    15,500
 * 14      노을    2,400  1,000  1,000  1,000  1,200  1,300  900    1,300  1,200  1,300  2,300  900    0      800    1,300  900    18,800
 * 15      정유미  2,100  1,000  1,000  0      800    900    0      1,000  700    800    600    1,100  500    1,000  1,000  -      12,500
 * 16      송민지  2,000  700    400    800    1,100  800    1,000  900    1,200  800    0      1,100  0      1,200  700    -      12,700
 * 17      김가윤  2,400  1,200  1,300  1,200  1,200  900    1,000  1,100  900    1,000  2,000  1,100  800    1,100  1,000  900    19,100
 * 18      함은정  800    800    0      1,100  1,600  800    800    1,100  700    1,100  0      0      0      1,100  1,200  900    12,000
 * 19      박예진  1,500  2,200  1,200  1,100  1,400  0      700    1,200  1,200  1,100  200    2,400  0      1,000  400    -      15,600
 * 20      김솔이  1,000  200    200    300    0      0      0      0      0      300    0      0      0      0      300    -      2,300
 * 21      김선영  2,100  500    600    900    900    400    1,100  900    1,000  400    600    0      1,600  200    1,200  1,000  13,400
 * 22      강선구  900    1,200  700    1,200  0      1,200  1,100  0      0      1,700  1,200  1,200  0      0      0      -      10,400
 * 23      송재은  2,400  1,200  1,300  1,200  1,300  1,200  1,300  1,200  1,300  1,200  2,300  1,200  1,300  1,200  1,300  1,300  22,200
 * 24      문호정  800    1,700  900    900    1,000  400    600    1,300  1,100  1,000  2,300  1,200  1,000  1,100  1,300  1,300  17,900
 * 25      윤정아  2,300  1,700  1,100  1,300  1,100  1,200  1,100  1,500  1,100  1,200  2,100  1,200  1,000  600    1,100  1,100  20,700
 * 26      박정민  1,500  1,200  1,200  1,100  1,200  1,100  1,200  1,300  1,300  800    1,200  1,100  800    1,000  1,300  1,300  18,600
 * 27      김영경  2,300  800    400    1,000  1,300  700    900    1,400  1,300  500    1,900  800    1,000  1,000  1,200  1,300  17,800
 * 28      서유리  2,300  1,200  1,300  1,200  1,300  1,200  1,300  1,500  1,100  1,300  2,200  1,300  1,200  1,400  1,600  1,300  22,700
 * 29      서주희  2,400  1,300  1,300  1,300  1,200  1,000  1,000  1,200  1,300  900    2,300  1,200  1,000  1,200  1,600  1,300  21,500
 * 30      류리    600    1,200  1,300  700    2,200  700    1,200  1,300  1,200  900    1,000  800    700    1,900  1,500  1,300  18,500
 * 31      김은정  2,400  1,200  1,300  1,200  1,300  1,200  1,200  1,300  1,300  1,100  2,200  1,200  600    1,500  1,600  1,300  21,900
 * 32      서정은  1,900  1,100  400    1,200  800    600    1,100  1,200  900    0      1,600  1,000  600    1,100  1,100  -      14,600
 * 33      유연숙  2,200  1,200  1,200  1,300  1,000  1,200  1,300  1,300  1,300  1,000  2,200  1,300  800    1,300  1,300  1,300  21,200
 * 34      서아란  2,400  1,000  700    900    1,000  0      0      1,100  0      0      2,000  0      700    0      500    -      10,300
 * 35      석지수  0      600    600    900    1,000  700    700    600    1,200  900    900    0      0      0      900    900    9,900
 * 36      안영신  1,100  1,700  1,100  400    0      500    200    0      300    0      100    0      0      0      0      -      5,400
 * 37      채수빈  700    500    600    1,000  0      300    400    1,000  0      0      300    0      0      0      0      -      4,800
 * 38      이용주  900    700    500    500    600    600    0      700    0      0      0      0      500    0      600    -      5,600
 * 39      김나희  700    800    1,200  1,000  1,300  700    900    800    1,200  900    1,100  700    700    800    1,200  1,100  15,100
 * 40      김이현  800    2,000  1,300  1,200  1,300  900    1,000  1,200  800    1,400  0      2,000  0      0      0      900    14,800
 *         합계    58,100 42,100 35,900 35,000 36,500 29,700 31,100 39,600 33,800 31,300 43,400 30,400 26,100 27,000 36,700 29,400 566,100
 *
 * [유저별 합계]
 * user_id 이름    총적립  비고
 * 3       양은혜  9,300
 * 4       변슬기  9,500
 * 5       이미연  18,900
 * 6       권예슬  7,200
 * 7       조혜린  18,000
 * 8       주민서  22,400  초과 300
 * 9       박수연  22,100
 * 10      신영지  20,600
 * 11      김지현  11,300
 * 12      최시하  11,000
 * 13      석보민  15,500
 * 14      노을    18,800
 * 15      정유미  12,500
 * 16      송민지  12,700
 * 17      김가윤  19,100
 * 18      함은정  12,000
 * 19      박예진  15,600
 * 20      김솔이  2,300
 * 21      김선영  13,400
 * 22      강선구  10,400
 * 23      송재은  22,200  초과 100
 * 24      문호정  17,900
 * 25      윤정아  20,700
 * 26      박정민  18,600
 * 27      김영경  17,800
 * 28      서유리  22,700  초과 600
 * 29      서주희  21,500
 * 30      류리    18,500
 * 31      김은정  21,900
 * 32      서정은  14,600
 * 33      유연숙  21,200
 * 34      서아란  10,300
 * 35      석지수  9,900
 * 36      안영신  5,400
 * 37      채수빈  4,800
 * 38      이용주  5,600
 * 39      김나희  15,100
 * 40      김이현  14,800
 *         합계    536,700 초과 1,000
 *
 * ※ 총적립은 초과분 포함해서 계산
 * ============================================
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

// 운영 DB 연결 (기본값)
const PROD_DATABASE_URL =
  'postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: PROD_DATABASE_URL,
    },
  },
});

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
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return encryptedText;
  }
}

interface PointConfig {
  dailyMax: number; // 일일 최대 포인트
  bonus: number; // 보너스 포인트 (1회성)
  dietMaxPerDay: number; // DIET 하루 최대 횟수
}

// 1인당 최대 획득 = dailyMax × 일수 + bonus
// 예: 16일 기준 = 1300 × 16 + 1300 = 22,100원
const DEFAULT_CONFIG: PointConfig = {
  dailyMax: 1300,
  bonus: 1300,
  dietMaxPerDay: 3,
};

async function calculatePointStatistics(
  startUserId: number,
  endUserId: number,
  endDate?: string,
  config: PointConfig = DEFAULT_CONFIG,
) {
  const endDateTime = endDate
    ? new Date(`${endDate}T23:59:59.999Z`)
    : new Date();

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
  const userPoints: Record<
    number,
    { name: string; total: number; excess: number }
  > = {};

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
    dailyPoints[date][item.userId] =
      (dailyPoints[date][item.userId] || 0) + item.amount;
  }

  const dates = Object.keys(dailyPoints).sort();

  // 5. 통계 계산
  // 1인당 최대 = dailyMax × 일수 + bonus
  const userCount = Object.keys(userPoints).length;
  const totalDays = dates.length;
  const maxPerPerson = config.dailyMax * totalDays + config.bonus;
  const maxTotal = maxPerPerson * userCount;
  const actualTotal = Object.values(userPoints).reduce(
    (sum, u) => sum + u.total,
    0,
  );
  const adjustedTotal = actualTotal - totalDietExcess;
  const payoutRate = ((adjustedTotal / maxTotal) * 100).toFixed(2);

  // 6. 일자별 총액 계산
  const dailyTotals: Record<string, number> = {};
  const sortedUsers = Object.entries(userPoints).sort(
    ([a], [b]) => parseInt(a) - parseInt(b),
  );
  const userIds = sortedUsers.map(([id]) => parseInt(id));

  for (const date of dates) {
    let dayTotal = 0;
    for (const uid of userIds) {
      dayTotal += dailyPoints[date]?.[uid] || 0;
    }
    dailyTotals[date] = dayTotal;
  }

  // 7. 최대 포인트 초과 유저 계산
  const overMaxUsers: Array<{
    userId: number;
    name: string;
    total: number;
    over: number;
  }> = [];
  for (const [userId, data] of sortedUsers) {
    if (data.total > maxPerPerson) {
      overMaxUsers.push({
        userId: parseInt(userId),
        name: data.name,
        total: data.total,
        over: data.total - maxPerPerson,
      });
    }
  }

  // ========== 출력 ==========

  // 1. 개요
  console.log('\n## 개요\n');
  console.log('| 항목 | 값 |');
  console.log('|------|-----|');
  console.log(`| 1인당 최대 획득 포인트 | ₩${maxPerPerson.toLocaleString()} |`);
  console.log(
    `| ${userCount}인 최대 획득 포인트 | ₩${maxTotal.toLocaleString()} |`,
  );
  console.log(`| 실 지급 포인트 | ₩${adjustedTotal.toLocaleString()} |`);
  console.log(
    `| 초과 지급 포인트 | ₩${totalDietExcess.toLocaleString()} |`,
  );
  console.log(`| 포인트 지급률 (%) | ${payoutRate}% |`);

  console.log('\n| 일자 | 총 지급 포인트 |');
  console.log('|------|---------------|');
  for (const date of dates) {
    const label = date.substring(5); // MM-DD
    console.log(`| ${label} | ${dailyTotals[date].toLocaleString()} |`);
  }

  // 최대 포인트 초과 유저
  if (overMaxUsers.length > 0) {
    console.log(`\n### ${maxPerPerson.toLocaleString()}원 초과 유저\n`);
    console.log('| user_id | 이름 | 총 획득 | 초과분 |');
    console.log('|---------|------|---------|--------|');
    for (const u of overMaxUsers) {
      console.log(
        `| ${u.userId} | ${u.name} | ${u.total.toLocaleString()} | ${u.over.toLocaleString()} |`,
      );
    }
  }

  // 2. 유저별 합계
  // - 획득 포인트: 실제 지급된 총액 (원본 그대로)
  // - 비고: DIET 초과지급분 표시 (차감하지 않음, 참고용)
  console.log('\n---\n');
  console.log('## 유저별 합계\n');
  console.log('| user_id | 이름 | 획득 포인트 | 비고 |');
  console.log('|---------|------|-------------|------|');

  for (const [userId, data] of sortedUsers) {
    const overMax = data.total > maxPerPerson ? data.total - maxPerPerson : 0;
    const note = overMax > 0 ? `초과 ${overMax}` : '';
    console.log(
      `| ${userId} | ${data.name} | ${data.total.toLocaleString()} | ${note} |`,
    );
  }

  // 3. 사용자별 일별 포인트
  console.log('\n---\n');
  console.log('## 사용자별 일별 포인트\n');

  // 헤더 생성
  let header = '| user_id | 이름 |';
  for (const date of dates) {
    header += ` ${date.substring(5)} |`;
  }
  header += ' 합계 |';
  console.log(header);

  let separator = '|---------|------|';
  for (let i = 0; i < dates.length; i++) separator += '-------|';
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
    grandTotal += dailyTotals[date];
    totalRow += ` **${dailyTotals[date].toLocaleString()}** |`;
  }
  totalRow += ` **${grandTotal.toLocaleString()}** |`;
  console.log(totalRow);

  return {
    userCount,
    totalDays,
    maxPerPerson,
    maxTotal,
    actualTotal,
    totalDietExcess,
    adjustedTotal,
    payoutRate: parseFloat(payoutRate),
    overMaxUsers,
  };
}

// CLI 실행
async function main() {
  const args = process.argv.slice(2);
  const startUserId = parseInt(args[0]) || 3;
  const endUserId = parseInt(args[1]) || 40;
  const endDate = args[2] || undefined;

  console.log('\n========================================');
  console.log('포인트 통계 조회');
  console.log('========================================');
  console.log(`조회 범위: user_id ${startUserId} ~ ${endUserId}`);
  console.log(`조회 기간: ~ ${endDate || '현재'}`);
  console.log('----------------------------------------');

  try {
    await calculatePointStatistics(startUserId, endUserId, endDate);
  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
