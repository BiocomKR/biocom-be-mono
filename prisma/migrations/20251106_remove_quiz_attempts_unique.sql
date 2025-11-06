-- 퀴즈 재시도 허용을 위한 UNIQUE 제약 제거
-- quiz_attempts 테이블의 (user_id, quiz_id) UNIQUE 제약 삭제
-- 작성일: 2025-11-06
-- 사유: 강의 퀴즈는 언제든지 다시 풀 수 있어야 함 (포인트는 최초 1회만 지급)

-- UNIQUE 제약 제거
ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_user_id_quiz_id_key;

-- 확인용 주석
-- 제거 후에도 인덱스는 유지됨: (user_id, quiz_id) 조합으로 빠른 조회 가능
-- 재시도 허용: 같은 사용자가 같은 퀴즈를 여러 번 시도 가능
-- 포인트 지급: Service 로직에서 최초 1회만 지급 제어
