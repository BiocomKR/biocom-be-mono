# 퀴즈 시스템 리팩토링 계획

## 1. 현재 구조 문제점
- EventQuiz가 관계 테이블이면서 동시에 데이터 테이블 역할
- 다른 액션(미션, 설문)과 일관성 없는 구조
- 퀴즈 재사용 불가능

## 2. 새로운 구조 설계

### Quiz 마스터 테이블 (신규)
```prisma
model Quiz {
  id            Int       @id @default(autoincrement())
  title         String    // 퀴즈 제목
  question      String    @db.Text
  options       Json      @db.JsonB // ["옵션1", "옵션2", "옵션3", "옵션4"]
  correctAnswer Int       // 정답 번호 (0-based index)
  points        Int       @default(50)
  category      String?   // 퀴즈 카테고리
  difficulty    String?   // 난이도 (EASY, MEDIUM, HARD)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime? @updatedAt
  
  eventQuizzes  EventQuiz[]
  
  @@map("quizzes")
}
```

### EventQuiz 관계 테이블 (수정)
```prisma
model EventQuiz {
  id            Int      @id @default(autoincrement())
  eventId       Int      @map("event_id")
  quizId        Int      @map("quiz_id")
  day           Int      // 퀴즈 출제 일차
  sortOrder     Int      @default(0) // 같은 날 여러 퀴즈가 있을 경우 순서
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime? @updatedAt
  
  event         EventPeriod @relation(fields: [eventId], references: [id])
  quiz          Quiz @relation(fields: [quizId], references: [id])
  quizAnswers   QuizAnswer[]
  
  @@unique([eventId, quizId, day]) // 같은 이벤트, 같은 날에 동일 퀴즈 중복 방지
  @@index([eventId, day])
  @@map("event_quizzes")
}
```

## 3. API 변경사항

### 퀴즈 관리 API (신규)
```
POST   /api/management/quiz              # 퀴즈 생성
GET    /api/management/quiz              # 퀴즈 목록 조회
GET    /api/management/quiz/:id          # 퀴즈 상세 조회
PUT    /api/management/quiz/:id          # 퀴즈 수정
DELETE /api/management/quiz/:id          # 퀴즈 삭제
```

### 이벤트-퀴즈 연결 API (수정)
```
POST   /api/management/event/periods/:id/quizzes         # 퀴즈 연결
DELETE /api/management/event/periods/:id/quizzes/:quizId # 퀴즈 연결 해제
GET    /api/management/event/periods/:id/quizzes         # 이벤트의 퀴즈 목록
```

## 4. 데이터 마이그레이션 계획

1. 기존 EventQuiz 데이터를 Quiz 테이블로 마이그레이션
2. 중복 제거 (동일한 question을 가진 퀴즈 통합)
3. EventQuiz를 관계 테이블로 재구성

## 5. 영향 범위

- QuizService 수정 필요
- ManagementQuizController 신규 생성
- ManagementEventController의 퀴즈 관련 API 수정
- 기존 사용자 API는 변경 없음 (조인으로 처리)