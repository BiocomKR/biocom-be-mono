/**
 * BalanceGame 노드 Cypher 쿼리
 * DELETE + CREATE 패턴
 */

// Step 1: 기존 BalanceGame 삭제
export const BALANCE_GAME_DELETE_QUERY = `
MATCH (u:User {chart_id: $chartId})-[:PLAYED_BALANCE_GAME]->(bg:BalanceGame)
DETACH DELETE bg
`;

// Step 2: 새 BalanceGame 생성
export const BALANCE_GAME_CREATE_QUERY = `
MATCH (u:User {chart_id: $chartId})

UNWIND $balanceGames AS game
CREATE (u)-[:PLAYED_BALANCE_GAME]->(bg:BalanceGame {
  game_id: game.gameId,
  question: game.question,
  option_a: game.optionA,
  option_b: game.optionB,
  user_choice: game.userChoice,
  played_date: date(game.playedDate),
  result_analysis: game.resultAnalysis,
  created_at: datetime()
})

RETURN count(bg) AS gameCount
`;
