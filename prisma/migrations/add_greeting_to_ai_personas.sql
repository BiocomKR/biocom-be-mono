-- AI 페르소나 테이블에 greeting 컬럼 추가
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS greeting TEXT;

-- 컬럼 코멘트 추가
COMMENT ON COLUMN ai_personas.greeting IS '인사말 (성별 통합)';