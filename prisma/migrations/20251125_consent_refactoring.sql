-- =============================================
-- 약관 시스템 리팩토링 마이그레이션
-- 실행일: 2025-11-25
-- =============================================

-- 1. consents 테이블 생성
CREATE TABLE IF NOT EXISTS consents (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    version VARCHAR(20) NOT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP(6) DEFAULT NOW(),
    deleted_at TIMESTAMP(6),
    CONSTRAINT consents_code_version_unique UNIQUE (code, version)
);

CREATE INDEX idx_consents_code_is_active ON consents (code, is_active);

-- 2. 기본 약관 데이터 삽입 (5개)
INSERT INTO consents (code, title, version, is_required, is_active, display_order) VALUES
('SERVICE_TERMS', '서비스 이용약관', '1.0', TRUE, TRUE, 1),
('AGE_14', '만 14세 이상 확인', '1.0', TRUE, TRUE, 2),
('PRIVACY', '개인정보 수집 및 이용 동의', '1.0', TRUE, TRUE, 3),
('THIRD_PARTY', '제3자 정보 제공 동의', '1.0', FALSE, TRUE, 4),
('MARKETING', '마케팅 알림 수신 동의', '1.0', FALSE, TRUE, 5);

-- 3. 기존 user_consents 데이터 백업
CREATE TABLE user_consents_backup AS SELECT * FROM user_consents;

-- 4. user_consents 테이블 구조 변경
-- 4-1. 기존 컬럼 삭제
ALTER TABLE user_consents DROP COLUMN IF EXISTS agree_to_terms;
ALTER TABLE user_consents DROP COLUMN IF EXISTS agree_to_age14;
ALTER TABLE user_consents DROP COLUMN IF EXISTS agree_to_privacy;
ALTER TABLE user_consents DROP COLUMN IF EXISTS agree_to_third_party;
ALTER TABLE user_consents DROP COLUMN IF EXISTS agree_to_marketing;
ALTER TABLE user_consents DROP COLUMN IF EXISTS updated_at;

-- 4-2. 새 컬럼 추가
ALTER TABLE user_consents ADD COLUMN consent_id INT;
ALTER TABLE user_consents ADD COLUMN is_agreed BOOLEAN;

-- 5. 기존 데이터 마이그레이션 (user_id 25, 29)
-- 기존 레코드 삭제 후 새 구조로 재삽입

-- user_id 25: 전체 동의
DELETE FROM user_consents WHERE user_id = 25;
INSERT INTO user_consents (user_id, consent_id, is_agreed, agreed_at, created_at)
SELECT 25, id, TRUE, '2025-11-13 00:57:53', '2025-11-13 00:57:53.095'
FROM consents WHERE is_active = TRUE;

-- user_id 29: 필수만 동의, 선택 거부
DELETE FROM user_consents WHERE user_id = 29;
INSERT INTO user_consents (user_id, consent_id, is_agreed, agreed_at, created_at)
SELECT 29, id,
    CASE WHEN is_required = TRUE THEN TRUE ELSE FALSE END,
    '2025-11-18 18:42:57', '2025-11-18 18:42:57.780'
FROM consents WHERE is_active = TRUE;

-- 6. 제약조건 추가
ALTER TABLE user_consents ALTER COLUMN consent_id SET NOT NULL;
ALTER TABLE user_consents ALTER COLUMN is_agreed SET NOT NULL;

ALTER TABLE user_consents ADD CONSTRAINT fk_user_consents_consent_id
    FOREIGN KEY (consent_id) REFERENCES consents(id);

ALTER TABLE user_consents ADD CONSTRAINT user_consents_user_id_consent_id_unique
    UNIQUE (user_id, consent_id);

CREATE INDEX idx_user_consents_consent_id ON user_consents (consent_id);

-- 완료 메시지
-- 백업 테이블: user_consents_backup (필요시 삭제)
