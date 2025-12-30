/**
 * 주간 영양제 레코드 생성 스크립트
 * userId=1 테스트용
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// KST 현재 시간 가져오기
function getNowKST() {
  const now = new Date();
  // UTC + 9시간 = KST
  now.setHours(now.getHours() + 9);
  return now;
}

// 이번 주 월요일 구하기
function getThisWeekMonday() {
  const now = getNowKST();
  const dayOfWeek = now.getDay(); // 0(일) ~ 6(토)
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);
  monday.setUTCHours(0, 0, 0, 0);

  return monday;
}

async function createWeeklySupplementRecords(userId) {
  console.log(`\n=== userId=${userId} 영양제 레코드 생성 시작 ===\n`);

  // 1. 사용자의 활성화된 영양제 루틴 조회
  const supplementRoutines = await prisma.userSupplementRoutine.findMany({
    where: {
      userId,
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
    orderBy: {
      displayOrder: 'asc',
    },
  });

  if (supplementRoutines.length === 0) {
    console.log(`❌ 영양제 루틴이 없습니다: userId=${userId}`);
    return;
  }

  console.log(`📋 영양제 루틴 조회 완료: ${supplementRoutines.length}개`);
  supplementRoutines.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.product.name} (productId=${r.productId})`);
  });

  // 2. 이번 주 월요일 기준 날짜 계산
  const baseDate = getThisWeekMonday();
  console.log(`\n📅 기준 날짜 (월요일): ${baseDate.toISOString().split('T')[0]}`);

  // 3. 7일치 레코드 생성
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

  console.log(`\n📝 생성할 레코드: ${recordsToCreate.length}건 (7일 × ${supplementRoutines.length}개)`);

  // 4. DB에 레코드 삽입
  const result = await prisma.userRecord.createMany({
    data: recordsToCreate,
    skipDuplicates: true,
  });

  console.log(`\n✅ 영양제 레코드 생성 완료: ${result.count}건 생성됨`);

  // 5. 생성된 레코드 확인
  const createdRecords = await prisma.userRecord.findMany({
    where: {
      userId,
      recordType: 'SUPPLEMENT',
    },
    orderBy: {
      date: 'asc',
    },
  });

  console.log(`\n📊 현재 userId=${userId}의 SUPPLEMENT 레코드: ${createdRecords.length}건`);

  // 날짜별로 그룹핑해서 출력
  const byDate = {};
  createdRecords.forEach(r => {
    const dateKey = r.date.toISOString().split('T')[0];
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(r.metadata.productId);
  });

  Object.entries(byDate).forEach(([date, productIds]) => {
    console.log(`  ${date}: ${productIds.length}개 영양제`);
  });
}

async function main() {
  try {
    await createWeeklySupplementRecords(1);
  } catch (error) {
    console.error('에러 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
