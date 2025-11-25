-- Add is_test column to push_notification_logs
-- 2025-01-20: Add test flag for push notifications

-- Add is_test column with default false
ALTER TABLE "push_notification_logs"
ADD COLUMN IF NOT EXISTS "is_test" BOOLEAN DEFAULT false NOT NULL;

-- Add index for filtering test records
CREATE INDEX IF NOT EXISTS "push_notification_logs_is_test_idx"
ON "push_notification_logs"("is_test");

-- Add comment
COMMENT ON COLUMN "push_notification_logs"."is_test" IS '테스트 발송 여부 (기본값: false)';
