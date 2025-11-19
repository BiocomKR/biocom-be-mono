-- Refactor push_tokens table structure
-- token_data (JSONB) → token (VARCHAR) + metadata (JSONB)

-- 1. 기존 데이터 삭제
TRUNCATE TABLE "push_tokens" CASCADE;

-- 2. token_data 컬럼 삭제
ALTER TABLE "push_tokens" DROP COLUMN "token_data";

-- 3. token 컬럼 추가 (필수)
ALTER TABLE "push_tokens" ADD COLUMN "token" VARCHAR(255) NOT NULL;

-- 4. metadata 컬럼 추가 (선택)
ALTER TABLE "push_tokens" ADD COLUMN "metadata" JSONB;

-- 5. token 컬럼에 인덱스 추가 (검색 성능 향상)
CREATE INDEX "push_tokens_token_idx" ON "push_tokens"("token");
