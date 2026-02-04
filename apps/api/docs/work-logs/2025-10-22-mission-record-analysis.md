# 미션/퀴즈 저장 규칙 분석 리포트

**날짜**: 2025-10-22
**작성자**: Claude Code
**목적**: user_records와 mission_attempts 테이블 저장 규칙 불일치 분석

---

## 📊 현황 요약

### 분석 대상 서비스 (4개)

1. **quiz-completion.service.ts** - 퀴즈 완료 처리
2. **mission-completion.service.ts** - 일반/기록형 미션 완료 처리
3. **record-completion.service.ts** - 기록 완료 처리 (구버전)
4. **records.service.ts** - 6가지 기록 처리 (신버전, tracking 모듈)

---

## 📋 서비스별 저장 규칙 비교표

| 서비스 | `user_records` 저장 시점 | `mission_attempts` 저장 시점 | 상태 |
|--------|------------------------|----------------------------|------|
| **quiz-completion.service.ts** | 정답 시만 ✅ | 모든 시도 ✅ | **올바름** |
| **mission-completion.service.ts** | 모든 시도 ❌ | 모든 시도 ✅ | **문제있음** |
| **record-completion.service.ts** | 모든 기록 (1일1회) | 저장 안함 ❌ | **문제있음** |
| **records.service.ts** | 모든 기록 (타입별 정책) | 저장 안함 ⚠️ | **애매함** |

---

## 🔍 상세 분석

### 1️⃣ quiz-completion.service.ts ✅

**파일**: `src/quiz/quiz-completion.service.ts`

#### user_records 저장
- **위치**: Line 120-150
- **조건**: `if (isCorrect)` - 정답일 때만 저장
- **recordType**: `'QUIZ'`

```typescript
if (isCorrect) {
  const userRecord = await tx.userRecord.create({
    data: {
      userId,
      userChallengeId: activeChallenge.id,
      recordType: 'QUIZ',
      date: today,
      metadata: { /* 퀴즈 상세 정보 */ },
    }
  });
  userRecordId = userRecord.id;
}
```

#### mission_attempts 저장
- **위치**: Line 153-170
- **조건**: 없음 - 모든 시도 저장
- **isCompleted**: `isCorrect`

```typescript
const missionAttempt = await tx.missionAttempt.create({
  data: {
    userId,
    challengeMissionId: challengeMission.id,
    attemptNumber: attemptCount + 1,
    isCompleted: isCorrect,
    trackingRecordId: userRecordId,  // 정답일 때만 ID 연결, 오답은 null
  }
});
```

**평가**: ✅ **올바름** - 테이블 역할이 명확히 구분됨

---

### 2️⃣ mission-completion.service.ts ❌

**파일**: `src/mission/mission-completion.service.ts`

#### user_records 저장 - 기록형 미션 (RECORD 타입)
- **위치**: Line 163-182
- **조건**: 없음 - 시도할 때마다 저장
- **recordType**: `mission.recordType`

```typescript
if (mission.type === 'RECORD') {
  const userRecord = await tx.userRecord.create({
    data: {
      userId,
      userChallengeId: userChallenge.id,
      recordType: mission.recordType,
      date: new Date(todayStr),
      metadata: { /* 기록 데이터 */ },
    }
  });
  trackingRecordId = userRecord.id;
}
```

#### user_records 저장 - 일반 미션 (recordType 있는 경우)
- **위치**: Line 226-256
- **조건**: `if (mission.recordType)` - 시도할 때마다 저장
- **recordType**: `mission.recordType`

```typescript
if (mission.recordType) {
  const userRecord = await tx.userRecord.create({
    data: {
      userId,
      userChallengeId: userChallenge.id,
      recordType: mission.recordType,
      date: new Date(todayStr),
      metadata: { /* DAILY_MISSION 상세 + 실제 수행 데이터 */ },
    }
  });
  trackingRecordId = userRecord.id;
}
```

#### mission_attempts 저장
- **위치**: Line 271-286
- **조건**: 없음 - 모든 시도 저장
- **isCompleted**: `attemptNumber >= dailyLimit`

```typescript
const isCompleted = attemptNumber >= dailyLimit; // dailyLimit 달성 시에만 완료
const missionAttempt = await tx.missionAttempt.create({
  data: {
    userId,
    challengeMissionId: challengeMission.id,
    attemptNumber,
    isCompleted,
    pointsEarned: isCompleted ? challengeMission.points : 0,
    trackingRecordId,  // 항상 연결됨
  }
});
```

**문제점**:

1. **user_records 과다 저장**
   ```
   시나리오: dailyLimit=3인 미션을 3번 시도

   현재 결과:
     - mission_attempts: 3건 (정상) ✅
     - user_records: 3건 (문제!) ❌

   기대 결과 (Quiz처럼):
     - mission_attempts: 3건 (모든 시도) ✅
     - user_records: 1건 (완료 시만) ✅
   ```

2. **영향**
   - `user_records`가 "기록/결과" 테이블이 아니라 "시도 이력"처럼 쌓임
   - `mission_attempts`와 역할 중복
   - 데이터 분석/집계 시 혼란

**평가**: ❌ **문제있음** - user_records 저장 기준 불명확

---

### 3️⃣ record-completion.service.ts ❌

**파일**: `src/mission/record-completion.service.ts`

#### user_records 저장
- **위치**: Line 91-101
- **조건**: 없음 - 항상 저장 (단, 1일1회 중복 체크 있음)
- **recordType**: 파라미터로 받은 `recordType`

```typescript
const userRecord = await tx.userRecord.create({
  data: {
    userId,
    userChallengeId,
    recordType,
    date: new Date(todayStr),
    metadata: dto.metadata || null,
  }
});
```

#### mission_attempts 저장
- **저장 안함!** ❌

**문제점**:

1. **mission_attempts 누락**
   ```
   이 서비스로 기록 완료 시:
     - user_records: 저장됨 ✅
     - mission_attempts: 없음 ❌

   결과:
     - 미션 진행 이력이 추적되지 않음
     - 미션 완료 통계 집계 시 누락 가능성
   ```

2. **연관 미션 완료 처리**
   - Line 108-169: 챌린지 연동 로직은 있음
   - DailyProgress, 포인트 지급은 처리됨
   - 하지만 mission_attempts 기록 없음

**평가**: ❌ **문제있음** - mission_attempts 누락

---

### 4️⃣ records.service.ts ⚠️

**파일**: `src/tracking/services/records.service.ts`

#### user_records 저장
- **위치**: Line 634-642 (createRecordBase)
- **조건**: 타입별로 다름
  - BEAUTY, FASTING, SLEEP: 1일1회 (중복 불허)
  - DIET, SUPPLEMENT, ACTIVITY: 중복 허용
- **recordCode**: 파라미터로 받은 `recordCode`

```typescript
const userRecord = await tx.userRecord.create({
  data: {
    userId,
    userChallengeId: activeChallenge?.id || null,
    recordCode,
    date,
    metadata,
  },
});
```

#### mission_attempts 저장
- **저장 안함**

#### 포인트 지급 로직
- **위치**: Line 645-654
- **조건**: 타입별로 다름
  - BEAUTY, FASTING, SLEEP: 매번 100포인트
  - DIET, SUPPLEMENT, ACTIVITY: 1일 첫 기록만 100포인트

```typescript
if (pointsToAward > 0) {
  await this.pointService.awardPointsInTransaction(
    tx,
    userId,
    pointsToAward,
    `${recordCode} 기록 완료`,
    'RECORD_COMPLETION',
    userRecord.id
  );
}
```

**질문**:

1. 이 서비스는 챌린지와 연동되는가? 독립적인가?
   - `userChallengeId`는 연결하지만 선택적 (null 가능)
   - mission_attempts는 저장 안함
   - 포인트는 독립적으로 지급

2. 기록 완료 시 미션 완료로 처리되어야 하는가?
   - 현재는 미션 개념 없음

**평가**: ⚠️ **애매함** - 챌린지와의 관계 불명확

---

## 🚨 핵심 문제점 정리

### 문제 1: mission-completion.service.ts - user_records 과다 저장

**현재 동작**:
- 기록형 미션: 시도할 때마다 `user_records` 저장
- 일반 미션: 시도할 때마다 `user_records` 저장 (recordType이 있으면)

**문제**:
- `user_records`가 "기록/결과" 테이블이 아니라 "시도 이력"처럼 쌓임
- `mission_attempts`와 역할 중복
- Quiz와 Mission의 동작이 불일치

**제안**:
```typescript
// 현재 (❌)
const userRecord = await tx.userRecord.create({...}); // 항상 저장
trackingRecordId = userRecord.id;

// 수정 후 (✅)
let trackingRecordId: number | null = null;

if (isCompleted) { // dailyLimit 달성 시에만
  const userRecord = await tx.userRecord.create({...});
  trackingRecordId = userRecord.id;
}

// mission_attempts는 항상 저장
const missionAttempt = await tx.missionAttempt.create({
  trackingRecordId, // 완료 시만 ID 연결, 미완료는 null
  isCompleted,
});
```

---

### 문제 2: record-completion.service.ts - mission_attempts 누락

**현재 동작**:
- `user_records`만 저장
- `mission_attempts` 저장 안함

**문제**:
- 미션 진행 이력이 추적되지 않음
- 미션 완료 통계 집계 시 누락 가능성

**제안**:
- Option A: `mission_attempts`도 함께 저장하도록 수정
- Option B: Deprecated 시키고 `mission-completion.service.ts` 사용

---

### 문제 3: record-completion.service.ts vs records.service.ts 중복

**현황**:
- 둘 다 기록 저장 서비스
- `record-completion.service.ts`: 구버전 (단순)
- `records.service.ts`: 신버전 (6가지 기록 타입 지원)

**질문**:
- 두 서비스가 공존하는 이유?
- 어느 것을 사용해야 하는가?
- `records.service.ts`는 챌린지와 독립적인가?

---

## ✅ 제안하는 통일된 규칙

### 기본 원칙

1. **`mission_attempts`**: 모든 시도 이력 저장
   - 정답/오답, 성공/실패 구분
   - `isCompleted` 플래그로 완료 여부 표시
   - 모든 챌린지 미션 시도는 반드시 기록

2. **`user_records`**: 의미있는 결과만 저장
   - Quiz: 정답 시만
   - Mission: dailyLimit 달성 시만 (또는 성공 시만)
   - 기록(DIET, SLEEP 등): 모든 기록 (실패 개념 없음)

3. **두 테이블의 연결**: `mission_attempts.trackingRecordId`
   - 성공/완료 시: user_records ID 연결
   - 실패/미완료 시: null

---

### 테이블별 역할 정의

#### `mission_attempts` - 시도 이력 테이블
- **목적**: 사용자의 모든 미션 시도 기록
- **저장 기준**: 시도할 때마다 무조건 저장
- **주요 필드**:
  - `attemptNumber`: 시도 횟수
  - `isCompleted`: 완료 여부 (true/false)
  - `pointsEarned`: 획득 포인트 (완료 시만 >0)
  - `trackingRecordId`: user_records 연결 (완료 시만)

#### `user_records` - 기록/결과 테이블
- **목적**: 사용자의 의미있는 기록/결과 저장
- **저장 기준**: 성공/완료/기록 시에만
- **주요 필드**:
  - `recordType` 또는 `recordCode`: 기록 타입
  - `date`: 기록 날짜
  - `metadata`: 상세 데이터

---

## 📝 수정 필요 사항

### 1. mission-completion.service.ts 수정

**목표**: user_records를 완료 시에만 저장

**수정 위치**:
- Line 163-182: 기록형 미션 처리 부분
- Line 226-256: 일반 미션 처리 부분

**수정 방향**:
```typescript
// 기존 로직
let trackingRecordId: number | null = null;

if (mission.type === 'RECORD') {
  // 기록형 미션
  // 기존: 항상 저장 ❌
  // 수정: dailyLimit 달성 시에만 저장 ✅

} else {
  // 일반 미션
  // 기존: recordType 있으면 항상 저장 ❌
  // 수정: dailyLimit 달성 시에만 저장 ✅
}

// mission_attempts는 항상 저장 (변경 없음)
const isCompleted = attemptNumber >= dailyLimit;
const missionAttempt = await tx.missionAttempt.create({
  trackingRecordId, // 완료 시만 연결
  isCompleted,
});
```

---

### 2. record-completion.service.ts 처리 방안

**Option A: 수정**
- `mission_attempts`도 함께 저장하도록 수정
- 챌린지 연동 시 시도 이력 기록

**Option B: Deprecated**
- 이 서비스 사용 중단
- `mission-completion.service.ts` 사용 권장
- 또는 `records.service.ts`로 마이그레이션

---

### 3. records.service.ts 역할 명확화

**확인 필요**:
- 챌린지와 독립적인 기록 서비스인가?
- 미션 완료와 연동되어야 하는가?
- `record-completion.service.ts`와의 차이점은?

**필요 시 수정**:
- 챌린지 연동이 필요하면 `mission_attempts` 추가
- 독립적이면 현재 구조 유지

---

## 🎯 결론

### 즉시 수정 필요
1. **mission-completion.service.ts**: user_records 저장 조건 수정
2. **record-completion.service.ts**: mission_attempts 추가 또는 deprecated

### 추가 검토 필요
1. **records.service.ts**: 챌린지와의 관계 명확화
2. **record-completion.service.ts vs records.service.ts**: 통합 또는 역할 구분

### 기대 효과
- 테이블 역할 명확화
- 데이터 일관성 확보
- 통계/집계 로직 단순화
- 시스템 이해도 향상

---

**작성 완료**: 2025-10-22
**다음 작업**: 형님과 수정 방향 합의 후 단계적 수정 진행
