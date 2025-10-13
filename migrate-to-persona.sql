-- AI 캐릭터 테이블을 AI 페르소나로 변경
ALTER TABLE ai_characters RENAME TO ai_personas;

-- avatar_url 컬럼을 persona_url로 변경
ALTER TABLE ai_personas RENAME COLUMN avatar_url TO persona_url;
