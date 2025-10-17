-- 챌린지 반복 수행 가능하도록 UNIQUE 제약 수정
-- 기존: (userId, status) 조합 전체 유니크 → 한 번만 완료 가능 ❌
-- 수정: status='ACTIVE'일 때만 유니크 → 여러 번 완료 가능 ✅

-- 1. 기존 UNIQUE INDEX 삭제 (Prisma가 생성한 인덱스)
DROP INDEX IF EXISTS user_challenges_user_id_status_key;

-- 2. Partial UNIQUE Index 생성 (status='ACTIVE'인 경우만)
CREATE UNIQUE INDEX IF NOT EXISTS user_challenges_active_unique
ON user_challenges(user_id)
WHERE status = 'ACTIVE';

-- 설명:
-- - 사용자는 동시에 하나의 ACTIVE 챌린지만 가능
-- - COMPLETED, EXPIRED 상태는 여러 개 가능 (반복 챌린지 수행)
-- - PostgreSQL의 Partial Index 기능 활용
--
-- ✅ 적용 완료: 2025-10-15
