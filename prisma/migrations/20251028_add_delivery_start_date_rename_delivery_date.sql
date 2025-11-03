-- 챌린지 배송일 컬럼 정리
-- delivery_date → delivery_arrival_date (배송도착예정일)로 이름 변경
-- delivery_start_date (배송시작일) 컬럼 추가

-- 1. delivery_date 컬럼을 delivery_arrival_date로 이름 변경
ALTER TABLE user_challenges
RENAME COLUMN delivery_date TO delivery_arrival_date;

-- 2. delivery_start_date 컬럼 추가 (배송시작일)
ALTER TABLE user_challenges
ADD COLUMN delivery_start_date DATE;

-- 3. 컬럼 코멘트 추가
COMMENT ON COLUMN user_challenges.delivery_arrival_date IS '배송도착예정일 (배송 완료 예정일)';
COMMENT ON COLUMN user_challenges.delivery_start_date IS '배송시작일 (배송 출발일)';
