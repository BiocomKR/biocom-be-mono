const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createBalanceGames() {
  console.log('🎮 밸런스게임 기초 데이터 생성 시작...');

  // 21일 챌린지에 맞는 다양한 밸런스게임들
  const balanceGames = [
    {
      challengeDay: 1,
      title: "첫날의 선택",
      description: "건강한 시작을 위한 첫 번째 선택입니다.",
      thumbnailUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-day1.png",
      backgroundUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-bg1.png"
    },
    {
      challengeDay: 2,
      title: "아침의 딜레마",
      description: "건강한 아침을 위한 선택을 해보세요.",
      thumbnailUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-day2.png",
      backgroundUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-bg2.png"
    },
    {
      challengeDay: 3,
      title: "영양소의 선택",
      description: "오늘 필요한 영양소를 선택해보세요.",
      thumbnailUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-day3.png",
      backgroundUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-bg3.png"
    },
    {
      challengeDay: 4,
      title: "운동 vs 휴식",
      description: "몸과 마음을 위한 선택을 해보세요.",
      thumbnailUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-day4.png",
      backgroundUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-bg4.png"
    },
    {
      challengeDay: 5,
      title: "건강한 간식",
      description: "건강과 맛, 두 마리 토끼를 잡아보세요.",
      thumbnailUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-day5.png",
      backgroundUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-bg5.png"
    },
    // 더 많은 게임들...
    {
      challengeDay: 6,
      title: "물 vs 차",
      description: "오늘의 수분 섭취 방법을 선택하세요.",
      thumbnailUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-day6.png",
      backgroundUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-bg6.png"
    },
    {
      challengeDay: 7,
      title: "일주일의 마무리",
      description: "일주일 동안의 노력을 돌아보세요.",
      thumbnailUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-day7.png",
      backgroundUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-bg7.png"
    },
    {
      challengeDay: 8,
      title: "새로운 주의 시작",
      description: "2주차를 맞이하는 마음가짐을 선택하세요.",
      thumbnailUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-day8.png",
      backgroundUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-bg8.png"
    },
    {
      challengeDay: 9,
      title: "건강한 저녁",
      description: "하루를 마무리하는 건강한 선택을 하세요.",
      thumbnailUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-day9.png",
      backgroundUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-bg9.png"
    },
    {
      challengeDay: 10,
      title: "중간점검",
      description: "챌린지 중간 지점에서의 선택입니다.",
      thumbnailUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-day10.png",
      backgroundUrl: "https://storage.googleapis.com/api-dev-biocom-uploads/balance-game-bg10.png"
    }
  ];

  try {
    const games = [];

    for (const gameData of balanceGames) {
      const game = await prisma.balanceGame.create({
        data: gameData
      });

      games.push(game);
      console.log(`✅ 밸런스게임 생성: ${game.title} (${game.challengeDay}일차, ID: ${game.id})`);
    }

    console.log(`\n🎉 총 ${games.length}개의 밸런스게임이 생성되었습니다!`);

    // 생성된 게임 목록 출력
    console.log('\n📋 생성된 밸런스게임 목록:');
    games.forEach((game, index) => {
      console.log(`${index + 1}. [${game.challengeDay}일차] ${game.title} (ID: ${game.id})`);
    });

  } catch (error) {
    console.error('❌ 밸런스게임 생성 중 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createBalanceGames();