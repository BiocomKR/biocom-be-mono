# 쇼핑몰 API 엔드포인트 설계

> 작성일: 2025-01-15
> 작성자: Claude Code (형님 지도하에)

## 1. API 설계 원칙

- RESTful API 규칙 준수
- JWT 인증 필수 (회원 전용 기능)
- 응답 형식 통일 (ApiResponse DTO)
- 페이지네이션 기본 적용 (목록 조회)
- 한글 주석 필수

## 2. 상품 관리 API

### 2.1 카테고리 API

```typescript
// 카테고리 목록 조회 (공개)
GET /api/categories
Query: ?parent_id=1&depth=0
Response: Category[]

// 카테고리 상세 조회 (공개)
GET /api/categories/:id
Response: Category with children

// 카테고리별 상품 조회 (공개)
GET /api/categories/:id/products
Query: ?page=1&limit=20&sort=created_at
Response: PaginatedResponse<Product[]>
```

### 2.2 상품 API

```typescript
// 상품 목록 조회 (공개)
GET /api/products
Query: ?category_id=1&status=ACTIVE&featured=true&page=1&limit=20
Response: PaginatedResponse<Product[]>

// 상품 검색 (공개)
GET /api/products/search
Query: ?q=비타민&page=1&limit=20
Response: PaginatedResponse<Product[]>

// 상품 상세 조회 (공개)
GET /api/products/:id
Response: Product with options, images

// 상품 조회수 증가
POST /api/products/:id/view
Response: { viewCount: number }

// 재고 확인 (실시간)
POST /api/products/check-stock
Body: { items: [{ sku: "P001", quantity: 2 }] }
Response: { items: [{ sku: "P001", available: true, stock: 50 }] }
```

## 3. 장바구니 API

```typescript
// 장바구니 조회 (회원)
GET /api/cart
Headers: Authorization: Bearer {token}
Response: Cart with items

// 장바구니 추가 (회원)
POST /api/cart/items
Headers: Authorization: Bearer {token}
Body: { productOptionId: 1, quantity: 2 }
Response: CartItem

// 장바구니 수량 변경 (회원)
PATCH /api/cart/items/:id
Headers: Authorization: Bearer {token}
Body: { quantity: 3 }
Response: CartItem

// 장바구니 삭제 (회원)
DELETE /api/cart/items/:id
Headers: Authorization: Bearer {token}
Response: { success: true }

// 장바구니 전체 삭제 (회원)
DELETE /api/cart/clear
Headers: Authorization: Bearer {token}
Response: { success: true }

// 장바구니 재고 일괄 확인 (회원)
POST /api/cart/validate
Headers: Authorization: Bearer {token}
Response: { valid: boolean, invalidItems: CartItem[] }
```

## 4. 주문/결제 API

### 4.1 주문 API

```typescript
// 주문 생성 (회원)
POST /api/orders
Headers: Authorization: Bearer {token}
Body: {
  cartItemIds: [1, 2, 3],
  shippingAddress: {
    recipientName: "홍길동",
    recipientPhone: "010-1234-5678",
    postalCode: "06234",
    address: "서울시 강남구",
    addressDetail: "123호",
    deliveryMessage: "부재시 경비실"
  },
  pointUsed: 5000
}
Response: Order

// 주문 목록 조회 (회원)
GET /api/orders
Headers: Authorization: Bearer {token}
Query: ?status=PAID&page=1&limit=10
Response: PaginatedResponse<Order[]>

// 주문 상세 조회 (회원)
GET /api/orders/:orderNumber
Headers: Authorization: Bearer {token}
Response: Order with items, payment, shipping

// 주문 취소 요청 (회원)
POST /api/orders/:orderNumber/cancel
Headers: Authorization: Bearer {token}
Body: { reason: "단순 변심", reasonDetail: "색상이 마음에 안들어요" }
Response: Refund

// 구매 확정 (회원)
POST /api/orders/:orderNumber/confirm
Headers: Authorization: Bearer {token}
Response: { success: true, pointsEarned: 500 }

// 주문 상태 조회 (회원)
GET /api/orders/:orderNumber/status
Headers: Authorization: Bearer {token}
Response: { status: "SHIPPED", logs: OrderStateLog[] }
```

### 4.2 결제 API

```typescript
// 결제 준비 (토스페이먼츠)
POST /api/payments/prepare
Headers: Authorization: Bearer {token}
Body: { orderNumber: "O20250814115621567", paymentMethod: "CARD" }
Response: {
  paymentKey: "toss_payment_key",
  orderId: "O20250814115621567",
  amount: 45000
}

// 결제 승인 (토스페이먼츠 콜백)
POST /api/payments/approve
Headers: Authorization: Bearer {token}
Body: {
  paymentKey: "toss_payment_key",
  orderId: "O20250814115621567",
  amount: 45000
}
Response: Payment

// 결제 실패 처리
POST /api/payments/fail
Headers: Authorization: Bearer {token}
Body: {
  orderNumber: "O20250814115621567",
  errorCode: "PAY_PROCESS_ABORTED",
  errorMessage: "사용자가 결제를 취소했습니다"
}
Response: { success: true }
```

## 5. 배송 API

```typescript
// 배송 조회 (회원)
GET /api/orders/:orderNumber/shipping
Headers: Authorization: Bearer {token}
Response: Shipping

// 배송 추적 (회원)
GET /api/shipping/:trackingNumber/track
Headers: Authorization: Bearer {token}
Response: ShippingTrack[]

// 배송비 계산
POST /api/shipping/calculate
Body: {
  totalAmount: 45000,
  postalCode: "63001" // 제주
}
Response: { shippingFee: 3000, policy: ShippingPolicy }
```

## 6. 리뷰/문의 API

### 6.1 리뷰 API

```typescript
// 리뷰 목록 조회 (공개)
GET /api/products/:productId/reviews
Query: ?rating=5&page=1&limit=10
Response: PaginatedResponse<ProductReview[]>

// 리뷰 작성 (회원, 구매자만)
POST /api/products/:productId/reviews
Headers: Authorization: Bearer {token}
Body: {
  orderItemId: 123,
  rating: 5,
  title: "정말 좋아요",
  content: "효과가 확실해요",
  mediaUrls: ["image1.jpg"]
}
Response: ProductReview

// 리뷰 수정 (작성자)
PUT /api/reviews/:id
Headers: Authorization: Bearer {token}
Body: { title: "수정된 제목", content: "수정된 내용" }
Response: ProductReview

// 리뷰 삭제 (작성자)
DELETE /api/reviews/:id
Headers: Authorization: Bearer {token}
Response: { success: true }

// 리뷰 도움됨 표시
POST /api/reviews/:id/helpful
Headers: Authorization: Bearer {token}
Response: { helpfulCount: 10 }
```

### 6.2 상품 문의 API

```typescript
// 문의 목록 조회 (공개, 비밀글 제외)
GET /api/products/:productId/questions
Query: ?answered=true&page=1&limit=10
Response: PaginatedResponse<ProductQuestion[]>

// 문의 작성 (회원)
POST /api/products/:productId/questions
Headers: Authorization: Bearer {token}
Body: {
  questionType: "PRODUCT",
  title: "성분 문의",
  content: "임산부도 먹어도 되나요?",
  isSecret: false
}
Response: ProductQuestion

// 문의 상세 조회 (작성자 또는 공개글)
GET /api/questions/:id
Headers: Authorization: Bearer {token}
Response: ProductQuestion with replies
```

## 7. 부가 기능 API

### 7.1 찜하기 API

```typescript
// 찜 목록 조회 (회원)
GET /api/wishlist
Headers: Authorization: Bearer {token}
Query: ?page=1&limit=20
Response: PaginatedResponse<Product[]>

// 찜 추가 (회원)
POST /api/wishlist
Headers: Authorization: Bearer {token}
Body: { productId: 123 }
Response: { success: true }

// 찜 삭제 (회원)
DELETE /api/wishlist/:productId
Headers: Authorization: Bearer {token}
Response: { success: true }

// 찜 여부 확인 (회원)
GET /api/products/:productId/wished
Headers: Authorization: Bearer {token}
Response: { wished: true }
```

### 7.2 최근 본 상품 API

```typescript
// 최근 본 상품 목록 (회원)
GET /api/recently-viewed
Headers: Authorization: Bearer {token}
Query: ?limit=10
Response: Product[]

// 최근 본 상품 기록
POST /api/recently-viewed
Headers: Authorization: Bearer {token}
Body: { productId: 123 }
Response: { success: true }

// 최근 본 상품 전체 삭제
DELETE /api/recently-viewed/clear
Headers: Authorization: Bearer {token}
Response: { success: true }
```

## 8. 관리자 API (추후 구현)

```typescript
// 상품 관리
POST /api/admin/products
PUT /api/admin/products/:id
DELETE /api/admin/products/:id

// 주문 관리
GET /api/admin/orders
PATCH /api/admin/orders/:id/status

// 배송 관리
POST /api/admin/shipping/:orderId/ship
PUT /api/admin/shipping/:orderId/tracking

// 환불 처리
POST /api/admin/refunds/:id/approve
POST /api/admin/refunds/:id/reject

// 리뷰 관리
PATCH /api/admin/reviews/:id/hide
PATCH /api/admin/reviews/:id/best

// 문의 답변
POST /api/admin/questions/:id/answer
```

## 9. 재고 동기화 Worker (백그라운드)

```typescript
// 재고 동기화 큐 처리
// 5분마다 실행
async function processInventorySyncQueue() {
  // 1. PENDING 상태 큐 조회
  // 2. 외부 재고 API 호출
  // 3. 성공/실패 처리
  // 4. 재시도 로직
}

// 재고 캐시 갱신
// 10분마다 실행
async function refreshInventoryCache() {
  // 1. 인기 상품 SKU 목록 조회
  // 2. 외부 재고 API 일괄 조회
  // 3. 캐시 업데이트
}
```

## 10. 응답 형식

### 성공 응답
```json
{
  "success": true,
  "data": {},
  "message": "성공적으로 처리되었습니다"
}
```

### 에러 응답
```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "상품을 찾을 수 없습니다",
    "details": {}
  }
}
```

### 페이지네이션 응답
```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

## 11. 에러 코드

```typescript
enum ShoppingErrorCode {
  // 상품 관련
  PRODUCT_NOT_FOUND = "PRODUCT_NOT_FOUND",
  PRODUCT_SOLD_OUT = "PRODUCT_SOLD_OUT",
  INVALID_PRODUCT_OPTION = "INVALID_PRODUCT_OPTION",
  
  // 장바구니 관련
  CART_ITEM_NOT_FOUND = "CART_ITEM_NOT_FOUND",
  EXCEED_MAX_ORDER_QTY = "EXCEED_MAX_ORDER_QTY",
  
  // 주문 관련
  ORDER_NOT_FOUND = "ORDER_NOT_FOUND",
  INVALID_ORDER_STATUS = "INVALID_ORDER_STATUS",
  ALREADY_CANCELLED = "ALREADY_CANCELLED",
  CANNOT_CANCEL = "CANNOT_CANCEL",
  
  // 결제 관련
  PAYMENT_FAILED = "PAYMENT_FAILED",
  PAYMENT_AMOUNT_MISMATCH = "PAYMENT_AMOUNT_MISMATCH",
  
  // 재고 관련
  INSUFFICIENT_STOCK = "INSUFFICIENT_STOCK",
  INVENTORY_API_ERROR = "INVENTORY_API_ERROR",
  
  // 리뷰 관련
  ALREADY_REVIEWED = "ALREADY_REVIEWED",
  NOT_PURCHASED = "NOT_PURCHASED",
  REVIEW_NOT_FOUND = "REVIEW_NOT_FOUND"
}
```

## 12. 구현 우선순위

### Phase 1 (핵심 기능)
1. 카테고리/상품 조회 API
2. 장바구니 API
3. 주문 생성 API
4. 결제 연동 (토스페이먼츠)

### Phase 2 (필수 기능)
1. 주문 관리 API
2. 배송 조회 API
3. 환불 처리 API
4. 재고 동기화

### Phase 3 (부가 기능)
1. 리뷰 API
2. 상품 문의 API
3. 찜하기 API
4. 최근 본 상품 API

### Phase 4 (관리자)
1. 상품 관리
2. 주문/배송 관리
3. 리뷰/문의 관리

---

*이 문서는 지속적으로 업데이트됩니다.*