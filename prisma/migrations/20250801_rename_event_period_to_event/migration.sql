-- 테이블 이름 변경
ALTER TABLE "event_periods" RENAME TO "events";

-- 외래키 제약조건 이름 변경 (선택사항이지만 일관성을 위해 권장)
-- Event 테이블과 관련된 외래키들의 이름은 PostgreSQL이 자동으로 업데이트함