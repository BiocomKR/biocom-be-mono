# 쿼리 최적화 가이드라인

## 🚨 N+1 문제 방지

### ❌ 안티패턴: 반복문에서 개별 쿼리 실행

**절대 금지:**
```typescript
// ❌ BAD: 6개의 개별 쿼리 (N+1 문제)
const totalSent = await this.prisma.pushNotificationLog.count({ where: filter });
const successCount = await this.prisma.pushNotificationLog.count({ where: { success: true, ...filter } });
const failureCount = await this.prisma.pushNotificationLog.count({ where: { success: false, ...filter } });
const readCount = await this.prisma.pushNotificationLog.count({ where: { readAt: { not: null }, ...filter } });
const clickedCount = await this.prisma.pushNotificationLog.count({ where: { clickedAt: { not: null }, ...filter } });
const logsByType = await this.prisma.pushNotificationLog.groupBy({ by: ['type'], where: filter });

// 결과: 6번의 DB 왕복 = 느린 응답 시간 (170ms+)
```

### ✅ 권장: 단일 쿼리로 집계

**최적화된 방법:**
```typescript
// ✅ GOOD: 단일 쿼리로 모든 통계 조회
const statsQuery = `
  SELECT
    COUNT(*) as "totalSent",
    COUNT(*) FILTER (WHERE success = true) as "successCount",
    COUNT(*) FILTER (WHERE success = false) as "failureCount",
    COUNT(*) FILTER (WHERE "readAt" IS NOT NULL) as "readCount",
    COUNT(*) FILTER (WHERE "clickedAt" IS NOT NULL) as "clickedCount"
  FROM "PushNotificationLog"
  WHERE "sentAt" >= $1 AND "sentAt" <= $2
`;

const result = await this.prisma.$queryRawUnsafe<any[]>(statsQuery, startDate, endDate);

// 결과: 1번의 DB 왕복 = 빠른 응답 시간 (30-50ms)
// 성능 개선: 약 70% 감소
```

## 📋 최적화 원칙

### 1. 순서 보장이 필요 없는 경우
- **반복문에서 개별 조회 지양**
- 가능하면 단일 쿼리로 집계
- PostgreSQL `COUNT() FILTER`, `CASE WHEN` 활용

### 2. 순서 보장이 필요한 경우
- 트랜잭션 처리가 필요한 경우
- 이전 결과에 의존하는 경우
- 비즈니스 로직상 순차 처리가 필수인 경우

**예외적으로 허용:**
```typescript
// ✅ 순서가 중요한 경우 (트랜잭션)
await this.prisma.$transaction(async (tx) => {
  const order = await tx.order.create({ data: orderData });
  const payment = await tx.payment.create({ data: { orderId: order.id } });
  const inventory = await tx.inventory.update({ where: { productId: order.productId } });
});
```

## 🛠️ 최적화 기법

### 1. COUNT() FILTER 사용 (PostgreSQL)
```sql
-- 여러 조건의 COUNT를 한 번에
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'success') as success_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count
FROM logs;
```

### 2. CASE WHEN으로 집계
```sql
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed_count
FROM logs;
```

### 3. GROUP BY로 타입별 집계
```sql
SELECT type, COUNT(*) as count
FROM logs
GROUP BY type;
```

### 4. 병렬 쿼리 실행
```typescript
// 독립적인 쿼리는 병렬로 실행
const [stats, types] = await Promise.all([
  this.prisma.$queryRaw`SELECT ...`,
  this.prisma.$queryRaw`SELECT type, COUNT(*) ...`,
]);
```

## 📊 성능 측정 사례

### 사례: 푸시 알림 통계 API 최적화

**Before (6개 쿼리):**
- 총 발송: `count()`
- 성공: `count({ where: { success: true } })`
- 실패: `count({ where: { success: false } })`
- 읽음: `count({ where: { readAt: { not: null } } })`
- 클릭: `count({ where: { clickedAt: { not: null } } })`
- 타입별: `groupBy({ by: ['type'] })`

**결과:** 170ms

**After (2개 쿼리):**
- 통계: 단일 `COUNT() FILTER` 쿼리
- 타입별: `GROUP BY` 쿼리
- 병렬 실행: `Promise.all()`

**결과:** 30-50ms (**70% 개선**)

## ⚡ 빠른 체크리스트

- [ ] 반복문 안에서 Prisma 쿼리 호출하는가?
- [ ] 여러 개의 `count()` 를 연속으로 호출하는가?
- [ ] 같은 테이블에 대해 조건만 다른 쿼리를 여러 번 하는가?
- [ ] 독립적인 쿼리들을 순차적으로 실행하는가?

**하나라도 해당되면 최적화 필요!**

## 🎯 권장 작업 흐름

1. **쿼리 작성 시:**
   - 단일 쿼리로 가능한지 먼저 고민
   - PostgreSQL 집계 함수 적극 활용

2. **API 응답 시간 측정:**
   - 로컬에서 개발자 도구로 확인
   - 100ms 이상이면 최적화 검토

3. **최적화 후 비교:**
   - Before/After 응답 시간 로그 남기기
   - 문서에 성능 개선 사례 기록

---

**마지막 업데이트:** 2025-11-21
**작성자:** Claude Code
**목적:** N+1 쿼리 문제 예방 및 성능 최적화
