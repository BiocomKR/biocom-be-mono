# EventPeriod를 Event로 변경하는 마이그레이션 가이드

## 개요
이 문서는 `EventPeriod` 모델을 `Event`로 변경하는 마이그레이션 과정을 설명합니다.

## 변경 사항
1. 모델명: `EventPeriod` → `Event`
2. 테이블명: `event_periods` → `events`
3. 모든 관련 타입과 서비스명 업데이트

## 데이터베이스 마이그레이션 SQL

다음 SQL을 데이터베이스에서 직접 실행하세요:

```sql
-- 테이블 이름 변경
ALTER TABLE "event_periods" RENAME TO "events";
```

## 코드 변경 사항 (완료됨)
1. ✅ Prisma 스키마 파일 수정 (`prisma/schema.prisma`)
   - `model EventPeriod` → `model Event`
   - `@@map("event_periods")` → `@@map("events")`
   - 모든 외래키 관계 업데이트

2. ✅ 서비스 파일 리네임
   - `event-period.service.ts` → `event.service.ts`
   - `EventPeriodService` → `EventService`

3. ✅ 타입 정의 수정 (`event.types.ts`)
   - `EventPeriodWithRelations` → `EventWithRelations`

4. ✅ 모든 import와 의존성 업데이트
   - 모든 컨트롤러와 서비스에서 EventService 사용
   - event-period.types → event.types

5. ✅ PrismaService 수정
   - `get eventPeriod()` → `get event()`

## 마이그레이션 실행 방법

1. 데이터베이스 백업 (중요!)
   ```bash
   pg_dump -h [호스트] -U [사용자] -d biocom > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. SQL 실행
   ```bash
   psql -h [호스트] -U [사용자] -d biocom -c 'ALTER TABLE "event_periods" RENAME TO "events";'
   ```

3. 서버 재시작
   ```bash
   npm run start:dev
   ```

## 확인 사항
- 모든 API 엔드포인트가 정상 작동하는지 확인
- 기존 데이터가 올바르게 유지되는지 확인
- 관련 테이블의 외래키가 정상 작동하는지 확인

## 롤백 방법
문제가 발생한 경우:
```sql
-- 테이블 이름을 원래대로 복원
ALTER TABLE "events" RENAME TO "event_periods";
```

그리고 이전 코드로 롤백하세요.