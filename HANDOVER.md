# biocom-bo-api 인수인계 문서

> 최종 업데이트: 2025-12-16
> 작성자: Claude Code

## 프로젝트 개요

- **이름**: biocom-bo-api (관리자 백엔드)
- **역할**: 관리자 웹페이지(biocom-admin)에서 호출하는 API
- **프레임워크**: NestJS

---

## 프로젝트 간 관계

### 바이오컴 프로젝트 구조
```
biocom-api (유저 백엔드) - 앱에서 호출
    ↓ 같은 DB 사용, 스키마 공유
biocom-bo-api (관리자 백엔드) - 관리자 웹에서 호출 ← 현재 프로젝트
    ↓ 같은 DB 사용, 스키마 공유
biocom-mq (메시지 큐 워커)
```

### 동기화 필수 항목
| 항목 | 파일 위치 | 동기화 대상 |
|------|----------|------------|
| Prisma Schema | `prisma/schema.prisma` | biocom-api, biocom-bo-api, biocom-mq |
| OrderStatus enum | `src/common/enums/order-status.enum.ts` | biocom-api ↔ biocom-bo-api |
| PaymentStatus enum | `src/common/enums/payment-status.enum.ts` | biocom-api ↔ biocom-bo-api |
| ProductStatus enum | `src/common/enums/` | biocom-api ↔ biocom-bo-api |

### 스키마/Enum 변경 시 주의사항
1. **한 프로젝트에서만 변경하면 다른 프로젝트 빌드 실패**
2. CLAUDE.md의 `SCHEMA_CHANGE` 절차 반드시 따를 것
3. enum 변경 시 양쪽 프로젝트 모두 수정 후 `prisma generate`

---

## 도메인별 컨텍스트

### Shop (주문/결제) 도메인

#### 상태 전이 규칙
```typescript
// 구현: src/shop/shop.service.ts - ORDER_STATUS_TRANSITIONS
// 정책 문서: /repo/docs/251212_결제주문상태관리.md

PENDING_PAYMENT → PAID, CANCELLED, PAYMENT_FAILED
PAID → PREPARING, CANCELLED
PREPARING → SHIPPED, CANCELLED
SHIPPED → DELIVERED, CANCEL_REQUESTED  // 송장 등록 후 취소 시
DELIVERED → COMPLETED
CANCEL_REQUESTED → CANCELLED  // 실무자 확인 후
CANCELLED → (변경 불가)
COMPLETED → (변경 불가)
PAYMENT_FAILED → CANCELLED
```

#### 관리자 주문 상태 변경 API
- `PATCH /shop/orders/:orderNumber/status`
- enum 검증 + 상태 전이 규칙 검증 적용됨
- 유효하지 않은 전이 시도 시 400 에러

#### 주의사항
- 주문 상태 변경 시 `ORDER_STATUS_TRANSITIONS` 규칙 체크
- CANCEL_REQUESTED 상태는 실무자가 반품 회수 확인 후 CANCELLED로 처리

#### 관련 파일
- 주문/상품 관리: `src/shop/shop.service.ts`
- 리뷰/Q&A 관리: `src/shop/feedback.service.ts`

---

## 기술적 주의사항

### KST 날짜/시간 처리
- **절대 금지**: `new Date()` 직접 사용
- **필수 사용**: `getNowKST()`, `stringToKSTDate()` from `src/common/utils/kst-date.util.ts`
- **이유**: Prisma ORM이 모든 Date 객체를 UTC로 변환함

### 쿼리 최적화
- N+1 문제 방지: 반복문 안에서 Prisma 쿼리 금지
- 독립적인 쿼리는 `Promise.all()` 병렬 실행

---

## 핵심 파일 구조

```
src/
├── common/
│   ├── enums/              # OrderStatus, ProductStatus 등
│   └── utils/
│       └── kst-date.util.ts  # KST 날짜 유틸
├── shop/
│   ├── shop.controller.ts   # 상품/주문 관리 API
│   ├── shop.service.ts      # ORDER_STATUS_TRANSITIONS 정의
│   ├── feedback.controller.ts
│   └── feedback.service.ts  # 리뷰/Q&A 관리
└── upload/
    └── upload.service.ts    # GCS 이미지 업로드
```

---

* 작성자: 엄신우
* 작성일: 25/12/16
* 수정일: 25/12/16(초안)
