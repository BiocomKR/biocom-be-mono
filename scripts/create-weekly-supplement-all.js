/**
 * 주간 영양제 레코드 일괄 생성 스크립트 (운영 DB)
 * userId=1 제외, 활성 영양제 루틴 있는 모든 사용자 대상
 */

const { PrismaClient } = require('@prisma/client');

// 운영 DB 연결
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom?connection_limit=10&pool_timeout=30&connect_timeout=10&timezone=Asia/Seoul',
    },
  },
});

// KST 현재 시간 가져오기
function getNowKST() {
  const now = new Date();
  now.setHours(now.getHours() + 9);
  return now;
}

// 이번 주 월요일 구하기
function getThisWeekMonday() {
  const now = getNowKST();
  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);
  monday.setUTCHours(0, 0, 0, 0);

  return monday;
}

async function createWeeklySupplementRecordsForUser(userId, supplementRoutines, baseDate) {
  const recordsToCreate = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const recordDate = new Date(baseDate);
    recordDate.setDate(baseDate.getDate() + dayOffset);
    recordDate.setUTCHours(0, 0, 0, 0);

    for (const routine of supplementRoutines) {
      recordsToCreate.push({
        userId,
        userChallengeId: null,
        recordType: 'SUPPLEMENT',
        metadata: {
          productId: routine.productId,
          morning: false,
          afternoon: false,
          evening: false,
        },
        date: recordDate,
        createdAt: getNowKST(),
        updatedAt: getNowKST(),
      });
    }
  }

  const result = await prisma.userRecord.createMany({
    data: recordsToCreate,
    skipDuplicates: true,
  });

  return result.count;
}

async function main() {
  console.log(`\n=== [운영 DB] 전체 사용자 영양제 레코드 일괄 생성 ===\n`);
  console.log(`⏰ 실행 시간: ${getNowKST().toISOString()}`);

  // 1. 활성 영양제 루틴이 있는 사용자 목록 조회 (userId=1 제외)
  const usersWithRoutines = await prisma.userSupplementRoutine.findMany({
    where: {
      userId: { not: 1 },
      isActive: true,
      product: {
        categoryCode: 'SUPPLEMENT',
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      { userId: 'asc' },
      { displayOrder: 'asc' },
    ],
  });

  // 사용자별로 그룹핑
  const userRoutinesMap = new Map();
  for (const routine of usersWithRoutines) {
    if (!userRoutinesMap.has(routine.userId)) {
      userRoutinesMap.set(routine.userId, []);
    }
    userRoutinesMap.get(routine.userId).push(routine);
  }

  const userIds = Array.from(userRoutinesMap.keys());
  console.log(`📋 처리 대상 사용자: ${userIds.length}명 (userId=1 제외)`);
  console.log(`   사용자 ID: ${userIds.join(', ')}\n`);

  // 2. 기준 날짜 (이번 주 월요일)
  const baseDate = getThisWeekMonday();
  console.log(`📅 기준 날짜 (월요일): ${baseDate.toISOString().split('T')[0]}\n`);

  // 3. 각 사용자별로 레코드 생성
  let totalCreated = 0;
  const results = [];

  for (const userId of userIds) {
    const routines = userRoutinesMap.get(userId);
    const count = await createWeeklySupplementRecordsForUser(userId, routines, baseDate);
    totalCreated += count;
    results.push({ userId, routineCount: routines.length, createdCount: count });
    console.log(`  ✅ userId=${userId}: ${routines.length}개 영양제 × 7일 = ${count}건 생성`);
  }

  console.log(`\n=== 완료 ===`);
  console.log(`📊 총 ${userIds.length}명, ${totalCreated}건 레코드 생성\n`);

  // 4. 검증: 각 사용자별 현재 SUPPLEMENT 레코드 수
  console.log(`\n=== 검증: 사용자별 SUPPLEMENT 레코드 현황 ===`);
  for (const userId of userIds) {
    const count = await prisma.userRecord.count({
      where: {
        userId,
        recordType: 'SUPPLEMENT',
      },
    });
    console.log(`  userId=${userId}: ${count}건`);
  }
}

main()
  .catch((error) => {
    console.error('에러 발생:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
