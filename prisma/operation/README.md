# prisma/operation 스크립트 가이드

DB 데이터 조작용 스크립트 모음. 실행 방법: `npx ts-node prisma/operation/{스크립트명}.ts`

---

## 맞춤솔루션 관련

### 건강유형별 DIET 매핑 기준

| 동물 (ID) | 건강유형 | 1순위 | 2순위 |
|-----------|----------|-------|-------|
| 불여우 (1) | SKIN_HEALTH | 저속노화 (SLOW_AGING) | 저포드맵 (LOW_FODMAP) |
| 북극곰 (2) | METABOLISM | 오리지널 (ORIGINAL) | 시그니처 (SIGNATURE) |
| 펭귄 (3) | GUT_HEALTH | 저포드맵 (LOW_FODMAP) | 오리지널 (ORIGINAL) |
| 고슴도치 (4) | IMMUNE_BALANCE | 저포드맵 (LOW_FODMAP) | 저속노화 (SLOW_AGING) |

### 스크립트 목록

| 스크립트 | 설명 |
|----------|------|
| `add-formula-products.ts` | FORMULA 상품 매핑 (맞춤솔루션 조합 상품) |
| `add-conditional-products.ts` | CONDITIONAL 상품 매핑 (메타드림/리셋데이) |
| `add-skin-health-diets.ts` | 불여우 DIET 매핑 (저속노화 + 저포드맵) |
| `fix-gut-health-diets.ts` | 펭귄 DIET 매핑 수정 (저포드맵 + 오리지널) |
| `fix-immune-balance-diets.ts` | 고슴도치 DIET 매핑 수정 (저포드맵 + 저속노화) |

### HealthTypeAnimalProduct 타입

- `FORMULA`: 맞춤솔루션 조합 상품 (displayOrder: 0번대)
- `SUPPLEMENT`: 단품 영양제 (displayOrder: 1~100번대)
- `DIET`: 식단 상품 (displayOrder: 100번대~)
- `CONDITIONAL`: 조건부 추천 (displayOrder: 200번대)

### 주의사항

- displayOrder는 `(health_type_animal_id, display_order)` unique 제약 있음
- 새 매핑 추가 시 기존 max displayOrder 조회 후 +1부터 시작 필요

---

## 영양제/상품 관련

| 스크립트 | 설명 |
|----------|------|
| `seed-supplement-products.ts` | 영양제 상품 시딩 |
| `seed-supplement-products-v2.ts` | 영양제 상품 시딩 v2 |
| `seed-supplement-nutrients.ts` | 영양제 성분 시딩 |
| `seed-overseas-supplement-products.ts` | 해외직구 영양제 시딩 |
| `seed-meal-products.ts` | 식단 상품 시딩 |
| `seed-product-lineups.ts` | 라인업 시딩 |
| `update-all-mechanisms.ts` | 작용기전 일괄 업데이트 |

---

## 챌린지 관련

| 스크립트 | 설명 | 사용법 |
|----------|------|--------|
| `set-challenge-day.ts` | 챌린지 일차 변경 | `npx ts-node ... [userId] [targetDay]` |
| `seed-missions.ts` | 미션 시딩 | |
| `newcomer-to-challenger.ts` | 신규→챌린저 전환 | |

---

## 중복 상품 정리

MEAL 카테고리와 LUNCHBOX 카테고리에 동일 상품이 중복 등록된 문제 해결용.

### 배경

- 동일 식단이 MEAL(ID: 19~22)과 LUNCHBOX(ID: 64~69) 두 곳에 중복 존재
- LUNCHBOX 상품을 정품으로, MEAL 상품을 INACTIVE 처리

### 스크립트 실행 순서

| 순서 | 스크립트 | 설명 |
|------|----------|------|
| 1 | `find-duplicate-products.ts` | 이름 기준 중복 상품 탐색 |
| 2 | `find-all-duplicates.ts` | 전체 중복 현황 조회 |
| 3 | `check-product-usage.ts` | 상품별 FK 참조 현황 확인 |
| 4 | `compare-csv-db.ts` | CSV와 DB 데이터 비교 |
| 5 | `fix-duplicate-products.ts` | 중복 상품 정리 (FK 이전 + INACTIVE 처리) |

### fix-duplicate-products.ts 동작

1. MEAL → LUNCHBOX로 FK 참조 일괄 변경
2. MEAL 상품 status를 INACTIVE로 변경
3. 중복 매핑 방지 (이미 LUNCHBOX 매핑 있으면 MEAL 매핑 삭제)

### 영향받는 테이블 (Product FK 참조)

| # | 테이블 | 설명 |
|---|--------|------|
| 1 | HealthTypeAnimalProduct | 건강유형별 상품 매핑 |
| 2 | OrderItem | 주문 상품 |
| 3 | CartItem | 장바구니 |
| 4 | ProductFeedback | 상품 피드백 |
| 5 | CouponProduct | 쿠폰 적용 상품 |
| 6 | UserSupplementRoutine | 유저 영양제 루틴 |
| 7 | UserSupplementRoutineHistory | 루틴 히스토리 |
| 8 | Subscription | 구독 |
| 9 | Coupon | 쿠폰 (productId) |
| 10 | IAPProduct | 인앱결제 상품 |
| 11 | ChallengeMission | 챌린지 미션 |
| 12 | ChallengeSurvey | 챌린지 설문 |
| 13 | ChallengeTicket | 챌린지 티켓 |
| 14 | UserChallenge | 유저 챌린지 |
| 15 | Wishlist | 찜 목록 |
| 16 | RecentlyViewed | 최근 본 상품 |
| 17 | UserChallengeSurveyResult | 챌린지 설문 결과 |
| 18 | LectureProduct | 강의 상품 |
| 19 | SupplementNutrient | 영양제 성분 |

---

## 기타

| 스크립트 | 설명 |
|----------|------|
| `seed-consents.ts` | 약관 동의 시딩 |
| `seed-health-check-products.ts` | 건강검사 상품 시딩 |
| `seed-health-type-animal-images.ts` | 건강유형 동물 이미지 시딩 |
| `export-solution-data.ts` | 맞춤솔루션 데이터 JSON 내보내기 |
| `sync-solution-to-prod.ts` | 맞춤솔루션 데이터 프로덕션 동기화 |

---
* 작성자: 엄신우
* 작성일: 24/12/28
* 수정일: 24/12/28(초안)
