-- 퀴즈 리팩토링 마이그레이션 스크립트
-- 실행 전 반드시 백업을 하세요!

-- 1. 퀴즈 마스터 테이블 생성
CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_answer INTEGER NOT NULL,
    points INTEGER DEFAULT 50,
    category VARCHAR(100),
    difficulty VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 2. 기존 EventQuiz 데이터를 Quiz 테이블로 마이그레이션
INSERT INTO quizzes (title, question, options, correct_answer, points, created_at, updated_at)
SELECT 
    CONCAT('Day ', day, ' Quiz - Event ', event_id) as title,
    question,
    options,
    correct_answer,
    points,
    created_at,
    updated_at
FROM event_quizzes
WHERE question IS NOT NULL;

-- 3. 임시 테이블로 기존 event_quizzes 백업
CREATE TABLE event_quizzes_backup AS SELECT * FROM event_quizzes;

-- 4. event_quizzes 테이블 구조 변경
-- 4.1. 기존 제약조건 제거
ALTER TABLE event_quizzes DROP CONSTRAINT IF EXISTS event_quizzes_event_id_day_key;

-- 4.2. 새로운 컬럼 추가
ALTER TABLE event_quizzes ADD COLUMN IF NOT EXISTS quiz_id INTEGER;
ALTER TABLE event_quizzes ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 4.3. quiz_id 값 설정 (question 매칭으로)
UPDATE event_quizzes eq
SET quiz_id = q.id
FROM quizzes q
WHERE eq.question = q.question;

-- 4.4. 기존 컬럼 제거
ALTER TABLE event_quizzes DROP COLUMN IF EXISTS question;
ALTER TABLE event_quizzes DROP COLUMN IF EXISTS options;
ALTER TABLE event_quizzes DROP COLUMN IF EXISTS correct_answer;
ALTER TABLE event_quizzes DROP COLUMN IF EXISTS points;

-- 4.5. NOT NULL 제약조건 추가
ALTER TABLE event_quizzes ALTER COLUMN quiz_id SET NOT NULL;

-- 4.6. 외래키 제약조건 추가
ALTER TABLE event_quizzes 
ADD CONSTRAINT event_quizzes_quiz_id_fkey 
FOREIGN KEY (quiz_id) REFERENCES quizzes(id);

-- 4.7. 새로운 유니크 제약조건 추가
ALTER TABLE event_quizzes 
ADD CONSTRAINT event_quizzes_event_id_quiz_id_day_key 
UNIQUE (event_id, quiz_id, day);

-- 4.8. 인덱스 추가
CREATE INDEX IF NOT EXISTS event_quizzes_quiz_id_idx ON event_quizzes(quiz_id);

-- 5. 검증 쿼리
SELECT 
    'Total quizzes migrated:' as description, 
    COUNT(*) as count 
FROM quizzes
UNION ALL
SELECT 
    'Total event-quiz relations:', 
    COUNT(*) 
FROM event_quizzes WHERE quiz_id IS NOT NULL;