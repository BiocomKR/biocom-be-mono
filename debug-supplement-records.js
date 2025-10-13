const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugSupplementRecords() {
  try {
    console.log('=== 영양제 기록 디버깅 ===');

    // 전체 영양제 기록 조회
    const allSupplementRecords = await prisma.userRecord.findMany({
      where: {
        recordCode: 'SUPPLEMENT'
      },
      select: {
        id: true,
        userId: true,
        date: true,
        metadata: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('\n📊 전체 영양제 기록:');
    allSupplementRecords.forEach(record => {
      console.log(`ID: ${record.id}, 사용자: ${record.userId}, 날짜: ${record.date}, 생성일: ${record.createdAt}`);
      console.log(`메타데이터:`, JSON.stringify(record.metadata, null, 2));
      console.log('---');
    });

    // userId 1번의 영양제 기록만 조회
    const user1Records = await prisma.userRecord.findMany({
      where: {
        userId: 1,
        recordCode: 'SUPPLEMENT'
      },
      select: {
        id: true,
        userId: true,
        date: true,
        metadata: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('\n🔍 사용자 1번 영양제 기록:');
    if (user1Records.length === 0) {
      console.log('❌ 사용자 1번의 영양제 기록이 없습니다!');
    } else {
      user1Records.forEach(record => {
        console.log(`ID: ${record.id}, 날짜: ${record.date}, 생성일: ${record.createdAt}`);
        console.log(`메타데이터:`, JSON.stringify(record.metadata, null, 2));
        console.log('---');
      });
    }

  } catch (error) {
    console.error('에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugSupplementRecords();