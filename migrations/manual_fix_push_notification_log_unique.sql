-- 푸시 알림 로그 unique 제약 수정
-- 기존: @@unique([campaignId, userId])
-- 변경: @@unique([campaignId, userId, pushTokenId])
--
-- 이유: 한 유저가 여러 기기(pushToken)에서 동일 캠페인의 푸시를 받을 수 있어야 함

-- 1. 기존 unique 제약 삭제
ALTER TABLE "push_notification_logs"
DROP CONSTRAINT IF EXISTS "push_notification_logs_campaign_id_user_id_key";

-- 2. 새로운 unique 제약 추가 (pushTokenId 포함)
ALTER TABLE "push_notification_logs"
ADD CONSTRAINT "push_notification_logs_campaign_id_user_id_push_token_id_key"
UNIQUE ("campaign_id", "user_id", "push_token_id");

-- 3. 변경사항 확인 쿼리
-- SELECT
--   conname AS constraint_name,
--   contype AS constraint_type,
--   pg_get_constraintdef(c.oid) AS constraint_definition
-- FROM pg_constraint c
-- JOIN pg_namespace n ON n.oid = c.connamespace
-- WHERE conrelid = 'push_notification_logs'::regclass
--   AND conname LIKE '%unique%' OR conname LIKE '%key%';
