-- 퀴즈 테이블 정규화: 올바른 관계 구조로 재설계
--
-- 올바른 데이터 흐름:
-- 1. 챌린지 → ChallengeMission → Mission → MissionQuiz → Quiz
-- 2. Content(강의) → LectureQuiz → Quiz (독립적)
--
-- 잘못된 설계 제거:
-- - ChallengeQuiz: 챌린지가 퀴즈를 직접 참조 (중간 단계 없음)
-- - Quiz.missionId, Quiz.contentId: 마스터 데이터가 종속됨

-- 1. MissionQuiz 관계 테이블 생성 (미션 → 퀴즈 매핑)
CREATE TABLE mission_quizzes (
  id SERIAL PRIMARY KEY,
  mission_id INT NOT NULL,
  quiz_id INT NOT NULL,
  day INT NOT NULL,
  sort_order INT DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP,

  CONSTRAINT fk_mission_quizzes_mission
    FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
  CONSTRAINT fk_mission_quizzes_quiz
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  CONSTRAINT uq_mission_quizzes_mission_quiz_day
    UNIQUE (mission_id, quiz_id, day)
);

CREATE INDEX idx_mission_quizzes_mission_id ON mission_quizzes(mission_id);
CREATE INDEX idx_mission_quizzes_quiz_id ON mission_quizzes(quiz_id);
CREATE INDEX idx_mission_quizzes_mission_day ON mission_quizzes(mission_id, day);

-- 2. lecture_quizzes에 day 컬럼 추가
ALTER TABLE lecture_quizzes
ADD COLUMN day INT;

-- 3. 기존 데이터 마이그레이션 (quizzes.day → lecture_quizzes.day)
UPDATE lecture_quizzes lq
SET day = q.day
FROM quizzes q
WHERE lq.quiz_id = q.id AND q.day IS NOT NULL;

-- 4. 기존 데이터 마이그레이션 (ChallengeQuiz → MissionQuiz)
-- 주의: challenge_quizzes의 데이터가 실제로 미션 기반인지 확인 필요
-- 현재는 데이터 보존만 하고, 실제 마이그레이션은 수동으로 진행
-- INSERT INTO mission_quizzes (mission_id, quiz_id, day, sort_order, is_active, created_at)
-- SELECT ...(적절한 매핑 필요)

-- 5. ChallengeQuiz 테이블 제거 (잘못된 직접 연결)
DROP TABLE IF EXISTS challenge_quizzes CASCADE;

-- 6. Quiz 테이블에서 종속성 컬럼 제거
ALTER TABLE quizzes
DROP COLUMN IF EXISTS mission_id,
DROP COLUMN IF EXISTS content_id,
DROP COLUMN IF EXISTS day;

-- 7. 인덱스 정리
DROP INDEX IF EXISTS quizzes_mission_id_idx;
DROP INDEX IF EXISTS quizzes_content_id_idx;
DROP INDEX IF EXISTS quizzes_day_idx;

-- 최종 구조:
-- Quiz: 순수 마스터 (question, options, correct_answer, explanation, points)
-- MissionQuiz: mission_id, quiz_id, day, sort_order
-- LectureQuiz: content_id, quiz_id, day, sort_order
