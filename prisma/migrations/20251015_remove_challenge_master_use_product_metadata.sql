-- ========================================
-- Challenge 마스터 테이블 제거 및 Product 기반 구조로 변경
-- ========================================
-- 설명:
-- 1. Challenge 테이블을 완전히 제거
-- 2. Product 테이블에 metadata JSONB 컬럼 추가
-- 3. 모든 챌린지 관련 테이블(ChallengeMission, ChallengeQuiz 등)을 Product 참조로 변경
-- 4. ChallengeProduct 테이블 제거 (챌린지 자체가 상품이므로 불필요)
--
-- 실행 전 백업 필수!
-- ========================================

BEGIN;

-- ========================================
-- Step 1: Product 테이블에 metadata 컬럼 추가
-- ========================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS metadata JSONB;
COMMENT ON COLUMN products.metadata IS '챌린지 메타데이터 (challengeType, totalDays, description 등)';

-- ========================================
-- Step 2: 기존 데이터 백업 (선택사항)
-- ========================================
-- CREATE TABLE challenges_backup AS SELECT * FROM challenges;
-- CREATE TABLE challenge_products_backup AS SELECT * FROM challenge_products;

-- ========================================
-- Step 3: ChallengeMission 테이블 수정
-- ========================================
-- 기존 challengeId를 productId로 변경
ALTER TABLE challenge_missions RENAME COLUMN challenge_id TO product_id;

-- 기존 FK 제약조건 제거
ALTER TABLE challenge_missions DROP CONSTRAINT IF EXISTS challenge_missions_challenge_id_fkey;

-- 새로운 FK 제약조건 추가
ALTER TABLE challenge_missions ADD CONSTRAINT challenge_missions_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- 기존 UNIQUE 제약조건 제거 및 재생성
DROP INDEX IF EXISTS challenge_missions_challenge_id_mission_id_day_key;
CREATE UNIQUE INDEX IF NOT EXISTS challenge_missions_product_id_mission_id_day_key
  ON challenge_missions(product_id, mission_id, day);

-- 기존 인덱스 제거 및 재생성
DROP INDEX IF EXISTS challenge_missions_challenge_id_day_idx;
CREATE INDEX IF NOT EXISTS challenge_missions_product_id_day_idx
  ON challenge_missions(product_id, day);

-- ========================================
-- Step 4: ChallengeQuiz 테이블 수정
-- ========================================
ALTER TABLE challenge_quizzes RENAME COLUMN challenge_id TO product_id;

ALTER TABLE challenge_quizzes DROP CONSTRAINT IF EXISTS challenge_quizzes_challenge_id_fkey;

ALTER TABLE challenge_quizzes ADD CONSTRAINT challenge_quizzes_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS challenge_quizzes_challenge_id_quiz_id_day_key;
CREATE UNIQUE INDEX IF NOT EXISTS challenge_quizzes_product_id_quiz_id_day_key
  ON challenge_quizzes(product_id, quiz_id, day);

DROP INDEX IF EXISTS challenge_quizzes_challenge_id_day_idx;
CREATE INDEX IF NOT EXISTS challenge_quizzes_product_id_day_idx
  ON challenge_quizzes(product_id, day);

-- ========================================
-- Step 5: ChallengeSurvey 테이블 수정
-- ========================================
ALTER TABLE challenge_surveys RENAME COLUMN challenge_id TO product_id;

ALTER TABLE challenge_surveys DROP CONSTRAINT IF EXISTS challenge_surveys_challenge_id_fkey;

ALTER TABLE challenge_surveys ADD CONSTRAINT challenge_surveys_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS challenge_surveys_challenge_id_survey_id_day_key;
CREATE UNIQUE INDEX IF NOT EXISTS challenge_surveys_product_id_survey_id_day_key
  ON challenge_surveys(product_id, survey_id, day);

DROP INDEX IF EXISTS challenge_surveys_challenge_id_day_idx;
CREATE INDEX IF NOT EXISTS challenge_surveys_product_id_day_idx
  ON challenge_surveys(product_id, day);

-- ========================================
-- Step 6: ChallengeContent 테이블 수정
-- ========================================
ALTER TABLE challenge_contents RENAME COLUMN challenge_id TO product_id;

ALTER TABLE challenge_contents DROP CONSTRAINT IF EXISTS challenge_contents_challenge_id_fkey;

ALTER TABLE challenge_contents ADD CONSTRAINT challenge_contents_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS challenge_contents_challenge_id_content_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS challenge_contents_product_id_content_id_key
  ON challenge_contents(product_id, content_id);

DROP INDEX IF EXISTS challenge_contents_challenge_id_week_number_idx;
CREATE INDEX IF NOT EXISTS challenge_contents_product_id_week_number_idx
  ON challenge_contents(product_id, week_number);

-- ========================================
-- Step 7: ChallengeTicket 테이블 수정
-- ========================================
ALTER TABLE challenge_tickets RENAME COLUMN challenge_id TO product_id;

ALTER TABLE challenge_tickets DROP CONSTRAINT IF EXISTS challenge_tickets_challenge_id_fkey;

ALTER TABLE challenge_tickets ADD CONSTRAINT challenge_tickets_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- ========================================
-- Step 8: UserChallenge 테이블 수정
-- ========================================
ALTER TABLE user_challenges RENAME COLUMN challenge_id TO product_id;

ALTER TABLE user_challenges DROP CONSTRAINT IF EXISTS user_challenges_challenge_id_fkey;

ALTER TABLE user_challenges ADD CONSTRAINT user_challenges_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- ========================================
-- Step 9: UserChallengeSurveyResult 테이블 수정
-- ========================================
ALTER TABLE user_challenge_survey_results RENAME COLUMN challenge_id TO product_id;

ALTER TABLE user_challenge_survey_results DROP CONSTRAINT IF EXISTS user_challenge_survey_results_challenge_id_fkey;

ALTER TABLE user_challenge_survey_results ADD CONSTRAINT user_challenge_survey_results_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS user_challenge_survey_results_user_id_challenge_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS user_challenge_survey_results_user_id_product_id_key
  ON user_challenge_survey_results(user_id, product_id);

DROP INDEX IF EXISTS user_challenge_survey_results_challenge_id_idx;
CREATE INDEX IF NOT EXISTS user_challenge_survey_results_product_id_idx
  ON user_challenge_survey_results(product_id);

-- ========================================
-- Step 10: ChallengeProduct 테이블 제거
-- ========================================
-- 챌린지 자체가 상품이므로 중간 테이블 불필요
DROP TABLE IF EXISTS challenge_products CASCADE;

-- ========================================
-- Step 11: Challenge 테이블 제거
-- ========================================
-- 모든 FK가 제거되었으므로 안전하게 삭제 가능
DROP TABLE IF EXISTS challenges CASCADE;

COMMIT;

-- ========================================
-- 마이그레이션 완료
-- ========================================
-- 다음 단계:
-- 1. 서비스 코드에서 Challenge 모델 참조 제거
-- 2. Product 기반 코드로 변경
-- 3. 챌린지 상품 데이터 추가 (metadata 포함)
-- ========================================
