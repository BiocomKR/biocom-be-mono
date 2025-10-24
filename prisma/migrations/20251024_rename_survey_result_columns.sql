-- user_challenge_survey_results 테이블 컬럼명 일관성 개선
-- Category → HealthType, 점수 컬럼에 Score 접두사 추가

-- 1. Category → HealthType 변경
ALTER TABLE user_challenge_survey_results RENAME COLUMN before_category TO before_health_type;
ALTER TABLE user_challenge_survey_results RENAME COLUMN after_category TO after_health_type;

-- 2. Before 점수 컬럼명 변경 (Score 접두사 추가)
ALTER TABLE user_challenge_survey_results RENAME COLUMN before_skin_health_score TO before_score_skin_health;
ALTER TABLE user_challenge_survey_results RENAME COLUMN before_metabolism_score TO before_score_metabolism;
ALTER TABLE user_challenge_survey_results RENAME COLUMN before_immune_score TO before_score_immune;
ALTER TABLE user_challenge_survey_results RENAME COLUMN before_gut_health_score TO before_score_gut_health;
ALTER TABLE user_challenge_survey_results RENAME COLUMN before_total_score TO before_score_total;

-- 3. After 점수 컬럼명 변경 (Score 접두사 추가)
ALTER TABLE user_challenge_survey_results RENAME COLUMN after_skin_health_score TO after_score_skin_health;
ALTER TABLE user_challenge_survey_results RENAME COLUMN after_metabolism_score TO after_score_metabolism;
ALTER TABLE user_challenge_survey_results RENAME COLUMN after_immune_score TO after_score_immune;
ALTER TABLE user_challenge_survey_results RENAME COLUMN after_gut_health_score TO after_score_gut_health;
ALTER TABLE user_challenge_survey_results RENAME COLUMN after_total_score TO after_score_total;
