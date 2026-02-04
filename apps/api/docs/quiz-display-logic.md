# 퀴즈 노출 로직 (프론트엔드 가이드)

## 📋 개요
강의 상세 API에서 퀴즈 노출 여부와 포인트 지급 조건을 제어합니다.

---

## 🎯 핵심 규칙

### 사용자 타입별 퀴즈 노출
| 사용자 타입 | 조건 | 퀴즈 노출 | 포인트 지급 |
|-----------|------|----------|------------|
| **챌린저** | `currentDay < dayNumber` | ❌ 비노출 | ❌ |
| **챌린저** | `currentDay === dayNumber` | ✅ 노출 | ✅ 200점 |
| **챌린저** | `currentDay > dayNumber` | ✅ 노출 | ❌ |
| **구독자** | - | ❌ 비노출 | ❌ |
| **일반회원** | - | ❌ 접근 불가 (403) | ❌ |

---

## 📡 API 응답 구조

### 1️⃣ 강의 상세 조회 API
**Endpoint**: `GET /api/contents/lectures/:id`

```typescript
// 응답 구조
{
  success: true,
  data: {
    id: 1,
    title: "강의 제목",
    content: "강의 내용",
    dayNumber: 15,              // 강의 일차 (중요!)
    weekNumber: 3,

    // 퀴즈 데이터 (노출 조건에 따라 빈 배열일 수 있음)
    lectureQuizzes: [
      {
        id: 1,
        quiz: {
          id: 10,
          question: "퀴즈 질문",
          options: ["선택지1", "선택지2", "선택지3", "선택지4"],
          explanation: "정답 해설"
        }
      }
    ],

    // 퀴즈 상태 정보 (프론트에서 UI 제어용)
    quizStatus: {
      available: true/false,      // 퀴즈 이용 가능 여부
      openDay: 15,                // 오픈 일차 (챌린저만, 구독자는 null)
      message: "메시지",           // 안내 메시지 (비노출 시)
      canEarnPoints: true/false   // 포인트 획득 가능 여부
    }
  }
}
```

### 2️⃣ 퀴즈 풀이 API
**Endpoint**: `POST /api/quizzes/lecture/complete`

```typescript
// 요청
{
  quizId: 10,          // 퀴즈 ID
  selectedAnswer: 2    // 선택한 답변 번호 (1~4)
}

// 응답
{
  success: true,
  data: {
    quiz: {
      id: 10,
      question: "퀴즈 질문",
      explanation: "정답 해설"
    },
    content: {
      id: 1,
      title: "강의 제목"
    },
    selectedAnswer: 2,
    correctAnswer: 3,
    isCorrect: false,
    pointsEarned: 0,              // 획득한 포인트 (0 또는 200)
    canEarnPoints: false,         // 포인트 획득 가능 여부
    pointEarnMessage: "과거 퀴즈는 포인트가 지급되지 않습니다",
    answeredAt: "2025-11-06T10:30:00Z"
  }
}
```

---

## 🎨 프론트엔드 UI 처리 가이드

### 1️⃣ 퀴즈 노출 여부 판단

```typescript
// 강의 상세 API 응답
const lectureData = response.data;

// 퀴즈 노출 여부 확인
if (lectureData.quizStatus.available) {
  // ✅ 퀴즈 노출: 퀴즈 UI 표시
  showQuizUI(lectureData.lectureQuizzes);

  // 포인트 획득 가능 여부 표시
  if (lectureData.quizStatus.canEarnPoints) {
    showPointBadge("200P 획득 가능");
  } else {
    showWarningMessage("포인트는 지급되지 않습니다");
  }
} else {
  // ❌ 퀴즈 비노출: 안내 메시지 표시
  showLockedQuizMessage(lectureData.quizStatus.message);
  // 예: "15일차에 오픈됩니다"
  // 예: "챌린지 참여자만 이용 가능합니다"
}
```

### 2️⃣ 퀴즈 상태별 UI 처리

```typescript
interface QuizStatus {
  available: boolean;
  openDay: number | null;
  message: string | null;
  canEarnPoints: boolean;
}

function renderQuizUI(quizStatus: QuizStatus, lectureQuizzes: any[]) {
  // 케이스 1: 미래 퀴즈 (비노출)
  if (!quizStatus.available && quizStatus.openDay) {
    return (
      <LockedQuizCard>
        <LockIcon />
        <Text>{quizStatus.message}</Text>
        {/* 예: "15일차에 오픈됩니다" */}
      </LockedQuizCard>
    );
  }

  // 케이스 2: 당일 퀴즈 (노출 + 포인트 O)
  if (quizStatus.available && quizStatus.canEarnPoints) {
    return (
      <QuizCard>
        <PointBadge>200P 획득</PointBadge>
        <QuizContent quizzes={lectureQuizzes} />
      </QuizCard>
    );
  }

  // 케이스 3: 과거 퀴즈 (노출 + 포인트 X)
  if (quizStatus.available && !quizStatus.canEarnPoints) {
    return (
      <QuizCard>
        <WarningBadge>포인트 지급 없음</WarningBadge>
        <InfoText>{quizStatus.message}</InfoText>
        <QuizContent quizzes={lectureQuizzes} />
      </QuizCard>
    );
  }

  // 케이스 4: 구독자 (비노출)
  if (!quizStatus.available && !quizStatus.openDay) {
    return (
      <LockedQuizCard>
        <LockIcon />
        <Text>{quizStatus.message}</Text>
        {/* 예: "챌린지 참여자만 이용 가능합니다" */}
      </LockedQuizCard>
    );
  }
}
```

### 3️⃣ 퀴즈 풀이 후 처리

```typescript
async function submitQuiz(quizId: number, selectedAnswer: number) {
  try {
    const response = await api.post('/quizzes/lecture/complete', {
      quizId,
      selectedAnswer
    });

    const result = response.data.data;

    // 정답 여부 표시
    if (result.isCorrect) {
      showSuccessMessage("정답입니다! 🎉");
    } else {
      showErrorMessage("오답입니다 😢");
    }

    // 해설 표시
    showExplanation(result.quiz.explanation);

    // 포인트 획득 정보 표시
    if (result.pointsEarned > 0) {
      showPointReward(`${result.pointsEarned}P 획득!`);
    } else if (result.pointEarnMessage) {
      showInfoMessage(result.pointEarnMessage);
      // 예: "과거 퀴즈는 포인트가 지급되지 않습니다"
    }

  } catch (error) {
    console.error('퀴즈 제출 실패:', error);
  }
}
```

---

## 🚨 주의사항

### 1. lectureQuizzes 배열 체크
```typescript
// ❌ 잘못된 방법
if (lectureData.lectureQuizzes.length > 0) {
  // lectureQuizzes가 빈 배열일 수 있음!
}

// ✅ 올바른 방법
if (lectureData.quizStatus.available) {
  // quizStatus.available로 먼저 체크
}
```

### 2. 포인트 획득 가능 여부 표시
```typescript
// ✅ 반드시 canEarnPoints로 체크
if (quizStatus.canEarnPoints) {
  showPointBadge("200P");
} else {
  showWarningBadge("포인트 없음");
}
```

### 3. 구독자와 미래 퀴즈 구분
```typescript
// 구분 방법: openDay 필드로 구분
if (!quizStatus.available) {
  if (quizStatus.openDay !== null) {
    // 미래 퀴즈: "15일차에 오픈됩니다"
  } else {
    // 구독자: "챌린지 참여자만 이용 가능합니다"
  }
}
```

---

## 📊 플로우차트

```
강의 상세 조회
    ↓
quizStatus.available 체크
    ↓
┌─────────────┬──────────────┐
│ available   │ !available   │
│ = true      │ = false      │
└─────────────┴──────────────┘
    ↓                 ↓
canEarnPoints    openDay != null?
    체크                ↓
    ↓             Yes: 미래 퀴즈
┌───┴───┐         No: 구독자
│       │
true   false
당일    과거
200P    0P
```

---

## 🔗 관련 파일

- 백엔드 Controller: `src/content/content.controller.ts:298-355`
- 백엔드 Service: `src/quiz/quiz-completion.service.ts:371-524`
- API 문서: `http://localhost:10804/api/docs`

---

**작성일**: 2025-11-06
**작성자**: Claude Code
**버전**: 1.0
