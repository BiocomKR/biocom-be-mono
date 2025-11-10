-- 구독 및 빌링키 기능 추가 마이그레이션
-- 작성일: 2025-11-10
-- 작성자: Claude

-- 1. users 테이블에 빌링키 컬럼 추가
ALTER TABLE users
ADD COLUMN billing_key VARCHAR(200),
ADD COLUMN customer_key VARCHAR(200);

-- 2. subscriptions 테이블 생성
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    billing_key VARCHAR(200) NOT NULL,
    customer_key VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    start_date TIMESTAMP NOT NULL,
    next_billing_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    billing_cycle INTEGER NOT NULL DEFAULT 30,
    price INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. 인덱스 생성
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_billing_key ON subscriptions(billing_key);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_next_billing_date ON subscriptions(next_billing_date);

-- 4. 주석 추가
COMMENT ON TABLE subscriptions IS '구독 테이블 - 정기 구독 상품 관리 (자동결제)';
COMMENT ON COLUMN subscriptions.id IS '구독 ID';
COMMENT ON COLUMN subscriptions.user_id IS '사용자 ID';
COMMENT ON COLUMN subscriptions.product_id IS '구독 상품 ID';
COMMENT ON COLUMN subscriptions.billing_key IS '토스페이먼츠 빌링키 (자동결제 키)';
COMMENT ON COLUMN subscriptions.customer_key IS '토스페이먼츠 고객키';
COMMENT ON COLUMN subscriptions.status IS '구독 상태: ACTIVE/PAUSED/CANCELLED/BILLING_DELETED/PAYMENT_FAILED/EXPIRED';
COMMENT ON COLUMN subscriptions.start_date IS '구독 시작일';
COMMENT ON COLUMN subscriptions.next_billing_date IS '다음 결제 예정일';
COMMENT ON COLUMN subscriptions.end_date IS '구독 종료일 (취소 시)';
COMMENT ON COLUMN subscriptions.billing_cycle IS '결제 주기 (일 단위): 30=월구독, 90=3개월, 365=연구독';
COMMENT ON COLUMN subscriptions.price IS '구독 가격 (매 결제 금액)';

COMMENT ON COLUMN users.billing_key IS '토스페이먼츠 빌링키 (자동결제용)';
COMMENT ON COLUMN users.customer_key IS '토스페이먼츠 고객키 (사용자 식별자)';
