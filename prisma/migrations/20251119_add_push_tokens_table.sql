-- CreateTable: push_tokens
-- 푸시 알림 토큰 관리 테이블 (FCM)

CREATE TABLE IF NOT EXISTS "push_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'FCM',
    "token_data" JSONB NOT NULL,
    "device_id" VARCHAR(255) NOT NULL,
    "platform" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

-- CreateIndex
CREATE INDEX "push_tokens_is_active_idx" ON "push_tokens"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_user_id_device_id_provider_key" ON "push_tokens"("user_id", "device_id", "provider");

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
