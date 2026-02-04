# 쇼핑 도메인 API 감사

> 작성일: 2025-10-24
> 분석자: Claude
> 상태: 🔄 진행 중

---

## 📍 쇼핑 도메인 구조

**컨트롤러 목록**:
1. Products - 상품 관리 (5개 엔드포인트)
2. Cart - 장바구니 (7개 엔드포인트)
3. Orders - 주문 (5개 엔드포인트)
4. Payment - 결제 (5개 엔드포인트)
5. Reviews - 리뷰 (12개 엔드포인트)
6. QnA - 상품 문의 (9개 엔드포인트)
7. Banners - 배너 (조회 중)

---

## 🎯 비즈니스 플로우

```
1. 상품 목록 조회 (Products)
   ↓
2. 상품 상세 조회 + 조회수 증가
   ↓
3. 장바구니 추가 (Cart)
   ↓
4. 재고 확인 (Products)
   ↓
5. 주문 생성 (Orders)
   ↓
6. 결제 준비 → 결제 확인 (Payment)
   ↓
7. 주문 완료 확인 (Orders)
   ↓
8. 리뷰/문의 작성 (Reviews/QnA)
```

---

## 1️⃣ Products 컨트롤러

**Base Path**: `/api/shop/products`

### 엔드포인트 목록

#### GET `/api/shop/products`
**목적**: 상품 목록 조회 (카테고리별 그룹핑)

**쿼리 파라미터**:
- `categoryCode`: 카테고리 필터
- `status`: 상품 상태 (기본값: ACTIVE)
- `featured`: 추천 상품만 (true/false)
- `q`: 검색어 (상품명, 설명, SKU)
- `sort`: 정렬 (NAME, VIEW_COUNT, CREATED_AT)

**응답**:
```json
{
  "success": true,
  "data": {
    "totalCount": 15,
    "categoryCount": 3,
    "categories": [
      {
        "categoryCode": "CHALLENGE",
        "categoryName": "챌린지 상품",
        "productCount": 5,
        "products": [
          {
            "id": 1,
            "name": "이너뷰티 챌린지 키트",
            "description": "...",
            "productType": "SET",
            "setItems": ["A", "B", "C"],
            "status": "ACTIVE",
            "viewCount": 123,
            "categoryCode": "CHALLENGE",
            "categoryName": "챌린지 상품",
            "imageUrl": "https://...",
            "originalPrice": 99000,
            "price": 89000
          }
        ]
      }
    ]
  }
}
```

**상태**: ✅ 정상

**검토 필요 사항**:
- [ ] 카테고리 순서가 CategorySortOrder 기준인데, 실제로 이게 맞는지 확인 필요
- [ ] 이미지를 MAIN 타입만 가져오는데, 여러 장이면 어떻게 되는지?

---

#### POST `/api/shop/products/check-stock`
**목적**: 재고 확인 (외부 API 연동)

**Request**:
```json
{
  "items": [
    {
      "sku": "CHALLENGE-001",
      "quantity": 1
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "sku": "CHALLENGE-001",
        "available": true,
        "stock": 87
      }
    ]
  }
}
```

**상태**: ⚠️ 모의 구현

**문제점**:
1. **모의 데이터 사용**
   - `const mockStock = Math.floor(Math.random() * 100);`
   - 실제 재고 API 연동 필요
   - TODO 주석만 있고 실제 구현은 없음

2. **캐시 전략**
   - 10분 캐시 사용 중
   - 캐시 무효화 전략이 없음
   - 재고가 변경되면 어떻게 업데이트하는지?

3. **API 로그**
   - 모든 요청을 `inventory_api_log` 테이블에 기록
   - 로그 삭제/정리 로직이 있는지 확인 필요

**검토 필요 사항**:
- [ ] 실제 재고 API 엔드포인트 확인
- [ ] 재고 부족 시 처리 로직
- [ ] 캐시 무효화 전략 수립
- [ ] API 로그 정리 정책

---

#### GET `/api/shop/products/:id`
**목적**: 상품 상세 조회

**응답**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "categoryCode": "CHALLENGE",
    "categoryName": "챌린지 상품",
    "name": "이너뷰티 챌린지 키트",
    "description": "...",
    "productType": "SET",
    "setItems": ["A", "B", "C"],
    "status": "ACTIVE",
    "viewCount": 123,
    "imageUrl": ["url1", "url2", "url3"],
    "originalPrice": 99000,
    "price": 89000,
    "reviewSummary": {
      "totalCount": 42,
      "averageRating": 4.5,
      "rating1Count": 1,
      "rating2Count": 2,
      "rating3Count": 3,
      "rating4Count": 10,
      "rating5Count": 26,
      "photoReviewCount": 15
    },
    "qnaSummary": {
      "totalCount": 10,
      "answeredCount": 8,
      "unansweredCount": 2
    }
  }
}
```

**상태**: ✅ 정상

**특징**:
- 리뷰 통계와 Q&A 통계를 함께 조회
- 별점별 카운트 제공
- 이미지는 전체 URL 배열로 제공

**검토 필요 사항**:
- [ ] 리뷰/Q&A 통계가 실시간이어야 하나, 캐시해야 하나?
- [ ] 상품 상세 페이지에서 정말 이 정보만으로 충분한가?

---

#### POST `/api/shop/products/:id/view`
**목적**: 상품 조회수 증가

**로직**:
1. `recently_viewed` 테이블에서 기존 조회 기록 확인
2. 기존 기록 있으면 → viewedAt만 업데이트, 조회수 증가 안함
3. 기존 기록 없으면 → 조회 기록 생성 + 조회수 증가

**응답**:
```json
{
  "success": true,
  "data": {
    "viewCount": 124,
    "isNewView": true
  }
}
```

**상태**: ✅ 정상

**특징**:
- 사용자별 중복 조회 방지
- 최근 본 상품 트래킹 겸용
- 트랜잭션으로 원자성 보장

**검토 필요 사항**:
- [ ] recently_viewed 테이블이 계속 커질텐데 정리 정책이 있나?
- [ ] 언제 호출해야 하나? (상세 페이지 진입 시? 이미지 로드 시?)

---

## 📊 Products 도메인 정리

### ✅ 잘된 점
1. **카테고리별 그룹핑** - 클라이언트에서 편하게 사용 가능
2. **중복 조회 방지** - recently_viewed 활용
3. **리뷰/Q&A 통계 통합** - 한 번에 조회 가능
4. **트랜잭션 사용** - 조회수 증가 로직

### ⚠️ 개선 필요
1. **재고 API 모의 구현** - 실제 연동 필요
2. **캐시 무효화 전략** - inventory_cache 관리
3. **로그 정리 정책** - inventory_api_log, recently_viewed

### 🤔 검토 필요
1. 이미지 조회 로직 (MAIN 타입만? 여러 장이면?)
2. 리뷰/Q&A 통계 캐싱 여부
3. 조회수 API 호출 시점

---

## 2️⃣ Cart 컨트롤러

**Base Path**: `/api/shop/cart`

### 엔드포인트 목록

#### GET `/api/shop/cart`
**목적**: 장바구니 조회

**응답**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 1,
    "items": [
      {
        "id": 1,
        "cartId": 1,
        "productId": 38,
        "quantity": 2,
        "stockAvailable": true,
        "stockCheckedAt": null,
        "addedAt": "2025-10-24T00:00:00Z",
        "product": {
          "id": 38,
          "name": "이너뷰티 챌린지",
          "price": 89000,
          "images": [...]
        },
        "subtotal": 178000
      }
    ],
    "totalProductPrice": 178000,
    "totalQuantity": 2,
    "createdAt": "2025-10-24T00:00:00Z"
  }
}
```

**특징**:
- 장바구니가 없으면 자동 생성
- 상품 정보 + MAIN 이미지 포함
- 아이템별 소계(subtotal) 자동 계산
- 총 금액, 총 수량 자동 계산

**상태**: ✅ 정상

---

#### POST `/api/shop/cart/items`
**목적**: 장바구니에 상품 추가

**Request**:
```json
{
  "productId": 38,
  "quantity": 1
}
```

**로직**:
1. 상품 존재 여부 확인
2. 상품 상태(ACTIVE) 확인
3. 최대 주문 수량 체크
4. 이미 장바구니에 있으면 → 수량 증가
5. 없으면 → 새로 추가

**상태**: ✅ 정상

**특징**:
- 중복 상품 자동 처리 (수량 누적)
- maxOrderQty 검증
- 판매 중인 상품만 추가 가능

---

#### PATCH `/api/shop/cart/items/:id`
**목적**: 장바구니 아이템 수량 변경

**Request**:
```json
{
  "quantity": 3
}
```

**상태**: ✅ 정상

**검증**:
- 본인 장바구니 아이템인지 확인
- 최대 주문 수량 체크

---

#### DELETE `/api/shop/cart/items/:id`
**목적**: 장바구니 아이템 삭제

**응답**:
```json
{
  "success": true
}
```

**상태**: ✅ 정상

**검증**:
- 본인 장바구니 아이템인지 확인

---

#### DELETE `/api/shop/cart/clear`
**목적**: 장바구니 전체 비우기

**응답**:
```json
{
  "success": true
}
```

**상태**: ✅ 정상

**로직**:
- 장바구니의 모든 아이템 삭제
- 장바구니 자체는 유지

---

#### POST `/api/shop/cart/validate`
**목적**: 장바구니 재고 검증

**응답**:
```json
{
  "success": true,
  "data": {
    "valid": false,
    "invalidItems": [
      {
        "id": 1,
        "productId": 38,
        "quantity": 2,
        "stockAvailable": false,
        "subtotal": 0
      }
    ],
    "message": "재고가 부족한 상품이 있습니다"
  }
}
```

**상태**: ⚠️ 모의 구현

**문제점**:
1. **모의 재고 확인**
   - `const mockStock = Math.floor(Math.random() * 100);`
   - Products의 check-stock과 동일한 문제
   - 실제 재고 API 연동 필요

2. **재고 상태 업데이트**
   - `stockAvailable`, `stockCheckedAt` 필드 업데이트
   - 근데 이게 언제 사용되는지?
   - 주문 시 다시 확인하는지?

**검토 필요 사항**:
- [ ] 재고 검증을 언제 호출해야 하나? (주문 전? 페이지 로드 시?)
- [ ] stockAvailable 필드가 실제로 활용되는지 확인
- [ ] 재고 부족 시 UI에서 어떻게 처리하는지

---

#### GET `/api/shop/cart/count`
**목적**: 장바구니 아이템 수 조회

**응답**:
```json
{
  "count": 5
}
```

**상태**: ✅ 정상

**용도**:
- 헤더 장바구니 아이콘 배지 표시용
- 매우 가벼운 쿼리 (COUNT만)

---

## 📊 Cart 도메인 정리

### ✅ 잘된 점
1. **자동 장바구니 생성** - 첫 사용 시 자동 생성
2. **중복 상품 처리** - 자동으로 수량 누적
3. **금액 자동 계산** - subtotal, totalProductPrice 자동 계산
4. **소유권 검증** - 본인 장바구니만 수정 가능
5. **최대 수량 검증** - maxOrderQty 체크
6. **가벼운 카운트 API** - 헤더 배지용 최적화

### ⚠️ 개선 필요
1. **재고 검증 모의 구현** - Products와 동일한 문제
2. **stockAvailable 활용** - 이 필드가 실제로 사용되는지 확인 필요

### 🤔 검토 필요
1. 재고 검증 호출 시점 (주문 전? 실시간?)
2. 장바구니 만료 정책 (오래된 아이템 자동 삭제?)
3. 재고 부족 상품 자동 제거 여부

---

## 3️⃣ Orders 컨트롤러

**Base Path**: `/api/shop/orders`

### 엔드포인트 목록

#### POST `/api/shop/orders`
**목적**: 주문 생성

**Request**:
```json
{
  "items": [
    {
      "productId": 38,
      "quantity": 1
    }
  ],
  "shippingAddress": {
    "name": "홍길동",
    "phone": "010-1234-5678",
    "postalCode": "12345",
    "address": "서울시 강남구",
    "detailAddress": "101호"
  },
  "pointUsed": 1000,
  "userCouponId": 5
}
```

**주요 로직** (트랜잭션):
1. 상품 정보 조회 및 검증
2. **챌린지/구독 중복 구매 체크** ✅
3. 상품 상태 검증 (ACTIVE, maxOrderQty)
4. 금액 계산 (상품 + 배송비)
5. 포인트 검증 및 차감
6. 쿠폰 검증 및 사용 처리
7. 주문 및 주문 아이템 생성
8. 배송 정보 생성
9. 주문 상태 로그 생성
10. ~~재고 차감 큐 등록~~ (주석 처리됨)

**상태**: ⚠️ 부분 주석 처리

**문제점**:
1. **재고 차감 로직 미구현**
   - Line 328: `// TODO: InventorySyncQueue 테이블이 없어서 주석 처리`
   - 재고 차감이 실제로 이루어지지 않음
   - 결제 완료 후에도 재고 처리 안됨

2. **배송비 계산 정책**
   - 제주도 우편번호 하드코딩 (63으로 시작)
   - 기본값 하드코딩 (BASE_FEE: 3000, FREE: 50000)
   - shipping_policies 테이블이 없으면 하드코딩 사용

**잘된 점**:
- ✅ 챌린지 중복 구매 방지
- ✅ 트랜잭션 처리
- ✅ 포인트/쿠폰 검증 및 사용
- ✅ 주문 상태 로그 기록
- ✅ 배송비 자동 계산

---

#### GET `/api/shop/orders`
**목적**: 주문 목록 조회 (페이지네이션)

**쿼리**:
- `status`: 주문 상태 필터
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 10)

**응답**:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 42
  }
}
```

**상태**: ✅ 정상

---

#### GET `/api/shop/orders/:orderNumber`
**목적**: 주문 상세 조회

**응답**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "orderNumber": "O20251024123456789",
    "status": "PAID",
    "totalAmount": 89000,
    "shippingFee": 3000,
    "pointUsed": 1000,
    "items": [...],
    "shipping": {...}
  }
}
```

**상태**: ✅ 정상

---

#### POST `/api/shop/orders/:orderNumber/cancel`
**목적**: 주문 취소

**Request**:
```json
{
  "reason": "단순 변심"
}
```

**주요 로직**:
1. 주문 상태 확인 (PENDING_PAYMENT, PAID, PREPARING만 가능)
2. 결제 취소 처리 (토스페이먼츠 API 호출)
3. 주문 상태 → CANCELLED
4. ~~재고 복구~~ (주석 처리됨)
5. 챌린지 티켓 취소 (PURCHASED 상태만)
6. 쿠폰 복구 (USED → ACTIVE)
7. 포인트 복구

**상태**: ⚠️ 부분 주석 처리

**문제점**:
1. **재고 복구 미구현**
   - Line 521: `// TODO: 재고 복구 처리 필요`
   - 취소해도 재고가 복구되지 않음

2. **활성화된 티켓 처리**
   - Line 578: `// TODO: 이미 사용 중인 챌린지가 있는 경우 환불 정책에 따라 처리`
   - 활성화된 티켓이 있으면 로그만 찍고 넘어감
   - 환불 정책이 정의되지 않음

**잘된 점**:
- ✅ PURCHASED 티켓만 취소 가능
- ✅ 쿠폰/포인트 복구
- ✅ 결제 취소 API 연동

---

#### POST `/api/shop/orders/:orderNumber/confirm`
**목적**: 구매 확정

**로직**:
1. 주문 상태 확인 (DELIVERED만 가능)
2. 주문 상태 → CONFIRMED
3. 포인트 적립 (구매 금액의 5%)

**상태**: ✅ 정상

**특징**:
- 배송 완료 후 구매 확정 시 포인트 적립
- 적립 비율: 5% (하드코딩)

---

## 4️⃣ Payment 컨트롤러

**Base Path**: `/api/shop/payment`

### 엔드포인트 목록

#### POST `/api/shop/payment/prepare`
**목적**: 결제 준비 (토스페이먼츠 SDK 초기화용)

**Request**:
```json
{
  "orderNumber": "O20251024123456789"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "orderId": "O20251024123456789",
    "orderName": "주문번호: O20251024123456789",
    "amount": 89000,
    "customerName": "홍길동",
    "customerEmail": "user@example.com",
    "paymentKey": null,
    "status": "PENDING"
  }
}
```

**상태**: ✅ 정상

**특징**:
- Payment 레코드 생성 (status: PENDING)
- 클라이언트에서 토스페이먼츠 SDK 초기화용 데이터 제공

---

#### POST `/api/shop/payment/confirm`
**목적**: 결제 승인 (토스페이먼츠 결제 완료 후)

**Request**:
```json
{
  "paymentKey": "toss_payment_key_123",
  "orderId": "O20251024123456789",
  "amount": 89000
}
```

**주요 로직** (트랜잭션):
1. 주문 및 Payment 레코드 조회
2. 금액 일치 확인
3. **토스페이먼츠 API 호출** (결제 승인)
4. Payment 상태 → COMPLETED
5. Order 상태 → PAID
6. ~~재고 차감 큐 처리~~ (주석 처리됨)
7. **챌린지 티켓 발급** ✅

**상태**: ⚠️ 부분 주석 처리

**문제점**:
1. **재고 차감 미구현**
   - 결제 완료 후에도 재고 처리 안됨
   - InventorySyncQueue 테이블 없음

**잘된 점**:
- ✅ 금액 일치 검증
- ✅ 토스페이먼츠 API 연동
- ✅ 챌린지 티켓 자동 발급
- ✅ 트랜잭션 처리
- ✅ 실패 시 롤백

---

#### POST `/api/shop/payment/cancel`
**목적**: 결제 취소

**Request**:
```json
{
  "orderNumber": "O20251024123456789",
  "cancelReason": "단순 변심"
}
```

**로직**:
1. 토스페이먼츠 취소 API 호출
2. Payment 상태 → CANCELLED
3. Order 상태는 `/orders/:orderNumber/cancel`에서 처리

**상태**: ✅ 정상

---

#### POST `/api/shop/payment/webhook`
**목적**: 토스페이먼츠 웹훅 수신

**로직**:
- 결제 상태 변경 알림 수신
- 로그 기록

**상태**: ✅ 정상

---

#### GET `/api/shop/payment/status/:orderNumber`
**목적**: 결제 상태 조회

**응답**:
```json
{
  "orderNumber": "O20251024123456789",
  "status": "COMPLETED",
  "amount": 89000,
  "paymentKey": "toss_payment_key_123"
}
```

**상태**: ⚠️ 이상한 구현

**문제점**:
- `preparePayment()` 메서드를 재사용해서 조회
- 근데 prepare는 PENDING Payment를 생성하는 로직
- 이미 완료된 결제의 상태를 조회하는데 prepare를 호출하는게 맞나?

---

## 📊 Orders & Payment 도메인 정리

### ✅ 잘된 점
1. **트랜잭션 처리** - 모든 중요 로직에 트랜잭션 적용
2. **챌린지 중복 구매 방지** - 이미 PURCHASED/ACTIVATED 티켓 있으면 차단
3. **챌린지 티켓 자동 발급** - 결제 완료 시 자동 발급
4. **포인트/쿠폰 시스템** - 검증, 사용, 복구 로직 완비
5. **주문 상태 로그** - 모든 상태 변경 기록
6. **토스페이먼츠 연동** - API 통신 구현
7. **배송비 자동 계산** - 금액/지역 기반

### 🔮 추후 작업 예정 (의도된 미구현)
> 형님 확인: 재고/취소/교환/환불/배송관리/결제Mock은 추후 작업 예정

1. **재고 관리 시스템**
   - InventorySyncQueue 테이블 추후 구축 예정

2. **취소/교환/환불 시스템**
   - 활성화된 챌린지 환불 정책 추후 정의

3. **배송 관리 시스템**
   - 배송 추적, 배송 상태 업데이트

4. **실제 결제 연동**
   - 현재 Mock 처리

### ⚠️ 검토 필요한 이슈
1. **결제 상태 조회 API 로직 의심**
   - `GET /payment/status/:orderNumber`
   - preparePayment() 메서드를 재사용
   - prepare는 PENDING Payment 생성하는 로직인데
   - 이미 완료된 결제 조회에 사용하는게 맞나?

---

## 5️⃣ Reviews 컨트롤러

**Base Path**: `/api/shop/reviews`

### 엔드포인트 개요
- 총 12개 엔드포인트
- 리뷰 CRUD + 댓글 CRUD + 유틸리티 API

### 주요 기능
1. **리뷰 작성 시 적립금 지급**
   - 기본 후기: 1,000원
   - 포토 후기 추가: +2,000원
   - 장문 후기(150자 이상): +2,000원
   - 최초 리뷰만 지급 (중복 방지)

2. **리뷰 댓글 시스템**
   - 리뷰에 댓글 작성 가능
   - 사진 첨부 가능 (최대 3장)
   - 본인 댓글만 수정/삭제

3. **도움됨 기능**
   - 리뷰에 도움됨 토글
   - 본인 리뷰에는 불가

4. **별점 통계**
   - 상품별 평균 별점
   - 별점별 리뷰 수

**상태**: ✅ 정상 (로직 복잡하지만 잘 구현됨)

---

## 6️⃣ QnA 컨트롤러

**Base Path**: `/api/shop/qna`

### 엔드포인트 개요
- 총 9개 엔드포인트
- Q&A CRUD + 답변 관리 (관리자)

### 주요 기능
1. **질문 작성**
   - 로그인한 사용자 누구나 작성 가능
   - 비밀글 기능
   - 문의 타입 분류

2. **답변 관리 (관리자 전용)**
   - ManagerGuard 사용
   - 답변 작성/수정/삭제
   - 답변 달린 질문은 수정 불가

3. **비밀글 권한**
   - 작성자만 조회 가능
   - 관리자는 모두 조회 가능

**상태**: ✅ 정상 (권한 관리 잘 됨)

---

## 7️⃣ Banners 컨트롤러

**Base Path**: `/api/shop/banners`

### 엔드포인트
- GET `/shop/banners` - 활성 배너 목록 조회

### 주요 기능
- 배너 타입별 필터링 (SHOP, HOME, EVENT)
- 현재 날짜 기준 활성화된 배너만 반환
- sortOrder 기준 정렬

**상태**: ✅ 정상 (단순 조회)

---

## 📊 쇼핑 도메인 전체 정리

### 🎯 도메인 구조
```
Products (상품)
  ↓
Cart (장바구니)
  ↓
Orders (주문) → Payment (결제)
  ↓
Reviews / QnA (후기/문의)
```

### ✅ 잘 구현된 부분
1. **Products & Cart**
   - 카테고리별 그룹핑
   - 중복 조회 방지
   - 금액 자동 계산
   - 최대 수량 검증

2. **Orders & Payment**
   - 챌린지 중복 구매 방지 ⭐
   - 포인트/쿠폰 시스템
   - 트랜잭션 처리
   - 주문 상태 로그
   - 챌린지 티켓 자동 발급 ⭐

3. **Reviews & QnA**
   - 적립금 지급 로직
   - 댓글 시스템
   - 권한 관리 (ManagerGuard)
   - 비밀글 기능

### 🔮 추후 작업 예정 (의도된 미구현)
> 형님 확인: 재고/취소/교환/환불/배송관리/결제Mock은 추후 작업 예정

1. **재고 관리 시스템**
2. **취소/교환/환불 시스템**
3. **배송 관리 시스템**
4. **실제 결제 연동**

### ⚠️ 검토 필요한 이슈

#### 1. 결제 상태 조회 API 로직 의심
**위치**: `src/shop/controllers/payment.controller.ts:127-138`

```typescript
@Get('status/:orderNumber')
async getPaymentStatus(...) {
  const payment = await this.paymentService.preparePayment(...); // ❌
  return {
    orderNumber,
    status: payment.status,
    amount: payment.amount,
    paymentKey: payment.paymentKey
  };
}
```

**문제**:
- 결제 상태 조회인데 `preparePayment()` 호출
- prepare는 PENDING Payment를 생성하는 로직
- 이미 완료된 결제를 조회해야 하는데 로직이 맞지 않음

**제안**:
- 별도의 `getPaymentStatus()` 메서드 생성
- 또는 Payment 레코드 직접 조회

---

## 🎯 쇼핑 도메인 결론

**전반적 평가**: ✅ **매우 잘 구현됨**

- 핵심 비즈니스 로직(챌린지 중복 방지, 티켓 발급) 완벽
- 트랜잭션 처리 철저
- 권한 관리 적절
- 포인트/쿠폰 시스템 완비

**이슈**:
- 결제 상태 조회 API 1건만 수정 필요
- 나머지는 추후 작업 예정 사항

---

**쇼핑 도메인 감사 완료** ✅
