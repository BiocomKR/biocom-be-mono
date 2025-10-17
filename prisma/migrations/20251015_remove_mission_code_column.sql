-- Mission 테이블 code 컬럼 제거 및 recordType 재구성
-- 날짜: 2025-10-15
-- 목적: code와 recordType 중복 제거, recordType을 유일한 식별자로 사용

-- 1. 기존 데이터 백업 (안전을 위해)
CREATE TABLE missions_backup_20251015 AS SELECT * FROM missions;

-- 2. 기존 미션 데이터 삭제 (깔끔하게 재시작)
DELETE FROM missions;

-- 3. code 컬럼 제거
ALTER TABLE missions DROP COLUMN IF EXISTS code;

-- 4. recordType을 NOT NULL로 변경 (모든 미션에 필수)
ALTER TABLE missions ALTER COLUMN record_type SET NOT NULL;

-- 5. recordType UNIQUE 제약 추가 (이미 있으면 스킵)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'missions_record_type_key'
    ) THEN
        ALTER TABLE missions ADD CONSTRAINT missions_record_type_key UNIQUE (record_type);
    END IF;
END $$;

-- 6. recordType 인덱스 생성
CREATE INDEX IF NOT EXISTS missions_record_type_idx ON missions(record_type);

-- 확인 쿼리
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'missions'
ORDER BY ordinal_position;
