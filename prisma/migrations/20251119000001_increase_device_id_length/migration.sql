-- Increase device_id column length to support FCM tokens
-- FCM 토큰이 deviceId로 사용될 수 있으므로 길이를 255로 증가

ALTER TABLE "push_tokens"
ALTER COLUMN "device_id" TYPE VARCHAR(255);
