-- Files 마스터 테이블 생성
-- 모든 파일 정보를 중앙에서 관리하는 마스터 테이블

CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  storage_type VARCHAR(50) DEFAULT 'local' NOT NULL,
  uploaded_by INT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT TIMEZONE('Asia/Seoul', NOW()) NOT NULL,
  updated_at TIMESTAMP,

  CONSTRAINT fk_files_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT uq_files_stored_name
    UNIQUE (stored_name)
);

CREATE INDEX idx_files_mime_type ON files(mime_type);
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX idx_files_is_active ON files(is_active);
CREATE INDEX idx_files_created_at ON files(created_at);

COMMENT ON TABLE files IS '파일 마스터 테이블 - 모든 파일 정보 중앙 관리';
COMMENT ON COLUMN files.original_name IS '원본 파일명';
COMMENT ON COLUMN files.stored_name IS '저장된 파일명 (unique)';
COMMENT ON COLUMN files.file_path IS '파일 저장 경로 또는 URL';
COMMENT ON COLUMN files.file_size IS '파일 크기 (bytes)';
COMMENT ON COLUMN files.mime_type IS 'MIME 타입';
COMMENT ON COLUMN files.storage_type IS '저장소 타입 (local, gcs, s3 등)';
COMMENT ON COLUMN files.uploaded_by IS '업로더 user_id (nullable - 시스템 업로드 가능)';
COMMENT ON COLUMN files.is_active IS '활성 상태';
