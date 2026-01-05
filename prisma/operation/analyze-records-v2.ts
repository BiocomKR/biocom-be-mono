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
    // 영양제 레코드 샘플 확인
    const supplementSamples = await prisma.userRecord.findMany({
      where: {
        userId: { gte: 2, lte: 39 },
        recordType: 'SUPPLEMENT'
      },
      select: {
        userId: true,
        metadata: true,
        date: true
      },
      take: 10
    });

    console.log('=== 영양제 metadata 샘플 ===');
    supplementSamples.forEach((r, i) => {
      console.log(`\n[${i + 1}] userId: ${r.userId}, date: ${r.date}`);
      console.log(JSON.stringify(r.metadata, null, 2));
    });

    // 다른 recordType 샘플도 확인
    const recordTypes = ['DIET', 'SLEEP', 'FASTING', 'ACTIVITY', 'BEAUTY', 'BALANCE_GAME', 'QUIZ', 'DAILY_MISSION', 'DECLARATION'];

    for (const type of recordTypes) {
      const sample = await prisma.userRecord.findFirst({
        where: {
          userId: { gte: 2, lte: 39 },
          recordType: type
        },
        select: { metadata: true }
      });
      console.log(`\n=== ${type} 샘플 ===`);
      console.log(JSON.stringify(sample?.metadata, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyze();
