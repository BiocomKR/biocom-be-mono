# 날짜/시간 버그 수정 작업일지 (2025-10-16)

## 🚨 문제 상황

### 핵심 문제
1. **DATE 필드 버그**: `startDate`에 "2025-10-20"을 저장하면 "2025-10-19"로 저장됨 (1일 차이)
2. **TIMESTAMP 필드 버그**: KST 시간 `2025-10-16 18:35:21`이 DB에 `2025-10-16 09:35:21`로 저장됨 (9시간 차이)

### 근본 원인
- Prisma ORM이 JavaScript Date 객체를 UTC로 처리
- PostgreSQL은 UTC 기준으로 날짜를 저장
- Prisma middleware에서 KST ↔ UTC 변환을 시도했으나 오히려 더 복잡해짐

### 사용자 요구사항
> "저장할때 KST로 저장하고 저장된값을 그냥 불러오는게 그렇게 힘든거냐?"
> "내가만든 미들웨어 싹다 없어도 돼. 이것만 해결된다면."

## ✅ 완료된 작업

### 1. Prisma Middleware 전체 비활성화
**파일**: `/src/common/services/prisma.service.ts`

#### 비활성화한 부분:
```typescript
// ❌ 기존: create 시 UTC 변환 (비활성화)
async create({ args, query, model }) {
  // args.data = convertDatesToUTC(args.data);
  const result = await query(args);
  // return convertDatesToKST(result);
  return result;
}

// ❌ 기존: update 시 UTC 변환 (비활성화)
async update({ args, query, model }) {
  // if (args.data) args.data = convertDatesToUTC(args.data);
  const result = await query(args);
  // return convertDatesToKST(result);
  return result;
}

// ❌ 기존: findUnique 시 KST 변환 (비활성화)
async findUnique({ args, query, model }) {
  const result = await query(args);
  // return result ? convertDatesToKST(result) : result;
  return result;
}

// ❌ 기존: findFirst 시 KST 변환 (비활성화)
async findFirst({ args, query, model }) {
  const result = await query(args);
  // return result ? convertDatesToKST(result) : result;
  return result;
}

// ❌ 기존: findMany 시 KST 변환 (비활성화)
async findMany({ args, query, model }) {
  const results = await query(args);
  // return results.map(result => convertDatesToKST(result));
  return results;
}

// ❌ 기존: upsert 시 변환 (비활성화)
async upsert({ args, query, model }) {
  // if (args.create) args.create = convertDatesToUTC(args.create);
  // if (args.update) args.update = convertDatesToUTC(args.update);
  const result = await query(args);
  // return convertDatesToKST(result);
  return result;
}
```

**위치**: Lines 104-186

### 2. 테스트용 테이블 생성
**파일**: `/prisma/schema.prisma`

```prisma
/// 날짜/시간 테스트용 테이블
/// DATE, TIMESTAMP 컬럼의 KST 저장/조회 테스트를 위한 테이블
model DateTimeTest {
  id          Int       @id @default(autoincrement())
  /// 테스트용 DATE 컬럼 (날짜만 저장)
  testDate    DateTime  @map("test_date") @db.Date
  /// 테스트용 TIMESTAMP 컬럼 (날짜 + 시간 저장)
  testTime    DateTime  @map("test_time")
  /// 메모
  memo        String?   @db.VarChar(200)
  /// 생성일시
  createdAt   DateTime  @default(now()) @map("created_at")

  @@map("datetime_tests")
}
```

**실행 명령어**:
```bash
npx prisma db push --skip-generate
npx prisma generate
```

**결과**: ✅ 테이블 생성 완료 (`datetime_tests`)

### 3. 테스트 API 엔드포인트 생성

#### 생성된 파일:
1. **Controller**: `/src/datetime-test/datetime-test.controller.ts`
   - `POST /api/datetime-test` - 날짜/시간 저장
   - `GET /api/datetime-test/:id` - 특정 데이터 조회
   - `GET /api/datetime-test` - 전체 데이터 조회

2. **Service**: `/src/datetime-test/datetime-test.service.ts`
   - `create()` - 저장 + 재조회 + 비교
   - `findOne()` - 단건 조회
   - `findAll()` - 전체 조회
   - 상세한 로깅 포함

3. **DTO**: `/src/datetime-test/dto/create-datetime-test.dto.ts`
   ```typescript
   {
     testDate: string;  // "2025-10-20"
     testTime: string;  // "2025-10-16T18:35:21+09:00"
     memo?: string;
   }
   ```

4. **Module**: `/src/datetime-test/datetime-test.module.ts`

5. **App Module 등록**: `/src/app.module.ts`
   ```typescript
   import { DateTimeTestModule } from './datetime-test/datetime-test.module';
   // ...
   imports: [
     // ...
     DateTimeTestModule, // 날짜/시간 테스트 모듈 (임시)
   ]
   ```

## ❌ 미완료 작업 (Typescript 컴파일 에러로 중단)

### 문제 상황
```
TS2339: Property 'dateTimeTest' does not exist on type 'PrismaService'.
```

#### 원인 분석:
1. Prisma Client는 정상 생성됨: `node_modules/.prisma/client/index.d.ts`에 `dateTimeTest` 존재 확인
   ```bash
   grep "dateTimeTest" node_modules/.prisma/client/index.d.ts
   # 결과: get dateTimeTest(): Prisma.DateTimeTestDelegate<ExtArgs, ClientOptions>;
   ```

2. 그러나 Typescript 컴파일러가 캐시 문제로 인식 못함
3. 다음 시도들 모두 실패:
   - `npx prisma generate` 재실행
   - 서버 재시작 (여러 번)
   - `rm -rf dist && npx nest build` (전체 재빌드)
   - 파일 touch로 재컴파일 트리거

### 시도한 해결 방법들:
1. ✅ Prisma Client 재생성
2. ✅ 서버 재시작 (여러 번)
3. ✅ dist 폴더 삭제 후 재빌드
4. ❌ Typescript 캐시 문제 해결 실패

## 📋 다음 작업 (내일)

### Option 1: Typescript 캐시 문제 해결
1. `node_modules/.prisma/client` 삭제 후 재생성
2. `tsconfig.json`의 `skipLibCheck` 확인
3. VS Code Typescript 서버 재시작
4. 최악의 경우 `node_modules` 전체 삭제 후 `npm install`

### Option 2: 더 간단한 접근 (추천!)
**직접 SQL 테스트 스크립트 작성**

```bash
# /scripts/test-datetime-direct.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDateTime() {
  console.log('=== KST 날짜/시간 저장 테스트 ===\n');

  // 1. 저장 테스트
  const testDate = '2025-10-20';
  const testTime = '2025-10-16T18:35:21+09:00';

  console.log('[저장 요청]');
  console.log(`testDate: ${testDate}`);
  console.log(`testTime: ${testTime}\n`);

  const result = await prisma.$executeRaw`
    INSERT INTO datetime_tests (test_date, test_time, memo, created_at)
    VALUES (${testDate}::date, ${testTime}::timestamptz, 'Direct SQL 테스트', NOW())
    RETURNING *;
  `;

  // 2. 조회 테스트
  const saved = await prisma.$queryRaw`
    SELECT * FROM datetime_tests ORDER BY id DESC LIMIT 1;
  `;

  console.log('[저장된 값]', saved);

  await prisma.$disconnect();
}

testDateTime().catch(console.error);
```

**실행**:
```bash
npx ts-node scripts/test-datetime-direct.ts
```

### Option 3: 기존 챌린지 API 수정하여 직접 테스트
1. `challenge.service.ts`의 `setStartDate()` 메서드 직접 테스트
2. 로그를 추가하여 저장 전/후 값 비교

## 🎯 최종 목표

1. **DATE 필드**: "2025-10-20" 입력 → DB에 "2025-10-20" 저장 ✅
2. **TIMESTAMP 필드**: "2025-10-16 18:35:21 KST" 입력 → DB에 "2025-10-16 18:35:21+09" 저장 ✅
3. **조회 시**: 저장된 값 그대로 반환 (변환 없음) ✅

## 📝 중요 참고사항

### Prisma와 날짜 처리 원칙
1. **JavaScript Date 객체는 항상 UTC 기준**
   - `new Date('2025-10-20')` → 실제로는 `2025-10-20T00:00:00.000Z` (UTC)
   - 한국 시간으로 표현하면 `2025-10-20 09:00:00 KST`

2. **PostgreSQL DATE 타입**
   - 시간 정보 없이 날짜만 저장
   - 타임존 정보 없음
   - Prisma가 Date 객체를 DATE 타입에 저장할 때 UTC 날짜 부분만 추출

3. **PostgreSQL TIMESTAMP 타입**
   - 기본적으로 타임존 정보 없음
   - `TIMESTAMPTZ` (timestamp with time zone)를 사용하면 타임존 저장

### 해결 방향
현재 Prisma middleware를 전부 비활성화했으므로:
- **저장 시**: 애플리케이션 레벨에서 KST 날짜/시간을 적절한 형식으로 변환 필요
- **조회 시**: DB에서 가져온 값을 그대로 사용
- **challenge-date.util.ts** 수정 필요

## 🔧 백그라운드 프로세스 정리 필요

현재 실행 중인 백그라운드 프로세스:
- `a13878`: npm run start:dev (첫 번째)
- `cd0e3c`: npm run start:dev (두 번째)
- `c3e1cc`: rm -rf dist && npx nest build && npm run start:dev (세 번째)

**내일 첫 작업**:
```bash
# 모든 프로세스 종료
lsof -ti:10804 | xargs kill -9

# 포트 확인
lsof -i :10804
```

---

**작성자**: Claude Code
**작성일**: 2025-10-16 18:46 KST
**다음 작업 예정**: 2025-10-17
