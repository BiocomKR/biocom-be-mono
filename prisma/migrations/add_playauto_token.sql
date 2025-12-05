-- 플레이오토 인증 토큰 테이블 생성
-- 플레이오토 API 호출용 인증 토큰 관리 (24시간 유효)

CREATE TABLE IF NOT EXISTS playauto_tokens (
  id INTEGER PRIMARY KEY DEFAULT 1,
  token VARCHAR(500) NOT NULL,
  sol_no INTEGER NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ID가 1개만 존재하도록 제약
ALTER TABLE playauto_tokens ADD CONSTRAINT playauto_tokens_single_row CHECK (id = 1);
