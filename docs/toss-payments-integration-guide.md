# 토스페이먼츠 연동 가이드

## 📋 목차
1. [연동 방식 개요](#연동-방식-개요)
2. [결제 플로우](#결제-플로우)
3. [API 명세](#api-명세)
4. [환불/취소 처리](#환불취소-처리)
5. [환경 설정](#환경-설정)
6. [주의사항](#주의사항)

---

## 연동 방식 개요

### 하이브리드 방식 (클라이언트 SDK + 서버 API)

바이브코딩은 **토스페이먼츠 하이브리드 연동 방식**을 사용합니다:

- **클라이언트(RN 앱)**: 토스페이먼츠 SDK로 결제 위젯 표시 및 사용자 인터랙션
- **백엔드 서버**: 토스페이먼츠 API로 최종 승인, 검증, 취소 처리
- **보안**: Secret Key는 백엔드 서버에만 존재

```
┌─────────────┐         ┌─────────────┐         ┌─────────────────┐
│   RN 앱     │ ◄─────► │  백엔드     │ ◄─────► │ 토스페이먼츠   │
│  (SDK)      │         │  (API)      │         │     API         │
└─────────────┘         └─────────────┘         └─────────────────┘
   결제 위젯              최종 승인/검증           결제 처리
```

---

## 결제 플로우

### 전체 프로세스

```
1️⃣ [RN 앱] 주문 생성
   POST /api/shop/orders
   { items: [...], shippingAddress: {...} }

   ↓ Response: { orderNumber: "O20251107123456" }

2️⃣ [RN 앱] 결제 준비 API 호출
   POST /api/shop/payment/prepare
   { orderNumber: "O20251107123456" }

   ↓ Response: { amount: 50000, orderName: "주문번호: O20251107123456" }

3️⃣ [RN 앱] 토스페이먼츠 SDK 결제 위젯 표시
   - 사용자가 결제 수단 선택 (카드/계좌이체/간편결제 등)
   - 결제 정보 입력 및 결제 진행

   ↓ 토스 SDK 결과: { paymentKey, orderId, amount }

4️⃣ [RN 앱] 백엔드로 결제 승인 요청
   POST /api/shop/payment/confirm
   {
     paymentKey: "tgen_...",
     orderId: "O20251107123456",
     amount: 50000
   }

5️⃣ [백엔드] 토스페이먼츠 API 최종 승인
   POST https://api.tosspayments.com/v1/payments/confirm
   Authorization: Basic {TOSS_PAYMENTS_SECRET_KEY}
   {
     paymentKey: "tgen_...",
     orderId: "O20251107123456",
     amount: 50000
   }

   ↓ 토스 API 응답: { status: "DONE", approvedAt: "..." }

6️⃣ [백엔드] 주문/결제 상태 업데이트
   - Order.status: PENDING_PAYMENT → PAID
   - Payment.status: PENDING → COMPLETED
   - Payment.pgTransactionId = paymentKey
   - 챌린지 티켓 활성화 (챌린지 상품인 경우)

7️⃣ [백엔드] RN 앱에 결제 완료 응답
   Response: { success: true, orderNumber: "O20251107123456" }
```

### 상태 전이도

```
Order.status:
PENDING_PAYMENT (주문 생성)
    ↓
PAID (결제 완료)
    ↓
PREPARING (배송 준비)
    ↓
SHIPPING (배송 중)
    ↓
DELIVERED (배송 완료)
    ↓
COMPLETED (구매 확정)

Payment.status:
PENDING → COMPLETED → (CANCELLED)
```

---

## API 명세

### 1. 결제 준비

```typescript
POST /api/shop/payment/prepare
Authorization: Bearer {jwt_token}

Request:
{
  orderNumber: string  // "O20251107123456"
}

Response:
{
  orderId: number,
  orderNumber: string,
  amount: number,
  orderName: string,
  customerName: string,
  customerEmail: string,
  paymentKey: null,
  status: "PENDING"
}
```

**처리 내용**:
- Order 조회 (PENDING_PAYMENT 상태만 가능)
- Payment 레코드 생성 (없는 경우)
- RN 앱이 토스 SDK 초기화에 필요한 정보 반환

---

### 2. 결제 승인

```typescript
POST /api/shop/payment/confirm

Request:
{
  paymentKey: string,  // 토스에서 발급한 결제 키
  orderId: string,     // 주문번호 (O20251107123456)
  amount: number       // 결제 금액
}

Response:
{
  orderId: number,
  orderNumber: string,
  amount: number,
  status: "COMPLETED",
  paymentKey: string,
  approvedAt: string
}
```

**처리 내용**:
1. Order 및 Payment 조회
2. 금액 검증 (order.totalAmount === amount)
3. 토스페이먼츠 API 호출
4. Payment 업데이트:
   - status: PENDING → COMPLETED
   - pgTransactionId = paymentKey
   - completedAt = getNowKST()
5. Order 업데이트:
   - status: PENDING_PAYMENT → PAID
   - paidAt = getNowKST()
6. OrderStateLog 생성
7. 챌린지 티켓 활성화 (해당하는 경우)

---

### 3. 결제 취소

```typescript
POST /api/shop/payment/cancel
Authorization: Bearer {jwt_token}

Request:
{
  orderNumber: string,
  cancelReason: string
}

Response:
{
  success: true,
  message: "결제가 취소되었습니다",
  refundAmount: number
}
```

---

### 4. 결제 상태 조회

```typescript
GET /api/shop/payment/status/:orderNumber
Authorization: Bearer {jwt_token}

Response:
{
  orderNumber: string,
  status: string,
  amount: number,
  paymentKey: string
}
```

---

### 5. 토스페이먼츠 웹훅

```typescript
POST /api/shop/payment/webhook

Request:
{
  eventType: string,
  data: {
    paymentKey: string,
    orderId: string,
    status: string
  }
}

Response:
{
  received: true
}
```

**처리 내용**:
- 토스페이먼츠에서 전송하는 결제 상태 변경 알림 처리
- 결제 취소, 환불 등의 상태 변경 동기화

---

## 환불/취소 처리

### 1. 고객 주문 취소 (배송 전)

```typescript
POST /api/shop/orders/:orderNumber/cancel
Authorization: Bearer {jwt_token}

Request:
{
  reason: string,           // "단순 변심"
  reasonDetail?: string     // "다른 상품 구매 예정"
}

처리 로직:
1. 취소 가능 여부 확인:
   - Order.status === 'PAID' or 'PREPARING'
   - Order.shippedAt === null
2. Refund 생성 (refundType: 'CANCEL')
3. 토스페이먼츠 취소 API 호출 (전액)
4. Order.status → 'CANCELLED'
5. 포인트 복구
6. 쿠폰 복구
```

---

### 2. 고객 반품 신청 (배송 후)

```typescript
POST /api/shop/orders/:orderNumber/return
Authorization: Bearer {jwt_token}

Request:
{
  reason: string,           // "상품 불량"
  reasonDetail?: string     // "포장 훼손"
}

처리 로직:
1. 반품 가능 여부 확인:
   - Order.status === 'DELIVERED'
   - 배송 완료 후 7일 이내
2. ExchangeReturn 생성 (type: 'RETURN', status: 'REQUESTED')
3. 관리자 승인 대기
```

---

### 3. 관리자 반품 승인

```typescript
POST /api/management/refund/return/:orderNumber/:returnId/approve
Authorization: X-API-Key

처리 로직:
1. ExchangeReturn 상태 확인 (REQUESTED)
2. ExchangeReturn.status → 'APPROVED'
3. 고객에게 회수 안내 발송 (TODO: 이메일/SMS)
```

---

### 4. 관리자 반품 완료 및 환불

```typescript
POST /api/management/refund/return/:orderNumber/:returnId/complete
Authorization: X-API-Key

Request:
{
  returnTrackingNumber?: string  // 반송 송장번호 (선택)
}

처리 로직:
1. ExchangeReturn.status → 'COMPLETED'
2. Refund 생성 (refundType: 'RETURN')
3. 토스페이먼츠 취소 API 호출 (전액)
   POST https://api.tosspayments.com/v1/payments/{paymentKey}/cancel
   {
     cancelReason: "반품 환불 - {사유}"
   }
4. Order.status → 'COMPLETED'
5. 포인트 복구
```

---

## 토스페이먼츠 API 호출 (서버 → 토스)

### 결제 승인 API

```typescript
POST https://api.tosspayments.com/v1/payments/confirm
Authorization: Basic {Base64(TOSS_PAYMENTS_SECRET_KEY + ':')}
Content-Type: application/json

Request:
{
  paymentKey: string,
  orderId: string,
  amount: number
}

Response:
{
  paymentKey: string,
  orderId: string,
  status: "DONE",
  method: "카드",
  approvedAt: "2025-11-07T15:30:00+09:00",
  card: {
    company: "신한",
    number: "1234-****-****-5678"
  }
}
```

---

### 결제 취소 API

```typescript
POST https://api.tosspayments.com/v1/payments/{paymentKey}/cancel
Authorization: Basic {Base64(TOSS_PAYMENTS_SECRET_KEY + ':')}
Content-Type: application/json

Request:
{
  cancelReason: string,       // 취소 사유
  cancelAmount?: number,      // 생략 시 전액 취소
  refundReceiveAccount?: {    // 가상계좌 환불용
    bank: string,
    accountNumber: string,
    holderName: string
  }
}

Response:
{
  paymentKey: string,
  cancels: [
    {
      transactionKey: string,      // Refund.tossCancelId에 저장
      cancelReason: string,
      canceledAt: "2025-11-07T16:00:00+09:00",
      cancelAmount: number
    }
  ]
}
```

---

### 결제 조회 API

```typescript
GET https://api.tosspayments.com/v1/payments/{paymentKey}
Authorization: Basic {Base64(TOSS_PAYMENTS_SECRET_KEY + ':')}

Response:
{
  paymentKey: string,
  orderId: string,
  status: "DONE" | "CANCELED" | "PARTIAL_CANCELED",
  totalAmount: number,
  method: string,
  approvedAt: string,
  cancels?: [...]
}
```

---

## 환경 설정

### 환경 변수

```bash
# .env
TOSS_PAYMENTS_SECRET_KEY=test_sk_...     # 테스트 키
# TOSS_PAYMENTS_SECRET_KEY=live_sk_...   # 운영 키 (실제 배포 시)
```

### 테스트/운영 모드 전환

**현재 상태**: Mock 모드 (실제 토스 API 호출 안 함)

```typescript
// src/shop/services/payment.service.ts Line 131-136

// ❌ 현재 (Mock 모드)
const tossResult = {
  paymentKey: dto.paymentKey,
  orderId: dto.orderId,
  method: '카드',
  approvedAt: getNowKST().toISOString()
};

// ✅ 실제 운영 시 (주석 해제)
const tossResult = await this.tossPayments.confirmPayment(
  dto.paymentKey,
  dto.orderId,
  dto.amount
);
```

---

## 주의사항

### 1. Secret Key 보안

- ⚠️ **절대 클라이언트에 노출 금지**
- 백엔드 환경 변수로만 관리
- Git에 커밋 금지 (.env.example에만 예시)

### 2. 금액 검증 필수

```typescript
// 반드시 서버에서 금액 검증
if (order.totalAmount !== dto.amount) {
  throw new BadRequestException('결제 금액이 일치하지 않습니다');
}
```

### 3. 멱등성 (Idempotency)

- 토스 API는 같은 paymentKey로 중복 승인 시 에러 반환
- 클라이언트 재시도 시 동일한 paymentKey 사용

### 4. 타임아웃 설정

```typescript
// 모든 토스 API 호출에 10초 타임아웃 적용
timeout: 10000
```

### 5. KST 타임존 준수

```typescript
// ✅ 올바른 방법
import { getNowKST } from '@/common/utils/kst-date.util';
payment.completedAt = getNowKST();

// ❌ 절대 금지
payment.completedAt = new Date(); // UTC로 저장됨!
```

### 6. 전액 환불만 지원

- 부분 취소/부분 환불 없음
- `cancelAmount` 파라미터 생략 (undefined) → 전액 취소

### 7. 웹훅 보안

- 토스페이먼츠 웹훅 IP 화이트리스트 설정 권장
- 웹훅 데이터는 반드시 토스 API 조회로 검증

---

## 코드 위치

### 서비스 파일
- `/src/shop/services/toss-payments.service.ts` - 토스 API 호출
- `/src/shop/services/payment.service.ts` - 결제 비즈니스 로직

### 컨트롤러
- `/src/shop/controllers/payment.controller.ts` - 결제 API 엔드포인트

### 모듈
- `/src/shop/payment.module.ts` - 결제 모듈 설정

### 환불 처리
- `/src/management/services/management-refund.service.ts` - 환불/반품 로직

---

## 테스트 카드 정보 (토스페이먼츠 제공)

```
카드번호: 1234-5678-9012-3456
유효기간: 12/25
CVC: 123
비밀번호 앞 2자리: 12
```

---

**작성일**: 2025-11-07
**작성자**: Claude Code
**버전**: 1.0.0
