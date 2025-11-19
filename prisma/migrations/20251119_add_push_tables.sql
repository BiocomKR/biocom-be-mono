-- Push 알림 도메인 테이블 추가
-- 작성일: 2025-11-19
-- 작성자: Claude Code

-- ================================================================
-- 1. 푸시 토큰 통합 테이블
-- 모든 푸시 서비스(FCM, OneSignal, APNs 등)의 토큰 관리
-- ================================================================
CREATE TABLE IF NOT EXISTS "push_tokens" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,

    -- 푸시 서비스 제공자 (FCM, ONESIGNAL, APNS 등)
    "provider" VARCHAR(20) NOT NULL,

    -- 토큰 데이터 (서비스별로 구조가 다름)
    -- FCM: { "token": "abc123..." }
    -- OneSignal: { "playerId": "xyz", "appId": "..." }
    -- APNs: { "deviceToken": "...", "bundleId": "..." }
    "token_data" JSONB NOT NULL,

    -- 디바이스 정보
    "device_id" VARCHAR(100),
    "platform" VARCHAR(20),
    "device_model" VARCHAR(100),
    "os_version" VARCHAR(50),
    "app_version" VARCHAR(50),

    -- 토큰 상태
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invalidated_at" TIMESTAMP(3),
    "invalid_reason" VARCHAR(100),

    -- 사용 이력
    "last_used_at" TIMESTAMP(3),
    "last_failed_at" TIMESTAMP(3),
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,

    -- 알림 설정
    "marketing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "night_push_enabled" BOOLEAN NOT NULL DEFAULT true,

    -- 메타 정보
    "user_agent" VARCHAR(500),
    "ip_address" VARCHAR(45),
    "timezone" VARCHAR(50) DEFAULT 'Asia/Seoul',

    -- 시간 정보
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    -- 제약 조건 (같은 유저 + 같은 디바이스 + 같은 서비스는 1개만)
    CONSTRAINT "push_tokens_user_id_device_id_provider_key" UNIQUE ("user_id", "device_id", "provider")
);

-- 푸시 토큰 인덱스
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");
CREATE INDEX "push_tokens_provider_idx" ON "push_tokens"("provider");
CREATE INDEX "push_tokens_is_active_idx" ON "push_tokens"("is_active");
CREATE INDEX "push_tokens_platform_idx" ON "push_tokens"("platform");

-- 푸시 토큰 외래키
ALTER TABLE "push_tokens"
ADD CONSTRAINT "push_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ================================================================
-- 2. 푸시 알림 스케줄 테이블
-- 반복 발송 설정 및 메시지 템플릿 관리
-- ================================================================
CREATE TABLE IF NOT EXISTS "push_notification_schedules" (
    "id" SERIAL PRIMARY KEY,

    -- 스케줄 정보
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "category" VARCHAR(20) NOT NULL,

    -- 크론 설정
    "cron_expression" VARCHAR(50) NOT NULL,

    -- 메시지 템플릿
    "title" VARCHAR(100) NOT NULL,
    "body_template" TEXT NOT NULL,

    -- 타겟팅 조건 (JSON)
    "target_query" JSONB,

    -- 상태
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    -- 관리자 정보
    "created_by" INTEGER,

    -- 시간 정보
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3)
);

-- 푸시 알림 스케줄 인덱스
CREATE INDEX "push_notification_schedules_type_idx" ON "push_notification_schedules"("type");
CREATE INDEX "push_notification_schedules_category_idx" ON "push_notification_schedules"("category");
CREATE INDEX "push_notification_schedules_is_active_idx" ON "push_notification_schedules"("is_active");

-- ================================================================
-- 3. 푸시 알림 캠페인 테이블
-- 특정 시점의 실제 발송 실행 기록
-- ================================================================
CREATE TABLE IF NOT EXISTS "push_notification_campaigns" (
    "id" SERIAL PRIMARY KEY,

    -- 스케줄 연결 (수동 발송이면 null)
    "schedule_id" INTEGER,

    -- 캠페인 식별
    "campaign_key" VARCHAR(255) NOT NULL UNIQUE,

    -- 발송 내용
    "title" VARCHAR(100) NOT NULL,
    "body" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "category" VARCHAR(20) NOT NULL,

    -- 실행 결과
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "target_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "fail_count" INTEGER NOT NULL DEFAULT 0,

    -- 시간 정보
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 관리자 정보 (수동 발송인 경우)
    "created_by" INTEGER
);

-- 푸시 알림 캠페인 인덱스
CREATE INDEX "push_notification_campaigns_campaign_key_idx" ON "push_notification_campaigns"("campaign_key");
CREATE INDEX "push_notification_campaigns_schedule_id_idx" ON "push_notification_campaigns"("schedule_id");
CREATE INDEX "push_notification_campaigns_status_idx" ON "push_notification_campaigns"("status");
CREATE INDEX "push_notification_campaigns_type_idx" ON "push_notification_campaigns"("type");
CREATE INDEX "push_notification_campaigns_scheduled_at_idx" ON "push_notification_campaigns"("scheduled_at");

-- 푸시 알림 캠페인 외래키
ALTER TABLE "push_notification_campaigns"
ADD CONSTRAINT "push_notification_campaigns_schedule_id_fkey"
FOREIGN KEY ("schedule_id") REFERENCES "push_notification_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ================================================================
-- 4. 푸시 알림 발송 로그 테이블
-- 개별 유저별 발송 상세 이력
-- ================================================================
CREATE TABLE IF NOT EXISTS "push_notification_logs" (
    "id" SERIAL PRIMARY KEY,

    -- 관계
    "campaign_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "push_token_id" INTEGER,

    -- 발송 내용
    "title" VARCHAR(100) NOT NULL,
    "body" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "data" JSONB,

    -- 발송 결과
    "success" BOOLEAN NOT NULL,
    "error_code" VARCHAR(50),
    "error_message" TEXT,

    -- 시간
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- 사용자 반응 (선택사항)
    "read_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),

    -- 제약 조건 (같은 캠페인에 같은 유저는 1번만)
    CONSTRAINT "push_notification_logs_campaign_id_user_id_key" UNIQUE ("campaign_id", "user_id")
);

-- 푸시 알림 로그 인덱스
CREATE INDEX "push_notification_logs_user_id_idx" ON "push_notification_logs"("user_id");
CREATE INDEX "push_notification_logs_campaign_id_idx" ON "push_notification_logs"("campaign_id");
CREATE INDEX "push_notification_logs_push_token_id_idx" ON "push_notification_logs"("push_token_id");
CREATE INDEX "push_notification_logs_type_idx" ON "push_notification_logs"("type");
CREATE INDEX "push_notification_logs_success_idx" ON "push_notification_logs"("success");
CREATE INDEX "push_notification_logs_sent_at_idx" ON "push_notification_logs"("sent_at");

-- 푸시 알림 로그 외래키
ALTER TABLE "push_notification_logs"
ADD CONSTRAINT "push_notification_logs_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "push_notification_logs"
ADD CONSTRAINT "push_notification_logs_push_token_id_fkey"
FOREIGN KEY ("push_token_id") REFERENCES "push_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "push_notification_logs"
ADD CONSTRAINT "push_notification_logs_campaign_id_fkey"
FOREIGN KEY ("campaign_id") REFERENCES "push_notification_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ================================================================
-- 5. 테이블 코멘트 추가
-- ================================================================
COMMENT ON TABLE "push_tokens" IS '푸시 토큰 통합 테이블 (FCM, OneSignal, APNs 등 모든 서비스)';
COMMENT ON TABLE "push_notification_schedules" IS '푸시 알림 스케줄 및 템플릿 설정';
COMMENT ON TABLE "push_notification_campaigns" IS '푸시 알림 캠페인 발송 기록';
COMMENT ON TABLE "push_notification_logs" IS '푸시 알림 개별 발송 이력';
