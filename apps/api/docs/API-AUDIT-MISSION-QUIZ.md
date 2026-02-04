# 미션 & 퀴즈 도메인 API 감사

> 작성일: 2025-10-24
> 분석자: Claude
> 상태: ✅ 완료

---

## 📍 미션 & 퀴즈 도메인 구조

**컨트롤러 목록**:
1. Mission - 미션 관리 (3개 엔드포인트)
2. Records - 기록 완료 (1개 엔드포인트) - ⚠️ **비활성화됨**
3. Quiz - 퀴즈 (2개 엔드포인트)

---

## 🎯 비즈니스 플로우

```
챌린지 시작
  ↓
1일 1미션 조회 (GET /missions/daily)
  ↓
미션 수행 완료 (POST /missions/complete)
  ↓
퀴즈 조회 (GET /quizzes/daily)
  ↓
퀴즈 답변 제출 (POST /quizzes/complete)
  ↓
포인트 적립
```

---

## 1️⃣ Mission 컨트롤러

**Base Path**: `/api/missions`

### 엔드포인트 목록

#### GET `/api/missions/daily`
**목적**: 오늘의 1일 1미션 조회

**응답**:
```json
{
  "success": true,
  "data": {
    "missionId": 15,
    "title": "물 8잔 마시기",
    "description": "하루 2L 이상 물을 마셔보세요",
    "missionType": "WATER_INTAKE",
    "currentDay": 7,
    "isCompleted": false,
    "completedAt": null
  }
}
```

**상태**: ✅ 정상

---

#### GET `/api/missions/daily-progress`
**목적**: 일일 미션 진행도 조회 (메인화면용)

**응답**:
```json
{
  "success": true,
  "data": {
    "missions": [
      {
        "missionId": 15,
        "title": "물 8잔 마시기",
        "isCompleted": true,
        "completedAt": "2025-10-24T10:30:00Z"
      }
    ],
    "totalMissions": 3,
    "completedMissions": 1,
    "completionRate": 33.3
  }
}
```

**상태**: ✅ 정상

**특징**:
- 메인화면에서 전체 미션 달성률 표시용
- 오늘의 미션 목록 + 완료 여부

---

#### POST `/api/missions/complete`
**목적**: 미션 수행 완료

**Request**:
```json
{
  "missionId": 15,
  "data": {
    "waterIntake": 2000
  }
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "missionId": 15,
    "isCompleted": true,
    "completedAt": "2025-10-24T10:30:00Z",
    "pointsEarned": 100,
    "message": "미션 완료! 100 포인트 적립되었습니다"
  }
}
```

**주요 로직**:
1. dailyLimit 체크 (하루 몇 번까지 가능한지)
2. 미션 완료 기록 생성
3. 포인트 적립
4. 챌린지 진행상황 업데이트

**상태**: ✅ 정상

---

## 2️⃣ Records 컨트롤러 (비활성화됨)

**Base Path**: `/api/records`

### 💡 **설계 변경으로 불필요해진 엔드포인트**

#### POST `/api/records/:id/complete`
**목적**: 기록 완료 처리

**현재 상태**: 🗑️ **비활성화 (의미 없음)**

**코드**:
```typescript
async completeRecord(...) {
  // return this.recordsService.completeRecord(...); // 임시 주석
  throw new Error('임시 비활성화됨');
}
```

**왜 비활성화되었나?**:
- **기록 저장 API가 tracking 도메인으로 이동**
- `/tracking/records/beauty`, `/tracking/records/diet` 등으로 6가지 기록 유형 전부 구현됨
- 각 기록 저장 시 **이미 포인트 100점씩 지급됨**
- 기록은 "생성 = 완료"이므로 별도의 "완료 처리" 단계가 불필요

**실제 기록 저장 API**:
- POST `/tracking/records/beauty` - 이너뷰티 기록 (포인트 100점)
- POST `/tracking/records/diet` - 식단 기록 (포인트 100점)
- POST `/tracking/records/supplement` - 영양제 기록 (포인트 100점)
- POST `/tracking/records/fasting` - 간헐적 단식 (포인트 100점)
- POST `/tracking/records/sleep` - 수면 기록 (포인트 100점)
- POST `/tracking/records/activity` - 활동 기록 (포인트 100점)

**결론**:
- 이 엔드포인트는 **제거 가능**
- 기록 시스템은 tracking 도메인에서 정상 작동 중

---

## 3️⃣ Quiz 컨트롤러

**Base Path**: `/api/quizzes`

### 엔드포인트 목록

#### GET `/api/quizzes/daily`
**목적**: 오늘의 퀴즈 조회

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "quizId": 42,
      "question": "비타민 C가 가장 많이 함유된 과일은?",
      "options": [
        "사과",
        "오렌지",
        "바나나",
        "키위"
      ],
      "quizType": "MULTIPLE_CHOICE",
      "points": 50,
      "isCompleted": false
    }
  ]
}
```

**상태**: ✅ 정상

---

#### POST `/api/quizzes/complete`
**목적**: 퀴즈 답변 제출 및 완료 처리

**Request**:
```json
{
  "quizId": 42,
  "answer": "키위"
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "quizId": 42,
    "isCorrect": true,
    "correctAnswer": "키위",
    "pointsEarned": 50,
    "message": "정답입니다! 50 포인트 적립되었습니다"
  }
}
```

**주요 로직**:
1. 이미 답변한 퀴즈인지 체크
2. 정답 채점
3. 정답 시 포인트 적립
4. 챌린지 진행상황 업데이트

**상태**: ✅ 정상

**특징**:
- 정답/오답 즉시 피드백
- 오답도 기록은 남김
- 챌린지 진행률에 반영

---

## 📊 미션 & 퀴즈 도메인 정리

### ✅ 잘된 점
1. **미션 시스템**
   - dailyLimit 체크
   - 포인트 자동 적립
   - 진행도 트래킹

2. **퀴즈 시스템**
   - 즉시 채점
   - 정답/오답 피드백
   - 중복 답변 방지

3. **챌린지 연동**
   - 미션/퀴즈 완료 시 챌린지 진행상황 자동 업데이트

### 🗑️ 제거 가능한 코드

#### 1. Records 컨트롤러
**위치**: `src/mission/record-completion.controller.ts`

**현재**:
- 완전히 비활성화됨
- 설계 변경으로 불필요해짐

**제안**:
- 파일 자체를 삭제 가능
- 기록 시스템은 `/tracking/records/*` 에서 정상 작동 중

---

## 🤔 검토 필요사항

1. **userId 추출 로직 불일치**
   - Mission: `req.user?.userId || req.user?.sub`
   - Quiz: `req.user?.userId || req.user?.sub || req.user?.id`
   - 왜 Quiz만 `req.user?.id` 추가?
   - 표준화 필요

---

## 🎯 미션 & 퀴즈 도메인 결론

**전반적 평가**: ✅ **기본 기능은 잘 구현됨**

- 미션/퀴즈 조회, 완료 처리 정상 작동
- 포인트 적립 로직 완비
- 챌린지 연동 잘 됨

**정리 필요**:
- Records 컨트롤러 파일 삭제 가능 (설계 변경으로 불필요)

**개선 필요**:
- userId 추출 로직 표준화

---

**미션 & 퀴즈 도메인 감사 완료** ✅
