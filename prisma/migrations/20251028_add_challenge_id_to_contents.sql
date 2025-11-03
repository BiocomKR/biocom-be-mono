-- Contents 테이블에 challenge_id 컬럼 추가 (약한 관계/선택적 관계)
ALTER TABLE contents ADD COLUMN challenge_id INTEGER;

-- Foreign Key 제약조건 추가 (NULL 허용)
ALTER TABLE contents ADD CONSTRAINT contents_challenge_id_fkey 
  FOREIGN KEY (challenge_id) REFERENCES products(id) ON DELETE SET NULL;

-- 인덱스 추가 (조회 성능 향상)
CREATE INDEX idx_contents_challenge_id ON contents(challenge_id);

-- 주석 추가
COMMENT ON COLUMN contents.challenge_id IS '챌린지(상품) ID - NULL 허용 (전체 공개 컨텐츠용)';
