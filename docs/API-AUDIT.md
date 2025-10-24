# API 감사 (API Audit)

> 작성일: 2025-10-23
> 목적: 각 도메인별 API의 목적과 실제 사용 여부를 점검

## 📋 도메인 분류

### 1. 👤 사용자 & 인증 (Auth & Users)
- `auth.controller.ts` - 인증 (로그인, 회원가입)
- `users.controller.ts` - 사용자 정보 관리

### 2. 🎯 챌린지 (Challenge)
- `challenge.controller.ts` - 챌린지 관리

### 3. 📝 미션 & 퀴즈 (Mission & Quiz)
- `mission.controller.ts` - 미션 조회 및 수행
- `record-completion.controller.ts` - 기록형 미션 완료
- `quiz-completion.controller.ts` - 퀴즈 완료

### 4. 📊 트래킹 (Tracking)
- `records.controller.ts` - 기록 관리
- `statistics.controller.ts` - 통계 조회

### 5. 📋 설문 (Survey)
- `survey.controller.ts` - 설문 조회 및 제출

### 6. 📚 컨텐츠 (Content)
- `content.controller.ts` - 컨텐츠 조회

### 7. 🛒 쇼핑 (Shop)
- `products.controller.ts` - 상품 조회
- `cart.controller.ts` - 장바구니
- `orders.controller.ts` - 주문 관리
- `payment.controller.ts` - 결제
- `reviews.controller.ts` - 리뷰
- `qna.controller.ts` - 상품 Q&A
- `banners.controller.ts` - 배너

### 8. 🎁 포인트 & 쿠폰 (Point & Coupon)
- `point.controller.ts` - 포인트 관리
- `coupon.controller.ts` - 쿠폰 관리

### 9. 🎮 기타 기능 (Others)
- `ai-persona.controller.ts` - AI 페르소나
- `balance-game.controller.ts` - 밸런스 게임
- `upload.controller.ts` - 파일 업로드
- `home.controller.ts` - 홈 화면
- `health.controller.ts` - 헬스체크

### 10. 🔧 관리자 (Management)
- `management-users.controller.ts` - 사용자 관리
- `management-challenge.controller.ts` - 챌린지 관리
- `management-mission.controller.ts` - 미션 관리
- `management-quiz-master.controller.ts` - 퀴즈 관리
- `management-survey.controller.ts` - 설문 관리
- `management-content.controller.ts` - 컨텐츠 관리
- `management-shop.controller.ts` - 쇼핑 관리
- `management-shipping.controller.ts` - 배송 관리
- `management-refund.controller.ts` - 환불 관리
- `management-point.controller.ts` - 포인트 관리
- `management-dashboard.controller.ts` - 대시보드
- `management-api-key.controller.ts` - API 키 관리

---

## 🔍 도메인별 상세 분석

### ✅ 완료
- 없음

### 🔄 진행 중
- 챌린지 도메인

### ⏳ 대기 중
- 사용자 & 인증
- 미션 & 퀴즈
- 트래킹
- 설문
- 컨텐츠
- 쇼핑
- 포인트 & 쿠폰
- 기타 기능
- 관리자

---

## 📝 분석 템플릿

각 도메인 분석 시 아래 템플릿을 사용:

```markdown
## [도메인명] 분석

### Controller: [파일명]
**Base Path**: `/api/[경로]`

#### 엔드포인트 목록

| Method | Path | 목적 | 상태 | 비고 |
|--------|------|------|------|------|
| GET | /example | 예시 조회 | ✅ 정상 | |
| POST | /example | 예시 생성 | ⚠️ 검토필요 | 불필요한 조인 |
| DELETE | /example | 예시 삭제 | ❌ 문제 | 사용 안함 |

#### 문제점
1. [문제 1]
2. [문제 2]

#### 개선 방안
1. [개선안 1]
2. [개선안 2]
```

---

## 🎯 우선순위

1. **High**: 챌린지, 미션, 쇼핑 (핵심 비즈니스)
2. **Medium**: 설문, 트래킹, 포인트
3. **Low**: 기타 기능
4. **관리자**: 별도 검토
