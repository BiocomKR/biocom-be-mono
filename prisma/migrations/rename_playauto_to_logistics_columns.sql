-- Order 테이블에 logistics_provider 컬럼 추가
ALTER TABLE orders ADD COLUMN IF NOT EXISTS logistics_provider VARCHAR(50);

-- Order 테이블의 playauto 컬럼명을 logistics로 변경
ALTER TABLE orders RENAME COLUMN playauto_uniq TO logistics_uniq;
ALTER TABLE orders RENAME COLUMN playauto_bundle_no TO logistics_bundle_no;

-- 기존 데이터에 provider 값 설정 (playauto로 생성된 데이터)
UPDATE orders SET logistics_provider = 'PLAYAUTO' WHERE logistics_uniq IS NOT NULL;
