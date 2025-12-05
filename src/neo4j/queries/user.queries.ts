/**
 * User 노드 Cypher 쿼리
 */

export const USER_SYNC_QUERY = `
MERGE (u:User {chart_id: $chartId})
ON CREATE SET
  u.created_at = datetime()
SET
  u.name = $name,
  u.inner_beauty_type = $innerBeautyType,
  u.ai_coach_type = $aiCoachType,
  u.mbti = $mbti,
  u.self_declaration = $selfDeclaration,
  u.praise_message = $praiseMessage,
  u.updated_at = datetime()
RETURN u
`;
