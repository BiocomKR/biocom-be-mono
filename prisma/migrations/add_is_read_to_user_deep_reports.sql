-- user_deep_reports 테이블에 읽음 여부 컬럼 추가
-- 기본값: false (미확인 상태)
ALTER TABLE user_deep_reports
ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;

-- 기존 데이터는 모두 읽음 처리 (이미 조회한 것으로 간주)
UPDATE user_deep_reports SET is_read = true WHERE is_read = false;

COMMENT ON COLUMN user_deep_reports.is_read IS '리포트 읽음 여부 (true: 확인, false: 미확인)';
