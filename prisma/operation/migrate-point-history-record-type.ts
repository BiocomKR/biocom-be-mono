/**
 * point_histories record_type 백필 마이그레이션 스크립트
 *
 * 목적:
 * 기존 RECORD_COMPLETION 타입의 point_histories에 record_type 컬럼 채우기
 *
 * 마이그레이션 전략:
 * 1. user_records와 조인 가능한 건 → user_records.record_type 복사
 * 2. 조인 불가 건 (user_records 삭제됨) → description 파싱 ("BEAUTY 기록 완료" → "BEAUTY")
 *
 * 사용법: npx ts-node prisma/operation/migrate-point-history-record-type.ts [--dry-run] [--prod]
 *
 * 옵션:
 *   --dry-run: 실제 업데이트 없이 결과만 출력
 *   --prod: 운영 DB에서 실행 (기본값: 개발 DB)
 */

import { PrismaClient } from '@prisma/client';

// CLI 인자 파싱
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isProd = args.includes('--prod');

// DB URL 설정
const DEV_DB_URL = 'postgresql://biocom:bico0825%21%40%23@34.47.124.132:5432/biocom';
const PROD_DB_URL = 'postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: isProd ? PROD_DB_URL : DEV_DB_URL,
    },
  },
});

// description에서 recordType 추출 (예: "BEAUTY 기록 완료" -> "BEAUTY")
function parseRecordTypeFromDescription(desc: string): string | null {
  const match = desc.match(/^(BEAUTY|DIET|SUPPLEMENT|FASTING|SLEEP|ACTIVITY)\s+기록\s+완료$/);
  return match ? match[1] : null;
}

async function main() {
  const dbName = isProd ? '운영' : '개발';
  console.log(`=== point_histories record_type 마이그레이션 ${isDryRun ? '(DRY-RUN)' : ''} ===`);
  console.log(`📍 대상 DB: ${dbName}\n`);

  // 1. 마이그레이션 대상 조회 (RECORD_COMPLETION이면서 record_type이 null인 건)
  const targetHistories = await prisma.pointHistory.findMany({
    where: {
      relatedType: 'RECORD_COMPLETION',
      recordType: null,
    },
    select: {
      id: true,
      relatedId: true,
      description: true,
    },
  });

  console.log(`📊 마이그레이션 대상: ${targetHistories.length}건\n`);

  if (targetHistories.length === 0) {
    console.log('✅ 마이그레이션할 데이터가 없습니다.');
    return;
  }

  // 2. relatedId로 user_records 조회하여 record_type 가져오기
  const relatedIds = targetHistories
    .filter((h) => h.relatedId !== null)
    .map((h) => h.relatedId!);

  const userRecords = await prisma.userRecord.findMany({
    where: { id: { in: relatedIds } },
    select: { id: true, recordType: true },
  });

  const recordTypeMap = new Map(userRecords.map((r) => [r.id, r.recordType]));

  // 3. 업데이트 데이터 준비
  const updates: { id: number; recordType: string; source: 'join' | 'parse' }[] = [];
  const failures: { id: number; description: string; reason: string }[] = [];

  for (const history of targetHistories) {
    // 우선순위 1: user_records 조인
    if (history.relatedId && recordTypeMap.has(history.relatedId)) {
      updates.push({
        id: history.id,
        recordType: recordTypeMap.get(history.relatedId)!,
        source: 'join',
      });
      continue;
    }

    // 우선순위 2: description 파싱
    const parsed = parseRecordTypeFromDescription(history.description);
    if (parsed) {
      updates.push({
        id: history.id,
        recordType: parsed,
        source: 'parse',
      });
      continue;
    }

    // 실패
    failures.push({
      id: history.id,
      description: history.description,
      reason: history.relatedId ? 'user_record 삭제됨 + 파싱 불가' : 'relatedId 없음 + 파싱 불가',
    });
  }

  // 4. 결과 출력
  const joinCount = updates.filter((u) => u.source === 'join').length;
  const parseCount = updates.filter((u) => u.source === 'parse').length;

  console.log('📈 분석 결과:');
  console.log(`   - user_records 조인으로 복구: ${joinCount}건`);
  console.log(`   - description 파싱으로 복구: ${parseCount}건`);
  console.log(`   - 복구 불가: ${failures.length}건\n`);

  if (failures.length > 0) {
    console.log('⚠️ 복구 불가 건:');
    failures.forEach((f) => {
      console.log(`   - id=${f.id}: "${f.description}" (${f.reason})`);
    });
    console.log('');
  }

  // 5. DRY-RUN이면 여기서 종료
  if (isDryRun) {
    console.log('🔍 DRY-RUN 모드: 실제 업데이트 없이 종료합니다.');
    console.log('\n실제 마이그레이션을 실행하려면 --dry-run 옵션을 제거하세요.');
    return;
  }

  // 6. 실제 업데이트 실행
  console.log('🚀 마이그레이션 실행 중...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const update of updates) {
    try {
      await prisma.pointHistory.update({
        where: { id: update.id },
        data: { recordType: update.recordType },
      });
      successCount++;

      // 진행률 표시 (100건마다)
      if (successCount % 100 === 0) {
        console.log(`   진행: ${successCount}/${updates.length}건 완료`);
      }
    } catch (error) {
      errorCount++;
      console.error(`   ❌ id=${update.id} 업데이트 실패:`, error);
    }
  }

  console.log('\n=== 마이그레이션 완료 ===');
  console.log(`✅ 성공: ${successCount}건`);
  console.log(`❌ 실패: ${errorCount}건`);
  console.log(`⏭️ 스킵 (복구 불가): ${failures.length}건`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
