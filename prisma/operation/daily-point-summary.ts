import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom'
    }
  }
});

// 암호화 키 (운영 환경과 동일)
const ENCRYPTION_KEY = 'b!@c@m2@25!@#$@creTkEy!2E45bT8@';

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
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    // 복호화 실패 시 원본 반환
    return encryptedText;
  }
}

async function main() {
  // 먼저 어떤 type들이 있는지 확인
  const types = await prisma.pointHistory.groupBy({
    by: ['type'],
    _count: true
  });
  console.log('포인트 내역 type 종류:', types);

  // 모든 유저의 일별 포인트 적립 내역 (amount > 0 인 적립만)
  const pointHistory = await prisma.pointHistory.findMany({
    where: {
      amount: { gt: 0 }
    },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      }
    },
    orderBy: [
      { userId: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  // 유저별, 날짜별로 그룹화
  const grouped: Record<string, Record<string, { total: number; details: any[] }>> = {};

  for (const ph of pointHistory) {
    const rawName = ph.user?.name || `User ${ph.userId}`;
    const userName = decrypt(rawName);
    const date = ph.createdAt.toISOString().split('T')[0];

    if (!grouped[userName]) grouped[userName] = {};
    if (!grouped[userName][date]) grouped[userName][date] = { total: 0, details: [] };

    grouped[userName][date].total += ph.amount;
    grouped[userName][date].details.push({
      amount: ph.amount,
      description: ph.description,
      relatedType: ph.relatedType
    });
  }

  console.log('=== 일별 포인트 적립 내역 ===\n');

  for (const [userName, dates] of Object.entries(grouped)) {
    console.log(`\n👤 ${userName}`);
    console.log('-'.repeat(50));

    let userTotal = 0;
    for (const [date, data] of Object.entries(dates)) {
      console.log(`  📅 ${date}: +${data.total}P`);
      for (const detail of data.details) {
        const desc = detail.description || detail.relatedType || '기타';
        console.log(`     - ${desc}: +${detail.amount}P`);
      }
      userTotal += data.total;
    }
    console.log(`  ━━━ 총 적립: ${userTotal}P`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
