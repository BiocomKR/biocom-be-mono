-- file_uploads 테이블을 user_files로 리네이밍
-- 관계 테이블 명명 규칙에 맞게 변경 (userId + fileId → user_files)

ALTER TABLE file_uploads RENAME TO user_files;

-- 인덱스 리네이밍
ALTER INDEX idx_file_uploads_file_id RENAME TO idx_user_files_file_id;

-- FK 제약조건 리네이밍
ALTER TABLE user_files RENAME CONSTRAINT fk_file_uploads_file TO fk_user_files_file;

-- 코멘트 업데이트
COMMENT ON TABLE user_files IS '사용자 파일 관계 테이블';
COMMENT ON COLUMN user_files.file_id IS 'Files 마스터 테이블 참조';
