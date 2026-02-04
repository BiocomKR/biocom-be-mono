# 쿠폰 도메인 API 감사

> 작성일: 2025-10-24
> 분석자: Claude
> 상태: ✅ 완료

---

## 📍 쿠폰 도메인 구조

**컨트롤러**: Coupon (5개 엔드포인트)

**주요 기능**:
- 사용자 쿠폰 관리
- 상품별 쿠폰 조회 및 할인 계산
- 쿠폰 유효성 검증
- 주문 시 쿠폰 사용 처리

---

## 🎯 비즈니스 플로우

```
밸런스게임 완료
  ↓
쿠폰 발급 (UserCoupon 생성)
  ↓
쿠폰 보유 목록 조회 - GET /coupons
  ↓
상품별 사용 가능 쿠폰 조회 - GET /coupons/available/:productId
  ↓
쿠폰 유효성 검증 - GET /coupons/:userCouponId/validate
  ↓
주문 생성 시 쿠폰 적용 - POST /coupons/:userCouponId/use
  ↓
쿠폰 상태: USED (사용완료)
```

---

## 1️⃣ Coupon 컨트롤러

**Base Path**: `/api/coupons`

### 엔드포인트 목록

#### A. 쿠폰 조회
- GET `/` - 보유 쿠폰 목록 조회
- GET `/available/:productId` - 상품별 사용 가능한 쿠폰 조회
- GET `/:userCouponId` - 쿠폰 상세 정보 조회

#### B. 쿠폰 검증
- GET `/:userCouponId/validate` - 쿠폰 유효성 검증

#### C. 쿠폰 사용
- POST `/:userCouponId/use` - 쿠폰 사용 (주문 시)

---

### 주요 엔드포인트 상세

#### GET `/coupons`
**목적**: 사용자가 보유한 모든 쿠폰 조회

**응답**:
```json
{
  "coupons": [
    {
      "id": 1,
      "couponId": 10,
      "name": "첫 구매 10% 할인",
      "description": "첫 구매 시 10% 할인",
      "discountType": "PERCENTAGE",
      "discountValue": 10,
      "maxDiscountAmount": 5000,
      "productName": "바이오컴 챌린지",
      "status": "ACTIVE",
      "issuedAt": "2025-10-24T10:00:00Z",
      "expiresAt": "2025-10-26T10:00:00Z",
      "remainingHours": 36
    }
  ],
  "totalCount": 5,
  "activeCount": 3
}
```

**상태**: ✅ 정상

**특징**:
- 만료 시간 실시간 계산 (`remainingHours`)
- 상태별 카운트 제공
- 만료된 쿠폰도 표시 (상태: EXPIRED)

---

#### GET `/coupons/available/:productId`
**목적**: 특정 상품에 사용 가능한 쿠폰 조회 및 할인 계산

**파라미터**:
- `productId`: 상품 ID

**응답**:
```json
{
  "productId": 1,
  "productName": "바이오컴 챌린지",
  "availableCoupons": [
    {
      "id": 1,
      "couponId": 10,
      "name": "첫 구매 10% 할인",
      "description": "첫 구매 시 10% 할인",
      "discountType": "PERCENTAGE",
      "discountValue": 10,
      "maxDiscountAmount": 5000,
      "expectedDiscount": 4500,
      "remainingHours": 36
    }
  ],
  "originalPrice": 45000,
  "maxDiscount": 4500
}
```

**상태**: ✅ 정상

**특징**:
- 예상 할인 금액 계산 (`expectedDiscount`)
- 최대 할인 금액 제한 적용
- 만료되지 않은 쿠폰만 조회 (`expiresAt > now`)
- 활성 상태 쿠폰만 조회 (`status = ACTIVE`, `coupon.isActive = true`)

**할인 계산 로직**:
```typescript
if (discountType === 'PERCENTAGE') {
  expectedDiscount = floor(originalPrice * discountValue / 100);
  if (maxDiscountAmount) {
    expectedDiscount = min(expectedDiscount, maxDiscountAmount);
  }
} else {
  expectedDiscount = min(discountValue, originalPrice);
}
```

---

#### GET `/coupons/:userCouponId/validate`
**목적**: 쿠폰 유효성 검증 및 할인 금액 확인

**파라미터**:
- `userCouponId`: 사용자 쿠폰 ID
- `productId`: 적용할 상품 ID (쿼리 파라미터)

**응답 (유효한 경우)**:
```json
{
  "isValid": true,
  "message": "사용 가능한 쿠폰입니다",
  "expectedDiscount": 4500,
  "remainingHours": 36
}
```

**응답 (유효하지 않은 경우)**:
```json
{
  "isValid": false,
  "message": "만료된 쿠폰입니다"
}
```

**상태**: ✅ 정상

**검증 항목**:
1. 쿠폰 존재 여부 및 소유권 확인
2. 상태 확인 (`status = ACTIVE`)
3. 만료 시간 확인 (`expiresAt > now`)
4. 상품 일치 확인 (`coupon.productId === productId`)

---

#### POST `/coupons/:userCouponId/use`
**목적**: 주문 시 쿠폰 사용 처리

**파라미터**:
- `userCouponId`: 사용할 쿠폰 ID

**Request**:
```json
{
  "orderId": 123
}
```

**응답**:
```json
{
  "success": true,
  "message": "쿠폰이 성공적으로 적용되었습니다",
  "discountAmount": 4500,
  "usedCoupon": {
    "id": 1,
    "name": "첫 구매 10% 할인",
    "discountType": "PERCENTAGE",
    "discountValue": 10,
    "usedAt": "2025-10-24T15:30:00Z"
  }
}
```

**상태**: ✅ 정상

**주요 로직**:
1. 쿠폰 유효성 재확인
2. 주문 정보 확인
3. 주문 상품 중 쿠폰 적용 가능한 상품 확인
4. 할인 금액 계산 (수량 고려)
5. 쿠폰 상태 업데이트 (`ACTIVE` → `USED`)
6. `usedAt`, `usedOrderId` 기록

**할인 계산 (주문 시)**:
```typescript
if (discountType === 'PERCENTAGE') {
  discountAmount = floor(productPrice * quantity * discountValue / 100);
  if (maxDiscountAmount) {
    discountAmount = min(discountAmount, maxDiscountAmount);
  }
} else {
  discountAmount = min(discountValue, productPrice * quantity);
}
```

---

#### GET `/coupons/:userCouponId`
**목적**: 쿠폰 상세 정보 조회

**응답**:
```json
{
  "id": 1,
  "couponId": 10,
  "name": "첫 구매 10% 할인",
  "description": "첫 구매 시 10% 할인",
  "discountType": "PERCENTAGE",
  "discountValue": 10,
  "maxDiscountAmount": 5000,
  "product": {
    "id": 1,
    "name": "바이오컴 챌린지",
    "price": 45000
  },
  "status": "ACTIVE",
  "issuedAt": "2025-10-24T10:00:00Z",
  "expiresAt": "2025-10-26T10:00:00Z",
  "remainingHours": 36,
  "usedAt": null
}
```

**상태**: ✅ 정상

---

## 📊 데이터베이스 스키마

### Coupon 테이블
```prisma
model Coupon {
  id                Int      @id @default(autoincrement())
  name              String   @db.VarChar(200)
  description       String?
  discountType      String   @map("discount_type") @db.VarChar(20)
  discountValue     Int      @map("discount_value")
  maxDiscountAmount Int?     @map("max_discount_amount")
  productId         Int      @map("product_id")
  validHours        Int      @default(48) @map("valid_hours")
  isActive          Boolean  @default(true) @map("is_active")
  createdAt         DateTime @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  @@index([productId, isActive])
  @@map("coupons")
}
```

**할인 타입**:
- `PERCENTAGE`: 퍼센트 할인
- `AMOUNT`: 고정 금액 할인

---

### UserCoupon 테이블
```prisma
model UserCoupon {
  id          Int       @id @default(autoincrement())
  userId      Int       @map("user_id")
  couponId    Int       @map("coupon_id")
  status      String    @default("ACTIVE") @db.VarChar(20)
  issuedAt    DateTime  @map("issued_at")
  expiresAt   DateTime  @map("expires_at")
  usedAt      DateTime? @map("used_at")
  usedOrderId Int?      @map("used_order_id")

  @@index([userId, status])
  @@index([couponId])
  @@index([expiresAt])
  @@map("user_coupons")
}
```

**쿠폰 상태**:
- `ACTIVE`: 사용 가능
- `USED`: 사용 완료
- `EXPIRED`: 만료

---

## 🔍 쿠폰 도메인 정리

### ✅ 잘된 점
1. **체계적인 할인 계산**
   - 퍼센트/고정금액 할인 모두 지원
   - 최대 할인 금액 제한 기능
   - 수량 고려한 할인 계산

2. **엄격한 유효성 검증**
   - 만료 시간 실시간 체크
   - 상품 일치 확인
   - 중복 사용 방지

3. **사용자 편의성**
   - 남은 시간 표시 (`remainingHours`)
   - 예상 할인 금액 미리 계산
   - 상품별 최대 할인 금액 안내

4. **관리 기능**
   - 만료된 쿠폰 자동 정리 (`cleanupExpiredCoupons`)
   - 사용 이력 추적 (`usedAt`, `usedOrderId`)

5. **성능 최적화**
   - 적절한 인덱스 설정
   - 필요한 필드만 조회

### 🤔 검토 필요사항

#### 1. userId 추출 불일치 ⚠️
**위치**: [coupon.controller.ts:50](src/coupons/controllers/coupon.controller.ts#L50)

**문제**:
- 다른 도메인은 `req.user.userId` 사용
- Coupon 컨트롤러만 `req.user.id` 사용
- 표준화 필요

```typescript
// 현재 (coupon.controller.ts)
const userId = req.user.id;  // ❌ 다른 도메인과 불일치

// 다른 도메인 (challenge, mission, survey, content 등)
const userId = req.user.userId || req.user.sub;  // ✅ 표준
```

**영향**:
- JWT 토큰의 payload 구조에 따라 userId가 없을 수 있음
- 인증 실패 가능성

**권장 조치**:
```typescript
const userId = req.user.userId || req.user.sub || req.user.id;
```

---

#### 2. 쿠폰 발급 API 없음 ⚠️
**현재 상황**:
- 쿠폰 조회/사용 API만 존재
- 쿠폰 발급 API 없음

**추정 시나리오**:
- 밸런스게임 완료 시 자동 발급 (UserBalanceGameHistory 관련)
- 관리자가 직접 DB에서 발급?

**질문**:
1. 사용자가 직접 쿠폰을 발급받는 기능이 필요한가?
2. 프로모션 코드 입력으로 쿠폰 발급하는 기능은?

---

#### 3. 할인 금액 계산 중복 로직
**문제**:
- `getAvailableCouponsForProduct` (line 127-134)
- `validateCoupon` (line 221-228)
- `useCoupon` (line 297-304)
- 동일한 할인 계산 로직이 3곳에 중복

**권장 조치**:
```typescript
private calculateDiscount(
  discountType: string,
  discountValue: number,
  price: number,
  quantity: number = 1,
  maxDiscountAmount?: number
): number {
  let discount = 0;

  if (discountType === 'PERCENTAGE') {
    discount = Math.floor(price * quantity * discountValue / 100);
    if (maxDiscountAmount) {
      discount = Math.min(discount, maxDiscountAmount);
    }
  } else {
    discount = Math.min(discountValue, price * quantity);
  }

  return discount;
}
```

---

#### 4. 배치 작업 실행 주기
**위치**: [coupon.service.ts:390](src/coupons/services/coupon.service.ts#L390)

**질문**:
- `cleanupExpiredCoupons` 배치 작업이 어디서 호출되는가?
- Cron job 설정되어 있는가?

**현재**: 메서드만 존재, 호출 코드 없음

**권장**:
- NestJS `@Cron` 데코레이터로 자동 실행
- 예: 매일 자정에 실행

```typescript
@Cron('0 0 * * *') // 매일 자정
async cleanupExpiredCoupons() {
  // ...
}
```

---

## 🎯 쿠폰 도메인 결론

**전반적 평가**: ✅ **매우 잘 구현됨**

- 할인 계산 로직 정확
- 유효성 검증 엄격
- 사용자 편의 기능 우수
- 성능 최적화 적절

**개선 제안**:
1. **필수**: userId 추출 로직 표준화 (`req.user.userId || req.user.sub`)
2. **선택**: 할인 계산 로직 공통 함수로 추출
3. **선택**: 배치 작업 자동 실행 설정
4. **확인**: 쿠폰 발급 플로우 명확화

---

**쿠폰 도메인 감사 완료** ✅
