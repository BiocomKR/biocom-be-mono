-- 챌린지 시스템 전면 개편 마이그레이션
-- 작성일: 2025-08-28
-- 목적: Event 기반 -> Challenge 기반 전환

-- ================================================
-- 1. 새로운 테이블 생성
-- ================================================

-- 챌린지 마스터 테이블
CREATE TABLE IF NOT EXISTS challenges (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  total_days INTEGER DEFAULT 21,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 챌린지-상품 연결 테이블
CREATE TABLE IF NOT EXISTS challenge_products (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(challenge_id, product_id)
);

-- 챌린지 구매권 테이블
CREATE TABLE IF NOT EXISTS challenge_tickets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  order_item_id INTEGER REFERENCES order_items(id),
  purchase_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'PURCHASED', -- PURCHASED, ACTIVATED, COMPLETED, EXPIRED
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 사용자별 활성 챌린지
CREATE TABLE IF NOT EXISTS user_challenges (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  ticket_id INTEGER NOT NULL REFERENCES challenge_tickets(id),
  activated_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  current_day INTEGER DEFAULT 1,
  total_points INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, EXPIRED
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, status) -- 한 번에 하나만 활성화
);

-- 일별 진행 상황
CREATE TABLE IF NOT EXISTS daily_progress (
  id SERIAL PRIMARY KEY,
  user_challenge_id INTEGER NOT NULL REFERENCES user_challenges(id),
  day INTEGER NOT NULL,
  date DATE NOT NULL,
  missions_total INTEGER DEFAULT 0,
  missions_completed INTEGER DEFAULT 0,
  surveys_total INTEGER DEFAULT 0,
  surveys_completed INTEGER DEFAULT 0,
  quizzes_total INTEGER DEFAULT 0,
  quizzes_correct INTEGER DEFAULT 0,
  contents_total INTEGER DEFAULT 0,
  contents_viewed INTEGER DEFAULT 0,
  trackings_total INTEGER DEFAULT 0,
  trackings_completed INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_challenge_id, day)
);

-- 기록 항목 마스터
CREATE TABLE IF NOT EXISTS tracking_items (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL, -- DIET, SLEEP, EXERCISE, WATER, MEDICATION, FASTING, INNER_BEAUTY
  name VARCHAR(100) NOT NULL,
  unit VARCHAR(20),
  default_target INTEGER,
  input_type VARCHAR(20), -- NUMBER, TIME, PHOTO, SELECT, SURVEY
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 기록 데이터
CREATE TABLE IF NOT EXISTS tracking_records (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  user_challenge_id INTEGER REFERENCES user_challenges(id),
  tracking_code VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  value TEXT,
  unit VARCHAR(20),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, tracking_code, date)
);

-- ================================================
-- 2. 연결 테이블 생성 (Event -> Challenge)
-- ================================================

-- 챌린지-미션 연결
CREATE TABLE IF NOT EXISTS challenge_missions (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  mission_id INTEGER NOT NULL REFERENCES missions(id),
  day INTEGER NOT NULL,
  points INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(challenge_id, mission_id, day)
);

-- 챌린지-설문 연결
CREATE TABLE IF NOT EXISTS challenge_surveys (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  survey_id INTEGER NOT NULL REFERENCES surveys(id),
  day INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(challenge_id, survey_id, day)
);

-- 챌린지-퀴즈 연결
CREATE TABLE IF NOT EXISTS challenge_quizzes (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
  day INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(challenge_id, quiz_id, day)
);

-- 챌린지-컨텐츠 연결
CREATE TABLE IF NOT EXISTS challenge_contents (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  content_id INTEGER NOT NULL REFERENCES contents(id),
  week_number INTEGER NOT NULL, -- 1, 2, 3주차
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(challenge_id, content_id)
);

-- ================================================
-- 3. 인덱스 추가
-- ================================================

CREATE INDEX idx_challenge_products_challenge ON challenge_products(challenge_id);
CREATE INDEX idx_challenge_products_product ON challenge_products(product_id);
CREATE INDEX idx_challenge_tickets_user_status ON challenge_tickets(user_id, status);
CREATE INDEX idx_user_challenges_user_active ON user_challenges(user_id, status);
CREATE INDEX idx_daily_progress_user_challenge ON daily_progress(user_challenge_id);
CREATE INDEX idx_tracking_records_user_date ON tracking_records(user_id, date);
CREATE INDEX idx_challenge_missions_challenge_day ON challenge_missions(challenge_id, day);
CREATE INDEX idx_challenge_surveys_challenge_day ON challenge_surveys(challenge_id, day);
CREATE INDEX idx_challenge_quizzes_challenge_day ON challenge_quizzes(challenge_id, day);
CREATE INDEX idx_challenge_contents_challenge_week ON challenge_contents(challenge_id, week_number);

-- ================================================
-- 4. 기초 데이터 입력
-- ================================================

-- 기록 항목 마스터 데이터
INSERT INTO tracking_items (code, name, unit, default_target, input_type) VALUES
('DIET', '식단 기록', '회', 3, 'PHOTO'),
('SLEEP', '수면 기록', '시간', 8, 'TIME'),
('EXERCISE', '운동 기록', '분', 30, 'NUMBER'),
('WATER', '물 섭취', 'ml', 2000, 'NUMBER'),
('MEDICATION', '영양제 복용', '회', 2, 'SELECT'),
('FASTING', '공복 시간', '시간', 16, 'TIME'),
('INNER_BEAUTY', '이너뷰티', '점', 100, 'SURVEY')
ON CONFLICT (code) DO NOTHING;

-- ================================================
-- 5. 기존 데이터 마이그레이션 (선택적)
-- ================================================

-- 테스트 챌린지 생성
INSERT INTO challenges (name, description, total_days, price, is_active)
SELECT 
  name,
  description,
  total_days,
  0 as price,
  is_active
FROM events
WHERE type = 'CHALLENGE'
ON CONFLICT DO NOTHING;

-- ================================================
-- 6. 주의사항
-- ================================================
-- 이 마이그레이션 실행 후:
-- 1. Prisma 스키마 업데이트 필요
-- 2. 기존 Event 관련 API 모두 수정 필요
-- 3. 서비스 로직 전면 개편 필요
-- 4. 기존 events 테이블은 백업 후 제거 예정