import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 운영 DB 기준 missions 데이터
const prodMissions = [
  { id: 22, sortOrder: 1, visibleFromDay: 1, visibleToDay: 10 },      // 자기 선언문
  { id: 50, sortOrder: 2, visibleFromDay: 22, visibleToDay: 28 },     // 애프터 문진
  { id: 23, sortOrder: 3, visibleFromDay: 11, visibleToDay: 20 },     // 나 칭찬하기
  { id: 47, sortOrder: 4, visibleFromDay: 8, visibleToDay: null },    // 심층리포트
  { id: 38, sortOrder: 101, visibleFromDay: null, visibleToDay: null }, // 뷰티 종합 점수
  { id: 14, sortOrder: 102, visibleFromDay: null, visibleToDay: null }, // 식단 기록하기
  { id: 17, sortOrder: 103, visibleFromDay: null, visibleToDay: null }, // 영양제 기록
  { id: 15, sortOrder: 104, visibleFromDay: null, visibleToDay: null }, // 공복 시간 기록
  { id: 19, sortOrder: 105, visibleFromDay: 1, visibleToDay: 21 },    // 영상 강의(+퀴즈)
  { id: 46, sortOrder: 106, visibleFromDay: 1, visibleToDay: 21 },    // 밸런스 게임
  { id: 16, sortOrder: 107, visibleFromDay: null, visibleToDay: null }, // 수면 시간 기록
  { id: 44, sortOrder: 108, visibleFromDay: null, visibleToDay: null }, // 활동 기록
  { id: 21, sortOrder: 109, visibleFromDay: 1, visibleToDay: 21 },    // 1일 1미션
];

async function main() {
  console.log('개발 DB missions 동기화 시작...\n');

  for (const mission of prodMissions) {
    try {
      const updated = await prisma.mission.update({
        where: { id: mission.id },
        data: {
          sortOrder: mission.sortOrder,
          visibleFromDay: mission.visibleFromDay,
          visibleToDay: mission.visibleToDay,
        },
      });
      console.log(`✅ id: ${updated.id}, sortOrder: ${updated.sortOrder}, visibleFromDay: ${updated.visibleFromDay}, visibleToDay: ${updated.visibleToDay}, name: ${updated.name}`);
    } catch (error) {
      console.log(`❌ id: ${mission.id} 업데이트 실패:`, error);
    }
  }

  console.log('\n동기화 완료!');
}

main().finally(() => prisma.$disconnect());
