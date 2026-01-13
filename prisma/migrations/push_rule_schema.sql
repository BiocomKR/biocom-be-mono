-- =====================================================
-- 푸시 알림 조건 기반 발송 스키마 마이그레이션
-- 작성일: 2026-01-13
-- 작성자: 엄신우
-- =====================================================

-- 1. PushToken 테이블에 bundle_id 추가 (dev/prod 앱 구분용)
-- -----------------------------------------------------
ALTER TABLE push_tokens
ADD COLUMN bundle_id VARCHAR(100) NULL;

-- 기존 토큰은 prod로 간주 (또는 NULL 유지)
-- UPDATE push_tokens SET bundle_id = 'com.biocom.challenge' WHERE bundle_id IS NULL;

COMMENT ON COLUMN push_tokens.bundle_id IS '앱 번들 ID (com.biocom.challenge / com.biocom.challenge.dev)';


-- 2. PushRule 테이블 생성
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS push_rules (
    id SERIAL PRIMARY KEY,

    -- 푸시 식별 코드 (이벤트 수집용, 유니크)
    push_code VARCHAR(100) NOT NULL UNIQUE,

    -- 규칙 이름 (어드민용)
    name VARCHAR(100) NOT NULL,

    -- 설명
    description VARCHAR(500),

    -- 조건 타입 (ConditionType enum)
    -- ONBOARDING_STATE, CHALLENGE_STATUS, CHALLENGE_DAY, CHALLENGE_START_OFFSET_DAYS,
    -- NO_ACCESS_HOURS, INCOMPLETE_COUNT, INCOMPLETE_TYPES, COMPLETION_RATE,
    -- REPORT_STATE, POINTS, COUPON_EXPIRING_HOURS, CART_HAS_ITEMS
    condition_type VARCHAR(50) NOT NULL,

    -- 조건 파라미터 (JSON)
    -- 예: { "day": 7 }, { "hours": 24 }, { "types": ["LECTURE"], "exclusive": true }
    condition_params JSONB NOT NULL DEFAULT '{}',

    -- 랜딩 타입 (LandingType enum)
    -- HOME, LECTURE, MISSION_RECORD, SOLUTION, CART, SURVEY_ONBOARDING, etc.
    landing_type VARCHAR(50) NOT NULL,

    -- 랜딩 파라미터 (JSON, nullable)
    -- 예: { "day": 7 }, { "missionType": "FOOD" }
    landing_params JSONB,

    -- 페르소나별 메시지 (JSON)
    -- { "default": { "title": "...", "body": "..." }, "STELLA": {...}, "MAEVE": {...}, ... }
    messages JSONB NOT NULL,

    -- 발송 시점 (PushSendTime enum)
    -- AT_07, AT_18, ON_FIRST_18_AFTER_EXIT, ON_24H_ELAPSED, ON_48H_ELAPSED, etc.
    send_time VARCHAR(50) NOT NULL,

    -- 발신자 타입 (BIOCOM | PERSONA)
    sender_type VARCHAR(20) NOT NULL DEFAULT 'PERSONA',

    -- 활성화 여부
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- 생성/수정일시
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_push_rules_condition_type ON push_rules(condition_type);
CREATE INDEX idx_push_rules_is_active ON push_rules(is_active);
CREATE INDEX idx_push_rules_send_time ON push_rules(send_time);

-- 코멘트
COMMENT ON TABLE push_rules IS '푸시 발송 규칙 (조건 + 메시지 + 랜딩)';
COMMENT ON COLUMN push_rules.push_code IS '푸시 식별 코드 (이벤트 수집용)';
COMMENT ON COLUMN push_rules.condition_type IS '조건 타입 (ConditionType enum)';
COMMENT ON COLUMN push_rules.condition_params IS '조건 파라미터 (JSON)';
COMMENT ON COLUMN push_rules.landing_type IS '랜딩 타입 (LandingType enum)';
COMMENT ON COLUMN push_rules.landing_params IS '랜딩 파라미터 (JSON)';
COMMENT ON COLUMN push_rules.messages IS '페르소나별 메시지 (JSON)';
COMMENT ON COLUMN push_rules.send_time IS '발송 시점 (PushSendTime enum)';
COMMENT ON COLUMN push_rules.sender_type IS '발신자 타입 (BIOCOM | PERSONA)';


-- 3. PushNotificationLog에 중복 방지용 유니크 제약 추가 (선택)
-- -----------------------------------------------------
-- 동일 유저에게 같은 pushCode로 같은 날 중복 발송 방지
-- ALTER TABLE push_notification_logs
-- ADD COLUMN scheduled_date DATE;

-- CREATE UNIQUE INDEX idx_push_logs_idempotent
-- ON push_notification_logs(user_id, push_code, scheduled_date)
-- WHERE push_code IS NOT NULL AND scheduled_date IS NOT NULL;
