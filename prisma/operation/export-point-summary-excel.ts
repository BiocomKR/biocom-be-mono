import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom'
    }
  }
});

const ENCRYPTION_KEY = 'b!@c@m2@25!@#$@creTkEy!2E45bT8@';

function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;

  try {
    let key: Buffer;
    if (ENCRYPTION_KEY.length !== 32) {
      key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    } else {
      key = Buffer.from(ENCRYPTION_KEY);
    }

    const combined = Buffer.from(encryptedText, 'base64');
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
  } catch {
    return encryptedText;
  }
}

async function main() {
  // ID 1번 제외, 이후 38명만 실제 사용자 (userId 2~39)
  const pointHistory = await prisma.pointHistory.findMany({
    where: {
      amount: { gt: 0 },
      userId: { gte: 2, lte: 39 }  // ID 2~39만 (38명)
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
  const grouped: Record<number, {
    userName: string;
    dates: Record<string, { total: number; details: any[] }>;
  }> = {};

  for (const ph of pointHistory) {
    const userId = ph.userId;
    const rawName = ph.user?.name || `User ${userId}`;
    const userName = decrypt(rawName);
    const date = ph.createdAt.toISOString().split('T')[0];

    if (!grouped[userId]) {
      grouped[userId] = { userName, dates: {} };
    }
    if (!grouped[userId].dates[date]) {
      grouped[userId].dates[date] = { total: 0, details: [] };
    }

    grouped[userId].dates[date].total += ph.amount;
    grouped[userId].dates[date].details.push({
      amount: ph.amount,
      description: ph.description,
      relatedType: ph.relatedType
    });
  }

  // 모든 날짜 수집
  const allDates = new Set<string>();
  for (const userData of Object.values(grouped)) {
    for (const date of Object.keys(userData.dates)) {
      allDates.add(date);
    }
  }
  const sortedDates = Array.from(allDates).sort();

  // CSV 생성 (엑셀에서 열 수 있음)
  const headers = ['이름', ...sortedDates, '총합'];
  const rows: string[][] = [];

  // 사용자별 행 생성
  const userIds = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  for (const userId of userIds) {
    const userData = grouped[userId];
    const row: string[] = [userData.userName];
    let userTotal = 0;

    for (const date of sortedDates) {
      const dateData = userData.dates[date];
      const points = dateData ? dateData.total : 0;
      row.push(points.toString());
      userTotal += points;
    }
    row.push(userTotal.toString());
    rows.push(row);
  }

  // 일별 합계 행
  const totalRow: string[] = ['일별 합계'];
  let grandTotal = 0;
  for (const date of sortedDates) {
    let dateTotal = 0;
    for (const userData of Object.values(grouped)) {
      if (userData.dates[date]) {
        dateTotal += userData.dates[date].total;
      }
    }
    totalRow.push(dateTotal.toString());
    grandTotal += dateTotal;
  }
  totalRow.push(grandTotal.toString());
  rows.push(totalRow);

  // CSV 파일 생성
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // BOM 추가 (한글 깨짐 방지)
  const bom = '\uFEFF';
  fs.writeFileSync('/Users/shinwoo/Desktop/포인트적립내역.csv', bom + csvContent, 'utf8');
  console.log('✅ 엑셀 파일 생성 완료: /Users/shinwoo/Desktop/포인트적립내역.csv');
  console.log(`총 ${userIds.length}명의 사용자 데이터`);

  // 상세 내역 시트용 CSV도 생성
  const detailHeaders = ['이름', '날짜', '포인트', '내역'];
  const detailRows: string[][] = [];

  for (const userId of userIds) {
    const userData = grouped[userId];
    for (const date of sortedDates) {
      const dateData = userData.dates[date];
      if (dateData) {
        for (const detail of dateData.details) {
          const desc = detail.description || detail.relatedType || '기타';
          detailRows.push([userData.userName, date, detail.amount.toString(), desc]);
        }
      }
    }
  }

  const detailCsvContent = [
    detailHeaders.join(','),
    ...detailRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  fs.writeFileSync('/Users/shinwoo/Desktop/포인트적립상세내역.csv', bom + detailCsvContent, 'utf8');
  console.log('✅ 상세 내역 파일 생성 완료: /Users/shinwoo/Desktop/포인트적립상세내역.csv');

  await prisma.$disconnect();
}

main().catch(console.error);
