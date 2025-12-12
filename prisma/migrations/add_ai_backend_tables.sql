-- ========================================
-- AI Backend Tables Migration
-- ========================================

-- 사용자 알레르기 검사 리포트
CREATE TABLE IF NOT EXISTS "user_allergy_reports" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "chart_id" VARCHAR(50) NOT NULL,
  "user_name" VARCHAR(255) NOT NULL,
  "level1" TEXT,
  "level2" TEXT,
  "level3" TEXT,
  "level4" TEXT,
  "level5" TEXT,
  "animal_type" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3),
  CONSTRAINT "fk_user_allergy_reports_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_user_allergy_reports_chart_id" FOREIGN KEY ("chart_id") REFERENCES "user_charts"("chart_id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_user_allergy_reports_user_id" ON "user_allergy_reports"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_allergy_reports_chart_id" ON "user_allergy_reports"("chart_id");

-- 사용자 대사 기능 검사 리포트
CREATE TABLE IF NOT EXISTS "user_metabolic_reports" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "chart_id" VARCHAR(50) NOT NULL,
  "username" VARCHAR(255) NOT NULL,
  "category_ranks" JSONB,
  "solutions" JSONB,
  "supplements" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3),
  CONSTRAINT "fk_user_metabolic_reports_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_user_metabolic_reports_chart_id" FOREIGN KEY ("chart_id") REFERENCES "user_charts"("chart_id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_user_metabolic_reports_user_id" ON "user_metabolic_reports"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_metabolic_reports_chart_id" ON "user_metabolic_reports"("chart_id");

-- 사용자 챗봇 대화 히스토리
CREATE TABLE IF NOT EXISTS "user_chat_histories" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "chart_id" VARCHAR(50),
  "session_id" VARCHAR(100),
  "test_type" VARCHAR(20),
  "user_message" TEXT NOT NULL,
  "ai_message" TEXT NOT NULL,
  "persona_type" VARCHAR(50),
  "gender" VARCHAR(10),
  "cached" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fk_user_chat_histories_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_user_chat_histories_chart_id" FOREIGN KEY ("chart_id") REFERENCES "user_charts"("chart_id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_user_chat_histories_user_id" ON "user_chat_histories"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_chat_histories_chart_id" ON "user_chat_histories"("chart_id");
CREATE INDEX IF NOT EXISTS "idx_user_chat_histories_user_created" ON "user_chat_histories"("user_id", "created_at");

-- 사용자 감정 상태
CREATE TABLE IF NOT EXISTS "user_emotional_states" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL UNIQUE,
  "intimacy" INTEGER NOT NULL DEFAULT 0,
  "relationship_stage" VARCHAR(20) NOT NULL DEFAULT 'stranger',
  "conversation_count" INTEGER NOT NULL DEFAULT 0,
  "last_chat_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3),
  CONSTRAINT "fk_user_emotional_states_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_user_emotional_states_user_id" ON "user_emotional_states"("user_id");

-- 딥 리포트
CREATE TABLE IF NOT EXISTS "user_deep_reports" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "chart_id" VARCHAR(50),
  "report_id" VARCHAR(100) NOT NULL UNIQUE,
  "provider" VARCHAR(20) NOT NULL,
  "content" JSONB NOT NULL,
  "processing_time_seconds" DOUBLE PRECISION,
  "total_tokens" INTEGER,
  "estimated_cost_usd" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  CONSTRAINT "fk_user_deep_reports_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_user_deep_reports_chart_id" FOREIGN KEY ("chart_id") REFERENCES "user_charts"("chart_id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_user_deep_reports_user_id" ON "user_deep_reports"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_deep_reports_report_id" ON "user_deep_reports"("report_id");
CREATE INDEX IF NOT EXISTS "idx_user_deep_reports_chart_id" ON "user_deep_reports"("chart_id");
