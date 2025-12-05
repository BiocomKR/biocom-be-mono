-- Order 테이블에 플레이오토 필드 추가
ALTER TABLE orders ADD COLUMN IF NOT EXISTS playauto_uniq VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS playauto_bundle_no VARCHAR(50);

-- PlayautoApiLog 테이블 생성
CREATE TABLE IF NOT EXISTS playauto_api_logs (
  id SERIAL PRIMARY KEY,
  order_id INTEGER,
  endpoint VARCHAR(200) NOT NULL,
  method VARCHAR(10) NOT NULL,
  request_data JSONB,
  response_data JSONB,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS playauto_api_logs_order_id_idx ON playauto_api_logs(order_id);
CREATE INDEX IF NOT EXISTS playauto_api_logs_status_idx ON playauto_api_logs(status);
CREATE INDEX IF NOT EXISTS playauto_api_logs_created_at_idx ON playauto_api_logs(created_at);
