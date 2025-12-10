import { PrismaClient } from '@prisma/client';
import { getNowKST } from '../src/common/utils/kst-date.util';

const prisma = new PrismaClient();

/**
 * 미션 마스터 데이터
 *
 * 변경 내역:
 * - 삭제: 18(아랑 피부 루틴), 20(오늘의 건강 컨텐츠), 24~26(이행률 달성)
 * - 이름 변경: 14(식단 기록하기), 16(수면 시간 기록), 19(영상 강의(+퀴즈)), 23(나 칭찬하기)
 * - daily_limit 변경: 14(3→9), 17(2→999)
 * - 추가: 뷰티 종합 점수, 활동 기록, 밸런스 게임, 심층리포트, 애프터 문진
 */
const missionsData = [
  // ===== DAILY (매일) =====
  {
    name: '뷰티 종합 점수',
    description: '오늘의 뷰티 종합 점수를 확인해주세요',
    points: 100,
    requireUpload: false,
    sortOrder: 1,
    isActive: true,
    category: 'DAILY',
    type: 'MISSION',
    recordType: 'BEAUTY_SCORE',
    dailyLimit: 1,
    specificDay: null,
    totalDays: 21,
    uploadType: null,
  },
  {
    name: '식단 기록하기',
    description: '식단을 기록해주세요 (하루 9번 기록시 완료)',
    points: 100,
    requireUpload: false,
    sortOrder: 2,
    isActive: true,
    category: 'DAILY',
    type: 'RECORD',
    recordType: 'DIET',
    dailyLimit: 9,
    specificDay: null,
    totalDays: 21,
    uploadType: null,
  },
  {
    name: '영양제 기록',
    description: '영양제 복용을 기록해주세요',
    points: 100,
    requireUpload: false,
    sortOrder: 3,
    isActive: true,
    category: 'DAILY',
    type: 'RECORD',
    recordType: 'SUPPLEMENT',
    dailyLimit: null, // 무제한
    specificDay: null,
    totalDays: 21,
    uploadType: null,
  },
  {
    name: '공복 시간 기록',
    description: '공복 시작 시간과 종료 시간을 기록해주세요',
    points: 100,
    requireUpload: false,
    sortOrder: 4,
    isActive: true,
    category: 'DAILY',
    type: 'RECORD',
    recordType: 'FASTING',
    dailyLimit: 1,
    specificDay: null,
    totalDays: 21,
    uploadType: null,
  },
  {
    name: '수면 시간 기록',
    description: '취침 시간과 기상 시간을 기록해주세요',
    points: 100,
    requireUpload: false,
    sortOrder: 5,
    isActive: true,
    category: 'DAILY',
    type: 'RECORD',
    recordType: 'SLEEP',
    dailyLimit: 1,
    specificDay: null,
    totalDays: 21,
    uploadType: null,
  },
  {
    name: '영상 강의(+퀴즈)',
    description: '오늘의 건강 영상을 시청하고 퀴즈를 풀어주세요',
    points: 200,
    requireUpload: false,
    sortOrder: 6,
    isActive: true,
    category: 'DAILY',
    type: 'MISSION',
    recordType: 'QUIZ',
    dailyLimit: null, // 무제한
    specificDay: null,
    totalDays: 21,
    uploadType: null,
  },
  {
    name: '활동 기록',
    description: '오늘의 활동을 기록해주세요',
    points: 100,
    requireUpload: false,
    sortOrder: 7,
    isActive: true,
    category: 'DAILY',
    type: 'RECORD',
    recordType: 'ACTIVITY',
    dailyLimit: null, // 무제한
    specificDay: null,
    totalDays: 21,
    uploadType: null,
  },
  // ===== SPECIAL =====
  {
    name: '1일 1미션',
    description: '오늘의 특별 미션을 수행해주세요',
    points: 100,
    requireUpload: true,
    sortOrder: 10,
    isActive: true,
    category: 'SPECIAL',
    type: 'MISSION',
    recordType: 'DAILY_MISSION',
    dailyLimit: 1,
    specificDay: null,
    totalDays: 21,
    uploadType: 'IMAGE',
  },
  {
    name: '밸런스 게임',
    description: '오늘의 밸런스 게임에 참여해주세요',
    points: 100,
    requireUpload: false,
    sortOrder: 9,
    isActive: true,
    category: 'DAILY',
    type: 'MISSION',
    recordType: 'BALANCE_GAME',
    dailyLimit: null, // 무제한
    specificDay: null,
    totalDays: 21,
    uploadType: null,
  },
  // ===== WEEKLY (주 1회) =====
  {
    name: '심층리포트',
    description: '주간 심층리포트를 확인해주세요',
    points: 500,
    requireUpload: false,
    sortOrder: 50,
    isActive: true,
    category: 'WEEKLY',
    type: 'MISSION',
    recordType: 'WEEKLY_REPORT',
    dailyLimit: 1,
    specificDay: null, // 7, 14, 21일차에 노출 (ChallengeMission에서 처리)
    totalDays: 3,
    uploadType: null,
  },
  // ===== EVENT (특정 일차) =====
  {
    name: '자기 선언문',
    description: '챌린지 시작을 위한 자기 선언문을 작성해주세요',
    points: 1000,
    requireUpload: false,
    sortOrder: 100,
    isActive: true,
    category: 'EVENT',
    type: 'MISSION',
    recordType: 'DECLARATION',
    dailyLimit: 1,
    specificDay: 1,
    totalDays: 1,
    uploadType: null,
  },
  {
    name: '나 칭찬하기',
    description: '10일차를 맞아 자신을 칭찬해주세요',
    points: 1000,
    requireUpload: false,
    sortOrder: 101,
    isActive: true,
    category: 'EVENT',
    type: 'MISSION',
    recordType: 'SELF_PRAISE',
    dailyLimit: 1,
    specificDay: 10,
    totalDays: 1,
    uploadType: null,
  },
  {
    name: '애프터 문진',
    description: '챌린지 완료 후 최종 문진을 작성해주세요',
    points: 1000,
    requireUpload: false,
    sortOrder: 102,
    isActive: true,
    category: 'EVENT',
    type: 'MISSION',
    recordType: 'AFTER_SURVEY',
    dailyLimit: 1,
    specificDay: 21,
    totalDays: 1,
    uploadType: null,
  },
];

/**
 * 챌린지 미션 매핑 데이터 (product_id: 38)
 *
 * recordType 기반으로 missionId를 조회하여 생성
 */
const generateChallengeMissions = async () => {
  const PRODUCT_ID = 38;

  // recordType으로 missionId 조회
  const missions = await prisma.mission.findMany({
    select: { id: true, recordType: true, points: true },
  });
  const missionMap = new Map(missions.map((m) => [m.recordType, m]));

  const getMissionId = (recordType: string) => {
    const mission = missionMap.get(recordType);
    if (!mission) throw new Error(`Mission not found: ${recordType}`);
    return mission.id;
  };

  const getMissionPoints = (recordType: string) => {
    const mission = missionMap.get(recordType);
    if (!mission) throw new Error(`Mission not found: ${recordType}`);
    return mission.points;
  };

  const challengeMissions: Array<{
    productId: number;
    missionId: number;
    day: number;
    points: number;
    isActive: boolean;
    sortOrder: number;
  }> = [];

  // 매일 수행하는 미션 recordType 목록
  const dailyMissionTypes = [
    'BEAUTY_SCORE', // 뷰티 종합 점수
    'DIET', // 식단 기록하기
    'SUPPLEMENT', // 영양제 기록
    'FASTING', // 공복 시간 기록
    'SLEEP', // 수면 시간 기록
    'QUIZ', // 영상 강의(+퀴즈)
    'ACTIVITY', // 활동 기록
    'DAILY_MISSION', // 1일 1미션
    'BALANCE_GAME', // 밸런스 게임
  ];

  for (let day = 1; day <= 21; day++) {
    let sortOrder = 1;

    // 1일차: 자기 선언문 추가
    if (day === 1) {
      challengeMissions.push({
        productId: PRODUCT_ID,
        missionId: getMissionId('DECLARATION'),
        day,
        points: getMissionPoints('DECLARATION'),
        isActive: true,
        sortOrder: sortOrder++,
      });
    }

    // 10일차: 나 칭찬하기 추가
    if (day === 10) {
      challengeMissions.push({
        productId: PRODUCT_ID,
        missionId: getMissionId('SELF_PRAISE'),
        day,
        points: getMissionPoints('SELF_PRAISE'),
        isActive: true,
        sortOrder: sortOrder++,
      });
    }

    // 21일차: 애프터 문진 추가
    if (day === 21) {
      challengeMissions.push({
        productId: PRODUCT_ID,
        missionId: getMissionId('AFTER_SURVEY'),
        day,
        points: getMissionPoints('AFTER_SURVEY'),
        isActive: true,
        sortOrder: sortOrder++,
      });
    }

    // 7, 14, 21일차: 심층리포트 추가
    if (day === 7 || day === 14 || day === 21) {
      challengeMissions.push({
        productId: PRODUCT_ID,
        missionId: getMissionId('WEEKLY_REPORT'),
        day,
        points: getMissionPoints('WEEKLY_REPORT'),
        isActive: true,
        sortOrder: sortOrder++,
      });
    }

    // 매일 미션 추가
    for (const recordType of dailyMissionTypes) {
      challengeMissions.push({
        productId: PRODUCT_ID,
        missionId: getMissionId(recordType),
        day,
        points: getMissionPoints(recordType),
        isActive: true,
        sortOrder: sortOrder++,
      });
    }
  }

  return challengeMissions;
};

async function main() {
  console.log('미션 데이터 시드 시작...');
  const now = getNowKST();

  // 1. 삭제할 미션 ID 목록
  const deleteTargetMissionIds = [18, 20, 24, 25, 26];

  // 2. ChallengeMission 삭제 (FK 관계 때문에 먼저 삭제)
  console.log('\n📌 ChallengeMission 삭제 중...');
  const deletedChallengeMissions = await prisma.challengeMission.deleteMany({
    where: {
      missionId: { in: deleteTargetMissionIds },
    },
  });
  console.log(`✅ ChallengeMission ${deletedChallengeMissions.count}건 삭제`);

  // 3. Mission 삭제
  console.log('\n📌 Mission 삭제 중...');
  for (const missionId of deleteTargetMissionIds) {
    try {
      await prisma.mission.delete({
        where: { id: missionId },
      });
      console.log(`✅ Mission ID ${missionId} 삭제`);
    } catch (error) {
      console.log(`⚠️ Mission ID ${missionId} 삭제 실패 (이미 없을 수 있음)`);
    }
  }

  // 4. Mission upsert (업데이트 또는 생성) - recordType이 unique이므로 이걸로 찾음
  console.log('\n📌 Mission upsert 중...');
  for (const mission of missionsData) {
    await prisma.mission.upsert({
      where: { recordType: mission.recordType },
      update: {
        name: mission.name,
        description: mission.description,
        points: mission.points,
        requireUpload: mission.requireUpload,
        sortOrder: mission.sortOrder,
        isActive: mission.isActive,
        category: mission.category,
        type: mission.type,
        dailyLimit: mission.dailyLimit,
        specificDay: mission.specificDay,
        totalDays: mission.totalDays,
        uploadType: mission.uploadType,
        updatedAt: now,
      },
      create: {
        name: mission.name,
        description: mission.description,
        points: mission.points,
        requireUpload: mission.requireUpload,
        sortOrder: mission.sortOrder,
        isActive: mission.isActive,
        category: mission.category,
        type: mission.type,
        recordType: mission.recordType,
        dailyLimit: mission.dailyLimit,
        specificDay: mission.specificDay,
        totalDays: mission.totalDays,
        uploadType: mission.uploadType,
        createdAt: now,
      },
    });
    console.log(`✅ Mission ${mission.recordType}: ${mission.name}`);
  }

  // 5. 기존 ChallengeMission 전체 삭제 후 재생성
  console.log('\n📌 ChallengeMission 재생성 중...');

  // product_id: 38에 해당하는 기존 데이터 삭제
  await prisma.challengeMission.deleteMany({
    where: { productId: 38 },
  });
  console.log('✅ 기존 ChallengeMission 삭제 완료');

  // 새 데이터 생성
  const challengeMissionsData = await generateChallengeMissions();
  await prisma.challengeMission.createMany({
    data: challengeMissionsData.map((cm) => ({
      ...cm,
      createdAt: now,
      updatedAt: now,
    })),
  });
  console.log(`✅ ChallengeMission ${challengeMissionsData.length}건 생성 완료`);

  console.log('\n🎉 미션 데이터 시드 완료!');
}

main()
  .catch((e) => {
    console.error('❌ 시드 실행 중 오류:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
