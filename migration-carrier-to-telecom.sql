-- users 테이블의 carrier 컬럼을 telecom으로 변경
-- 통신사 필드명 통일

ALTER TABLE users RENAME COLUMN carrier TO telecom;

-- 코멘트 업데이트
COMMENT ON COLUMN users.telecom IS '통신사 코드 (SKT, KTF, LGT, SKM, KTM, LGM)';
