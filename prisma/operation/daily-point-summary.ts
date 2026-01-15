/**
 * 일별 포인트 적립 내역 조회 스크립트
 *
 * 사용법:
 *   npx ts-node prisma/operation/daily-point-summary.ts [startUserId] [endUserId] [endDate]
 *
 * 예시:
 *   npx ts-node prisma/operation/daily-point-summary.ts 3 40 2026-01-14
 */
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom',
    },
  },
});

// 암호화 키 (운영 환경과 동일)
const ENCRYPTION_KEY = 'b!@c@m2@25!@#$@creTkEy!2E45bT8@';

// 설정
const config = {
  dailyMax: 1300, // 일일 최대 포인트
  bonus: 0, // 보너스 (필요시 추가)
};

/**
 * AES-256-GCM 복호화
 */
function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;

  try {
    // 키 준비 (32바이트가 아니면 해시로 변환)
    let key: Buffer;
    if (ENCRYPTION_KEY.length !== 32) {
      key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    } else {
      key = Buffer.from(ENCRYPTION_KEY);
    }

    const combined = Buffer.from(encryptedText, 'base64');

    // IV(16) + 인증태그(16) + 암호문
    const ivLength = 16;
    const tagLength = 16;

    const iv = combined.slice(0, ivLength);
    const tag = combined.slice(ivLength, ivLength + tagLength);
    const encrypted = combined.slice(ivLength + tagLength);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    (decipher as any).setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    // 복호화 실패 시 원본 반환
    return encryptedText;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const startUserId = parseInt(args[0]) || 3;
  const endUserId = parseInt(args[1]) || 40;
  const endDate = args[2] || undefined;

  // 종료일 계산
  let endDateTime: Date | undefined;
  if (endDate) {
    endDateTime = new Date(`${endDate}T23:59:59+09:00`);
  }

  // 모든 유저의 일별 포인트 적립 내역 (amount > 0 인 적립만)
  const pointHistory = await prisma.pointHistory.findMany({
    where: {
      userId: { gte: startUserId, lte: endUserId },
      amount: { gt: 0 },
      ...(endDateTime && { createdAt: { lte: endDateTime } }),
    },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }],
  });

  // 유저별, 날짜별로 그룹화
  const grouped: Record<
    number,
    { name: string; dates: Record<string, { total: number; details: any[] }> }
  > = {};

  for (const ph of pointHistory) {
    const rawName = ph.user?.name || `User ${ph.userId}`;
    const userName = decrypt(rawName);
    const date = ph.createdAt.toISOString().split('T')[0];

    if (!grouped[ph.userId])
      grouped[ph.userId] = { name: userName, dates: {} };
    if (!grouped[ph.userId].dates[date])
      grouped[ph.userId].dates[date] = { total: 0, details: [] };

    grouped[ph.userId].dates[date].total += ph.amount;
    grouped[ph.userId].dates[date].details.push({
      amount: ph.amount,
      description: ph.description,
      relatedType: ph.relatedType,
    });
  }

  // 일수 계산 (모든 날짜 수집)
  const allDates = new Set<string>();
  for (const userData of Object.values(grouped)) {
    for (const date of Object.keys(userData.dates)) {
      allDates.add(date);
    }
  }
  const totalDays = allDates.size;
  const maxPerPerson = config.dailyMax * totalDays + config.bonus;

  console.log('=== 일별 포인트 적립 내역 ===\n');
  console.log(`조회 범위: user_id ${startUserId} ~ ${endUserId}`);
  console.log(`조회 기간: ~ ${endDate || '현재'}`);
  console.log(`총 일수: ${totalDays}일`);
  console.log(`1인당 최대 획득 포인트: ₩${maxPerPerson.toLocaleString()}`);
  console.log('-'.repeat(50));

  const userSummaries: {
    userId: number;
    name: string;
    total: number;
    overMax: number;
  }[] = [];

  for (const [userIdStr, userData] of Object.entries(grouped)) {
    const userId = parseInt(userIdStr);
    console.log(`\n👤 [${userId}] ${userData.name}`);
    console.log('-'.repeat(50));

    let userTotal = 0;
    for (const [date, data] of Object.entries(userData.dates)) {
      console.log(`  📅 ${date}: +${data.total}P`);
      for (const detail of data.details) {
        const desc = detail.description || detail.relatedType || '기타';
        console.log(`     - ${desc}: +${detail.amount}P`);
      }
      userTotal += data.total;
    }

    const overMax = userTotal > maxPerPerson ? userTotal - maxPerPerson : 0;
    const overNote = overMax > 0 ? ` (초과 ${overMax})` : '';
    console.log(`  ━━━ 총 적립: ${userTotal.toLocaleString()}P${overNote}`);

    userSummaries.push({ userId, name: userData.name, total: userTotal, overMax });
  }

  // 전체 요약
  console.log('\n\n=== 유저별 합계 ===\n');
  console.log('| user_id | 이름 | 총적립 | 비고 |');
  console.log('|---------|------|--------|------|');

  let grandTotal = 0;
  let totalOverMax = 0;
  for (const u of userSummaries) {
    const note = u.overMax > 0 ? `초과 ${u.overMax}` : '';
    console.log(
      `| ${u.userId} | ${u.name} | ${u.total.toLocaleString()} | ${note} |`,
    );
    grandTotal += u.total;
    totalOverMax += u.overMax;
  }

  const totalOverNote =
    totalOverMax > 0 ? `초과 ${totalOverMax.toLocaleString()}` : '';
  console.log(`| 합계 | | ${grandTotal.toLocaleString()} | ${totalOverNote} |`);

  await prisma.$disconnect();
}

main().catch(console.error);
