/**
 * 밸런스게임 마이그레이션 스크립트
 * balance_game_steps 테이블의 "30%" 문자를 "20%"로 일괄 변경
 * 대상 필드: content, options
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(60));
  console.log('밸런스게임 30% → 20% 마이그레이션 시작');
  console.log('='.repeat(60));

  // 1. 전체 데이터 조회
  const allSteps = await prisma.balanceGameStep.findMany({
    select: {
      id: true,
      content: true,
      options: true,
    },
  });

  console.log(`\n총 ${allSteps.length}개 레코드 조회됨`);

  // 2. "30%"가 포함된 레코드 필터링 및 변환
  const updates: { id: number; content?: string; options?: any }[] = [];

  for (const step of allSteps) {
    let needsUpdate = false;
    const updateData: { content?: string; options?: any } = {};

    // content 필드 확인 및 변환
    if (step.content && step.content.includes('30%')) {
      updateData.content = step.content.replace(/30%/g, '20%');
      needsUpdate = true;
      console.log(`\n[ID: ${step.id}] content 변경 발견:`);
      console.log(`  Before: ${step.content.substring(0, 100)}...`);
      console.log(`  After:  ${updateData.content.substring(0, 100)}...`);
    }

    // options 필드 확인 및 변환 (JSON)
    if (step.options) {
      const optionsStr = JSON.stringify(step.options);
      if (optionsStr.includes('30%')) {
        const newOptionsStr = optionsStr.replace(/30%/g, '20%');
        updateData.options = JSON.parse(newOptionsStr);
        needsUpdate = true;
        console.log(`\n[ID: ${step.id}] options 변경 발견:`);
        console.log(`  Before: ${optionsStr.substring(0, 100)}...`);
        console.log(`  After:  ${newOptionsStr.substring(0, 100)}...`);
      }
    }

    if (needsUpdate) {
      updates.push({ id: step.id, ...updateData });
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`변경 대상: ${updates.length}개 레코드`);
  console.log('='.repeat(60));

  if (updates.length === 0) {
    console.log('\n변경할 데이터가 없습니다.');
    return;
  }

  // 3. 사용자 확인 (dry-run 모드 체크)
  const isDryRun = process.argv.includes('--dry-run');

  if (isDryRun) {
    console.log('\n[DRY-RUN 모드] 실제 업데이트를 수행하지 않습니다.');
    console.log('실제 실행하려면 --dry-run 옵션을 제거하세요.');
    return;
  }

  // 4. 트랜잭션으로 일괄 업데이트
  console.log('\n업데이트 실행 중...');

  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      const { id, ...data } = update;
      await tx.balanceGameStep.update({
        where: { id },
        data,
      });
      console.log(`  - ID ${id} 업데이트 완료`);
    }
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ 마이그레이션 완료: ${updates.length}개 레코드 업데이트됨`);
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('마이그레이션 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
