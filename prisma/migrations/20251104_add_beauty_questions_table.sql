-- 뷰티 설문지 마스터 테이블 생성
-- 이너뷰티 4개 항목 + 아우터뷰티 4개 항목 관리

CREATE TABLE IF NOT EXISTS beauty_questions (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL, -- 'INNER' 또는 'OUTER'
  category VARCHAR(50) NOT NULL, -- 구분 (장 건강, 대사 밸런스, 붓기 등)
  question TEXT NOT NULL, -- 질문 문구
  sort_order INT NOT NULL, -- 정렬 순서
  is_active BOOLEAN NOT NULL DEFAULT true, -- 활성화 여부
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- 이너뷰티 데이터 INSERT
INSERT INTO beauty_questions (type, category, question, sort_order) VALUES
('INNER', '장 건강', '속이 더부룩하거나 배가 불편했던 순간이 있었나요?', 1),
('INNER', '대사 밸런스', '오늘 손발이 차거나 에너지가 부족했나요?', 2),
('INNER', '염증', '열감이나 통증이 느껴지는 부위가 있었나요?', 3),
('INNER', '면역 과민 반응', '두드러기나 발진 등 피부 증상이 있었나요?', 4);

-- 아우터뷰티 데이터 INSERT
INSERT INTO beauty_questions (type, category, question, sort_order) VALUES
('OUTER', '붓기', '아침에 일어났을 때 얼굴이 평소보다 부은 느낌이 있었나요?', 5),
('OUTER', '수분감', '피부가 당기거나 건조하다는 느낌이 있었나요?', 6),
('OUTER', '유분감', '피지로 인해 얼굴이 쉽게 번들거리거나 유분이 많이 느껴졌나요?', 7),
('OUTER', '트러블', '붉은기나 뾰루지 등 눈에 띄는 피부 트러블이 있었나요?', 8);

-- 인덱스 생성
CREATE INDEX idx_beauty_questions_type ON beauty_questions(type);
CREATE INDEX idx_beauty_questions_sort_order ON beauty_questions(sort_order);
CREATE INDEX idx_beauty_questions_is_active ON beauty_questions(is_active);

COMMENT ON TABLE beauty_questions IS '뷰티 설문지 마스터 테이블 (이너뷰티 4개 + 아우터뷰티 4개)';
COMMENT ON COLUMN beauty_questions.type IS '뷰티 타입 (INNER: 이너뷰티, OUTER: 아우터뷰티)';
COMMENT ON COLUMN beauty_questions.category IS '구분 (장 건강, 대사 밸런스, 붓기, 수분감 등)';
COMMENT ON COLUMN beauty_questions.question IS '질문 문구';
COMMENT ON COLUMN beauty_questions.sort_order IS '정렬 순서';
COMMENT ON COLUMN beauty_questions.is_active IS '활성화 여부 (false시 앱에서 안보임)';
