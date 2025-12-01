-- 영양제 기록 중복 방지를 위한 UNIQUE 인덱스 추가
-- user_id, record_type, date, productId 조합으로 중복 방지
--
-- 배경:
-- - 멀티 파드 환경에서 영양제 배치가 중복 실행되어 동일한 데이터가 여러 번 생성됨
-- - Kubernetes CronJob으로 전환했지만, 만약의 경우를 대비한 DB 레벨 방어 로직
--
-- 효과:
-- - 동일한 사용자, 날짜, 영양제에 대해 하나의 레코드만 존재 보장
-- - createMany의 skipDuplicates 옵션과 함께 사용하여 안전한 배치 실행
--
-- 작성일: 2025-12-01

CREATE UNIQUE INDEX IF NOT EXISTS user_records_supplement_unique
ON user_records (
  user_id,
  record_type,
  date,
  ((metadata->>'productId')::int)
)
WHERE record_type = 'SUPPLEMENT';

-- 인덱스 생성 확인
COMMENT ON INDEX user_records_supplement_unique IS '영양제 기록 중복 방지 (user_id + date + productId)';
