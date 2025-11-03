-- ========================================
-- 퀴즈 약결합 구조 마이그레이션
-- 작성일: 2025-10-28
-- ========================================
-- 변경 사유:
--   - 퀴즈를 미션/강의와 약결합으로 설계
--   - 강의 퀴즈와 미션 퀴즈를 하나의 테이블에서 관리
--   - 추후 확장성 고려 (단독 퀴즈 등)

-- 1. missionId를 NULL 허용으로 변경 (약결합)
ALTER TABLE quizzes ALTER COLUMN mission_id DROP NOT NULL;

-- 2. day 컬럼도 NULL 허용 (미션 없는 퀴즈 대응)
ALTER TABLE quizzes ALTER COLUMN day DROP NOT NULL;

-- 3. contentId 컬럼 추가 (강의 퀴즈용, 약결합)
ALTER TABLE quizzes ADD COLUMN content_id INTEGER;

-- 4. Foreign Key 제약조건 추가
ALTER TABLE quizzes ADD CONSTRAINT quizzes_content_id_fkey 
  FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE SET NULL;

-- 5. contentId 인덱스 추가
CREATE INDEX idx_quizzes_content_id ON quizzes(content_id);

-- 6. 포인트 기본값 변경 (50 → 300)
ALTER TABLE quizzes ALTER COLUMN points SET DEFAULT 300;

-- 주석 추가
COMMENT ON COLUMN quizzes.mission_id IS '미션 ID (NULL 허용 - 미션 퀴즈인 경우만)';
COMMENT ON COLUMN quizzes.content_id IS '강의 ID (NULL 허용 - 강의 퀴즈인 경우만)';
COMMENT ON COLUMN quizzes.day IS '일차 (NULL 허용 - 미션 퀴즈인 경우만)';
COMMENT ON COLUMN quizzes.points IS '퀴즈 정답 시 지급 포인트 (기본 300점)';
COMMENT ON TABLE quizzes IS '퀴즈 마스터 테이블 - 강의 퀴즈, 미션 퀴즈 통합 관리 (약결합 설계)';
