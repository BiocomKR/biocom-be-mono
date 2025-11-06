-- lecture_products 테이블에 날짜 컬럼 추가
-- 작성일: 2025-11-06
-- 사유: 데이터 변경 이력 추적 및 감사 목적

-- created_at 컬럼 추가 (기본값: 현재 시각)
ALTER TABLE lecture_products
ADD COLUMN created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP;

-- updated_at 컬럼 추가 (기본값: 현재 시각)
ALTER TABLE lecture_products
ADD COLUMN updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP;

-- updated_at 자동 업데이트 트리거 생성
CREATE OR REPLACE FUNCTION update_lecture_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_lecture_products_updated_at
    BEFORE UPDATE ON lecture_products
    FOR EACH ROW
    EXECUTE FUNCTION update_lecture_products_updated_at();
