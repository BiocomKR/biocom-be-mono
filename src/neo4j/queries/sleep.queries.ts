/**
 * Sleep 노드 Cypher 쿼리
 */

export const SLEEP_SYNC_QUERY = `
MATCH (u:User {chart_id: $chartId})
MERGE (u)-[:HAS_DATE]->(d:Date {date_id: $dateId})
ON CREATE SET
  d.date = date($date),
  d.created_at = datetime()

MERGE (d)-[:HAS_SLEEP]->(s:Sleep {date_id: $dateId})
ON CREATE SET
  s.created_at = datetime()
SET
  s.bed_datetime = datetime(replace($bedDateTime, ' ', 'T')),
  s.wake_datetime = datetime(replace($wakeDateTime, ' ', 'T')),
  s.sleep_hours = $sleepHours,
  s.updated_at = datetime()

RETURN s
`;
