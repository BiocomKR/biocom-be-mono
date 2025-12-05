/**
 * Supplement 노드 Cypher 쿼리
 * DELETE + CREATE 패턴 (Food와 동일)
 */

// Step 1: 기존 Supplement 삭제
export const SUPPLEMENT_DELETE_QUERY = `
MATCH (u:User {chart_id: $chartId})-[:HAS_DATE]->(d:Date {date_id: $dateId})-[:TOOK_SUPPLEMENT]->(s:Supplement)
DETACH DELETE s
`;

// Step 2: 새 Supplement 생성 (SupplementType, Nutrient Master Data 포함)
export const SUPPLEMENT_CREATE_QUERY = `
MATCH (u:User {chart_id: $chartId})
MERGE (u)-[:HAS_DATE]->(d:Date {date_id: $dateId})
ON CREATE SET
  d.date = date($date),
  d.created_at = datetime()

WITH d
UNWIND $supplements AS supplement

// SupplementType 생성 또는 가져오기 (Master Data)
MERGE (st:SupplementType {supplement_name: supplement.supplementName})
ON CREATE SET
  st.supplement_type_id = 'supplement_type_' + toLower(replace(supplement.supplementName, ' ', '_')),
  st.created_at = datetime()

// Supplement 섭취 기록 생성
CREATE (d)-[:TOOK_SUPPLEMENT]->(s:Supplement {
  supplement_id: supplement.supplementId,
  intake_count: supplement.intakeCount,
  recommended_count: supplement.recommendedCount,
  created_at: datetime()
})
CREATE (s)-[:IS_TYPE]->(st)

// 영양소 관계 생성 (Master Data)
WITH st, supplement
UNWIND supplement.nutrients AS nutrientName
MERGE (n:Nutrient {nutrient_name: nutrientName})
ON CREATE SET
  n.nutrient_id = 'nutrient_' + toLower(replace(nutrientName, ' ', '_')),
  n.created_at = datetime()
MERGE (st)-[:CONTAINS]->(n)

RETURN count(DISTINCT s) AS supplementCount
`;
