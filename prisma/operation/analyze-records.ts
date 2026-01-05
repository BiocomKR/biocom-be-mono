import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom?connection_limit=5&pool_timeout=30&connect_timeout=10&timezone=Asia/Seoul'
    }
  }
});

async function analyze() {
  try {
    // 1. 대상 사용자 조회 (id 2~39, 38명)
    const users = await prisma.user.findMany({
      where: { id: { gte: 2, lte: 39 } },
      select: { id: true, name: true },
      orderBy: { id: 'asc' }
    });

    console.log(`\n=== 운영 DB 기록 수행율 분석 ===`);
    console.log(`대상 사용자: ${users.length}명 (id 2~39)\n`);

    // 2. 전체 user_records 조회
    const allRecords = await prisma.userRecord.findMany({
      where: { userId: { in: users.map(u => u.id) } },
      select: {
        userId: true,
        recordType: true,
        metadata: true,
        date: true
      }
    });

    console.log(`총 기록 수: ${allRecords.length}건\n`);

    // 3. recordType별 통계
    const typeStats: Record<string, number> = {};
    allRecords.forEach(r => {
      typeStats[r.recordType] = (typeStats[r.recordType] || 0) + 1;
    });

    console.log('=== recordType별 기록 수 ===');
    Object.entries(typeStats).sort((a,b) => b[1] - a[1]).forEach(([type, count]) => {
      console.log(`${type}: ${count}건`);
    });

    // 4. 사용자별 기록 통계
    console.log('\n=== 사용자별 기록 현황 ===');
    const userStats: Record<number, Record<string, number>> = {};

    allRecords.forEach(r => {
      if (!userStats[r.userId]) userStats[r.userId] = {};
      userStats[r.userId][r.recordType] = (userStats[r.userId][r.recordType] || 0) + 1;
    });

    const recordTypes = Object.keys(typeStats);

    // 테이블 형태로 출력
    console.log('ID\t이름\t\t' + recordTypes.join('\t'));
    console.log('-'.repeat(80));

    users.forEach(u => {
      const stats = userStats[u.id] || {};
      const row = recordTypes.map(t => stats[t] || 0).join('\t');
      const name = (u.name || '').slice(0, 6).padEnd(6, ' ');
      console.log(`${u.id}\t${name}\t\t${row}`);
    });

    // 5. 영양제(SUPPLEMENT) 상세 분석
    console.log('\n=== 영양제(SUPPLEMENT) 상세 분석 ===');
    const supplementRecords = allRecords.filter(r => r.recordType === 'SUPPLEMENT');

    let totalSlots = 0;
    let takenSlots = 0;

    supplementRecords.forEach(r => {
      const meta = r.metadata as any;
      if (meta && Array.isArray(meta.slots)) {
        meta.slots.forEach((slot: any) => {
          totalSlots++;
          if (slot.taken === true) takenSlots++;
        });
      }
    });

    console.log(`총 영양제 레코드: ${supplementRecords.length}건`);
    console.log(`총 슬롯 수: ${totalSlots}개`);
    console.log(`복용 완료 슬롯: ${takenSlots}개`);
    console.log(`영양제 복용율: ${totalSlots > 0 ? ((takenSlots / totalSlots) * 100).toFixed(1) : 0}%`);

    // 6. 사용자별 영양제 복용율
    console.log('\n=== 사용자별 영양제 복용율 ===');
    const userSupplementStats: Record<number, { total: number; taken: number }> = {};

    supplementRecords.forEach(r => {
      if (!userSupplementStats[r.userId]) {
        userSupplementStats[r.userId] = { total: 0, taken: 0 };
      }
      const meta = r.metadata as any;
      if (meta && Array.isArray(meta.slots)) {
        meta.slots.forEach((slot: any) => {
          userSupplementStats[r.userId].total++;
          if (slot.taken === true) userSupplementStats[r.userId].taken++;
        });
      }
    });

    users.forEach(u => {
      const stats = userSupplementStats[u.id];
      if (stats && stats.total > 0) {
        const rate = ((stats.taken / stats.total) * 100).toFixed(1);
        console.log(`${u.id}\t${u.name}\t${stats.taken}/${stats.total}\t${rate}%`);
      }
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyze();
