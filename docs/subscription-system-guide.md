# 바이브코딩 구독 시스템 가이드

## 📋 목차
1. [시스템 개요](#시스템-개요)
2. [데이터베이스 스키마](#데이터베이스-스키마)
3. [API 명세](#api-명세)
4. [자동결제 스케줄러](#자동결제-스케줄러)
5. [토스페이먼츠 빌링키](#토스페이먼츠-빌링키)
6. [웹훅 처리](#웹훅-처리)
7. [구독 상태 흐름도](#구독-상태-흐름도)
8. [테스트 시나리오](#테스트-시나리오)

---

## 시스템 개요

바이브코딩의 구독 시스템은 **토스페이먼츠 빌링키**를 활용한 정기결제 자동화 시스템입니다.

### 핵심 기능
- ✅ 빌링키 등록/삭제
- ✅ 구독 생성/취소/일시정지/재개
- ✅ 30일 주기 자동결제 (매일 자정 00:00 KST)
- ✅ 만료된 구독 자동정리 (매일 00:01 KST)
- ✅ 토스페이먼츠 웹훅 처리

### 기술스택
- **결제**: 토스페이먼츠 빌링키 API
- **스케줄러**: @nestjs/schedule (Cron)
- **ORM**: Prisma
- **DB**: PostgreSQL

---

## 데이터베이스 스키마

### 1. subscriptions 테이블

```sql
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    billing_key VARCHAR(200) NOT NULL,
    customer_key VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    start_date TIMESTAMP NOT NULL,
    next_billing_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    billing_cycle INTEGER NOT NULL DEFAULT 30,
    price INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscription_billing_key ON subscriptions(billing_key);
CREATE INDEX idx_subscription_status ON subscriptions(status);
CREATE INDEX idx_subscription_next_billing_date ON subscriptions(next_billing_date);
```

### 2. users 테이블 추가 컬럼

```sql
ALTER TABLE users ADD COLUMN billing_key VARCHAR(200);
ALTER TABLE users ADD COLUMN customer_key VARCHAR(200);
```

### 구독 상태 (status)

| 상태 | 설명 |
|------|------|
| `ACTIVE` | 활성 구독 (자동결제 진행) |
| `PAUSED` | 일시정지 (자동결제 X) |
| `CANCELED` | 사용자가 취소 |
| `EXPIRED` | 30일 이상 일시정지로 만료 |
| `PAYMENT_FAILED` | 자동결제 실패 |
| `BILLING_DELETED` | 토스에서 빌링키 삭제됨 |

---

## API 명세

### 1️⃣ 빌링키 관리

#### 빌링키 등록
```http
POST /shop/subscription/billing
Authorization: Bearer {JWT}
Content-Type: application/json

{
  "authKey": "토스페이먼츠에서 발급받은 인증키",
  "customerKey": "user_{userId}" // 고객 고유 식별자
}
```

**응답**:
```json
{
  "billingKey": "BIL20250110xxxxxx",
  "customerKey": "user_123",
  "card": {
    "company": "신한",
    "number": "1234",
    "cardType": "신용"
  }
}
```

#### 빌링키 삭제
```http
DELETE /shop/subscription/billing
Authorization: Bearer {JWT}
```

**응답**:
```json
{
  "message": "빌링키가 삭제되었습니다"
}
```

---

### 2️⃣ 구독 관리

#### 구독 생성
```http
POST /shop/subscription
Authorization: Bearer {JWT}
Content-Type: application/json

{
  "productId": 1,
  "billingCycle": 30 // 선택사항, 기본값 30일
}
```

**동작**:
1. 사용자의 빌링키 확인
2. 상품 정보 조회
3. **즉시 첫 결제 실행** (토스페이먼츠 빌링키 결제)
4. 성공 시 구독 생성, `next_billing_date = today + 30일`

**응답**:
```json
{
  "id": 1,
  "userId": 123,
  "productId": 1,
  "status": "ACTIVE",
  "startDate": "2025-01-10T00:00:00.000Z",
  "nextBillingDate": "2025-02-09T00:00:00.000Z",
  "billingCycle": 30,
  "price": 99000,
  "product": {
    "id": 1,
    "name": "바이브코딩 프리미엄",
    "price": 99000
  }
}
```

#### 내 구독 목록
```http
GET /shop/subscription
Authorization: Bearer {JWT}
```

**응답**:
```json
[
  {
    "id": 1,
    "status": "ACTIVE",
    "startDate": "2025-01-10T00:00:00.000Z",
    "nextBillingDate": "2025-02-09T00:00:00.000Z",
    "price": 99000,
    "product": {
      "id": 1,
      "name": "바이브코딩 프리미엄"
    }
  }
]
```

#### 구독 상세 조회
```http
GET /shop/subscription/:id
Authorization: Bearer {JWT}
```

#### 구독 취소
```http
DELETE /shop/subscription/:id
Authorization: Bearer {JWT}
```

**동작**:
- 구독 상태를 `CANCELED`로 변경
- `end_date`를 현재 시간으로 설정
- 다음 자동결제부터 실행되지 않음

#### 구독 일시정지
```http
PATCH /shop/subscription/:id/pause
Authorization: Bearer {JWT}
```

**동작**:
- 구독 상태를 `PAUSED`로 변경
- 자동결제가 일시 중단됨
- 30일 이상 일시정지 시 자동으로 `EXPIRED` 처리

#### 구독 재개
```http
PATCH /shop/subscription/:id/resume
Authorization: Bearer {JWT}
```

**동작**:
- 구독 상태를 `ACTIVE`로 변경
- 다음 자동결제부터 다시 진행

---

## 자동결제 스케줄러

### 파일 위치
- `src/shop/services/subscription-scheduler.service.ts`

### 1️⃣ 자동결제 크론잡

```typescript
@Cron('0 0 * * *', {
  name: 'auto-billing',
  timeZone: 'Asia/Seoul',
})
async handleAutoBilling()
```

**실행 시간**: 매일 자정 00:00 (KST)

**처리 로직**:
1. `status = 'ACTIVE'`이고 `next_billing_date`가 오늘인 구독 조회
2. 각 구독마다 `subscriptionService.processAutoBilling()` 호출
3. 빌링키로 토스페이먼츠 결제 API 호출
4. **성공 시**: `next_billing_date += billing_cycle` (30일 연장)
5. **실패 시**: `status = 'PAYMENT_FAILED'`

**로그 예시**:
```
[SubscriptionSchedulerService] 🕐 자동결제 스케줄러 시작...
[SubscriptionSchedulerService] 📋 오늘 처리할 자동결제: 3건
[SubscriptionSchedulerService] 처리 중: subscriptionId=1, 상품명=프리미엄, 사용자=user@example.com
[SubscriptionSchedulerService] ✅ 자동결제 스케줄러 완료: 성공 3건, 실패 0건
```

### 2️⃣ 만료 구독 정리 크론잡

```typescript
@Cron('0 1 0 * * *', {
  name: 'expire-subscriptions',
  timeZone: 'Asia/Seoul',
})
async handleExpiredSubscriptions()
```

**실행 시간**: 매일 00:01 (KST)

**처리 로직**:
1. `status = 'PAUSED'`이고 `updated_at`이 30일 이전인 구독 조회
2. `status = 'EXPIRED'`, `end_date = NOW()` 업데이트

### 3️⃣ 수동 실행 (테스트용)

```typescript
await subscriptionSchedulerService.runManually();
```

---

## 토스페이먼츠 빌링키

### 빌링키란?
- 카드정보를 저장하지 않고도 **자동결제**를 할 수 있는 토큰
- 사용자가 1회 카드 등록 시 토스페이먼츠가 발급
- 이후 서버에서 빌링키로 자유롭게 결제 가능

### 빌링키 발급 플로우

```
1. 앱(프론트) → 토스 결제창 (카드 등록)
   ↓
2. 토스 → authKey 발급
   ↓
3. 앱 → 백엔드 POST /shop/subscription/billing
   {
     "authKey": "토스에서 받은 authKey",
     "customerKey": "user_123"
   }
   ↓
4. 백엔드 → 토스 API: POST /billing/authorizations/issue
   {
     "authKey": "...",
     "customerKey": "user_123"
   }
   ↓
5. 토스 → billingKey 발급
   ↓
6. 백엔드 → DB에 billingKey 저장
```

### 빌링키로 결제하기

```typescript
// TossPaymentsService.chargeWithBillingKey()
POST https://api.tosspayments.com/v1/billing/{billingKey}
Authorization: Basic {Base64(secretKey:)}
Content-Type: application/json

{
  "customerKey": "user_123",
  "amount": 99000,
  "orderId": "AUTO_1736524800000",
  "orderName": "바이브코딩 프리미엄 - 정기결제"
}
```

**응답**:
```json
{
  "paymentKey": "PAY20250110xxxxxx",
  "orderId": "AUTO_1736524800000",
  "status": "DONE",
  "totalAmount": 99000
}
```

---

## 웹훅 처리

### 웹훅 엔드포인트
```http
POST /webhooks/toss/payment
Content-Type: application/json
toss-signature: {서명}

{
  "eventType": "BILLING_DELETED",
  "data": {
    "billingKey": "BIL20250110xxxxxx",
    "customerKey": "user_123"
  }
}
```

### 처리하는 이벤트

#### 1. BILLING_DELETED (빌링키 삭제)
**발생 시점**: 사용자가 토스페이먼츠 앱에서 직접 카드 삭제

**처리**:
```typescript
// WebhooksService.handleBillingDeleted()
await prisma.$transaction(async (tx) => {
  // 1. 해당 빌링키의 모든 활성 구독 중단
  await tx.subscription.updateMany({
    where: { billingKey, status: 'ACTIVE' },
    data: {
      status: 'BILLING_DELETED',
      endDate: new Date(),
    },
  });

  // 2. 사용자 테이블에서 빌링키 제거
  await tx.user.update({
    where: { id: userId },
    data: { billingKey: null, customerKey: null },
  });
});
```

#### 2. PAYMENT_STATUS_CHANGED
**발생 시점**: 가상계좌 입금 완료 등

**처리**: 주문 상태 업데이트

#### 3. 기타 이벤트
- `DEPOSIT_CALLBACK`: 가상계좌 입금 콜백
- `CANCEL_STATUS_CHANGED`: 결제 취소 상태 변경

---

## 구독 상태 흐름도

```
[신규 구독 생성]
       ↓
    ACTIVE ────────────────┐
       │                   │
       │ (일시정지)         │ (자동결제 성공)
       ↓                   │
    PAUSED                 │
       │                   │
       │ (재개)            │
       ↓                   │
    ACTIVE ←───────────────┘
       │
       │ (취소)
       ↓
   CANCELED


[자동결제 실패]
    ACTIVE
       │
       │ (결제 실패)
       ↓
 PAYMENT_FAILED


[빌링키 삭제]
    ACTIVE
       │
       │ (토스에서 빌링키 삭제)
       ↓
 BILLING_DELETED


[장기 일시정지]
    PAUSED
       │
       │ (30일 이상 경과)
       ↓
    EXPIRED
```

---

## 테스트 시나리오

### 1️⃣ 빌링키 등록 테스트

```bash
# 1. 토스페이먼츠 테스트 카드로 authKey 발급 (프론트)

# 2. 빌링키 등록
curl -X POST http://localhost:4001/shop/subscription/billing \
  -H "Authorization: Bearer {JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "authKey": "토스에서_발급받은_authKey",
    "customerKey": "user_1"
  }'

# 3. DB 확인
SELECT billing_key, customer_key FROM users WHERE id = 1;
```

### 2️⃣ 구독 생성 테스트

```bash
# 1. 구독 생성 (즉시 첫 결제 실행)
curl -X POST http://localhost:4001/shop/subscription \
  -H "Authorization: Bearer {JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 1,
    "billingCycle": 30
  }'

# 2. DB 확인
SELECT id, status, start_date, next_billing_date, price
FROM subscriptions
WHERE user_id = 1;
```

### 3️⃣ 자동결제 테스트 (수동 실행)

```typescript
// NestJS 앱 내부에서 수동 실행
const schedulerService = app.get(SubscriptionSchedulerService);
await schedulerService.runManually();
```

**또는** DB에서 `next_billing_date`를 오늘로 변경 후 크론 대기:

```sql
UPDATE subscriptions
SET next_billing_date = CURRENT_DATE
WHERE id = 1;
```

### 4️⃣ 구독 일시정지/재개 테스트

```bash
# 일시정지
curl -X PATCH http://localhost:4001/shop/subscription/1/pause \
  -H "Authorization: Bearer {JWT}"

# 재개
curl -X PATCH http://localhost:4001/shop/subscription/1/resume \
  -H "Authorization: Bearer {JWT}"
```

### 5️⃣ 구독 취소 테스트

```bash
curl -X DELETE http://localhost:4001/shop/subscription/1 \
  -H "Authorization: Bearer {JWT}"

# DB 확인 - status가 CANCELED, end_date 설정됨
SELECT status, end_date FROM subscriptions WHERE id = 1;
```

### 6️⃣ 웹훅 테스트 (빌링키 삭제)

```bash
curl -X POST http://localhost:4001/webhooks/toss/payment \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "BILLING_DELETED",
    "data": {
      "billingKey": "BIL20250110xxxxxx",
      "customerKey": "user_1"
    }
  }'

# DB 확인 - 구독 상태가 BILLING_DELETED로 변경됨
SELECT status, end_date FROM subscriptions WHERE billing_key = 'BIL20250110xxxxxx';
```

---

## 주의사항

### ⚠️ 보안
- 빌링키는 **절대 프론트엔드에 노출 금지**
- 토스페이먼츠 Secret Key는 환경변수로 관리
- 웹훅은 토스 서명 검증 필수 (추후 구현)

### ⚠️ 운영
- 자동결제 실패 시 사용자에게 **알림** 필요 (추후 구현)
- 결제 실패 시 재시도 로직 검토 필요
- 스케줄러 로그를 모니터링하여 이상 징후 파악

### ⚠️ 타임존
- 모든 크론잡은 **Asia/Seoul (KST)** 기준
- DB의 timestamp는 UTC 저장되지만 애플리케이션에서 KST 변환

---

## 관련 파일

### Controller
- `src/shop/controllers/subscription.controller.ts` - 구독 API
- `src/shop/controllers/webhooks.controller.ts` - 토스 웹훅

### Service
- `src/shop/services/subscription.service.ts` - 구독 비즈니스 로직
- `src/shop/services/subscription-scheduler.service.ts` - 자동결제 크론잡
- `src/shop/services/toss-payments.service.ts` - 토스페이먼츠 API
- `src/shop/services/webhooks.service.ts` - 웹훅 처리

### DTO
- `src/shop/dto/subscription/register-billing.dto.ts`
- `src/shop/dto/subscription/create-subscription.dto.ts`

### Database
- `prisma/schema.prisma` - Subscription 모델
- `prisma/migrations/add_subscription_and_billing_key.sql` - 마이그레이션

### Module
- `src/shop/payment.module.ts` - 결제/구독 모듈 등록

---

## FAQ

### Q1. 구독 생성 시 바로 결제가 되나요?
✅ **네**, 구독 생성 즉시 첫 결제가 실행됩니다. 성공해야만 구독이 생성됩니다.

### Q2. 자동결제는 정확히 언제 실행되나요?
✅ 매일 자정 00:00(KST)에 `next_billing_date`가 오늘인 구독들을 모두 결제합니다.

### Q3. 결제 실패하면 어떻게 되나요?
✅ 구독 상태가 `PAYMENT_FAILED`로 변경되고, 다음 자동결제는 실행되지 않습니다. (추후 재시도 로직 추가 예정)

### Q4. 사용자가 토스 앱에서 카드를 삭제하면?
✅ 토스에서 웹훅(`BILLING_DELETED`)으로 알려주고, 모든 활성 구독이 자동 중단됩니다.

### Q5. 일시정지하면 이미 지난 결제일은 어떻게 되나요?
✅ 일시정지된 구독은 자동결제가 실행되지 않습니다. 재개 시점부터 다시 결제가 진행됩니다.

### Q6. 30일 주기는 정확히 30일 후인가요?
✅ 네, `next_billing_date = current_next_billing_date + 30일`로 계산됩니다.

---

**작성일**: 2025-01-10
**작성자**: Claude (바이브코딩 AI 개발팀)
**버전**: 1.0.0
