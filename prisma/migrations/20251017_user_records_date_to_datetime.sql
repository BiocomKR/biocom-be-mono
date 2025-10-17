-- 마이그레이션: user_records.date 컬럼을 VARCHAR(10)에서 DATE로 변경
-- 이유: KST 날짜 처리 문제 해결 후 원래 타입으로 복원
-- 작성일: 2025-10-17

-- Step 1: 기존 date 컬럼을 임시 컬럼으로 백업
ALTER TABLE user_records
ADD COLUMN date_temp VARCHAR(10);

UPDATE user_records
SET date_temp = date;

-- Step 2: 기존 date 컬럼 삭제
ALTER TABLE user_records
DROP COLUMN date;

-- Step 3: date 컬럼을 DATE 타입으로 재생성
ALTER TABLE user_records
ADD COLUMN date DATE;

-- Step 4: 데이터 복원 (VARCHAR → DATE 변환)
UPDATE user_records
SET date = date_temp::DATE
WHERE date_temp IS NOT NULL;

-- Step 5: 임시 컬럼 삭제
ALTER TABLE user_records
DROP COLUMN date_temp;

-- Step 6: NOT NULL 제약조건 추가
ALTER TABLE user_records
ALTER COLUMN date SET NOT NULL;
