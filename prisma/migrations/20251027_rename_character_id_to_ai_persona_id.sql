-- users 테이블의 character_id 컬럼을 ai_persona_id로 변경
ALTER TABLE "users" RENAME COLUMN "character_id" TO "ai_persona_id";
