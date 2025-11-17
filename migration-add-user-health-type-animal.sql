-- User 테이블에 health_type_animal_id 컬럼 추가
ALTER TABLE users ADD COLUMN health_type_animal_id INTEGER NULL;

-- 외래키 제약조건 추가
ALTER TABLE users
ADD CONSTRAINT fk_users_health_type_animal_id
FOREIGN KEY (health_type_animal_id)
REFERENCES health_type_animals(id)
ON DELETE SET NULL;
