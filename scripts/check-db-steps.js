const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function check() {
  // balance_games 테이블에서 challengeDay와 id 매핑
  const games = await prisma.balanceGame.findMany({
    select: { id: true, challengeDay: true }
  });

  const gameIdToDay = {};
  for (const game of games) {
    gameIdToDay[game.id] = game.challengeDay;
  }

  // balance_game_steps에서 step_type별 카운트
  const steps = await prisma.balanceGameStep.findMany({
    select: { gameId: true, stepType: true }
  });

  const countByDayAndType = {};
  for (const step of steps) {
    const day = gameIdToDay[step.gameId];
    const key = `${day}일차`;
    if (!countByDayAndType[key]) {
      countByDayAndType[key] = { DIALOGUE: 0, QUESTION: 0, RESULT: 0 };
    }
    countByDayAndType[key][step.stepType]++;
  }

  console.log('=== [개발 DB] 일차별 step_type 개수 ===\n');
  for (const [day, counts] of Object.entries(countByDayAndType).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
    console.log(`${day}: DIALOGUE=${counts.DIALOGUE}, QUESTION=${counts.QUESTION}, RESULT=${counts.RESULT}`);
  }

  await prisma.$disconnect();
}

check();
