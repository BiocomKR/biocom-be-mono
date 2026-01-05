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
    // 1. 대상 사용자 조회 (id 2~39)
    const users = await prisma.user.findMany({
      where: { id: { gte: 2, lte: 39 } },
      select: { id: true, name: true },
      orderBy: { id: 'asc' }
    });

    console.log(`\n${'='.repeat(80)}`);
    console.log(`  운영 DB 기록 수행율 분석 (id 2~39, ${users.length}명)`);
    console.log(`${'='.repeat(80)}\n`);

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

    // 3. recordType별 통계
    const typeStats: Record<string, { total: number; completed: number }> = {};

    allRecords.forEach(r => {
      if (!typeStats[r.recordType]) {
        typeStats[r.recordType] = { total: 0, completed: 0 };
      }
      typeStats[r.recordType].total++;

      const meta = r.metadata as any;
      if (meta?.isCompleted === true) {
        typeStats[r.recordType].completed++;
      }
    });

    console.log('📊 recordType별 수행율');
    console.log('-'.repeat(60));
    console.log('기록유형\t\t총건수\t완료\t수행율');
    console.log('-'.repeat(60));

    Object.entries(typeStats)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([type, stat]) => {
        const rate = ((stat.completed / stat.total) * 100).toFixed(1);
        const typeName = type.padEnd(16);
        console.log(`${typeName}\t${stat.total}\t${stat.completed}\t${rate}%`);
      });

    // 4. 영양제 상세 분석 (morning/afternoon/evening 체크)
    console.log(`\n${'='.repeat(80)}`);
    console.log('💊 영양제(SUPPLEMENT) 상세 분석');
    console.log('※ 1주일치 미리 등록 후 morning/afternoon/evening true/false로 복용 체크');
    console.log('-'.repeat(80));

    const supplementRecords = allRecords.filter(r => r.recordType === 'SUPPLEMENT');

    let totalTimeSlots = 0;
    let takenTimeSlots = 0;
    let completedRecords = 0;

    const userSupplementStats: Record<number, {
      totalRecords: number;
      completedRecords: number;
      morningTotal: number;
      morningTaken: number;
      afternoonTotal: number;
      afternoonTaken: number;
      eveningTotal: number;
      eveningTaken: number;
    }> = {};

    supplementRecords.forEach(r => {
      const meta = r.metadata as any;
      if (!userSupplementStats[r.userId]) {
        userSupplementStats[r.userId] = {
          totalRecords: 0,
          completedRecords: 0,
          morningTotal: 0,
          morningTaken: 0,
          afternoonTotal: 0,
          afternoonTaken: 0,
          eveningTotal: 0,
          eveningTaken: 0
        };
      }

      const stats = userSupplementStats[r.userId];
      stats.totalRecords++;

      if (meta?.isCompleted === true) {
        stats.completedRecords++;
        completedRecords++;
      }

      // 시간대별 체크 (필드가 존재하면 카운트)
      if (meta?.morning !== undefined) {
        stats.morningTotal++;
        totalTimeSlots++;
        if (meta.morning === true) {
          stats.morningTaken++;
          takenTimeSlots++;
        }
      }
      if (meta?.afternoon !== undefined) {
        stats.afternoonTotal++;
        totalTimeSlots++;
        if (meta.afternoon === true) {
          stats.afternoonTaken++;
          takenTimeSlots++;
        }
      }
      if (meta?.evening !== undefined) {
        stats.eveningTotal++;
        totalTimeSlots++;
        if (meta.evening === true) {
          stats.eveningTaken++;
          takenTimeSlots++;
        }
      }
    });

    console.log(`총 영양제 레코드: ${supplementRecords.length}건`);
    console.log(`완료 처리된 레코드: ${completedRecords}건 (${((completedRecords / supplementRecords.length) * 100).toFixed(1)}%)`);
    console.log(`\n시간대별 복용 현황:`);
    console.log(`  - 아침(morning): ${userSupplementStats ? Object.values(userSupplementStats).reduce((sum, s) => sum + s.morningTaken, 0) : 0}/${Object.values(userSupplementStats).reduce((sum, s) => sum + s.morningTotal, 0)}회`);
    console.log(`  - 점심(afternoon): ${Object.values(userSupplementStats).reduce((sum, s) => sum + s.afternoonTaken, 0)}/${Object.values(userSupplementStats).reduce((sum, s) => sum + s.afternoonTotal, 0)}회`);
    console.log(`  - 저녁(evening): ${Object.values(userSupplementStats).reduce((sum, s) => sum + s.eveningTaken, 0)}/${Object.values(userSupplementStats).reduce((sum, s) => sum + s.eveningTotal, 0)}회`);
    console.log(`\n총 시간대 복용율: ${takenTimeSlots}/${totalTimeSlots} (${((takenTimeSlots / totalTimeSlots) * 100).toFixed(1)}%)`);

    // 5. 사용자별 종합 수행율
    console.log(`\n${'='.repeat(80)}`);
    console.log('👤 사용자별 종합 수행율');
    console.log('-'.repeat(80));
    console.log('ID\t이름\t총기록\t완료\t수행율\t영양제복용율');
    console.log('-'.repeat(80));

    const userTotalStats: Record<number, { total: number; completed: number }> = {};

    allRecords.forEach(r => {
      if (!userTotalStats[r.userId]) {
        userTotalStats[r.userId] = { total: 0, completed: 0 };
      }
      userTotalStats[r.userId].total++;

      const meta = r.metadata as any;
      if (meta?.isCompleted === true) {
        userTotalStats[r.userId].completed++;
      }
    });

    users.forEach(u => {
      const totalStat = userTotalStats[u.id] || { total: 0, completed: 0 };
      const suppStat = userSupplementStats[u.id];

      const totalRate = totalStat.total > 0
        ? ((totalStat.completed / totalStat.total) * 100).toFixed(1)
        : '0.0';

      let suppRate = '-';
      if (suppStat) {
        const suppTotal = suppStat.morningTotal + suppStat.afternoonTotal + suppStat.eveningTotal;
        const suppTaken = suppStat.morningTaken + suppStat.afternoonTaken + suppStat.eveningTaken;
        suppRate = suppTotal > 0 ? ((suppTaken / suppTotal) * 100).toFixed(1) + '%' : '-';
      }

      console.log(`${u.id}\t${u.name?.slice(0, 6) || '-'}\t${totalStat.total}\t${totalStat.completed}\t${totalRate}%\t${suppRate}`);
    });

    // 6. 전체 요약
    const totalRecords = allRecords.length;
    const totalCompleted = allRecords.filter(r => (r.metadata as any)?.isCompleted === true).length;

    console.log(`\n${'='.repeat(80)}`);
    console.log('📈 전체 요약');
    console.log('-'.repeat(80));
    console.log(`총 기록 수: ${totalRecords}건`);
    console.log(`완료된 기록: ${totalCompleted}건`);
    console.log(`전체 수행율: ${((totalCompleted / totalRecords) * 100).toFixed(1)}%`);
    console.log(`영양제 시간대 복용율: ${((takenTimeSlots / totalTimeSlots) * 100).toFixed(1)}%`);
    console.log(`${'='.repeat(80)}\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyze();
