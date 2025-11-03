-- lecture_quizzes 테이블에 created_at, updated_at 컬럼 추가

ALTER TABLE lecture_quizzes
ADD COLUMN created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Seoul') NOT NULL,
ADD COLUMN updated_at TIMESTAMP;
