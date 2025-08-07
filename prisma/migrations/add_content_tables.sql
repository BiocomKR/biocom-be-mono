-- 컨텐츠 마스터 테이블 생성
CREATE TABLE IF NOT EXISTS contents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- 컨텐츠 인덱스
CREATE INDEX IF NOT EXISTS contents_type_is_active_idx ON contents(type, is_active);

-- 컨텐츠 첨부파일 테이블 생성
CREATE TABLE IF NOT EXISTS content_files (
    id SERIAL PRIMARY KEY,
    content_id INTEGER NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_content_files_content FOREIGN KEY (content_id) 
        REFERENCES contents(id) ON DELETE CASCADE
);

-- 컨텐츠 파일 인덱스
CREATE INDEX IF NOT EXISTS content_files_content_id_idx ON content_files(content_id);

-- 이벤트-컨텐츠 관계 테이블 생성
CREATE TABLE IF NOT EXISTS event_contents (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL,
    content_id INTEGER NOT NULL,
    day INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT fk_event_contents_event FOREIGN KEY (event_id) 
        REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_contents_content FOREIGN KEY (content_id) 
        REFERENCES contents(id) ON DELETE CASCADE,
    CONSTRAINT unique_event_day UNIQUE (event_id, day),
    CONSTRAINT unique_event_content_day UNIQUE (event_id, content_id, day)
);

-- 이벤트 컨텐츠 인덱스
CREATE INDEX IF NOT EXISTS event_contents_event_id_is_active_idx ON event_contents(event_id, is_active);
CREATE INDEX IF NOT EXISTS event_contents_content_id_idx ON event_contents(content_id);
CREATE INDEX IF NOT EXISTS event_contents_day_idx ON event_contents(day);