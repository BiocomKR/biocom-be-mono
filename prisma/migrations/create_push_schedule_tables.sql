-- 푸시 스케줄 및 캠페인 테이블 생성

-- 1. 푸시 알림 스케줄 테이블
CREATE TABLE IF NOT EXISTS "push_notification_schedules" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500),
  "schedule_type" VARCHAR(20) DEFAULT 'RECURRING' NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "category" VARCHAR(20) NOT NULL,
  "cron_expression" VARCHAR(50),
  "one_time_scheduled_at" TIMESTAMP(3),
  "title" VARCHAR(100) NOT NULL,
  "body_template" TEXT NOT NULL,
  "image_url" VARCHAR(500),
  "data" JSONB,
  "target_query" JSONB,
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "is_active" BOOLEAN DEFAULT true NOT NULL,
  "last_executed_at" TIMESTAMP(3),
  "next_execution_at" TIMESTAMP(3),
  "execution_count" INTEGER DEFAULT 0 NOT NULL,
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP(3)
);

-- 2. 푸시 알림 캠페인 테이블
CREATE TABLE IF NOT EXISTS "push_notification_campaigns" (
  "id" SERIAL PRIMARY KEY,
  "schedule_id" INTEGER,
  "campaign_key" VARCHAR(255) UNIQUE NOT NULL,
  "campaign_type" VARCHAR(20) DEFAULT 'MANUAL' NOT NULL,
  "title" VARCHAR(100) NOT NULL,
  "body" TEXT NOT NULL,
  "image_url" VARCHAR(500),
  "data" JSONB,
  "type" VARCHAR(50) NOT NULL,
  "category" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
  "target_count" INTEGER DEFAULT 0 NOT NULL,
  "sent_count" INTEGER DEFAULT 0 NOT NULL,
  "fail_count" INTEGER DEFAULT 0 NOT NULL,
  "scheduled_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "cancel_reason" VARCHAR(500),
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_by" INTEGER,
  CONSTRAINT "push_notification_campaigns_schedule_id_fkey"
    FOREIGN KEY ("schedule_id")
    REFERENCES "push_notification_schedules"("id")
    ON DELETE SET NULL
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS "push_notification_schedules_type_idx" ON "push_notification_schedules"("type");
CREATE INDEX IF NOT EXISTS "push_notification_schedules_category_idx" ON "push_notification_schedules"("category");
CREATE INDEX IF NOT EXISTS "push_notification_schedules_is_active_idx" ON "push_notification_schedules"("is_active");
CREATE INDEX IF NOT EXISTS "push_notification_schedules_schedule_type_idx" ON "push_notification_schedules"("schedule_type");
CREATE INDEX IF NOT EXISTS "push_notification_schedules_next_execution_at_idx" ON "push_notification_schedules"("next_execution_at");
CREATE INDEX IF NOT EXISTS "push_notification_schedules_start_date_end_date_idx" ON "push_notification_schedules"("start_date", "end_date");

CREATE INDEX IF NOT EXISTS "push_notification_campaigns_campaign_key_idx" ON "push_notification_campaigns"("campaign_key");
CREATE INDEX IF NOT EXISTS "push_notification_campaigns_schedule_id_idx" ON "push_notification_campaigns"("schedule_id");
CREATE INDEX IF NOT EXISTS "push_notification_campaigns_campaign_type_idx" ON "push_notification_campaigns"("campaign_type");
CREATE INDEX IF NOT EXISTS "push_notification_campaigns_status_idx" ON "push_notification_campaigns"("status");
CREATE INDEX IF NOT EXISTS "push_notification_campaigns_type_idx" ON "push_notification_campaigns"("type");
CREATE INDEX IF NOT EXISTS "push_notification_campaigns_scheduled_at_idx" ON "push_notification_campaigns"("scheduled_at");
CREATE INDEX IF NOT EXISTS "push_notification_campaigns_created_at_idx" ON "push_notification_campaigns"("created_at");
