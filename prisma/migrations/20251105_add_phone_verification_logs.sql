-- 휴대폰 본인인증 로그 테이블 생성
-- NHN KCP SMS 인증 감사 로그 (법적 요구사항)

CREATE TABLE IF NOT EXISTS phone_verification_logs (
    id SERIAL PRIMARY KEY,
    cert_number VARCHAR(14) NOT NULL COMMENT '본인확인 거래번호 (KCP 발급)',
    phone_number VARCHAR(11) NOT NULL COMMENT '휴대폰 번호',
    telecom VARCHAR(3) NOT NULL COMMENT '통신사 코드 (SKT, KTF, LGT, SKM, KTM, LGM)',
    user_name VARCHAR(50) NOT NULL COMMENT '사용자 이름',
    birth_day VARCHAR(8) NOT NULL COMMENT '생년월일 (YYYYMMDD)',
    sex VARCHAR(1) NOT NULL COMMENT '성별 코드 (1: 남, 2: 여)',
    ci VARCHAR(500) COMMENT 'CI (개인 고유 연계정보)',
    di VARCHAR(500) COMMENT 'DI (업체별 중복가입 확인정보)',
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '인증 상태 (pending: 대기, completed: 완료, failed: 실패)',
    step VARCHAR(20) NOT NULL COMMENT '진행 단계 (identity: 실명확인, sms_sent: SMS발송, verified: 인증완료)',
    fail_reason TEXT COMMENT '실패 사유',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일시',
    updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일시'
);

-- 인덱스 생성
CREATE INDEX idx_phone_verification_logs_cert_number ON phone_verification_logs(cert_number);
CREATE INDEX idx_phone_verification_logs_phone_number ON phone_verification_logs(phone_number);
CREATE INDEX idx_phone_verification_logs_verification_status ON phone_verification_logs(verification_status);
CREATE INDEX idx_phone_verification_logs_created_at ON phone_verification_logs(created_at);

-- 테이블 코멘트
COMMENT ON TABLE phone_verification_logs IS 'NHN KCP 휴대폰 본인인증 로그 테이블 - 법적 감사 로그';
