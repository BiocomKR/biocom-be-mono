-- 푸시 스케줄 테이블 고도화 마이그레이션
-- 수동 실행용 SQL (데이터 안전)

-- 1. PushNotificationSchedule 테이블에 컬럼 추가
ALTER TABLE "push_notification_schedules"
  ADD COLUMN IF NOT EXISTS "description" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "schedule_type" VARCHAR(20) DEFAULT 'RECURRING',
  ADD COLUMN IF NOT EXISTS "one_time_scheduled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "image_url" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "data" JSONB,
  ADD COLUMN IF NOT EXISTS "start_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_executed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "next_execution_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "execution_count" INTEGER DEFAULT 0;

-- 2. cron_expression을 nullable로 변경 (ONCE 타입에서는 불필요)
ALTER TABLE "push_notification_schedules"
  ALTER COLUMN "cron_expression" DROP NOT NULL;

-- 3. PushNotificationCampaign 테이블에 컬럼 추가
ALTER TABLE "push_notification_campaigns"
  ADD COLUMN IF NOT EXISTS "campaign_type" VARCHAR(20) DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "image_url" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "data" JSONB,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancel_reason" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "error_message" TEXT;

-- 4. 인덱스 추가
CREATE INDEX IF NOT EXISTS "push_notification_schedules_schedule_type_idx" ON "push_notification_schedules"("schedule_type");
CREATE INDEX IF NOT EXISTS "push_notification_schedules_next_execution_at_idx" ON "push_notification_schedules"("next_execution_at");
CREATE INDEX IF NOT EXISTS "push_notification_schedules_start_date_end_date_idx" ON "push_notification_schedules"("start_date", "end_date");

CREATE INDEX IF NOT EXISTS "push_notification_campaigns_campaign_type_idx" ON "push_notification_campaigns"("campaign_type");
CREATE INDEX IF NOT EXISTS "push_notification_campaigns_created_at_idx" ON "push_notification_campaigns"("created_at");

-- 5. 기존 데이터 업데이트 (scheduleType 기본값 설정)
UPDATE "push_notification_schedules"
SET "schedule_type" = 'RECURRING'
WHERE "schedule_type" IS NULL;

UPDATE "push_notification_campaigns"
SET "campaign_type" = 'MANUAL'
WHERE "campaign_type" IS NULL;
