/**
 * 포인트 지급 내역 리포트 생성 스크립트
 *
 * 사용법:
 *   npx ts-node prisma/operation/export-point-report.ts [startUserId] [endUserId] [startDate] [endDate]
 *
 * 예시:
 *   npx ts-node prisma/operation/export-point-report.ts 3 40 2025-12-29 2026-01-11
 *
 * 환경변수:
 *   DATABASE_URL: 운영 DB 연결 문자열
 *   ENCRYPTION_KEY: 이름 복호화 키
 *
 * 출력:
 *   ./output/point-report-YYYYMMDD-HHMMSS/
 *     - 1_일자별상세.csv
 *     - 2_사용자별합계.csv
 *     - 3_요약.csv
 *     - 4_일자별총액.csv
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// 운영 DB 연결 (독립적)
const PROD_DATABASE_URL = 'postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom?connection_limit=5&pool_timeout=30&connect_timeout=10&timezone=Asia/Seoul';
const ENCRYPTION_KEY = 'b!@c@m2@25!@#$@creTkEy!2E45bT8@';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: PROD_DATABASE_URL
    }
  }
});

// 복호화 유틸
class CryptoUtil {
  private static algorithm = 'aes-256-gcm';
  private static ivLength = 16;
  private static tagLength = 16;

  private static getKey(): Buffer {
    if (ENCRYPTION_KEY.length !== 32) {
      return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    }
    return Buffer.from(ENCRYPTION_KEY);
  }

  static decrypt(encryptedText: string): string {
    if (!encryptedText) return encryptedText;

    try {
      const key = this.getKey();
      const combined = Buffer.from(encryptedText, 'base64');

      const iv = combined.slice(0, this.ivLength);
      const tag = combined.slice(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = combined.slice(this.ivLength + this.tagLength);

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      (decipher as any).setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      return encryptedText; // 복호화 실패 시 원본 반환
    }
  }
}

// 날짜 유틸
function formatDate(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function formatDateLabel(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${month}-${day}`;
}

// 포인트 포맷
function formatPoints(points: number): string {
  return points === 0 ? '-' : points.toLocaleString('ko-KR');
}

// CSV 생성 유틸
function createCSV(headers: string[], rows: string[][]): string {
  const bom = '\uFEFF'; // UTF-8 BOM for Excel
  const headerLine = headers.join(',');
  const dataLines = rows.map(row => row.map(cell => `"${cell}"`).join(','));
  return bom + [headerLine, ...dataLines].join('\n');
}

async function main() {
  const args = process.argv.slice(2);

  const startUserId = parseInt(args[0]) || 3;
  const endUserId = parseInt(args[1]) || 40;
  const startDate = args[2] || '2025-12-29';
  const endDate = args[3] || '2026-01-11';

  console.log(`\n📊 포인트 리포트 생성`);
  console.log(`   사용자: ${startUserId} ~ ${endUserId}`);
  console.log(`   기간: ${startDate} ~ ${endDate}\n`);

  const dates = getDateRange(startDate, endDate);
  const maxPointsPerDay = 1300;
  const totalDays = dates.length;
  const maxPointsPerChallenge = maxPointsPerDay * totalDays;
  const totalUsers = endUserId - startUserId + 1;

  // 1. 사용자 목록 조회
  const users = await prisma.user.findMany({
    where: {
      id: { gte: startUserId, lte: endUserId }
    },
    select: { id: true, name: true },
    orderBy: { id: 'asc' }
  });

  // 2. 포인트 내역 조회
  const startDateTime = new Date(`${startDate}T00:00:00+09:00`);
  const endDateTime = new Date(`${endDate}T23:59:59+09:00`);

  const pointHistories = await prisma.pointHistory.findMany({
    where: {
      userId: { gte: startUserId, lte: endUserId },
      type: { in: ['EARN', 'EARNED'] },
      createdAt: { gte: startDateTime, lte: endDateTime }
    },
    select: {
      userId: true,
      amount: true,
      createdAt: true
    }
  });

  // 3. 사용자별, 일자별 집계
  const userDailyPoints: Map<number, Map<string, number>> = new Map();
  const dailyTotals: Map<string, number> = new Map();

  // 초기화
  for (const user of users) {
    userDailyPoints.set(user.id, new Map());
    for (const date of dates) {
      userDailyPoints.get(user.id)!.set(date, 0);
    }
  }
  for (const date of dates) {
    dailyTotals.set(date, 0);
  }

  // 집계
  for (const ph of pointHistories) {
    const dateStr = formatDate(ph.createdAt);
    if (dates.includes(dateStr)) {
      const userPoints = userDailyPoints.get(ph.userId);
      if (userPoints) {
        const current = userPoints.get(dateStr) || 0;
        userPoints.set(dateStr, current + ph.amount);
      }
      dailyTotals.set(dateStr, (dailyTotals.get(dateStr) || 0) + ph.amount);
    }
  }

  // 4. 사용자별 합계 및 초과지급 계산
  interface UserSummary {
    userId: number;
    name: string;
    total: number;
    overPayment: number;
  }

  const userSummaries: UserSummary[] = [];

  for (const user of users) {
    const dailyPoints = userDailyPoints.get(user.id)!;
    let total = 0;
    for (const points of dailyPoints.values()) {
      total += points;
    }

    const overPayment = total > maxPointsPerChallenge ? total - maxPointsPerChallenge : 0;
    const decryptedName = CryptoUtil.decrypt(user.name);

    userSummaries.push({
      userId: user.id,
      name: decryptedName,
      total,
      overPayment
    });
  }

  // 5. 전체 통계
  const totalPoints = userSummaries.reduce((sum, u) => sum + u.total, 0);
  const totalOverPayment = userSummaries.reduce((sum, u) => sum + u.overPayment, 0);
  const maxPossiblePoints = maxPointsPerChallenge * totalUsers;
  const paymentRate = ((totalPoints / maxPossiblePoints) * 100).toFixed(2);

  // 6. 출력 디렉토리 생성
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const outputDir = path.join(__dirname, '..', '..', 'output', `point-report-${timestamp}`);
  fs.mkdirSync(outputDir, { recursive: true });

  // 7. CSV 파일 생성

  // 7-1. 일자별 상세
  const detailHeaders = ['user_id', '이름', ...dates.map(formatDateLabel), '합계'];
  const detailRows: string[][] = [];

  for (const user of userSummaries) {
    const dailyPoints = userDailyPoints.get(user.userId)!;
    const row = [
      user.userId.toString(),
      user.name,
      ...dates.map(d => formatPoints(dailyPoints.get(d) || 0)),
      formatPoints(user.total)
    ];
    detailRows.push(row);
  }

  // 합계 행
  const totalRow = [
    '',
    '합계',
    ...dates.map(d => formatPoints(dailyTotals.get(d) || 0)),
    formatPoints(totalPoints)
  ];
  detailRows.push(totalRow);

  fs.writeFileSync(
    path.join(outputDir, '1_일자별상세.csv'),
    createCSV(detailHeaders, detailRows)
  );

  // 7-2. 사용자별 합계
  const summaryHeaders = ['user_id', '이름', '획득 포인트', '비고'];
  const summaryRows: string[][] = userSummaries.map(u => [
    u.userId.toString(),
    u.name,
    formatPoints(u.total),
    u.overPayment > 0 ? `초과지급 -${formatPoints(u.overPayment)}` : ''
  ]);
  summaryRows.push(['', '합계', formatPoints(totalPoints), '']);

  fs.writeFileSync(
    path.join(outputDir, '2_사용자별합계.csv'),
    createCSV(summaryHeaders, summaryRows)
  );

  // 7-3. 요약
  const overviewHeaders = ['항목', '값'];
  const overviewRows: string[][] = [
    ['1인당 최대 획득 포인트', `₩${maxPointsPerChallenge.toLocaleString('ko-KR')}`],
    [`${totalUsers}인 최대 획득 포인트`, `₩${maxPossiblePoints.toLocaleString('ko-KR')}`],
    ['실 지급 포인트', `₩${totalPoints.toLocaleString('ko-KR')}`],
    ['초과 지급 포인트', `₩${totalOverPayment.toLocaleString('ko-KR')}`],
    ['포인트 지급률 (%)', `${paymentRate}%`]
  ];

  fs.writeFileSync(
    path.join(outputDir, '3_요약.csv'),
    createCSV(overviewHeaders, overviewRows)
  );

  // 7-4. 일자별 총액
  const dailyHeaders = ['일자', '총 지급 포인트'];
  const dailyRows: string[][] = dates.map(d => [
    formatDateLabel(d),
    `₩${(dailyTotals.get(d) || 0).toLocaleString('ko-KR')}`
  ]);

  fs.writeFileSync(
    path.join(outputDir, '4_일자별총액.csv'),
    createCSV(dailyHeaders, dailyRows)
  );

  console.log(`✅ 리포트 생성 완료: ${outputDir}`);
  console.log(`\n📁 생성된 파일:`);
  console.log(`   - 1_일자별상세.csv`);
  console.log(`   - 2_사용자별합계.csv`);
  console.log(`   - 3_요약.csv`);
  console.log(`   - 4_일자별총액.csv`);

  console.log(`\n📊 요약:`);
  console.log(`   총 사용자: ${totalUsers}명`);
  console.log(`   기간: ${totalDays}일`);
  console.log(`   1인당 최대: ₩${maxPointsPerChallenge.toLocaleString('ko-KR')}`);
  console.log(`   실 지급: ₩${totalPoints.toLocaleString('ko-KR')}`);
  console.log(`   초과 지급: ₩${totalOverPayment.toLocaleString('ko-KR')}`);
  console.log(`   지급률: ${paymentRate}%`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ 오류 발생:', e);
  await prisma.$disconnect();
  process.exit(1);
});
