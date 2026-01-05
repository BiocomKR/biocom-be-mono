import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

// 환경변수 설정
process.env.ENCRYPTION_KEY = 'b!@c@m2@25!@#$@creTkEy!2E45bT8@';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom?connection_limit=5&pool_timeout=30&connect_timeout=10&timezone=Asia/Seoul'
    }
  }
});

// 복호화 함수
function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;

  try {
    const keyStr = process.env.ENCRYPTION_KEY;
    const key = keyStr.length !== 32
      ? crypto.createHash('sha256').update(keyStr).digest()
      : Buffer.from(keyStr);

    const combined = Buffer.from(encryptedText, 'base64');
    const iv = combined.slice(0, 16);
    const tag = combined.slice(16, 32);
    const encrypted = combined.slice(32);

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

async function analyze() {
  try {
    // 1. 대상 사용자 조회
    const users = await prisma.user.findMany({
      where: { id: { gte: 2, lte: 39 } },
      select: { id: true, name: true },
      orderBy: { id: 'asc' }
    });

    // 2. 사용자별 챌린지 조회
    const userChallenges = await prisma.userChallenge.findMany({
      where: { userId: { in: users.map(u => u.id) } },
      select: {
        userId: true,
        activatedAt: true,
        expiresAt: true,
        status: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const userChallengeMap: Record<number, typeof userChallenges[0]> = {};
    userChallenges.forEach(uc => {
      if (!userChallengeMap[uc.userId]) {
        userChallengeMap[uc.userId] = uc;
      }
    });

    // 3. 전체 user_records 조회
    const allRecords = await prisma.userRecord.findMany({
      where: { userId: { in: users.map(u => u.id) } },
      select: {
        userId: true,
        recordType: true,
        metadata: true,
        date: true
      }
    });

    // 4. 사용자별, 기록유형별 집계
    const userRecordMap: Record<number, Record<string, number>> = {};

    allRecords.forEach(r => {
      if (!userRecordMap[r.userId]) userRecordMap[r.userId] = {};
      userRecordMap[r.userId][r.recordType] = (userRecordMap[r.userId][r.recordType] || 0) + 1;
    });

    // 영양제 제외 기록유형
    const mainRecordTypes = ['DIET', 'SLEEP', 'FASTING', 'ACTIVITY', 'BEAUTY', 'BALANCE_GAME', 'QUIZ', 'DAILY_MISSION', 'DECLARATION'];

    console.log(`\n${'='.repeat(140)}`);
    console.log(`  운영 DB 사용자별 기록 유형별 수행 현황 (id 2~39, ${users.length}명)`);
    console.log(`${'='.repeat(140)}\n`);

    // 헤더
    console.log('ID\t이름\t\tDIET\tSLEEP\tFAST\tACTIV\tBEAUTY\tBAL_G\tQUIZ\tD_MIS\tDECL\tSUPP');
    console.log('-'.repeat(120));

    users.forEach(u => {
      const records = userRecordMap[u.id] || {};

      const decryptedName = decrypt(u.name || '');
      const row = [
        String(u.id),
        (decryptedName?.slice(0, 6) || '-').padEnd(8),
        records['DIET'] || 0,
        records['SLEEP'] || 0,
        records['FASTING'] || 0,
        records['ACTIVITY'] || 0,
        records['BEAUTY'] || 0,
        records['BALANCE_GAME'] || 0,
        records['QUIZ'] || 0,
        records['DAILY_MISSION'] || 0,
        records['DECLARATION'] || 0,
        records['SUPPLEMENT'] || 0
      ];

      console.log(row.join('\t'));
    });

    // 5. 기대치 대비 수행율 계산
    console.log(`\n${'='.repeat(100)}`);
    console.log('📈 챌린지 진행일 기준 수행율 분석');
    console.log('-'.repeat(100));
    console.log('ID\t이름\t\t진행일\tDIET기대/실제\tSLEEP\t\tFAST\t\tACTIV\t\tBEAUTY');
    console.log('-'.repeat(100));

    users.forEach(u => {
      const records = userRecordMap[u.id] || {};
      const challenge = userChallengeMap[u.id];

      let challengeDays = 0;
      if (challenge?.activatedAt) {
        const start = new Date(challenge.activatedAt);
        const now = new Date();
        challengeDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        challengeDays = Math.min(challengeDays, 21);
      }

      const decryptedName = decrypt(u.name || '');
      if (challengeDays === 0) {
        console.log(`${u.id}\t${(decryptedName?.slice(0, 6) || '-').padEnd(8)}\t-\t챌린지 없음`);
        return;
      }

      // DIET: 하루 3끼
      const dietExpected = challengeDays * 3;
      const dietActual = records['DIET'] || 0;

      // 나머지: 하루 1회
      const sleepExpected = challengeDays;
      const sleepActual = records['SLEEP'] || 0;

      const fastExpected = challengeDays;
      const fastActual = records['FASTING'] || 0;

      const activExpected = challengeDays;
      const activActual = records['ACTIVITY'] || 0;

      const beautyExpected = challengeDays;
      const beautyActual = records['BEAUTY'] || 0;

      console.log(`${u.id}\t${(decryptedName?.slice(0, 6) || '-').padEnd(8)}\t${challengeDays}일\t${dietActual}/${dietExpected}\t\t${sleepActual}/${sleepExpected}\t\t${fastActual}/${fastExpected}\t\t${activActual}/${activExpected}\t\t${beautyActual}/${beautyExpected}`);
    });

    // 6. 기록유형별 전체 통계
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 기록유형별 전체 통계');
    console.log('-'.repeat(80));

    const typeTotal: Record<string, number> = {};
    allRecords.forEach(r => {
      typeTotal[r.recordType] = (typeTotal[r.recordType] || 0) + 1;
    });

    [...mainRecordTypes, 'SUPPLEMENT'].forEach(type => {
      const note = type === 'SUPPLEMENT' ? ' (1주일치 미리 등록)' : '';
      console.log(`${type.padEnd(16)}: ${typeTotal[type] || 0}건${note}`);
    });

    console.log(`\n${'='.repeat(80)}\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyze();
