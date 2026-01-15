/**
 * 강의 콘텐츠 bannerTitle 업데이트 스크립트
 * dayNumber를 기준으로 매핑하여 bannerTitle 설정
 *
 * 사용법: npx ts-node prisma/operation/update-lecture-banner-titles.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// dayNumber -> bannerTitle 매핑
const bannerTitleMap: Record<number, string> = {
  0: '평생 아름다운 피부로 사는 방법',
  1: '10살 어려지는 식단 비법',
  2: '트러블 진정 솔루션',
  3: '염증에서 벗어나는 방법',
  4: '변비 해소와 피부 개선법',
  5: '탄력·노화·홍조의 공통 원인',
  6: '샐러드가 피부를 망치는 이유',
  7: '클렌징보다 중요한 식사 습관',
  8: '진짜 장·피부 개선템',
  9: '피부를 살리는 핵심 열쇠',
  10: '날씬한 사람들의 피부 비결',
  11: '염증 악화 음식',
  12: '피부 좋아지는 관리법',
  13: '생리 전 여드름 원인',
  14: '자기 전 필수 습관',
  15: '트러블, 체중 증가, 우울의 원인',
  16: '피부가 늙어가는 이유',
  17: '피부 주인 되찾기',
  18: '바이오 해킹이란?',
  19: '스트레스와 피부의 관계',
  20: '나에게 필요한 영양제',
  21: '3주간 총 정리',
};

async function main() {
  console.log('=== 강의 bannerTitle 업데이트 시작 ===\n');

  // 1. 현재 LECTURE 콘텐츠 조회
  const lectures = await prisma.content.findMany({
    where: { type: 'LECTURE', isActive: true },
    select: { id: true, title: true, dayNumber: true, bannerTitle: true },
    orderBy: { dayNumber: 'asc' },
  });

  console.log(`총 ${lectures.length}개 강의 발견\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const lecture of lectures) {
    const dayNumber = lecture.dayNumber;

    if (dayNumber === null || dayNumber === undefined) {
      console.log(`⚠️  ID ${lecture.id}: dayNumber가 없음 - 건너뜀`);
      skippedCount++;
      continue;
    }

    const newBannerTitle = bannerTitleMap[dayNumber];

    if (!newBannerTitle) {
      console.log(`⚠️  Day ${dayNumber} (ID ${lecture.id}): 매핑 없음 - 건너뜀`);
      skippedCount++;
      continue;
    }

    // 업데이트
    await prisma.content.update({
      where: { id: lecture.id },
      data: { bannerTitle: newBannerTitle },
    });

    console.log(`✅ Day ${String(dayNumber).padStart(2, '0')} (ID ${lecture.id}): "${newBannerTitle}"`);
    updatedCount++;
  }

  console.log('\n=== 결과 ===');
  console.log(`업데이트: ${updatedCount}개`);
  console.log(`건너뜀: ${skippedCount}개`);

  // 결과 확인
  console.log('\n=== 업데이트 후 확인 ===');
  const updated = await prisma.content.findMany({
    where: { type: 'LECTURE', isActive: true },
    select: { dayNumber: true, bannerTitle: true },
    orderBy: { dayNumber: 'asc' },
  });

  for (const l of updated) {
    console.log(`Day ${String(l.dayNumber).padStart(2, '0')}: ${l.bannerTitle}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
