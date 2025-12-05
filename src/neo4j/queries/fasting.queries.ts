/**
 * Fasting 노드 Cypher 쿼리
 */

export const FASTING_SYNC_QUERY = `
MATCH (u:User {chart_id: $chartId})
MERGE (u)-[:HAS_DATE]->(d:Date {date_id: $dateId})
ON CREATE SET
  d.date = date($date),
  d.created_at = datetime()

MERGE (d)-[:HAS_FASTING]->(f:Fasting {date_id: $dateId})
ON CREATE SET
  f.created_at = datetime()
SET
  f.start_datetime = datetime(replace($startDateTime, ' ', 'T')),
  f.end_datetime = datetime(replace($endDateTime, ' ', 'T')),
  f.fasting_hours = $fastingHours,
  f.updated_at = datetime()

RETURN f
`;
