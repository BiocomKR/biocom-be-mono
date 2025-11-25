-- CreateTable: push_tokens
-- 푸시 알림 토큰 관리 테이블

CREATE TABLE "push_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "token_data" JSONB NOT NULL,
    "device_id" VARCHAR(100),
    "platform" VARCHAR(20),
    "device_model" VARCHAR(100),
    "os_version" VARCHAR(50),
    "app_version" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invalidated_at" TIMESTAMP(3),
    "invalid_reason" VARCHAR(100),
    "last_used_at" TIMESTAMP(3),
    "last_failed_at" TIMESTAMP(3),
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "marketing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "night_push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "user_agent" VARCHAR(500),
    "ip_address" VARCHAR(45),
    "timezone" VARCHAR(50) DEFAULT 'Asia/Seoul',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_user_id_device_id_provider_key" ON "push_tokens"("user_id", "device_id", "provider");

-- CreateIndex
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

-- CreateIndex
CREATE INDEX "push_tokens_provider_idx" ON "push_tokens"("provider");

-- CreateIndex
CREATE INDEX "push_tokens_is_active_idx" ON "push_tokens"("is_active");

-- CreateIndex
CREATE INDEX "push_tokens_platform_idx" ON "push_tokens"("platform");

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
