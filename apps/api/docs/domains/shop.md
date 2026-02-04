# Shop 도메인 문서

## 1. 개요

Shop 모듈은 바이오컴 앱의 쇼핑몰 기능을 담당합니다.

### 모듈 구성
| 모듈 | 설명 |
|------|------|
| Products | 상품 목록/상세 조회 |
| Cart | 장바구니 |
| Orders | 주문 생성/조회/취소 |
| Payment | 결제 (토스페이먼츠) |
| Reviews | 상품 리뷰 |
| QnA | 상품 문의 |
| Banners | 배너 관리 |
| Subscription | 구독 (빌링키 기반) |

### 파일 구조
```
src/shop/
├── controllers/
│   ├── orders.controller.ts
│   ├── payment.controller.ts
│   ├── products.controller.ts
│   ├── cart.controller.ts
│   ├── reviews.controller.ts
│   ├── qna.controller.ts
│   ├── banners.controller.ts
│   ├── subscription.controller.ts
│   └── webhooks.controller.ts
├── services/
│   ├── orders.service.ts
│   ├── payment.service.ts
│   ├── products.service.ts
│   ├── cart.service.ts
│   ├── reviews.service.ts
│   ├── qna.service.ts
│   ├── banners.service.ts
│   ├── subscription.service.ts
│   ├── subscription-scheduler.service.ts  # 구독 갱신 스케줄러
│   ├── toss-payments.service.ts
│   ├── webhooks.service.ts
│   └── order-sync.service.ts
└── dto/
    ├── orders/
    ├── payment/
    ├── products/
    └── ...
```

---

## 2. 주문 구조

### 설계 원칙
- **1개 주문 = N개 상품** (여러 상품을 하나의 주문으로 묶음)
- 주문번호 형식: `O + YYYYMMDDHHMISS + 3자리 랜덤` (예: `O20251217143052001`)

### 주문 생성 DTO
```typescript
class CreateOrderDto {
  items: PurchaseItemDto[];       // 구매할 상품 배열
  cartItemIds?: number[];         // 장바구니에서 구매 시
  shippingAddress: ShippingAddressDto;
  pointUsed?: number;             // 사용할 포인트
  userCouponId?: number;          // 사용할 쿠폰
}

class PurchaseItemDto {
  productId: number;
  quantity: number;
}
```

### 주문 생성 플로우
1. 상품 정보 조회 및 검증
2. 챌린지/구독 상품 중복 구매 체크 (PURCHASED/ACTIVATED 티켓 보유 시 구매 불가)
3. 상품 상태 검증 (ACTIVE만 구매 가능)
4. 최대 주문 수량 검증 (`maxOrderQty`)
5. 금액 계산 (상품가 + 배송비 - 쿠폰할인 - 포인트)
6. **포인트 사용 제한**: 상품 금액의 30%까지만 사용 가능
7. 주문 생성 (PENDING_PAYMENT)
8. 주문 아이템 생성
9. Payment 레코드 생성 (PENDING)
10. 배송 정보 생성 (Shipping)
11. 주문 상태 로그 생성 (OrderStateLog)
12. 쿠폰 사용 처리 (UserCoupon → USED)
13. 포인트 차감 + PointHistory 생성
14. 장바구니 아이템 삭제 (해당 시)

### 개인정보 암호화
주문 시 아래 필드들은 `CryptoUtil.encrypt()`로 암호화되어 저장됨:
- recipientName (수령인명)
- recipientMobile (연락처)
- address (주소)
- addressDetail (상세주소)
- deliveryMessage (배송메시지)

---

## 3. 결제 플로우

### PG사: 토스페이먼츠

### 결제 승인 플로우
```
[앱] 결제 요청
    ↓
[앱] 토스 결제창 → 토스 서버
    ↓
[앱] paymentKey 수신
    ↓
[앱] POST /api/payment/confirm (paymentKey, orderId, amount)
    ↓
[API] 주문/결제 정보 검증 + 금액 일치 확인
    ↓
[API] 토스 결제 승인 API 호출 (트랜잭션 밖)
    ↓
[API] 결제 성공 시 DB 업데이트 (트랜잭션 안)
    - Payment 상태 → COMPLETED
    - Order 상태 → PAID
    - 챌린지/구독 티켓 발급
    - 구매 포인트 적립 (상품금액의 10%)
    ↓
[API] 플레이오토 주문 생성 (비동기, 트랜잭션 커밋 후)
```

### 결제 취소 플로우
```
[앱] POST /api/orders/:orderNumber/cancel
    ↓
[API] 송장 등록 여부 확인 (플레이오토 실시간 조회)
    ↓
[송장 미등록] → PG 결제 취소 → CANCELLED
[송장 등록됨] → CANCEL_REQUESTED (실무자 확인)
               → Refund 레코드 생성 (status: REQUESTED)
```

### 멱등성 보장
- 이미 PAID 상태인 주문에 대해 결제 승인 요청 시, 에러 대신 기존 결제 정보 반환
- 중복 결제 방지

---

## 4. 상태 관리

### Order Status (주문 상태)
```typescript
enum OrderStatus {
  PENDING_PAYMENT   // 결제 대기
  PAID              // 결제 완료
  PREPARING         // 상품 준비중
  SHIPPED           // 배송중
  DELIVERED         // 배송 완료
  CANCEL_REQUESTED  // 취소 요청 (송장 등록 후)
  CANCELLED         // 취소됨
  COMPLETED         // 구매 확정
  PAYMENT_FAILED    // 결제 실패
}
```

### Payment Status (결제 상태)
```typescript
enum PaymentStatus {
  PENDING           // 결제 대기
  PROCESSING        // 결제 처리중
  COMPLETED         // 결제 완료
  FAILED            // 결제 실패
  CANCELLED         // 전액 취소
  PARTIAL_CANCELLED // 부분 취소
}
```

### 상태 변경 규칙
| 현재 상태 | 가능한 다음 상태 |
|-----------|------------------|
| PENDING_PAYMENT | PAID, CANCELLED, PAYMENT_FAILED |
| PAID | PREPARING, CANCEL_REQUESTED, CANCELLED |
| PREPARING | SHIPPED, CANCEL_REQUESTED, CANCELLED |
| SHIPPED | DELIVERED, CANCEL_REQUESTED |
| DELIVERED | COMPLETED |
| CANCEL_REQUESTED | CANCELLED |

---

## 5. 취소/환불 정책

### 정책적 결정사항
- **부분 취소/부분 환불 미지원** (현재)
- 향후 도입 시 `PARTIAL_CANCELLED` 상태 활용 가능

### 취소 분기 로직

#### 결제 전 (PENDING_PAYMENT)
- 즉시 CANCELLED 처리
- PG 취소 불필요

#### 송장 미등록 (PAID, PREPARING)
- 플레이오토 실시간 조회로 송장 여부 재확인 (`orderSyncService.syncFromPlayauto`)
- PG 결제 취소 자동 호출
- 포인트/쿠폰 복구 (PaymentService.cancelPayment에서 처리)
- 즉시 CANCELLED 처리

#### 송장 등록됨 (SHIPPED 등)
- CANCEL_REQUESTED 상태로 변경
- Refund 레코드 생성 (status: REQUESTED)
- 관리자 페이지에서 실무자 확인 후 처리
- 플레이오토 주문 삭제 필요

### 토스 웹훅 상태 매핑
| 토스 status | PaymentStatus | OrderStatus |
|-------------|---------------|-------------|
| DONE | COMPLETED | PAID |
| CANCELED | CANCELLED | CANCELLED |
| PARTIAL_CANCELED | PARTIAL_CANCELLED | (유지) |
| ABORTED | FAILED | PAYMENT_FAILED |
| EXPIRED | FAILED | (로그만 기록) |

---

## 6. 물류 연동 (플레이오토)

### 연동 시점
- 결제 승인 완료 후 비동기로 호출
- `PaymentService.confirmPayment()` 트랜잭션 커밋 후 실행

### 저장 필드
```typescript
Order {
  logisticsProvider: 'PLAYAUTO'
  logisticsUniq: string      // 플레이오토 고유 ID
  logisticsBundleNo: string  // 묶음 번호
}
```

### 실패 처리
- 결제는 유지 (물류 실패로 결제 취소 안 함)
- `LogisticsApiLog` 테이블에 FAILURE 기록
- 배치로 재시도 가능 (`logisticsUniq`가 null인 PAID 주문)

### 취소 시 플레이오토 처리
- 송장 미등록: 플레이오토 주문 삭제 (`DELETE /order/delete`)
- 송장 등록됨: 관리자가 수동 처리 후 삭제

### 주문 상태 실시간 동기화
- 취소 요청 시 `orderSyncService.syncFromPlayauto()` 호출
- 플레이오토에서 최신 배송 상태/송장번호 가져와서 DB 동기화
- 동기화 결과로 송장 여부 판단 후 취소 분기

---

## 7. 배송비 정책

### 기본 정책 (ShippingPolicy 테이블 없을 시)
- 기본 배송비: 3,000원
- 무료 배송 기준: 50,000원 이상
- 제주도 추가: 3,000원 (우편번호 63으로 시작)

### 계산 로직
```typescript
// 제주도 체크
const isJeju = postalCode.startsWith('63');

if (totalAmount >= freeShippingThreshold) {
  return isJeju ? jejuExtraFee : 0;
}

return baseFee + (isJeju ? jejuExtraFee : 0);
```

---

## 8. 포인트/쿠폰

### 포인트 사용
- 주문 생성 시 차감
- **사용 제한**: 상품 금액의 30%까지만 사용 가능
- 취소 시 복구 (type: REFUND)

### 포인트 적립
| 시점 | 적립률 | 기준 |
|------|-------|------|
| 결제 완료 시 | 10% | 상품 금액 (totalProductPrice) |
| 구매 확정 시 | 1% | 결제 금액 (totalAmount) |

### 쿠폰 사용
- 상품별 쿠폰 (특정 상품에만 적용 가능)
- 할인 타입: PERCENTAGE, AMOUNT
- 최대 할인액 제한 가능 (maxDiscountAmount)
- 사용 시 UserCoupon 상태 → USED, usedAt/usedOrderId 기록

---

## 9. 반품/교환

### 신청 조건
- 배송 완료 후 7일 이내
- DELIVERED 상태인 주문만 가능

### 상태 관리
```typescript
// 실제 구현된 enum (REQUESTED만 존재)
enum ExchangeReturnStatus {
  REQUESTED   // 신청됨
}
```

> **주의**: 문서상 APPROVED, COMPLETED, REJECTED 상태가 있지만, 실제 enum에는 REQUESTED만 구현됨. 관리자 페이지에서 처리 로직 추가 필요.

### 테이블: ExchangeReturn
```typescript
{
  orderId: number
  type: 'RETURN' | 'EXCHANGE'
  status: ExchangeReturnStatus
  reason: string
  reasonDetail?: string
  requestedAt: Date
  approvedAt?: Date
  completedAt?: Date
}
```

---

## 10. 챌린지/구독 티켓

### 발급 시점
- **결제 승인 완료 시** (`PaymentService.confirmPayment`)
- 주문 생성 시에는 발급하지 않음 (미결제 티켓 방지)

### 중복 구매 방지
- 동일 상품에 대해 PURCHASED 또는 ACTIVATED 상태 티켓이 있으면 구매 불가
- 주문 생성 시점에 검증 (`orders.service.ts`)

### 동시성 방어
- `orderItemId + seq` 유니크 제약 (DB level)
- seq 기반 deterministic 생성 (1부터 quantity까지)
- 중복 생성 시도 시 P2002 에러 → catch 후 skip (멱등성 보장)

### 티켓 타입 분류
```typescript
// categoryCode에 따라 결정
'SUBSCRIPTION' → ticketType: 'SUBSCRIPTION'
'CHALLENGE'    → ticketType: 'CHALLENGE'
```

---

## 11. 주요 주의사항

### 개인정보 처리
- 조회 시 반드시 `CryptoUtil.decrypt()` 적용
- recipientName, recipientMobile, address, addressDetail

### 날짜/시간 처리
- 모든 날짜는 `getNowKST()` 사용 (new Date() 금지)
- 토스 응답의 approvedAt은 `parseISO8601ToKST()`로 변환

### 트랜잭션 분리
- 외부 API 호출 (토스, 플레이오토)은 트랜잭션 밖에서 실행
- DB 업데이트만 트랜잭션 안에서 처리

### 미구현/TODO 항목
- 재고 차감: `InventorySyncQueue` 테이블 없어서 주석 처리 상태
- 반품/교환 후속 처리: 관리자 페이지 구현 필요

---

## 12. 관련 파일

### biocom-api (유저 앱 API)
- 주문: `src/shop/services/orders.service.ts`
- 결제: `src/shop/services/payment.service.ts`
- 웹훅: `src/shop/services/webhooks.service.ts`
- 물류 연동: `src/playauto/providers/playauto.provider.ts`
- 주문 동기화: `src/shop/services/order-sync.service.ts`

### biocom-bo-api (관리자 API)
- 주문 관리: `src/orders/orders.service.ts`
- 환불 처리: `src/refund/refund.service.ts`

### Enum 파일
- `src/common/enums/order-status.enum.ts`
- `src/common/enums/payment-status.enum.ts`
- `src/common/enums/exchange-return-status.enum.ts`

---
* 작성자: 엄신우
* 작성일: 25/12/17
* 수정일: 25/12/18
