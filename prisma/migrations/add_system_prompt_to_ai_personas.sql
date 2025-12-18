-- AI 페르소나 테이블에 system_prompt 컬럼 추가
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS system_prompt TEXT;

-- 컬럼 코멘트 추가
COMMENT ON COLUMN ai_personas.system_prompt IS '시스템 프롬프트';