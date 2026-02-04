# 📚 데이터베이스 설정 가이드

> 작성일: 2025-07-24  
> 작성자: 최대길

## 🗄️ DB 환경 구성

### 개발 환경
- **Host**: 43.200.68.96
- **Port**: 5432
- **Database**: biocom
- **Username**: biocom
- **Password**: bico0724!@#

### 운영 환경
- **Host**: TBD
- **Port**: 5432
- **Database**: TBD
- **Username**: TBD
- **Password**: TBD

## 🚀 초기 설정 방법

### 1. DB 및 사용자 생성 (PostgreSQL)

```sql
-- DB 생성
CREATE DATABASE biocom;

-- 사용자 생성
CREATE USER biocom WITH PASSWORD 'bico0724!@#';

-- 권한 부여
GRANT ALL PRIVILEGES ON DATABASE biocom TO biocom;

-- biocom DB로 전환
\c biocom

-- public 스키마 권한 부여
GRANT ALL ON SCHEMA public TO biocom;
GRANT CREATE ON SCHEMA public TO biocom;
```

### 2. Prisma 스키마 적용

```bash
# .env 파일에 DATABASE_URL 설정 확인
DATABASE_URL="postgresql://biocom:bico0724%21%40%23@43.200.68.96:5432/biocom"

# 스키마 적용
npx prisma db push
```

### 3. 테이블 COMMENT 추가

Prisma는 DB 레벨 COMMENT를 지원하지 않으므로 수동으로 실행해야 합니다.

```bash
# 개발 DB
psql "postgresql://biocom:bico0724%21%40%23@43.200.68.96:5432/biocom" -f docs/database-comments.sql

# 운영 DB (추후)
psql "postgresql://운영DB정보" -f docs/database-comments.sql
```

## 📝 주의사항

1. **비밀번호 특수문자 인코딩**
   - `!` → `%21`
   - `@` → `%40`
   - `#` → `%23`

2. **새 테이블 추가 시**
   - `prisma/schema.prisma`에 모델 추가
   - `npx prisma db push` 실행
   - `docs/database-comments.sql`에 COMMENT 추가
   - COMMENT SQL 실행

3. **환경별 설정 파일**
   - `.env` - 기본 개발 환경
   - `.env.development` - 개발 환경 명시
   - `.env.production` - 운영 환경 (별도 관리)

## 🔍 DB 접속 방법

### PostgreSQL 클라이언트
```bash
psql "postgresql://biocom:bico0724%21%40%23@43.200.68.96:5432/biocom"
```

### Docker 컨테이너 접속
```bash
# EC2 SSH 접속
ssh -i a.pem ubuntu@43.200.68.96

# PostgreSQL 컨테이너 접속
docker exec -it a2ce8ef4f576 psql -U challenger -d biocom
```

## 📊 테이블 구조 확인

```sql
-- 테이블 목록
\dt

-- 테이블 상세 (COMMENT 포함)
\dt+ imweb_info

-- 컬럼 정보 (COMMENT 포함)
\d+ imweb_info
```