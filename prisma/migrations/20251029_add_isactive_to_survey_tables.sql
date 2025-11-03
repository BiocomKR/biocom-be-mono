-- ========================================
-- 설문 테이블에 isActive 컬럼 추가
-- 작성일: 2025-10-29
-- ========================================
-- 변경 사유:
--   - 설문 질문/옵션의 임시 활성화/비활성화 기능 지원
--   - Soft Delete 패턴 적용

-- survey_questions 테이블에 is_active 컬럼 추가
ALTER TABLE survey_questions
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- survey_options 테이블에 is_active 컬럼 추가
ALTER TABLE survey_options
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- 인덱스 추가 (활성화된 항목만 자주 조회하므로)
CREATE INDEX idx_survey_questions_is_active ON survey_questions(is_active);
CREATE INDEX idx_survey_options_is_active ON survey_options(is_active);

-- 주석 추가
COMMENT ON COLUMN survey_questions.is_active IS '질문 활성화 상태 (true: 활성, false: 비활성)';
COMMENT ON COLUMN survey_options.is_active IS '옵션 활성화 상태 (true: 활성, false: 비활성)';
