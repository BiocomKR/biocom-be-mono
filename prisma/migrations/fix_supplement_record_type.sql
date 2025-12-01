-- 잘못된 record_type 수정: SUPPLEMENTS → SUPPLEMENT
--
-- 배경:
-- - 배치 코드에서 record_type을 'SUPPLEMENTS'로 잘못 생성
-- - 올바른 값은 'SUPPLEMENT' (단수형)
-- - 다른 모든 코드에서 'SUPPLEMENT' 사용
--
-- 영향:
-- - 배치로 생성된 영양제 기록들의 record_type 수정
--
-- 작성일: 2025-12-01

UPDATE user_records
SET record_type = 'SUPPLEMENT'
WHERE record_type = 'SUPPLEMENTS';

-- 확인
SELECT record_type, COUNT(*)
FROM user_records
GROUP BY record_type;
