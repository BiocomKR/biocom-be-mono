-- Files 테이블에서 uploaded_by 컬럼 제거
-- UserFile 관계 테이블로 충분하므로 중복 제거

-- FK 제약조건 먼저 제거
ALTER TABLE files
DROP CONSTRAINT IF EXISTS fk_files_uploaded_by;

-- 인덱스 제거
DROP INDEX IF EXISTS idx_files_uploaded_by;

-- 컬럼 제거
ALTER TABLE files
DROP COLUMN IF EXISTS uploaded_by;
