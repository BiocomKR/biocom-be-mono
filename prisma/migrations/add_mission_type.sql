-- Mission 테이블에 type 필드 추가
ALTER TABLE missions 
ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'DAILY';

-- type 인덱스 추가
CREATE INDEX IF NOT EXISTS "missions_type_is_active_idx" ON missions(type, is_active);