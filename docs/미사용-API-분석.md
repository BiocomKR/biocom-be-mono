# biocom-bo-api 미사용 API 분석

> 작성일: 25/02/02
> 목적: biocom-admin에서 호출하지 않는 API 정리

## 분석 방법

1. biocom-admin/src/api/*.api.ts에서 호출하는 모든 API 추출
2. biocom-bo-api의 컨트롤러 엔드포인트와 비교
3. 프론트엔드에서 호출하지 않는 엔드포인트 식별

---

## 삭제 완료 목록

### 1. ShippingController (전체 삭제)

| 엔드포인트 | 삭제 이유 |
|-----------|----------|
| `GET /shipping` | OrdersController `/orders`로 대체 |
| `PUT /shipping/:orderNumber/tracking` | `/orders/:id/tracking`으로 대체 |
| `POST /shipping/:orderNumber/start` | `/orders/:id/status`로 대체 |
| `POST /shipping/:orderNumber/complete` | `/orders/:id/status`로 대체 |
| `POST /shipping/batch/status` | 프론트 미사용 |
| `GET /shipping/statistics` | 프론트 미사용 |

### 2. AppConfigController (전체 삭제)

| 엔드포인트 | 삭제 이유 |
|-----------|----------|
| `GET /app-configs` | 프론트 미사용, 관리 UI 없음 |
| `GET /app-configs/:configKey` | 프론트 미사용 |
| `POST /app-configs` | 프론트 미사용 |
| `PUT /app-configs/:configKey` | 프론트 미사용 |
| `DELETE /app-configs/:configKey` | 프론트 미사용 |
| `PUT /app-configs/:configKey/toggle` | 프론트 미사용 |

### 3. ShopController (부분 삭제 - 주문/배송비)

**유지**: `/shop/products/*` (상품 관련)

| 삭제된 엔드포인트 | 삭제 이유 |
|-----------------|----------|
| `GET /shop/orders` | OrdersController `/orders`와 중복 |
| `GET /shop/orders/:orderNumber` | `/orders/:id`와 중복 |
| `PATCH /shop/orders/:orderNumber/status` | `/orders/:id/status`와 중복 |
| `POST /shop/orders/:orderNumber/memo` | 프론트 미사용 |
| `GET /shop/shipping-policies` | 프론트 미사용 |
| `POST /shop/shipping-policies` | 프론트 미사용 |
| `PUT /shop/shipping-policies/:id` | 프론트 미사용 |

### 4. RefundController (부분 삭제)

**유지**: `approve`, `reject`, `admin-cancel` 3개

| 삭제된 엔드포인트 | 삭제 이유 |
|-----------------|----------|
| `GET /refund` | `/orders/claims`로 대체 |
| `GET /refund/:id` | 프론트 미사용 |
| `POST /refund/:id/complete` | 프론트 미사용 |
| `POST /refund/batch/status` | 프론트 미사용 |
| `GET /refund/statistics/summary` | 프론트 미사용 |
| `GET /refund/pending/list` | 프론트 미사용 |
| `POST /refund/return/*` | `/orders/exchange-returns`로 대체 |
| `POST /refund/exchange/*` | `/orders/exchange-returns`로 대체 |

### 5. UploadController (부분 삭제 - AI 기능)

| 삭제된 엔드포인트 | 삭제 이유 |
|-----------------|----------|
| `POST /upload/food-analysis` | 앱용 API, bo-api에 불필요 |
| `POST /upload/face-slimming` | 앱용 API, bo-api에 불필요 |
| `POST /upload/image` | 앱용 API |
| `GET /upload/:id` | 앱용 API |
| `GET /upload` | 앱용 API |
| `DELETE /upload/:id` | 앱용 API |

### 6. PushPersonalizedController (부분 삭제)

| 삭제된 엔드포인트 | 삭제 이유 |
|-----------------|----------|
| `GET /push/personalized/operators` | 프론트 미사용 |

---

## 유지 대상

### OperatorsController
- SYSTEM 권한 전용, CLI/직접 API 호출용
- 프론트에서 호출하지 않지만 운영에 필요

### 삭제 금지 엔드포인트
- `/health/*` - K8s liveness/readiness probe
- `/auth/*` - 인증 관련
- `/toss/*`, `/imweb/*` - 외부 서비스 연동 (현재 컨트롤러 없음)

---

* 작성자: 엄신우
* 작성일: 25/02/02
* 수정일: 25/02/02(초안)
