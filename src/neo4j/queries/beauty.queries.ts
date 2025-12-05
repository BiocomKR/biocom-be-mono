/**
 * Beauty 노드 Cypher 쿼리
 */

export const BEAUTY_SYNC_QUERY = `
MATCH (u:User {chart_id: $chartId})
MERGE (u)-[:HAS_DATE]->(d:Date {date_id: $dateId})
ON CREATE SET
  d.date = date($date),
  d.created_at = datetime()

MERGE (d)-[:HAS_BEAUTY]->(b:Beauty {date_id: $dateId})
ON CREATE SET
  b.created_at = datetime()
SET
  b.total_score = $totalScore,
  b.inner_beauty_score = $innerBeautyScore,
  b.outer_beauty_score = $outerBeautyScore,
  b.inner_beauty_details = $innerBeautyDetails,
  b.outer_beauty_details = $outerBeautyDetails,
  b.score = $totalScore,
  b.updated_at = datetime()

RETURN b
`;
