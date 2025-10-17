-- 주문 테이블 보안 강화 마이그레이션
-- 1. 컬럼명 변경: recipient_phone -> recipient_mobile
-- 2. 개인정보 암호화를 위한 컬럼 크기 확대

-- Step 1: recipient_phone 컬럼명 변경
ALTER TABLE "orders"
RENAME COLUMN "recipient_phone" TO "recipient_mobile";

-- Step 2: 암호화를 위한 컬럼 크기 확대
-- recipient_name: VARCHAR(100) -> VARCHAR(255)
ALTER TABLE "orders"
ALTER COLUMN "recipient_name" TYPE VARCHAR(255);

-- address: VARCHAR(255) -> VARCHAR(500) (암호화 시 크기 증가)
ALTER TABLE "orders"
ALTER COLUMN "address" TYPE VARCHAR(500);

-- address_detail: VARCHAR(255) -> VARCHAR(500) (암호화 시 크기 증가)
ALTER TABLE "orders"
ALTER COLUMN "address_detail" TYPE VARCHAR(500);

-- Step 3: 주석 업데이트는 Prisma schema에서 관리
COMMENT ON COLUMN "orders"."recipient_name" IS '수령인명 (암호화)';
COMMENT ON COLUMN "orders"."recipient_mobile" IS '수령인 휴대폰번호 (암호화)';
COMMENT ON COLUMN "orders"."address" IS '주소 (암호화)';
COMMENT ON COLUMN "orders"."address_detail" IS '상세주소 (암호화)';
