# 챌린지 도메인 API 감사

> 작성일: 2025-10-23
> 분석자: Claude
> 상태: 🔄 진행 중

---

## 📍 Controller: challenge.controller.ts
**Base Path**: `/api/challenges`

---

## 🎯 비즈니스 플로우

```
1. 챌린지 상품 구매 (Shop 도메인)
   ↓
2. 이용권 발급 (ChallengeTicket 생성)
   ↓
3. 이용 가능한 티켓 조회 (/my-tickets)
   ↓
4. 시작일 설정 (/schedule/start-date)
   ↓
5. 챌린지 진행 (/my-active)
   ↓
6. 설문 전후 비교 (/survey-comparison)
```

---

## 📋 엔드포인트 목록

### 1️⃣ GET `/api/challenges`
**목적**: 구매 가능한 챌린지 목록 조회

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "id": 38,
      "name": "이너뷰티 챌린지",
      "description": "...",
      "totalDays": 21,
      "isActive": true,
      "products": [...]
    }
  ]
}
```

**상태**: ✅ 정상

**검토 필요 사항**:
- [ ] 실제 앱에서 사용되는가?
- [ ] products 배열이 필요한가? (쇼핑에서 조회하면 되지 않나?)

---

### 2️⃣ GET `/api/challenges/my-tickets`
**목적**: 구매했지만 아직 활성화하지 않은 이용권 목록 조회

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "challenge": {...},
      "purchaseDate": "2025-10-23T10:00:00.000Z",
      "status": "PURCHASED"
    }
  ]
}
```

**상태**: ✅ 수정 완료 (2025-10-23)

**변경 사항**:
- PURCHASED 상태만 조회하도록 수정
- 불필요한 challengeStatus, startDate, endDate 필드 제거

---

### 3️⃣ GET `/api/challenges/my-active`
**목적**: 현재 진행 중인 챌린지 + 오늘의 활동 조회

**응답**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "challenge": {...},
    "activatedAt": "2025-10-16T07:17:42.287Z",
    "expiresAt": "2025-11-04T23:59:59.000Z",
    "currentDay": 7,
    "totalPoints": 1500,
    "status": "ACTIVE",
    "todayActivities": {
      "currentDay": 7,
      "todayDate": "2025-10-23",
      "missions": [...],
      "surveys": [...],
      "quizzes": [...],
      "contents": []
    }
  }
}
```

**상태**: ⚠️ 검토 필요

**잠재적 문제점**:
1. **너무 많은 정보를 한 번에 조회**
   - 챌린지 기본 정보
   - 오늘의 미션, 설문, 퀴즈, 컨텐츠
   - 이것들이 정말 한 화면에서 다 필요한가?

2. **currentDay 중복**
   - 최상위에 `currentDay: 7`
   - `todayActivities.currentDay: 7`
   - 왜 두 번?

3. **contents 항상 빈 배열**
   - 코드 보니 `const contents = []` 하드코딩
   - 이게 왜 있음?

**검토 필요 사항**:
- [ ] API를 분리하는게 나을까?
  - `/my-active` - 챌린지 기본 정보만
  - `/my-active/today` - 오늘의 활동만
- [ ] 실제 앱에서 어떻게 사용되는지 확인 필요

---

### 4️⃣ POST `/api/challenges/activate`
**목적**: 챌린지 활성화 (구식 메서드)

**Request**:
```json
{
  "ticketId": 1
}
```

**상태**: ⚠️ Deprecated?

**문제점**:
1. **시작일 설정 없이 바로 활성화**
   - 구매 즉시 시작?
   - 사용자가 시작일을 선택할 수 없음

2. **신규 API와 중복**
   - `POST /:productId/schedule/start-date` 가 신규 방식
   - 이 API는 deprecated인가?

**검토 필요 사항**:
- [ ] 실제로 사용되는가?
- [ ] 제거 가능한가?
- [ ] 아니면 즉시 시작용으로 남겨둘 것인가?

---

### 5️⃣ GET `/api/challenges/:productId/survey-comparison`
**목적**: 챌린지 사전/사후 설문 비교

**응답**:
```json
{
  "success": true,
  "data": {
    "before": {
      "category": "DOG",
      "animalCharacter": "허스키",
      "scores": {
        "skinHealth": 60,
        "metabolism": 70,
        ...
      }
    },
    "after": {
      "category": "CAT",
      "scores": {...}
    },
    "scoreComparison": {
      "skinHealth": {
        "before": 60,
        "after": 75,
        "change": 15,
        "improvement": 25.0
      },
      ...
    }
  }
}
```

**상태**: ✅ 정상

**검토 필요 사항**:
- [ ] 언제 호출되는가? (챌린지 완료 후?)
- [ ] 진행 중에도 볼 수 있어야 하는가?

---

### 6️⃣ GET `/api/challenges/:productId/schedule`
**목적**: 챌린지 일정 조회

**응답**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "startDate": "2025-10-27",
    "deliveryDate": "2025-10-24",
    "endDate": "2025-11-16",
    "isConfirmed": true,
    "canModify": false,
    "purchasedAt": "2025-10-16T07:01:04.891Z",
    "createdAt": "2025-10-22T00:00:00.000Z"
  }
}
```

**상태**: ⚠️ 검토 필요

**문제점**:
1. **ChallengeSchedule 테이블이 존재하는가?**
   - 코드를 보니 `userChallenge.challengeSchedule` 조회
   - 근데 스키마에는 없는 것 같은데?

2. **UserChallenge에 이미 날짜 정보 있음**
   - `startDate`, `endDate`, `deliveryDate` 필드 존재
   - 왜 별도 테이블이 필요한가?

**검토 필요 사항**:
- [ ] ChallengeSchedule 테이블 확인
- [ ] 이 API가 실제로 동작하는가?

---

### 7️⃣ POST `/api/challenges/:productId/schedule/start-date`
**목적**: 챌린지 시작일 설정 (신규 방식)

**Request**:
```json
{
  "startDate": "2025-10-27"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 8,
    "startDate": "2025-10-27",
    "deliveryDate": "2025-10-24",
    "endDate": "2025-11-16",
    "isConfirmed": true,
    "canModify": false,
    "purchasedAt": "2025-10-16T07:01:04.891Z",
    "createdAt": "2025-10-22T00:00:00.000Z"
  }
}
```

**상태**: ⚠️ 로직 검토 필요

**문제점**:
1. **티켓 재사용 가능**
   - 같은 티켓으로 여러 번 챌린지 시작 가능
   - 현재 데이터: 티켓 1번 → UserChallenge 2개
   - 이게 의도된 동작인가?

2. **중복 활성화 체크**
   - "이미 활성화된 챌린지가 있습니다" 체크 있음
   - 근데 실제로 작동하는가?

**검토 필요 사항**:
- [ ] 티켓 1개당 챌린지 1회만 시작 가능해야 하는가?
- [ ] 아니면 완료 후 재도전 가능해야 하는가?
- [ ] 현재 PURCHASED 상태 체크만 하는데, ACTIVATED도 확인해야 하는가?

---

## 🚨 발견된 주요 문제점

### 1. 티켓 재사용 문제
**현상**:
- 티켓 1번으로 UserChallenge 2개 생성됨
- 2025-10-16, 2025-10-22 각각 시작

**원인**:
```typescript
// setStartDate() 메서드
const ticket = await tx.challengeTicket.findFirst({
  where: {
    userId,
    productId,
    status: ChallengeTicketStatus.PURCHASED  // ❌ 이미 ACTIVATED된 티켓은 제외됨
  }
});
```

**문제**:
- 첫 번째 시작: PURCHASED → ACTIVATED ✅
- 두 번째 시작: ACTIVATED 상태라 찾을 수 없어야 함 ✅
- **근데 실제로는 2번 시작됨?** ❌

**추가 확인 필요**:
- `activateChallenge()` 구식 메서드를 사용했나?
- 아니면 티켓이 2개였나?

### 2. ChallengeSchedule 테이블 존재 여부
**확인 필요**:
- `/schedule` API가 `challengeSchedule` 관계 조회
- 근데 스키마에 없는 것 같음
- 실제로 동작하는가?

### 3. contents 빈 배열
**코드**:
```typescript
const contents = []; // 왜?
```

**원인 주석**:
```
// ⚠️ 컨텐츠 조회 제거됨
// - challenge_contents 테이블 제거로 인해 제거
```

**문제**:
- 제거됐으면 API에서 빼야 하는데 왜 남아있나?

---

## 📝 권장 조치사항

### 즉시 수정 필요
1. **티켓 재사용 문제 해결**
   - 티켓당 1회만 사용 가능하도록
   - 또는 완료/만료 후 재사용 로직 명확화

2. **ChallengeSchedule 관계 확인**
   - 존재하지 않으면 API 수정 필요

3. **contents 필드 제거**
   - API 응답에서 제거
   - 또는 실제 구현

### 검토 후 결정
1. **API 통합/분리**
   - `/my-active` 너무 무거움
   - 분리 검토

2. **activate vs start-date**
   - 둘 중 하나 선택
   - Deprecated 명시

3. **불필요한 필드 정리**
   - `currentDay` 중복
   - `products` 배열 필요성

---

## 🎯 다음 단계

1. **스키마 확인**
   - ChallengeSchedule 테이블 존재 여부
   - UserChallenge 관계 확인

2. **실제 사용 확인**
   - 각 API가 앱에서 실제로 호출되는지
   - 언제, 어떤 화면에서 사용되는지

3. **테스트 케이스 작성**
   - 티켓 재사용 시나리오
   - 중복 활성화 시나리오

형님, 어떤 것부터 확인할까요?

---

## ✅ 수정 완료 내역 (2025-10-23)

### 1. 티켓 보안 강화
**파일**: [src/challenge/challenge.service.ts](../src/challenge/challenge.service.ts)

**수정 내용**:
- `setStartDate()` (Line 1216-1230): 티켓 소유자 확인 + 재사용 방지
- `activateChallenge()` (Line 318-332): 동일 검증 추가

**추가된 검증**:
```typescript
// 티켓 소유자 확인
if (ticket.userId !== userId) {
  throw new BadRequestException('본인의 이용권만 사용할 수 있습니다');
}

// 티켓 재사용 방지
const existingChallenge = await tx.userChallenge.findFirst({
  where: { ticketId: ticket.id }
});
if (existingChallenge) {
  throw new ConflictException('이미 사용된 이용권입니다');
}
```

### 2. ChallengeSchedule 관계 제거
**파일**: [src/challenge/challenge.service.ts](../src/challenge/challenge.service.ts)

**배경**:
- 2025-10-16 마이그레이션: `challenge_schedules` 테이블 삭제
- 일정 정보를 `user_challenges`로 통합

**수정 내용**:
- `getChallengeSchedule()` (Line 1149-1177): challengeSchedule 조인 제거
- userChallenge 필드 직접 사용

### 3. contents 필드 제거
**파일**: [src/challenge/challenge.service.ts](../src/challenge/challenge.service.ts)

**배경**:
- `challenge_contents` 테이블 삭제됨
- Content.accessLevel 기반으로 변경

**수정 내용**:
- `getMyActiveChallenge()` (Line 230-268): contents 배열 제거
- `getTodayActivities()` (Line 529-556): contents 배열 제거
- 관련 로그 메시지 업데이트

### 4. my-tickets API 개선
**파일**: [src/challenge/challenge.service.ts](../src/challenge/challenge.service.ts)

**수정 내용** (Line 114-154):
- PURCHASED 상태만 필터링 추가
- challengeStatus, startDate, endDate 필드 제거
- 응답 간소화

**변경 전**:
```typescript
where: { userId }  // 모든 상태
```

**변경 후**:
```typescript
where: {
  userId,
  status: ChallengeTicketStatus.PURCHASED  // 활성화 가능한 것만
}
```

---

## 📊 최종 상태

### 수정 완료 ✅
- [x] 티켓 재사용 방지
- [x] 티켓 소유권 검증
- [x] ChallengeSchedule 관계 제거
- [x] contents 필드 제거
- [x] my-tickets API 개선

### 보류 ⏳
- [ ] API 통합/분리 검토 (실제 사용 패턴 분석 필요)
- [ ] activate vs setStartDate 정리 (실제 사용 현황 확인 필요)
- [ ] currentDay 중복 제거 (앱 확인 필요)

---

## 🎯 다음 단계

**챌린지 도메인 감사 완료!**

다음: **Shop 도메인** 분석 예정
