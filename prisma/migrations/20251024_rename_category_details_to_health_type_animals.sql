-- 테이블명 변경: category_details -> health_type_animals
ALTER TABLE category_details RENAME TO health_type_animals;

-- 컬럼명 변경
ALTER TABLE health_type_animals RENAME COLUMN category_code TO health_type;
ALTER TABLE health_type_animals RENAME COLUMN category_type TO type_name;
ALTER TABLE health_type_animals RENAME COLUMN animal_character TO animal_name;
ALTER TABLE health_type_animals RENAME COLUMN character_keyword TO catchphrase;
ALTER TABLE health_type_animals RENAME COLUMN detailed_features TO symptoms;

-- 컬럼 타입 변경 (VarChar 길이 명시 및 Text 타입 변경)
ALTER TABLE health_type_animals ALTER COLUMN health_type TYPE VARCHAR(50);
ALTER TABLE health_type_animals ALTER COLUMN type_name TYPE VARCHAR(50);
ALTER TABLE health_type_animals ALTER COLUMN animal_name TYPE VARCHAR(50);
ALTER TABLE health_type_animals ALTER COLUMN catchphrase TYPE TEXT;
ALTER TABLE health_type_animals ALTER COLUMN symptoms TYPE TEXT;

-- 기존 데이터가 있다면 모두 삭제 (새로운 시드 데이터로 교체 예정)
TRUNCATE TABLE health_type_animals;
