/**
 * Mission 노드 Cypher 쿼리
 * DELETE + CREATE 패턴
 */

// Step 1: 기존 Mission 삭제
export const MISSION_DELETE_QUERY = `
MATCH (u:User {chart_id: $chartId})-[:HAS_MISSION]->(m:Mission)
DETACH DELETE m
`;

// Step 2: 새 Mission 생성
export const MISSION_CREATE_QUERY = `
MATCH (u:User {chart_id: $chartId})

UNWIND $missions AS mission
CREATE (u)-[:HAS_MISSION]->(m:Mission {
  mission_id: mission.missionId,
  description: mission.description,
  is_completed: mission.isCompleted,
  completed_date: CASE
    WHEN mission.completedDate IS NOT NULL
    THEN date(mission.completedDate)
    ELSE null
  END,
  reward_points: mission.rewardPoints,
  category: mission.category,
  created_at: datetime()
})

RETURN count(m) AS missionCount
`;
