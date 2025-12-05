/**
 * Food 노드 Cypher 쿼리
 * DELETE + CREATE 패턴
 */

// Step 1: 기존 Food 삭제
export const FOOD_DELETE_QUERY = `
MATCH (u:User {chart_id: $chartId})-[:HAS_DATE]->(d:Date {date_id: $dateId})-[:ATE_FOOD]->(f:Food)
DETACH DELETE f
`;

// Step 2: Date 노드 보장 + 새 Food 생성
export const FOOD_CREATE_QUERY = `
MATCH (u:User {chart_id: $chartId})
MERGE (u)-[:HAS_DATE]->(d:Date {date_id: $dateId})
ON CREATE SET
  d.date = date($date),
  d.created_at = datetime()

WITH d
UNWIND $foods AS food
CREATE (d)-[:ATE_FOOD]->(f:Food {
  food_id: food.foodId,
  food_name: food.foodName,
  diet_type: food.dietType,
  is_fasting: food.isFasting,
  image_url: food.imageUrl,
  allergy_foods: food.allergyFoods,
  allergy_score: food.allergyScore,
  processed_count: food.processedCount,
  processed_foods: food.processedFoods,
  high_fodmap_count: food.highFodmapCount,
  high_fodmap_foods: food.highFodmapFoods,
  created_at: datetime()
})

RETURN count(f) AS foodCount
`;
