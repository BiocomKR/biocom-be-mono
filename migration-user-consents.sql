-- user_consents 테이블 생성
-- 사용자 약관 동의 내역 저장

CREATE TABLE IF NOT EXISTS user_consents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    agree_to_terms BOOLEAN NOT NULL,
    agree_to_age14 BOOLEAN NOT NULL,
    agree_to_privacy BOOLEAN NOT NULL,
    agree_to_third_party BOOLEAN NOT NULL,
    agree_to_marketing BOOLEAN NOT NULL,
    agreed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP,

    CONSTRAINT fk_user_consents_user_id FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX idx_user_consents_user_id ON user_consents(user_id);

-- 코멘트 추가
COMMENT ON TABLE user_consents IS '사용자 약관 동의 테이블';
COMMENT ON COLUMN user_consents.id IS 'PK';
COMMENT ON COLUMN user_consents.user_id IS '사용자 ID (FK)';
COMMENT ON COLUMN user_consents.agree_to_terms IS '[필수] 서비스 이용약관 동의';
COMMENT ON COLUMN user_consents.agree_to_age14 IS '[필수] 만 14세 이상 확인';
COMMENT ON COLUMN user_consents.agree_to_privacy IS '[필수] 개인정보 수집 이용 동의';
COMMENT ON COLUMN user_consents.agree_to_third_party IS '[선택] 제3자 정보 제공 동의';
COMMENT ON COLUMN user_consents.agree_to_marketing IS '[선택] 마케팅 알림 수신 동의';
COMMENT ON COLUMN user_consents.agreed_at IS '약관 동의 일시 (KST)';
COMMENT ON COLUMN user_consents.created_at IS '레코드 생성일시';
COMMENT ON COLUMN user_consents.updated_at IS '레코드 수정일시';
