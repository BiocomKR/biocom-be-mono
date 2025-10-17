-- 챌린지 티켓 테이블에 구독 지원을 위한 컬럼 추가
-- ticketType: 이용권 타입 (CHALLENGE: 챌린지, SUBSCRIPTION: 구독)
-- startDate: 활성화 시작일
-- endDate: 만료일
-- challengeId를 nullable로 변경 (구독권은 challengeId 없음)

-- 1. ticketType 컬럼 추가 (기본값: CHALLENGE)
ALTER TABLE "challenge_tickets"
ADD COLUMN "ticket_type" VARCHAR(20) NOT NULL DEFAULT 'CHALLENGE';

-- 2. startDate, endDate 컬럼 추가
ALTER TABLE "challenge_tickets"
ADD COLUMN "start_date" TIMESTAMP(3),
ADD COLUMN "end_date" TIMESTAMP(3);

-- 3. challengeId를 nullable로 변경
ALTER TABLE "challenge_tickets"
ALTER COLUMN "challenge_id" DROP NOT NULL;

-- 4. 기존 인덱스 삭제
DROP INDEX IF EXISTS "challenge_tickets_userId_status_idx";

-- 5. 새 인덱스 생성 (ticketType 추가)
CREATE INDEX "challenge_tickets_userId_status_ticketType_idx"
ON "challenge_tickets"("user_id", "status", "ticket_type");

-- 6. 기존 데이터에 대한 처리 (필요시)
-- 기존 ACTIVE 상태의 챌린지 티켓에 대해 endDate 설정
-- UPDATE "challenge_tickets" ct
-- SET "end_date" = uc."expires_at"
-- FROM "user_challenges" uc
-- WHERE ct."id" = uc."ticket_id"
-- AND ct."status" = 'ACTIVE'
-- AND ct."end_date" IS NULL;
