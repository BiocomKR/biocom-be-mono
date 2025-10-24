-- 1. RecordItem 테이블 삭제 (missions 테이블과 중복으로 불필요)
-- 2. UserRecord 테이블 수정:
--    - recordCode → recordType으로 컬럼명 변경
--    - value, unit 컬럼 삭제 (metadata(JSON)에 모든 데이터 저장)
--    - RecordItem 외래키 제약 삭제

-- Step 1: UserRecord의 RecordItem 외래키 제약 삭제
ALTER TABLE user_records DROP CONSTRAINT IF EXISTS user_records_record_code_fkey;

-- Step 2: UserRecord 컬럼 변경
-- recordCode → recordType으로 변경
ALTER TABLE user_records RENAME COLUMN record_code TO record_type;

-- Step 3: value, unit 컬럼 삭제
ALTER TABLE user_records DROP COLUMN IF EXISTS value;
ALTER TABLE user_records DROP COLUMN IF EXISTS unit;

-- Step 4: 인덱스 재생성 (recordCode → recordType)
DROP INDEX IF EXISTS user_records_user_id_record_code_date_idx;
CREATE INDEX user_records_user_id_record_type_date_idx ON user_records(user_id, record_type, date);

-- Step 5: RecordItem 테이블 삭제
DROP TABLE IF EXISTS record_items;

-- 완료 확인
SELECT 'Migration completed: RecordItem 테이블 삭제 및 UserRecord 단순화 완료' AS status;
