/**
 * AllergyReport 노드 Cypher 쿼리
 * MERGE 패턴 (단일 검사 결과)
 */

export const ALLERGY_SYNC_QUERY = `
MATCH (u:User {chart_id: $chartId})
MERGE (u)-[:HAS_ALLERGY_REPORT]->(ar:AllergyReport {chart_id: $chartId})
ON CREATE SET
  ar.created_at = datetime()
SET
  ar.test_date = date($testDate),
  ar.allergen_count = $allergenCount,
  ar.allergen_details = $allergenDetails,
  ar.has_test_result = $hasTestResult,
  ar.updated_at = datetime()

RETURN ar
`;
