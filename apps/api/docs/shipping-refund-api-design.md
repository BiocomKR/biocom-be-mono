# 배송 및 취소/환불 API 설계 문서

## 📋 목차
1. [개요](#개요)
2. [핵심 원칙](#핵심-원칍)
3. [DB 스키마](#db-스키마)
4. [API 설계](#api-설계)
5. [상태 전이도](#상태-전이도)
6. [토스페이먼츠 연동](#토스페이먼츠-연동)

---

## 개요

### 목적
- 주문 배송 관리 기능 구현
- 주문 취소/반품/교환 프로세스 구현
- 토스페이먼츠 결제 취소 API 연동

### 범위
- ✅ **전체 취소/전체 환불만 지원**
- ✅ **부분 취소/부분 환불 없음**
- ✅ 주문 단위로만 처리

---

## 핵심 원칙

### 1. 타임존 관리
⚠️ **모든 날짜/시간은 KST(한국 표준시) 사용 필수**

```typescript
import { getNowKST } from '@/common/utils/kst-date.util';

// ✅ 올바른 방법
order.shippedAt = getNowKST();
order.deliveredAt = getNowKST();

// ❌ 절대 금지
order.shippedAt = new Date(); // UTC로 저장됨!
```

### 2. 취소/환불 규칙
- **취소**: 배송 시작 **전** ((Order.status === 'PAID' || Order.status === 'PREPARING') && Order.shippedAt === null)
- **반품**: 배송 완료 **후** (Order.deliveredAt !== null)
- **전액 처리**: 부분 취소/부분 환불 없음

### 3. 상태 관리
- 모든 상태 변경은 `OrderStateLog` 테이블에 기록
- 토스페이먼츠 API 호출 응답은 `Refund.tossResponse`에 저장

---

## DB 스키마

### 주요 테이블

#### 1. orders
```typescript
{
  status: string;           // 주문 상태
  shippedAt: DateTime?;     // 발송일시 (KST)
  deliveredAt: DateTime?;   // 배송완료일시 (KST)
  completedAt: DateTime?;   // 구매확정일시 (KST)
  cancelledAt: DateTime?;   // 취소일시 (KST)
}
```

**주문 상태값**:
- `PENDING` - 결제 대기
- `PAID` - 결제 완료
- `PREPARING` - 배송 준비중
- `SHIPPING` - 배송 중
- `DELIVERED` - 배송 완료
- `COMPLETED` - 구매 확정
- `CANCELLED` - 취소됨

#### 2. shipping
```typescript
{
  orderId: number;
  courierCode: string?;     // 택배사 코드 (CJ, EPOST 등)
  courierName: string?;     // 택배사명
  trackingNumber: string?;  // 송장번호
  status: string;           // 배송 상태
  shippedAt: DateTime?;     // 배송 시작일시 (KST)
  deliveredAt: DateTime?;   // 배송 완료일시 (KST)
}
```

**배송 상태값**:
- `PENDING` - 대기
- `READY_FOR_SHIPMENT` - 배송 준비
- `IN_TRANSIT` - 배송 중
- `DELIVERED` - 배송 완료

#### 3. refunds
```typescript
{
  orderId: number;
  paymentId: number;
  refundType: string;       // CANCEL | RETURN
  status: string;           // 환불 상태
  refundAmount: Decimal;    // 환불 금액 (전액)
  pointRefund: Decimal;     // 포인트 환불액
  tossCancelId: string?;    // 토스 취소 ID
  tossResponse: Json?;      // 토스 응답
  reason: string;           // 환불 사유
  requestedAt: DateTime;    // 요청일시 (KST)
  completedAt: DateTime?;   // 완료일시 (KST)
}
```

**환불 상태값**:
- `REQUESTED` - 요청됨
- `PROCESSING` - 처리 중
- `COMPLETED` - 완료
- `REJECTED` - 거절됨

#### 4. exchange_returns
```typescript
{
  orderId: number;
  type: string;             // EXCHANGE | RETURN
  status: string;           // 신청 상태
  reason: string;           // 사유
  trackingNumber: string?;  // 반송 송장번호
  requestedAt: DateTime;    // 신청일시 (KST)
  approvedAt: DateTime?;    // 승인일시 (KST)
  completedAt: DateTime?;   // 완료일시 (KST)
}
```

**교환/반품 상태값**:
- `REQUESTED` - 신청됨
- `APPROVED` - 승인됨
- `REJECTED` - 거절됨
- `COMPLETED` - 완료

---

## API 설계

### 1. 배송 관리 API (관리자용)

#### 배송 준비 시작
```typescript
PATCH /api/admin/orders/:orderId/preparing
Authorization: Bearer {admin_token}

Response:
{
  success: true,
  message: "배송 준비가 시작되었습니다",
  data: {
    orderId: 123,
    orderNumber: "O20251107123456",
    status: "PREPARING"
  }
}

처리 로직:
1. Order.status 확인 (PAID만 가능)
2. Order 업데이트:
   - status: PAID → PREPARING
3. OrderStateLog 생성 (PAID → PREPARING)
```

#### 배송 시작 (송장번호 입력)
```typescript
PATCH /api/admin/orders/:orderId/shipping
Authorization: Bearer {admin_token}

Request Body:
{
  courierCode: "CJ",
  courierName: "CJ대한통운",
  trackingNumber: "1234567890"
}

Response:
{
  success: true,
  message: "배송이 시작되었습니다",
  data: {
    orderId: 123,
    orderNumber: "O20251107123456",
    shipping: {
      courierCode: "CJ",
      courierName: "CJ대한통운",
      trackingNumber: "1234567890",
      status: "IN_TRANSIT",
      shippedAt: "2025-11-07T15:30:00.000Z" // KST
    }
  }
}

처리 로직:
1. Order.status 확인 (PREPARING만 가능)
2. Shipping 업데이트:
   - courierCode, courierName, trackingNumber 저장
   - status: PENDING → IN_TRANSIT
   - shippedAt = getNowKST()
3. Order 업데이트:
   - status: PREPARING → SHIPPING
   - shippedAt = getNowKST()
4. OrderStateLog 생성 (PREPARING → SHIPPING)
```

#### 배송 완료 처리
```typescript
PATCH /api/admin/orders/:orderId/shipping/delivered
Authorization: Bearer {admin_token}

Response:
{
  success: true,
  message: "배송이 완료되었습니다",
  data: {
    orderId: 123,
    orderNumber: "O20251107123456",
    deliveredAt: "2025-11-10T10:00:00.000Z" // KST
  }
}

처리 로직:
1. Order.status 확인 (SHIPPING만 가능)
2. Shipping 업데이트:
   - status: IN_TRANSIT → DELIVERED
   - deliveredAt = getNowKST()
3. Order 업데이트:
   - status: SHIPPING → DELIVERED
   - deliveredAt = getNowKST()
4. OrderStateLog 생성 (SHIPPING → DELIVERED)
5. 7일 후 자동 구매확정 스케줄 등록 (TODO)
```

---

### 2. 주문 취소 API (고객용 - 배송 전만)

```typescript
POST /api/orders/:orderId/cancel
Authorization: Bearer {user_token}

Request Body:
{
  reason: "단순 변심",
  reasonDetail?: "다른 상품 구매 예정"
}

Response:
{
  success: true,
  message: "주문이 취소되었습니다. 환불은 영업일 기준 3-5일 소요됩니다.",
  data: {
    orderId: 123,
    orderNumber: "O20251107123456",
    refund: {
      refundAmount: 50000,
      pointRefund: 5000,
      tossCancelId: "toss_cancel_123"
    },
    cancelledAt: "2025-11-07T16:00:00.000Z" // KST
  }
}

에러 응답:
{
  success: false,
  statusCode: 400,
  message: "배송이 시작된 주문은 취소할 수 없습니다. 반품 신청을 이용해주세요."
}

처리 로직:
1. 권한 검증 (본인 주문인지 확인)
2. 취소 가능 여부 확인:
   - Order.status === 'PAID' || Order.status === 'PREPARING'
   - Order.shippedAt === null
   - 아니면 → 400 에러
3. Refund 생성:
   - refundType: 'CANCEL'
   - refundAmount: Order.totalAmount (전액)
   - pointRefund: Order.pointUsed
   - status: 'REQUESTED'
   - requestedAt = getNowKST()
4. 토스페이먼츠 취소 API 호출:
   - cancelPayment(paymentKey, cancelReason, 전액)
   - 응답 저장: Refund.tossResponse
   - 취소 ID 저장: Refund.tossCancelId
5. Refund 상태 업데이트:
   - status: 'REQUESTED' → 'COMPLETED'
   - completedAt = getNowKST()
6. Order 업데이트:
   - status: 'PAID' or 'PREPARING' → 'CANCELLED'
   - cancelledAt = getNowKST()
7. 포인트 복구:
   - User.points += Order.pointUsed
   - PointHistory 생성 (환불)
8. OrderStateLog 생성 (PAID or PREPARING → CANCELLED)
```

---

### 3. 반품 요청 API (고객용 - 배송 완료 후)

#### 반품 신청
```typescript
POST /api/orders/:orderId/return
Authorization: Bearer {user_token}

Request Body:
{
  reason: "상품 불량",
  reasonDetail?: "포장 훼손"
}

Response:
{
  success: true,
  message: "반품 신청이 완료되었습니다. 관리자 승인 후 안내드리겠습니다.",
  data: {
    returnId: 456,
    orderId: 123,
    orderNumber: "O20251107123456",
    status: "REQUESTED",
    requestedAt: "2025-11-15T14:00:00.000Z" // KST
  }
}

에러 응답:
{
  success: false,
  statusCode: 400,
  message: "배송 완료 후 7일 이내만 반품 가능합니다."
}

처리 로직:
1. 권한 검증 (본인 주문인지 확인)
2. 반품 가능 여부 확인:
   - Order.deliveredAt !== null
   - 배송 완료 후 7일 이내 (deliveredAt + 7일 > 현재)
   - Order.status === 'DELIVERED'
   - 아니면 → 400 에러
3. ExchangeReturn 생성:
   - type: 'RETURN'
   - status: 'REQUESTED'
   - reason, reasonDetail 저장
   - requestedAt = getNowKST()
```

#### 반품 승인 (관리자용)
```typescript
PATCH /api/admin/orders/:orderId/return/:returnId/approve
Authorization: Bearer {admin_token}

Response:
{
  success: true,
  message: "반품이 승인되었습니다. 고객에게 회수 안내가 발송됩니다.",
  data: {
    returnId: 456,
    status: "APPROVED",
    approvedAt: "2025-11-16T09:00:00.000Z" // KST
  }
}

처리 로직:
1. ExchangeReturn 조회 및 상태 확인 (REQUESTED만 가능)
2. ExchangeReturn 업데이트:
   - status: 'REQUESTED' → 'APPROVED'
   - approvedAt = getNowKST()
3. 고객에게 회수 안내 발송 (이메일/SMS - TODO)
```

#### 반품 완료 (관리자용 - 상품 수령 후)
```typescript
POST /api/admin/orders/:orderId/return/:returnId/complete
Authorization: Bearer {admin_token}

Request Body:
{
  returnTrackingNumber?: "9876543210"
}

Response:
{
  success: true,
  message: "반품이 완료되었습니다. 환불이 진행됩니다.",
  data: {
    returnId: 456,
    orderId: 123,
    refund: {
      refundAmount: 50000,
      pointRefund: 5000,
      tossCancelId: "toss_cancel_456"
    },
    completedAt: "2025-11-20T11:00:00.000Z" // KST
  }
}

처리 로직:
1. ExchangeReturn 조회 및 상태 확인 (APPROVED만 가능)
2. ExchangeReturn 업데이트:
   - status: 'APPROVED' → 'COMPLETED'
   - completedAt = getNowKST()
   - returnTrackingNumber 저장 (선택)
3. Refund 생성:
   - refundType: 'RETURN'
   - refundAmount: Order.totalAmount (전액)
   - pointRefund: Order.pointUsed
   - status: 'REQUESTED'
   - requestedAt = getNowKST()
4. 토스페이먼츠 취소 API 호출:
   - cancelPayment(paymentKey, cancelReason, 전액)
   - 응답 저장: Refund.tossResponse
   - 취소 ID 저장: Refund.tossCancelId
5. Refund 상태 업데이트:
   - status: 'REQUESTED' → 'COMPLETED'
   - completedAt = getNowKST()
6. Order 업데이트:
   - status: 'DELIVERED' → 'COMPLETED'
   - completedAt = getNowKST()
7. 포인트 복구:
   - User.points += Order.pointUsed
   - PointHistory 생성 (환불)
8. OrderStateLog 생성 (DELIVERED → COMPLETED)
```

---

### 4. 교환 신청 API (고객용)

```typescript
POST /api/orders/:orderId/exchange
Authorization: Bearer {user_token}

Request Body:
{
  reason: "사이즈 변경",
  reasonDetail?: "M → L"
}

Response:
{
  success: true,
  message: "교환 신청이 완료되었습니다. 관리자 승인 후 안내드리겠습니다.",
  data: {
    exchangeId: 789,
    orderId: 123,
    orderNumber: "O20251107123456",
    status: "REQUESTED",
    requestedAt: "2025-11-15T14:00:00.000Z" // KST
  }
}

처리 로직:
1. 권한 검증 (본인 주문인지 확인)
2. 교환 가능 여부 확인:
   - Order.deliveredAt !== null
   - 배송 완료 후 7일 이내
   - Order.status === 'DELIVERED'
3. ExchangeReturn 생성:
   - type: 'EXCHANGE'
   - status: 'REQUESTED'
   - reason, reasonDetail 저장
   - requestedAt = getNowKST()
```

---

## 상태 전이도

### 주문 상태 전이
```
PENDING (주문 생성)
    ↓ (결제 완료)
PAID (결제 완료)
    ↓ (관리자 배송 준비)
PREPARING (배송 준비중)
    ↓ (관리자 송장 입력)
SHIPPING (배송 중)
    ↓ (배송 완료)
DELIVERED (배송 완료)
    ↓ (7일 후 자동 또는 고객 확정)
COMPLETED (구매 확정)

CANCELLED (취소됨) ← PAID 또는 PREPARING에서 가능
```

### 취소/반품 가능 구간
```
┌─────────────────────────────────────────────────┐
│         고객 취소 가능 구간                      │
│  PAID 또는 PREPARING (배송 전, shippedAt === null)│
└─────────────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│         고객 반품 가능 구간               │
│  DELIVERED (배송 완료 후 7일 이내)       │
└──────────────────────────────────────────┘
```

---

## 토스페이먼츠 연동

### 기존 Service 확인
```typescript
// src/shop/services/toss-payments.service.ts
class TossPaymentsService {
  // 이미 구현됨
  async cancelPayment(
    paymentKey: string,
    cancelReason: string,
    cancelAmount?: number // undefined면 전액 취소
  ): Promise<any>
}
```

### 사용 방법
```typescript
// 전액 취소 (취소/반품 모두 전액만 지원)
const tossResponse = await this.tossPaymentsService.cancelPayment(
  payment.pgTransactionId, // paymentKey
  `주문 취소 - ${refund.reason}`, // cancelReason
  undefined // 전액 취소 (cancelAmount 생략)
);

// 응답 저장
refund.tossResponse = tossResponse;
refund.tossCancelId = tossResponse.cancels[0].transactionKey;
```

---

## 권한 검증

### 고객 API
```typescript
// 본인 주문인지 확인
const order = await this.prisma.order.findUnique({
  where: { id: orderId }
});

if (order.userId !== userId) {
  throw new ForbiddenException('본인의 주문만 취소/반품할 수 있습니다');
}
```

### 관리자 API
```typescript
// 관리자 권한 확인 (Guard 사용)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
async updateShipping(...)
```

---

## 에러 처리

### 공통 에러
- `400 BadRequestException` - 잘못된 요청 (상태 불일치 등)
- `403 ForbiddenException` - 권한 없음
- `404 NotFoundException` - 주문/반품 찾을 수 없음
- `500 InternalServerException` - 토스 API 호출 실패

### 에러 메시지 예시
```typescript
// 배송 시작된 주문 취소 시도
throw new BadRequestException(
  '배송이 시작된 주문은 취소할 수 없습니다. 반품 신청을 이용해주세요.'
);

// 반품 기간 초과
throw new BadRequestException(
  '배송 완료 후 7일 이내만 반품 가능합니다.'
);

// 토스 API 실패
throw new InternalServerException(
  '결제 취소 처리 중 오류가 발생했습니다. 고객센터로 문의해주세요.'
);
```

---

## 구현 순서

1. ✅ **배송 관리 API** (관리자용)
   - PATCH /admin/orders/:orderId/preparing (새로 추가)
   - PATCH /admin/orders/:orderId/shipping
   - PATCH /admin/orders/:orderId/shipping/delivered

2. ✅ **주문 취소 API** (고객용)
   - POST /orders/:orderId/cancel

3. ✅ **반품 API** (고객용 + 관리자용)
   - POST /orders/:orderId/return
   - PATCH /admin/orders/:orderId/return/:returnId/approve
   - POST /admin/orders/:orderId/return/:returnId/complete

4. ✅ **교환 API** (고객용)
   - POST /orders/:orderId/exchange

5. ✅ **테스트 및 검증**

---

**작성일**: 2025-11-07
**작성자**: Claude Code
