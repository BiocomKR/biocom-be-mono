/**
 * Activity 노드 Cypher 쿼리
 * DELETE + CREATE 패턴
 */

// Step 1: 기존 Activity 삭제
export const ACTIVITY_DELETE_QUERY = `
MATCH (u:User {chart_id: $chartId})-[:HAS_DATE]->(d:Date {date_id: $dateId})
      -[:HAS_ACTIVITY]->(da:DailyActivity)-[:INCLUDES]->(a:Activity)
DETACH DELETE a
`;

// Step 2: DailyActivity 업데이트 (MERGE)
export const DAILY_ACTIVITY_SYNC_QUERY = `
MATCH (u:User {chart_id: $chartId})
MERGE (u)-[:HAS_DATE]->(d:Date {date_id: $dateId})
ON CREATE SET
  d.date = date($date),
  d.created_at = datetime()

MERGE (d)-[:HAS_ACTIVITY]->(da:DailyActivity {date_id: $dateId})
ON CREATE SET
  da.created_at = datetime()
SET
  da.total_calories = $totalCalories,
  da.activity_count = $activityCount,
  da.total_duration_minutes = $totalDurationMinutes,
  da.updated_at = datetime()

RETURN da
`;

// Step 3: 새 Activity 생성 (배치) + ActivityType 연결
export const ACTIVITY_CREATE_QUERY = `
MATCH (da:DailyActivity {date_id: $dateId})

UNWIND $activities AS activity
MATCH (at:ActivityType {code: activity.activityTypeCode})

CREATE (da)-[:INCLUDES]->(a:Activity {
  activity_id: activity.activityId,
  name: activity.name,
  activity_time: activity.activityTime,
  duration_minutes: activity.durationMinutes,
  calories_burned: activity.caloriesBurned,
  activity_type_code: activity.activityTypeCode,
  image_url: activity.imageUrl,
  created_at: datetime()
})

CREATE (a)-[:IS_TYPE]->(at)

RETURN count(a) AS activityCount
`;
