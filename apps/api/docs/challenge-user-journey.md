# 챌린지 사용자 여정 (Challenge User Journey)

> 일반 사용자가 챌린저가 되는 전체 과정을 단계별로 설명합니다.

## 📌 전제 조건
- 사용자는 이미 회원가입 완료 (User 테이블에 존재)
- 초기 사용자 상태: `NEWCOMER`

---

## 🎯 예시 시나리오
- **오늘 날짜**: 2025년 11월 14일 (목요일)
- **챌린지 시작일 설정**: 2025년 11월 18일 (월요일)
- **챌린지 종료일**: 2025년 12월 8일 (21일 챌린지)

---

## 🚀 전체 플로우

```
구매 → 활성화 → 시작일 설정 → [대기] → 시작일 도래 → 챌린지 진행 → 종료
```

---

## 📋 상세 단계

### 1단계: 챌린지 구매 가능 목록 조회

#### API
```
GET /api/challenges
```

#### 응답
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "21일 이너뷰티 챌린지",
      "description": "21일간의 이너뷰티 여정",
      "totalDays": 21,
      "isActive": true
    }
  ]
}
```

#### 사용자 액션
- 구매할 챌린지 선택
- `productId = 1` 획득

#### DB 상태
- 변화 없음

#### 사용자 상태
- `NEWCOMER` (변화 없음)

---

### 2단계: 챌린지 상품 구매

#### API
```
POST /api/shop/orders
(상품 결제 API - Shop 모듈)
```

#### 요청
```json
{
  "productId": 1,
  "optionId": 1,
  "paymentMethod": "CARD"
}
```

#### DB 변화

**challenge_tickets 테이블:**
```sql
INSERT INTO challenge_tickets (
  user_id,
  product_id,
  ticket_type,
  status,
  purchase_date,
  created_at
) VALUES (
  123,              -- 사용자 ID
  1,                -- 챌린지 상품 ID
  'ONE_TIME',       -- 일회성 티켓
  'PURCHASED',      -- 구매 완료
  '2025-11-14',     -- 구매일
  '2025-11-14 10:30:00'
);
```

#### 사용자 상태
- `NEWCOMER` (변화 없음)

---

### 3단계: 구매한 티켓 조회

#### API
```
GET /api/challenges/my-tickets
```

#### 응답
```json
{
  "success": true,
  "data": [
    {
      "id": 456,
      "challenge": {
        "id": 1,
        "name": "21일 이너뷰티 챌린지",
        "description": "21일간의 이너뷰티 여정",
        "totalDays": 21,
        "isActive": true
      },
      "purchaseDate": "2025-11-14",
      "status": "PURCHASED"
    }
  ]
}
```

#### 사용자 액션
- 활성화할 티켓 선택
- `ticketId = 456` 획득

#### 사용자 상태
- `NEWCOMER` (변화 없음)

---

### 4단계: 챌린지 활성화 (티켓 사용)

#### API
```
POST /api/challenges/activate
```

#### 요청
```json
{
  "ticketId": 456
}
```

#### DB 변화

**user_challenges 테이블 (생성):**
```sql
INSERT INTO user_challenges (
  user_id,
  product_id,
  ticket_id,
  status,
  activated_at,
  created_at
) VALUES (
  123,                      -- 사용자 ID
  1,                        -- 챌린지 상품 ID
  456,                      -- 티켓 ID
  'PENDING',                -- ⚠️ PENDING 상태!
  '2025-11-14 15:30:00',    -- 활성화 시점
  '2025-11-14 15:30:00'
);
```

**challenge_tickets 테이블 (업데이트):**
```sql
UPDATE challenge_tickets
SET status = 'ACTIVATED'
WHERE id = 456;
```

#### 응답
```json
{
  "success": true,
  "data": {
    "userChallengeId": 789,
    "challengeName": "21일 이너뷰티 챌린지",
    "activatedAt": "2025-11-14T15:30:00Z",
    "status": "PENDING"
  }
}
```

#### 사용자 상태
- `NEWCOMER` (변화 없음!)
- ⚠️ 아직 시작일 전이므로 챌린저가 아님

---

### 5단계: 챌린지 시작일 설정

#### API
```
POST /api/challenges/1/schedule/start-date
```

#### 요청
```json
{
  "startDate": "2025-11-18"
}
```

#### 선택 가능한 시작일
- **정책**: 다음주 월요일부터 3주간의 월요일
- **11월 14일 신청 시**: 11월 18일(월), 11월 25일(월), 12월 2일(월)

#### DB 변화

**user_challenges 테이블 (업데이트):**
```sql
UPDATE user_challenges
SET
  start_date = '2025-11-18 00:00:00',  -- 시작일
  end_date = '2025-12-08 23:59:59',    -- 종료일 (시작일 +20일)
  expires_at = '2025-12-08 23:59:59',
  status = 'PENDING'                   -- ⚠️ 여전히 PENDING!
WHERE id = 789;
```

#### 응답
```json
{
  "success": true,
  "data": {
    "id": 789,
    "startDate": "2025-11-18",
    "endDate": "2025-12-08",
    "isConfirmed": true,
    "canModify": false
  }
}
```

#### 사용자 상태
- `NEWCOMER` (변화 없음!)
- ⚠️ 시작일을 설정했지만 아직 11월 18일이 아니므로 챌린저 아님

---

### 6단계: 대기 기간 (11월 15일 ~ 11월 17일)

#### 크론잡 실행
- **실행 시각**: 매일 KST 00:00
- **크론잡 이름**: `activatePendingChallenges`

#### 크론잡 로직
```typescript
// 오늘 시작해야 하는 PENDING 챌린지 찾기
const today = '2025-11-15'; // 예: 11월 15일

const pendingChallenges = await prisma.userChallenge.findMany({
  where: {
    status: 'PENDING',
    startDate: {
      lte: new Date(today + ' 00:00:00'),
      gte: new Date(today + ' 00:00:00')
    }
  }
});

// 결과: 없음 (시작일은 11-18)
```

#### DB 상태
- 변화 없음

#### 사용자 상태
- `NEWCOMER` (변화 없음)

---

### 7단계: 시작일 도래! (11월 18일 00:00)

#### 크론잡 실행
- **실행 시각**: 2025-11-18 00:00:00 (KST)
- **크론잡 이름**: `activatePendingChallenges`

#### 크론잡 로직
```typescript
// 오늘 시작해야 하는 PENDING 챌린지 찾기
const today = '2025-11-18';

const pendingChallenges = await prisma.userChallenge.findMany({
  where: {
    status: 'PENDING',
    startDate: {
      lte: new Date(today + ' 00:00:00'),
      gte: new Date(today + ' 00:00:00')
    }
  },
  include: { user: true }
});

// 결과: userChallengeId = 789 발견!

// 각 챌린지에 대해:
for (const challenge of pendingChallenges) {
  // 1. UserChallenge 상태 변경
  await prisma.userChallenge.update({
    where: { id: challenge.id },
    data: { status: 'ACTIVE' }
  });

  // 2. User 상태 변경
  await prisma.user.update({
    where: { id: challenge.userId },
    data: { status: 'CHALLENGER' }
  });

  // 3. 첫날(Day 1) 진행 상황 생성
  await prisma.dailyProgress.create({
    data: {
      userChallengeId: challenge.id,
      day: 1,
      date: new Date(today)
    }
  });
}
```

#### DB 변화

**user_challenges 테이블:**
```sql
UPDATE user_challenges
SET status = 'ACTIVE'  -- PENDING → ACTIVE
WHERE id = 789;
```

**users 테이블:**
```sql
UPDATE users
SET status = 'CHALLENGER'  -- NEWCOMER → CHALLENGER
WHERE id = 123;
```

**daily_progress 테이블 (생성):**
```sql
INSERT INTO daily_progress (
  user_challenge_id,
  day,
  date
) VALUES (
  789,
  1,
  '2025-11-18'
);
```

#### 사용자 상태
- `CHALLENGER` ✅ 드디어 챌린저!

#### 활성화되는 기능
- ✅ 챌린저 전용 콘텐츠 접근 가능
- ✅ 챌린저 퀴즈 200점 획득 가능
- ✅ 미션 수행, 기록 작성 등 모든 챌린지 기능 사용 가능

---

### 8단계: 챌린지 진행 (11월 18일 ~ 12월 8일)

#### 사용자 활동
- 매일 미션 수행
- 기록 작성 (식단, 간헐적 단식, 수면, 운동 등)
- 퀴즈 참여
- 설문 참여
- 콘텐츠 학습

#### Daily Progress 업데이트
- 매일 새로운 `daily_progress` 레코드 생성
- 완료한 미션, 기록 등 통계 집계

#### 사용자 상태
- `CHALLENGER` (유지)

---

### 9단계: 챌린지 종료 (12월 8일 23:59:59 이후)

#### 크론잡 실행
- **실행 시각**: 2025-12-09 00:00:00 (KST)
- **크론잡 이름**: `expireCompletedChallenges`

#### 크론잡 로직
```typescript
// 오늘 종료해야 하는 ACTIVE 챌린지 찾기
const today = '2025-12-09';

const expiredChallenges = await prisma.userChallenge.findMany({
  where: {
    status: 'ACTIVE',
    endDate: {
      lt: new Date(today + ' 00:00:00')
    }
  }
});

// 결과: userChallengeId = 789 발견!

for (const challenge of expiredChallenges) {
  await prisma.$transaction(async (tx) => {
    // 1. UserChallenge 상태 변경
    await tx.userChallenge.update({
      where: { id: challenge.id },
      data: { status: 'COMPLETED' }
    });

    // 2. 다른 ACTIVE 챌린지가 있는지 확인
    const otherActiveChallenges = await tx.userChallenge.count({
      where: {
        userId: challenge.userId,
        status: 'ACTIVE',
        id: { not: challenge.id }
      }
    });

    // 3. 다른 ACTIVE 챌린지가 없으면 User 상태 복원
    if (otherActiveChallenges === 0) {
      // 활성 구독이 있는지 확인
      const activeSubscription = await tx.challengeTicket.findFirst({
        where: {
          userId: challenge.userId,
          ticketType: 'SUBSCRIPTION',
          status: 'ACTIVE',
          endDate: { gt: new Date() }
        }
      });

      const newStatus = activeSubscription ? 'SUBSCRIBER' : 'NEWCOMER';

      await tx.user.update({
        where: { id: challenge.userId },
        data: { status: newStatus }
      });
    }
  });
}
```

#### DB 변화

**user_challenges 테이블:**
```sql
UPDATE user_challenges
SET status = 'COMPLETED'  -- ACTIVE → COMPLETED
WHERE id = 789;
```

**users 테이블:**
```sql
UPDATE users
SET status = 'NEWCOMER'  -- CHALLENGER → NEWCOMER (구독 없는 경우)
-- 또는
SET status = 'SUBSCRIBER'  -- CHALLENGER → SUBSCRIBER (구독 있는 경우)
WHERE id = 123;
```

#### 사용자 상태
- `NEWCOMER` (구독 없는 경우)
- `SUBSCRIBER` (구독 있는 경우)

#### 비활성화되는 기능
- ❌ 챌린저 전용 콘텐츠 접근 불가
- ❌ 챌린저 퀴즈 참여 불가 (0점 또는 비노출)

---

## 📊 상태 변화 요약표

| 단계 | API/크론잡 | UserChallenge.status | User.status | 설명 |
|------|-----------|---------------------|-------------|------|
| 1 | GET /challenges | - | NEWCOMER | 구매 가능한 챌린지 조회 |
| 2 | POST /shop/orders | - | NEWCOMER | 챌린지 상품 구매 |
| 3 | GET /my-tickets | - | NEWCOMER | 구매한 티켓 조회 |
| 4 | POST /activate | **PENDING** | NEWCOMER | 티켓 사용, 챌린지 준비 |
| 5 | POST /schedule/start-date | PENDING | NEWCOMER | 시작일 설정 |
| 6 | (대기) | PENDING | NEWCOMER | 시작일 전 대기 |
| 7 | **크론잡 (00:00)** | **ACTIVE** | **CHALLENGER** | 시작일 도래, 챌린지 시작! |
| 8 | (진행 중) | ACTIVE | CHALLENGER | 챌린지 수행 |
| 9 | **크론잡 (00:00)** | **COMPLETED** | NEWCOMER/SUBSCRIBER | 챌린지 종료 |

---

## 🔑 핵심 포인트

### 1. 사용자 상태 변경 시점
- ⚠️ **시작일 설정 시에는 User 상태가 변경되지 않음**
- ✅ **시작일 00:00 크론잡에서만 CHALLENGER로 변경**
- 이유: 시작일 전에 챌린저가 되면 논리적 모순

### 2. UserChallenge 상태
- `PENDING`: 티켓 활성화했지만 시작일 전
- `ACTIVE`: 시작일이 되어 챌린지 진행 중
- `COMPLETED`: 챌린지 완료
- `EXPIRED`: 챌린지 기간 만료 (완료하지 못함)

### 3. 시작일 선택 정책
- 다음주 월요일부터 3주간의 월요일만 선택 가능
- 한 번 설정하면 수정 불가 (`canModify: false`)

### 4. 권한 우선순위
```
CHALLENGER > SUBSCRIBER > NEWCOMER
```
- 챌린저가 최우선 권한
- 챌린지 종료 후 구독 여부에 따라 SUBSCRIBER 또는 NEWCOMER로 복원

---

## 🛠️ 필요한 크론잡

### 1. activatePendingChallenges
- **실행 주기**: 매일 00:00 (KST)
- **역할**: PENDING 챌린지를 ACTIVE로 전환
- **로직**:
  1. `WHERE status = 'PENDING' AND startDate = 오늘` 찾기
  2. UserChallenge → ACTIVE
  3. User → CHALLENGER
  4. DailyProgress Day 1 생성

### 2. expireCompletedChallenges
- **실행 주기**: 매일 00:00 (KST)
- **역할**: 종료된 챌린지 정리 및 User 상태 복원
- **로직**:
  1. `WHERE status = 'ACTIVE' AND endDate < 오늘` 찾기
  2. UserChallenge → COMPLETED
  3. 다른 ACTIVE 챌린지 없으면 User 상태 복원

---

## 📝 참고사항

### API 순서 중요!
1. activate → 2. setStartDate 순서로 호출해야 함
2. activate 없이 setStartDate만 호출하면 에러 발생

### 중복 활성화 방지
- 한 사용자는 한 번에 하나의 ACTIVE 챌린지만 가능
- activate 시 이미 ACTIVE 챌린지가 있으면 409 에러

### 시작일 수정 불가
- 시작일은 한 번 설정하면 절대 수정 불가
- 시스템 정책상 중요한 제약사항

---

**작성일:** 2025-11-14
**작성자:** Claude Code (AI Agent)
**버전:** 1.0
