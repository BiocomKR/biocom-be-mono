-- 운영자 관련 테이블 수동 생성 SQL
-- 실행: psql 또는 DBeaver에서 직접 실행

-- 1. AccessTier enum 생성
DO $$ BEGIN
    CREATE TYPE "AccessTier" AS ENUM ('SYSTEM', 'MANAGER', 'STAFF', 'VIEWER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. MenuCode enum 생성
DO $$ BEGIN
    CREATE TYPE "MenuCode" AS ENUM (
        'DASHBOARD', 'USERS', 'CHALLENGE', 'MISSION', 'SURVEY',
        'QUIZ', 'CONTENT', 'POINT', 'SHOP', 'ORDERS',
        'SHIPPING', 'REFUNDS', 'PUSH', 'OPERATORS'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. departments 테이블 생성
CREATE TABLE IF NOT EXISTS "departments" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL UNIQUE,
    "code" VARCHAR(50) NOT NULL UNIQUE,
    "menu_codes" "MenuCode"[] DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. operators 테이블 생성
CREATE TABLE IF NOT EXISTS "operators" (
    "id" SERIAL PRIMARY KEY,
    "email" VARCHAR(255) NOT NULL UNIQUE,
    "password" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "access_tier" "AccessTier" NOT NULL DEFAULT 'VIEWER',
    "department_id" INTEGER REFERENCES "departments"("id"),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. operator_refresh_tokens 테이블 생성
CREATE TABLE IF NOT EXISTS "operator_refresh_tokens" (
    "id" VARCHAR(255) PRIMARY KEY,
    "token" VARCHAR(255) NOT NULL UNIQUE,
    "operator_id" INTEGER NOT NULL REFERENCES "operators"("id") ON DELETE CASCADE,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "operator_refresh_tokens_operator_id_idx" ON "operator_refresh_tokens"("operator_id");
CREATE INDEX IF NOT EXISTS "operator_refresh_tokens_token_idx" ON "operator_refresh_tokens"("token");

-- 6. operator_auth_logs 테이블 생성
CREATE TABLE IF NOT EXISTS "operator_auth_logs" (
    "id" SERIAL PRIMARY KEY,
    "operator_id" INTEGER NOT NULL REFERENCES "operators"("id") ON DELETE CASCADE,
    "action" VARCHAR(50) NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "operator_auth_logs_operator_id_created_at_idx" ON "operator_auth_logs"("operator_id", "created_at");
