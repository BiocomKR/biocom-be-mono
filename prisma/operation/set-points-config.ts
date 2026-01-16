/**
 * 미션별 pointsConfig 설정 스크립트
 *
 * 사용법:
 * npx ts-node prisma/operation/set-points-config.ts
 *
 * 설정 내용:
 * - 기록형 미션 (BEAUTY, DIET, SUPPLEMENT, FASTING, SLEEP, ACTIVITY):
 *   - 챌린지 진행 중: 포인트 지급 (기본)
 *   - 챌린지 종료 후: 포인트 없음 (afterChallengeDays 설정 안함)
 *   - 구독자: 무제한
 *
 * - 심층리포트 (WEEKLY_REPORT):
 *   - 챌린지 진행 중: 포인트 지급 (기본)
 *   - 챌린지 종료 후: 7일까지 포인트 지급
 *   - 구독자: 무제한
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 기록형 미션 recordTypes
const RECORD_MISSIONS = ['BEAUTY', 'DIET', 'SUPPLEMENT', 'FASTING', 'SLEEP', 'ACTIVITY'];

// 심층리포트
const DEEP_REPORT_MISSION = 'WEEKLY_REPORT';

async function main() {
  console.log('=== pointsConfig 설정 시작 ===\n');

  // 1. 기록형 미션 설정 (챌린지 종료 후 포인트 없음)
  const recordConfig = {
    // afterChallengeDays: 설정 안함 (종료 후 포인트 없음)
    subscriberUnlimited: true,  // 구독자 무제한
  };

  console.log('1. 기록형 미션 설정:', JSON.stringify(recordConfig, null, 2));
  console.log('   - 챌린지 진행 중: 포인트 지급 (기본)');
  console.log('   - 챌린지 종료 후: 포인트 없음');
  console.log('   - 구독자: 무제한\n');

  for (const recordType of RECORD_MISSIONS) {
    const result = await prisma.mission.updateMany({
      where: { recordType },
      data: { pointsConfig: recordConfig },
    });
    console.log(`   - ${recordType}: ${result.count}개 업데이트`);
  }

  // 2. 심층리포트 설정 (챌린지 종료 후 7일까지)
  const deepReportConfig = {
    afterChallengeDays: 7,       // 종료 후 7일까지 포인트 지급
    subscriberUnlimited: true,   // 구독자 무제한
  };

  console.log('\n2. 심층리포트 설정:', JSON.stringify(deepReportConfig, null, 2));
  console.log('   - 챌린지 진행 중: 포인트 지급 (기본)');
  console.log('   - 챌린지 종료 후: 7일까지 포인트 지급');
  console.log('   - 구독자: 무제한\n');

  const deepReportResult = await prisma.mission.updateMany({
    where: { recordType: DEEP_REPORT_MISSION },
    data: { pointsConfig: deepReportConfig },
  });
  console.log(`   - ${DEEP_REPORT_MISSION}: ${deepReportResult.count}개 업데이트`);

  // 3. 결과 확인
  console.log('\n=== 설정 결과 확인 ===\n');

  const missions = await prisma.mission.findMany({
    where: {
      recordType: { in: [...RECORD_MISSIONS, DEEP_REPORT_MISSION] },
    },
    select: {
      id: true,
      name: true,
      recordType: true,
      pointsConfig: true,
    },
    orderBy: { recordType: 'asc' },
  });

  for (const mission of missions) {
    console.log(`[${mission.recordType}] ${mission.name}`);
    console.log(`   pointsConfig: ${JSON.stringify(mission.pointsConfig)}`);
  }

  console.log('\n=== 완료 ===');
}

main()
  .catch((e) => {
    console.error('오류 발생:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
