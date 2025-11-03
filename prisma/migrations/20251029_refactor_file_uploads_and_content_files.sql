-- Step 1: 기존 FileUpload 데이터를 Files 테이블로 마이그레이션
INSERT INTO files (
  original_name, stored_name, file_path, file_size, mime_type,
  storage_type, created_at
)
SELECT
  original_name,
  filename,
  path,
  size,
  mimetype,
  'local',
  uploaded_at
FROM file_uploads
WHERE NOT EXISTS (
  SELECT 1 FROM files WHERE stored_name = file_uploads.filename
);

-- Step 2: 기존 ContentFile 데이터를 Files 테이블로 마이그레이션
INSERT INTO files (
  original_name, stored_name, file_path, file_size, mime_type,
  storage_type, created_at
)
SELECT
  file_name,
  SUBSTRING(file_url FROM '[^/]+$'), -- URL에서 파일명 추출
  file_url,
  file_size,
  mime_type,
  'gcs',
  created_at
FROM content_files
WHERE NOT EXISTS (
  SELECT 1 FROM files WHERE file_path = content_files.file_url
);

-- Step 3: FileUpload 테이블에 file_id 컬럼 추가 (이미 있으면 스킵)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_uploads' AND column_name='file_id') THEN
    ALTER TABLE file_uploads ADD COLUMN file_id INT;
  END IF;
END $$;

-- Step 4: FileUpload의 file_id를 Files 테이블의 id로 매핑
UPDATE file_uploads fu
SET file_id = f.id
FROM files f
WHERE f.stored_name = fu.filename AND fu.file_id IS NULL;

-- Step 5: FileUpload file_id를 NOT NULL로 변경 및 FK 추가
ALTER TABLE file_uploads
ALTER COLUMN file_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_file_uploads_file') THEN
    ALTER TABLE file_uploads ADD CONSTRAINT fk_file_uploads_file
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 6: FileUpload에서 중복 파일정보 컬럼 제거
ALTER TABLE file_uploads
DROP COLUMN IF EXISTS original_name,
DROP COLUMN IF EXISTS filename,
DROP COLUMN IF EXISTS mimetype,
DROP COLUMN IF EXISTS size,
DROP COLUMN IF EXISTS path;

-- Step 7: ContentFile 테이블에 file_id 컬럼 추가 (이미 있으면 스킵)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='content_files' AND column_name='file_id') THEN
    ALTER TABLE content_files ADD COLUMN file_id INT;
  END IF;
END $$;

-- Step 8: ContentFile의 file_id를 Files 테이블의 id로 매핑
UPDATE content_files cf
SET file_id = f.id
FROM files f
WHERE f.file_path = cf.file_url AND cf.file_id IS NULL;

-- Step 9: ContentFile file_id를 NOT NULL로 변경 및 FK 추가
ALTER TABLE content_files
ALTER COLUMN file_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_content_files_file') THEN
    ALTER TABLE content_files ADD CONSTRAINT fk_content_files_file
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 10: ContentFile에서 중복 파일정보 컬럼 제거
ALTER TABLE content_files
DROP COLUMN IF EXISTS file_url,
DROP COLUMN IF EXISTS file_name,
DROP COLUMN IF EXISTS file_size,
DROP COLUMN IF EXISTS mime_type;

-- Step 11: 인덱스 추가 (이미 있으면 스킵)
CREATE INDEX IF NOT EXISTS idx_file_uploads_file_id ON file_uploads(file_id);
CREATE INDEX IF NOT EXISTS idx_content_files_file_id ON content_files(file_id);

COMMENT ON COLUMN file_uploads.file_id IS 'Files 마스터 테이블 참조';
COMMENT ON COLUMN content_files.file_id IS 'Files 마스터 테이블 참조';
