import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * point_histories의 포인트 지급 내역을 user_records.metadata.pointsEarned에 백필
 *
 * point_histories.description 패턴:
 * - "BEAUTY 기록 완료" → recordType: BEAUTY
 * - "DIET 기록 완료" → recordType: DIET
 * - "미션 완료: 자기 선언문 (1/1)" → mission name으로 recordType 조회 필요
 *
 * 사용법:
 * npx ts-node prisma/operation/backfill-points-earned.ts
 * npx ts-node prisma/operation/backfill-points-earned.ts --dry-run  # 테스트 실행 (실제 업데이트 안함)
 */

// 미션 이름 → recordType 매핑 (missions 테이블에서 조회)
const missionNameToRecordType: Record<string, string> = {};

async function loadMissionMappings() {
  const missions = await prisma.mission.findMany({
    select: { name: true, recordType: true },
  });

  for (const mission of missions) {
    missionNameToRecordType[mission.name] = mission.recordType;
  }

  console.log('=== 미션 매핑 로드 완료 ===');
  console.log(missionNameToRecordType);
  console.log('');
}

function extractRecordTypeFromDescription(description: string): string | null {
  // 패턴 1: "BEAUTY 기록 완료", "DIET 기록 완료" 등
  const recordMatch = description.match(/^(\w+) 기록 완료$/);
  if (recordMatch) {
    return recordMatch[1];
  }

  // 패턴 2: "미션 완료: 미션이름 (n/m)"
  const missionMatch = description.match(/^미션 완료: (.+) \(\d+\/\d+\)$/);
  if (missionMatch) {
    const missionName = missionMatch[1];
    return missionNameToRecordType[missionName] || null;
  }

  return null;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  if (isDryRun) {
    console.log('🔍 DRY RUN 모드 - 실제 업데이트하지 않습니다.\n');
  }

  // 미션 매핑 로드
  await loadMissionMappings();

  // point_histories에서 RECORD_COMPLETION, CHALLENGE_MISSION 타입의 포인트 지급 내역 조회
  const pointHistories = await prisma.pointHistory.findMany({
    where: {
      relatedType: { in: ['RECORD_COMPLETION', 'CHALLENGE_MISSION'] },
      amount: { gt: 0 }, // 포인트 지급만 (차감 제외)
    },
    select: {
      id: true,
      userId: true,
      amount: true,
      description: true,
      relatedId: true,
      relatedType: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`=== 처리할 point_histories: ${pointHistories.length}건 ===\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  const errors: string[] = [];

  for (const ph of pointHistories) {
    const recordType = extractRecordTypeFromDescription(ph.description);

    if (!recordType) {
      errors.push(`[ID: ${ph.id}] recordType 추출 실패: "${ph.description}"`);
      skipped++;
      continue;
    }

    // relatedId로 user_records 찾기 (RECORD_COMPLETION인 경우)
    // 또는 createdAt + userId + recordType으로 찾기
    let userRecord = null;

    if (ph.relatedType === 'RECORD_COMPLETION' && ph.relatedId) {
      userRecord = await prisma.userRecord.findUnique({
        where: { id: ph.relatedId },
      });
    }

    // relatedId로 못 찾은 경우, createdAt 기준으로 찾기
    if (!userRecord) {
      // createdAt 기준 ±1분 범위로 검색
      const minTime = new Date(ph.createdAt.getTime() - 60000);
      const maxTime = new Date(ph.createdAt.getTime() + 60000);

      userRecord = await prisma.userRecord.findFirst({
        where: {
          userId: ph.userId,
          recordType: recordType,
          createdAt: {
            gte: minTime,
            lte: maxTime,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!userRecord) {
      errors.push(`[ID: ${ph.id}] user_record 못 찾음: userId=${ph.userId}, recordType=${recordType}, date=${ph.createdAt.toISOString()}`);
      notFound++;
      continue;
    }

    // 이미 pointsEarned가 있는지 확인
    const existingPoints = (userRecord.metadata as any)?.pointsEarned || 0;
    if (existingPoints > 0) {
      skipped++;
      continue;
    }

    // metadata 업데이트
    const newMetadata = {
      ...(userRecord.metadata as object || {}),
      pointsEarned: ph.amount,
    };

    if (!isDryRun) {
      await prisma.userRecord.update({
        where: { id: userRecord.id },
        data: { metadata: newMetadata },
      });
    }

    console.log(`✅ [${ph.id}] user_record ${userRecord.id} 업데이트: ${recordType}, +${ph.amount}원`);
    updated++;
  }

  console.log('\n=== 결과 ===');
  console.log(`총 처리: ${pointHistories.length}건`);
  console.log(`업데이트: ${updated}건`);
  console.log(`스킵 (이미 존재 또는 추출 실패): ${skipped}건`);
  console.log(`레코드 못 찾음: ${notFound}건`);

  if (errors.length > 0) {
    console.log(`\n=== 에러 목록 (${errors.length}건) ===`);
    errors.slice(0, 20).forEach((e) => console.log(e));
    if (errors.length > 20) {
      console.log(`... 외 ${errors.length - 20}건`);
    }
  }

  if (isDryRun) {
    console.log('\n🔍 DRY RUN 완료 - 실제 업데이트하려면 --dry-run 없이 실행하세요.');
  }
}

main()
  .catch((e) => {
    console.error('실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
