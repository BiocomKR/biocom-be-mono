# 🧪 바이오컴 API 테스트 시나리오 v2.0

📅 작성일: 2025-08-01  
🏗️ Prisma 자동 시간대 변환 기반 E2E 테스트 시나리오

---

## 📌 주요 변경사항

### 🔄 시간대 처리 자동화
- **이전**: date.util.ts 함수로 수동 변환
- **현재**: Prisma Extension이 자동으로 KST ↔ UTC 변환
- **영향**: 모든 날짜/시간 관련 테스트 시나리오 변경

---

## 목차

1. [시간대 변환 테스트](#1-시간대-변환-테스트)
2. [이벤트 날짜 경계 테스트](#2-이벤트-날짜-경계-테스트)
3. [기본 사용자 플로우 테스트](#3-기본-사용자-플로우-테스트)
4. [설문 시스템 테스트](#4-설문-시스템-테스트)
5. [미션 시스템 테스트](#5-미션-시스템-테스트)
6. [퀴즈 시스템 테스트](#6-퀴즈-시스템-테스트)
7. [포인트 시스템 테스트](#7-포인트-시스템-테스트)
8. [엣지 케이스](#8-엣지-케이스)

---

## 1️⃣ 시간대 변환 테스트

### 🕐 자동 시간대 변환 검증

> 💡 **시나리오**: Prisma Extension의 자동 변환 확인

**Given**: 
- 서버 시간: UTC
- 입력 시간: 2025-08-01 09:00:00 (KST)

**When**: 이벤트 생성
```javascript
const event = await prisma.event.create({
  data: {
    name: "시간대 테스트",
    startDate: new Date("2025-08-01T09:00:00"), // KST 입력
    endDate: new Date("2025-08-08T09:00:00"),
    totalDays: 7,
    isActive: false
  }
});
```

**Then**:
- DB 저장값: `2025-08-01T00:00:00Z` (UTC)
- API 응답: `2025-08-01T09:00:00` (KST로 자동 변환)
- 클라이언트는 한국 시간으로 받음

### 📅 날짜 비교 로직 검증

> 💡 **시나리오**: JavaScript Date 객체로 날짜 비교

**Given**: 
- 이벤트 시작일: 2025-08-01 (DB에는 UTC로 저장)
- 오늘 날짜: 2025-08-03

**When**: 이벤트 일차 계산
```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);
const diffTime = today.getTime() - event.startDate.getTime();
const dayNumber = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
```

**Then**:
- dayNumber = 3 (3일차)
- 시간대 변환 없이 정확한 계산

---

## 2️⃣ 이벤트 날짜 경계 테스트

### 🌃 자정 시작 이벤트

> 💡 **시나리오**: 한국 시간 자정에 이벤트 시작

**Given**:
- 이벤트 시작: 2025-08-01 00:00:00 KST
- 현재 시간: 2025-08-01 00:01:00 KST

**When**: 활성 이벤트 조회
```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);

const activeEvent = await prisma.event.findFirst({
  where: {
    isActive: true,
    startDate: { lte: today },
    endDate: { gte: today }
  }
});
```

**Then**:
- 이벤트가 정상적으로 조회됨
- UTC 시간대 차이로 인한 문제 없음

### 🌅 자정 종료 이벤트

> 💡 **시나리오**: 한국 시간 23:59:59에 이벤트 종료

**Given**:
- 이벤트 종료: 2025-08-31 23:59:59 KST
- 현재 시간: 2025-08-31 23:58:00 KST

**When**: 미션 수행 시도

**Then**:
- 미션 수행 성공
- 2분 후 (2025-09-01 00:01:00) 미션 수행 시 실패

---

## 3️⃣ 기본 사용자 플로우 테스트

### 🆕 회원가입 타임스탬프

> 💡 **시나리오**: 신규 사용자 가입 시간 기록

**When**: 회원가입 API 호출  
**Then**:
- `users.createdAt`: 한국 시간으로 응답
- `users.lastLoginAt`: 한국 시간으로 응답
- DB에는 UTC로 저장되지만 API는 KST 반환

### 🎯 이벤트 참여 시간 기록

> 💡 **시나리오**: 이벤트 참여 시간 추적

**When**: 이벤트 참여 API 호출  
**Then**:
- `event_users.joinedAt`: 참여 시각 (KST)
- `event_users.completedAt`: null
- 모든 시간 필드가 한국 시간 기준

---

## 4️⃣ 설문 시스템 테스트

### 📝 설문 응답 시간 기록

> ✅ **시나리오**: 설문 답변 시간 추적

**When**: 설문 답변 제출
```javascript
const answer = await prisma.surveyAnswer.create({
  data: {
    userId: 1,
    surveyQuestionId: 1,
    surveyOptionId: 1,
    type: 'before'
  }
});
```

**Then**:
- `answer.createdAt`: 답변 시간 (KST)
- 일차 계산 시 한국 시간 기준으로 정확함

---

## 5️⃣ 미션 시스템 테스트

### 💧 일일 미션 시간 검증

> 🏆 **시나리오**: 자정 직전/직후 미션 수행

**Test Case 1: 자정 직전**
- 시간: 2025-08-01 23:59:00 KST
- 미션 수행 → 1일차 미션으로 기록

**Test Case 2: 자정 직후**
- 시간: 2025-08-02 00:01:00 KST
- 미션 수행 → 2일차 미션으로 기록

**When**: 미션 완료 API 호출
```javascript
const completion = await prisma.missionCompletion.create({
  data: {
    eventUserId: 1,
    eventMissionId: 1,
    missionDay: await calculateEventDay(new Date()),
    pointsEarned: 100
  }
});
```

**Then**:
- `completion.completedAt`: 완료 시간 (KST)
- `missionDay`: 한국 시간 기준 일차

### 🔒 중복 미션 방지 (날짜 기준)

> ❌ **시나리오**: 한국 날짜 기준 중복 체크

**Given**: 
- 2025-08-01 23:00:00 KST에 미션 완료
- UTC로는 2025-08-01 14:00:00

**When**: 
- 2025-08-02 01:00:00 KST에 재시도
- UTC로는 2025-08-01 16:00:00 (같은 UTC 날짜)

**Then**:
- 다른 날짜로 인식하여 미션 수행 가능
- 한국 시간 기준으로 정확하게 처리

---

## 6️⃣ 퀴즈 시스템 테스트

### ✅ 일차별 퀴즈 시간 검증

> 🎯 **시나리오**: 퀴즈 응답 시간과 일차 매칭

**When**: 3일차 퀴즈 참여
```javascript
const answer = await prisma.quizAnswer.create({
  data: {
    eventUserId: 1,
    eventQuizId: 3,
    selectedAnswer: 2,
    isCorrect: true,
    pointsEarned: 50
  }
});
```

**Then**:
- `answer.answeredAt`: 응답 시간 (KST)
- 3일차 퀴즈로 정확히 기록

---

## 7️⃣ 포인트 시스템 테스트

### 💰 포인트 이력 시간 추적

> 📊 **시나리오**: 포인트 획득/사용 시간 기록

**When**: 포인트 적립
```javascript
const history = await prisma.pointHistory.create({
  data: {
    userId: 1,
    type: 'EARN',
    amount: 100,
    relatedType: 'MISSION',
    relatedId: 1
  }
});
```

**Then**:
- `history.createdAt`: 포인트 변동 시간 (KST)
- 일별 포인트 집계 시 한국 날짜 기준

---

## 8️⃣ 엣지 케이스

### 🌏 다국가 사용자 시나리오

> ⚠️ **시나리오**: 해외 거주 사용자의 활동

**Given**: 
- 사용자: 미국 거주 (PST)
- 서버: 한국 시간 기준 운영

**When**: 미국 시간 23:00에 미션 수행

**Then**:
- 한국 시간 기준으로 다음날 미션으로 기록
- 모든 사용자가 동일한 시간 기준 사용

### 🔄 서버 재시작 시 시간대 유지

> ✔️ **시나리오**: 서버 재시작 후 시간대 설정 확인

**When**: 서버 재시작

**Then**:
- Prisma Extension 자동 로드
- 모든 날짜 변환 정상 작동
- 기존 데이터 조회 시 KST로 변환

### 📊 통계 집계 정확성

> 📈 **시나리오**: 일별/주별/월별 통계

**When**: 일별 활동 통계 집계
```javascript
const dailyStats = await prisma.missionCompletion.groupBy({
  by: ['missionDay'],
  _count: true,
  where: {
    eventUserId: 1
  }
});
```

**Then**:
- 한국 날짜 기준으로 정확한 집계
- 자정 기준 일자 변경 반영

---

## 📊 테스트 우선순위

### 🔴 **Critical** (필수)
1. 자정 시작/종료 이벤트 정상 작동
2. 미션/퀴즈 일차 정확성
3. 중복 방지 로직 (한국 날짜 기준)
4. 포인트 적립 시간 정확성

### 🟡 **Important** (중요)
1. 통계 집계 정확성
2. 다국가 사용자 시나리오
3. 서버 재시작 시 동작
4. 날짜 경계 테스트

### 🟢 **Nice to have** (추가)
1. 성능 테스트 (대량 날짜 변환)
2. 동시성 처리
3. 타임존 변경 시나리오

---

## 🗂️ 테스트 환경 설정

```javascript
// 테스트 시 명시적 시간 설정
const testDate = new Date("2025-08-01T00:00:00");
jest.setSystemTime(testDate);

// 이벤트 생성 (자정 시작)
const event = await prisma.event.create({
  data: {
    name: "자정 테스트 이벤트",
    startDate: new Date("2025-08-01"),
    endDate: new Date("2025-08-21"),
    totalDays: 21,
    isActive: true
  }
});

// DB 저장값 확인
const rawData = await prisma.$queryRaw`
  SELECT start_date, end_date 
  FROM events 
  WHERE id = ${event.id}
`;
// UTC로 저장됨: 2025-07-31T15:00:00Z

// API 응답값 확인
console.log(event.startDate); 
// KST로 변환됨: 2025-08-01T00:00:00
```

---

## ⚠️ 주의사항

1. **모든 날짜는 JavaScript Date 객체 사용**
   - ❌ `getKoreanTime()`, `parseKoreanDate()` 사용 금지
   - ✅ `new Date()` 사용

2. **날짜 비교는 기본 JavaScript 연산**
   - ❌ `getDaysDifferenceKST()` 사용 금지
   - ✅ `date1.getTime() - date2.getTime()` 사용

3. **Prisma가 자동으로 처리하는 것**
   - 저장 시: KST → UTC 변환
   - 조회 시: UTC → KST 변환
   - Raw Query 사용 시 수동 변환 필요

---

💡 **결론**: Prisma Extension으로 시간대 처리가 자동화되어 개발자는 한국 시간만 고려하면 됩니다.  
모든 테스트는 한국 시간 기준으로 작성하고 실행하세요.