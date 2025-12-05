-- 관리자 활동 로그 테이블 (기존 operator_auth_logs 대체)
-- 모든 관리자 API 요청을 기록하여 감사 추적 가능

-- 1. 새 테이블 생성
CREATE TABLE operator_activity_logs (
    id SERIAL PRIMARY KEY,
    operator_id INT NULL,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(255) NOT NULL,
    action VARCHAR(50) NULL,
    status_code INT NOT NULL,
    ip VARCHAR(45) NULL,
    user_agent TEXT NULL,
    request_body TEXT NULL,
    duration INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_operator_activity_logs_operator
        FOREIGN KEY (operator_id)
        REFERENCES operators(id)
        ON DELETE SET NULL
);

-- 2. 인덱스 생성
CREATE INDEX idx_operator_activity_logs_operator_created
    ON operator_activity_logs(operator_id, created_at);
CREATE INDEX idx_operator_activity_logs_path_created
    ON operator_activity_logs(path, created_at);
CREATE INDEX idx_operator_activity_logs_action_created
    ON operator_activity_logs(action, created_at);
CREATE INDEX idx_operator_activity_logs_created
    ON operator_activity_logs(created_at);

-- 3. 기존 데이터 마이그레이션 (operator_auth_logs -> operator_activity_logs)
INSERT INTO operator_activity_logs (operator_id, method, path, action, status_code, ip, user_agent, duration, created_at)
SELECT
    operator_id,
    'POST' as method,
    '/api/auth/login' as path,
    action,
    200 as status_code,
    ip,
    user_agent,
    0 as duration,
    created_at
FROM operator_auth_logs;

-- 4. 기존 테이블 삭제 (데이터 마이그레이션 확인 후 실행)
-- DROP TABLE operator_auth_logs;

-- 참고: 기존 테이블 삭제는 데이터 마이그레이션 확인 후 수동으로 실행하세요
