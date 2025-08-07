# 📋 바이오컴 API 테스트 시퀀스

📅 작성일: 2025-08-01  
👤 테스터: 형님

---

## 🏢 백오피스 테스트

### 1️⃣ 이벤트 생성
- **API**: POST /api/management/event/periods
- **헤더**: x-api-key: {관리자 API 키}
- **요청 데이터**:
  ```json
  {
    "name": "8월 건강 챌린지",
    "type": "CHALLENGE",
    "startDate": "2025-08-01",
    "endDate": "2025-08-21",
    "totalDays": 21,
    "description": "21일간의 건강 습관 만들기",
    "isActive": true
  }
  ```
- **확인사항**: 
  - 201 응답
  - eventId 반환 (이후 매핑에 사용)

### 2️⃣ 미션, 설문, 퀴즈 생성

#### 2-1. 미션 생성
- **API**: POST /api/management/missions
- **헤더**: x-api-key: {관리자 API 키}
- **요청 데이터**:
  ```json
  {
    "code": "DAILY_WATER",
    "name": "물 8잔 마시기",
    "category": "DAILY",
    "points": 100,
    "description": "하루에 물 8잔을 마시고 인증하세요"
  }
  ```
- **확인사항**: missionId 반환

#### 2-2. 설문 생성
- **API**: POST /api/management/surveys
- **헤더**: x-api-key: {관리자 API 키}
- **요청 데이터**:
  ```json
  {
    "title": "건강 상태 사전 설문",
    "description": "챌린지 시작 전 건강 상태를 확인합니다",
    "type": "health",
    "isActive": true
  }
  ```
- **확인사항**: surveyId 반환

#### 2-3. 퀴즈 생성
- **API**: POST /api/management/quiz-masters
- **헤더**: x-api-key: {관리자 API 키}
- **요청 데이터**:
  ```json
  {
    "question": "하루 권장 물 섭취량은?",
    "options": ["1L", "1.5L", "2L", "2.5L"],
    "correctAnswer": 3,
    "category": "health",
    "difficulty": "easy"
  }
  ```
- **확인사항**: quizId 반환

### 3️⃣ 이벤트와 미션, 설문, 퀴즈 매핑

#### 3-1. 미션 연결
- **API**: POST /api/management/event/{eventId}/missions
- **헤더**: x-api-key: {관리자 API 키}
- **요청 데이터**:
  ```json
  {
    "missionIds": [1, 2, 3],
    "points": 100,
    "activeFromDay": 1,
    "activeToDay": 21
  }
  ```

#### 3-2. 설문 연결
- **API**: POST /api/management/event/{eventId}/surveys
- **헤더**: x-api-key: {관리자 API 키}
- **요청 데이터**:
  ```json
  {
    "surveyId": 1,
    "surveyOptions": {
      "type": "before",
      "fromDay": 1,
      "toDay": 3
    }
  }
  ```

#### 3-3. 퀴즈 연결
- **API**: POST /api/management/event/{eventId}/quizzes
- **헤더**: x-api-key: {관리자 API 키}
- **요청 데이터**:
  ```json
  {
    "quizIds": [1, 2, 3, 4, 5],
    "pointsPerQuiz": 50
  }
  ```

---

## 👤 사용자 테스트

### 1️⃣ 회원가입
- **API**: POST /api/auth/signup
- **요청 데이터**:
  ```json
  {
    "email": "user@test.com",
    "password": "Test1234!",
    "name": "테스트유저",
    "mobile": "01098765432"
  }
  ```
- **확인사항**: 
  - 201 응답
  - access_token 반환

### 2️⃣ 로그인
- **API**: POST /api/auth/signin
- **요청 데이터**:
  ```json
  {
    "email": "user@test.com",
    "password": "Test1234!"
  }
  ```
- **확인사항**: 
  - access_token 반환
  - 이후 모든 API에 Bearer 토큰으로 사용

### 3️⃣ 참여 가능한 이벤트 조회
- **API**: GET /api/event/active
- **헤더**: Authorization: Bearer {token}
- **확인사항**: 
  - 백오피스에서 생성한 이벤트 표시
  - 미션, 설문, 퀴즈 정보 포함

### 4️⃣ 백오피스에서 생성한 이벤트 참여
- **API**: GET /api/event/active/{eventId}
- **헤더**: Authorization: Bearer {token}
- **확인사항**: 
  - 이벤트 상세 정보
  - event_users 테이블에 참여 기록 생성

### 5️⃣ 미션, 설문, 퀴즈 답변 제출

#### 5-1. 미션 완료
- **API**: POST /api/mission/complete
- **헤더**: Authorization: Bearer {token}
- **요청 데이터**:
  ```json
  {
    "missionId": 1,
    "date": "2025-08-01"
  }
  ```
- **확인사항**: 포인트 적립

#### 5-2. 설문 답변
- **API**: POST /api/survey/answers
- **헤더**: Authorization: Bearer {token}
- **요청 데이터**:
  ```json
  {
    "type": "before",
    "answers": [
      {"questionId": 1, "optionId": 2},
      {"questionId": 2, "optionId": 4}
    ]
  }
  ```

#### 5-3. 퀴즈 답변
- **API**: POST /api/quiz/answer
- **헤더**: Authorization: Bearer {token}
- **요청 데이터**:
  ```json
  {
    "quizId": 1,
    "selectedAnswer": 3
  }
  ```
- **확인사항**: 정답 시 포인트 적립

### 6️⃣ 포인트 확인
- **API**: GET /api/users/me
- **헤더**: Authorization: Bearer {token}
- **확인사항**: 
  - 총 누적 포인트
  - 미션: 100점
  - 퀴즈 정답: 50점
  - 총합 확인

---

## 📊 테스트 체크리스트

### 백오피스
| 순번 | 테스트 항목 | 상태 | 비고 |
|------|------------|------|------|
| 1 | 이벤트 생성 | ⬜ | |
| 2-1 | 미션 생성 | ⬜ | |
| 2-2 | 설문 생성 | ⬜ | |
| 2-3 | 퀴즈 생성 | ⬜ | |
| 3-1 | 미션 연결 | ⬜ | |
| 3-2 | 설문 연결 | ⬜ | |
| 3-3 | 퀴즈 연결 | ⬜ | |

### 사용자
| 순번 | 테스트 항목 | 상태 | 비고 |
|------|------------|------|------|
| 1 | 회원가입 | ⬜ | |
| 2 | 로그인 | ⬜ | |
| 3 | 이벤트 조회 | ⬜ | |
| 4 | 이벤트 참여 | ⬜ | |
| 5-1 | 미션 완료 | ⬜ | |
| 5-2 | 설문 답변 | ⬜ | |
| 5-3 | 퀴즈 답변 | ⬜ | |
| 6 | 포인트 확인 | ⬜ | |

✅ 완료 / ❌ 실패 / ⬜ 미진행

---

## ⚠️ 주의사항

1. **API 키**: 백오피스 API는 x-api-key 헤더 필수
2. **토큰**: 사용자 API는 Bearer 토큰 필수
3. **날짜**: 모든 날짜는 한국 시간 기준
4. **순서**: 백오피스 설정을 먼저 완료해야 사용자 테스트 가능