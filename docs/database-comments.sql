-- =====================================================
-- 데이터베이스 테이블 및 컬럼 COMMENT 설정
-- 
-- 작성일: 2025-07-24
-- 용도: Prisma가 DB 레벨 COMMENT를 지원하지 않아 수동으로 실행 필요
-- 
-- 사용법:
-- 1. 개발 DB: psql "postgresql://biocom:bico0724%21%40%23@43.200.68.96:5432/biocom" -f docs/database-comments.sql
-- 2. 운영 DB: 추후 운영 DB 생성 시 동일하게 실행
-- =====================================================

-- =====================================================
-- users 테이블
-- =====================================================
COMMENT ON TABLE users IS '사용자 테이블 - 애플리케이션의 모든 사용자 정보를 저장';
COMMENT ON COLUMN users.id IS '사용자 고유 식별자';
COMMENT ON COLUMN users.email IS '사용자 이메일 (로그인 ID로 사용)';
COMMENT ON COLUMN users.password IS '암호화된 비밀번호';
COMMENT ON COLUMN users.nickname IS '사용자 닉네임';
COMMENT ON COLUMN users.created_at IS '계정 생성 일시';
COMMENT ON COLUMN users.updated_at IS '정보 수정 일시';

-- =====================================================
-- file_uploads 테이블
-- =====================================================
COMMENT ON TABLE file_uploads IS '파일 업로드 테이블 - 사용자가 업로드한 파일 정보를 저장';
COMMENT ON COLUMN file_uploads.id IS '파일 고유 식별자';
COMMENT ON COLUMN file_uploads.user_id IS '업로드한 사용자 ID';
COMMENT ON COLUMN file_uploads.original_name IS '원본 파일명';
COMMENT ON COLUMN file_uploads.filename IS '저장된 파일명';
COMMENT ON COLUMN file_uploads.mimetype IS '파일 MIME 타입';
COMMENT ON COLUMN file_uploads.size IS '파일 크기 (bytes)';
COMMENT ON COLUMN file_uploads.path IS '파일 저장 경로';
COMMENT ON COLUMN file_uploads.uploaded_at IS '업로드 일시';
COMMENT ON COLUMN file_uploads.file_type IS '파일 타입 분류';
COMMENT ON COLUMN file_uploads.upload_category IS '업로드 카테고리';

-- =====================================================
-- imweb_info 테이블
-- =====================================================
COMMENT ON TABLE imweb_info IS '아임웹 사이트 정보 테이블 - 아임웹 API 연동을 위한 인증 정보 저장';
COMMENT ON COLUMN imweb_info.id IS '고유 식별자';
COMMENT ON COLUMN imweb_info.name IS '아임웹 사이트 이름 (관리용)';
COMMENT ON COLUMN imweb_info.client_id IS '아임웹 OAuth 클라이언트 ID';
COMMENT ON COLUMN imweb_info.client_secret IS '아임웹 OAuth 클라이언트 Secret';
COMMENT ON COLUMN imweb_info.site_code IS '아임웹 사이트 코드 (고유값, API 호출 시 사용)';
COMMENT ON COLUMN imweb_info.redirect_uri IS 'OAuth 인가 코드 수신용 콜백 URI';
COMMENT ON COLUMN imweb_info.scope IS 'API 사용 권한 범위 (예: member-info:read site-info:write)';
COMMENT ON COLUMN imweb_info.access_token IS '아임웹 API 액세스 토큰 (2시간 유효)';
COMMENT ON COLUMN imweb_info.refresh_token IS '아임웹 API 리프레시 토큰 (90일 유효)';
COMMENT ON COLUMN imweb_info.created_at IS '생성 일시';
COMMENT ON COLUMN imweb_info.updated_at IS '수정 일시 (최초 생성 시 null)';

-- =====================================================
-- 추가 테이블이 생성되면 여기에 COMMENT 추가
-- =====================================================