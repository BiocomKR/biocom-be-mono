-- ========================================
-- 퀴즈 시도 기록 테이블 추가
-- 작성일: 2025-10-28
-- ========================================
-- 변경 사유:
--   - 강의 퀴즈 답변 기록 및 중복 제출 방지
--   - 최초 1회 포인트 지급 관리

-- quiz_attempts 테이블 생성
CREATE TABLE quiz_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  quiz_id INTEGER NOT NULL,
  content_id INTEGER,
  selected_answer INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points_earned INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL,
  
  -- Foreign Keys
  CONSTRAINT quiz_attempts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT quiz_attempts_quiz_id_fkey 
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  CONSTRAINT quiz_attempts_content_id_fkey 
    FOREIGN KEY (content_id) REFERENCES contents(id) ON DELETE SET NULL,
  
  -- 유니크 제약 (사용자당 퀴즈 1회만)
  CONSTRAINT quiz_attempts_user_id_quiz_id_key 
    UNIQUE (user_id, quiz_id)
);

-- 인덱스 추가
CREATE INDEX idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempts_content_id ON quiz_attempts(content_id);

-- 주석 추가
COMMENT ON TABLE quiz_attempts IS '퀴즈 시도 기록 테이블 - 강의 퀴즈 답변 및 포인트 지급 관리';
COMMENT ON COLUMN quiz_attempts.user_id IS '사용자 ID';
COMMENT ON COLUMN quiz_attempts.quiz_id IS '퀴즈 ID';
COMMENT ON COLUMN quiz_attempts.content_id IS '강의 ID (NULL 허용)';
COMMENT ON COLUMN quiz_attempts.selected_answer IS '선택한 답변 번호';
COMMENT ON COLUMN quiz_attempts.is_correct IS '정답 여부';
COMMENT ON COLUMN quiz_attempts.points_earned IS '획득한 포인트 (최초 1회 300점)';
COMMENT ON COLUMN quiz_attempts.created_at IS '답변 일시';
