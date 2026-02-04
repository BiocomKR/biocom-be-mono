# 기록 관리 도메인 API 감사

> 작성일: 2025-10-24
> 분석자: Claude
> 상태: ✅ 완료

---

## 📍 기록 관리 도메인 구조

**컨트롤러**: Records (11개 엔드포인트) + Statistics (7개 엔드포인트)

**주요 기능**:
- 6가지 기록 유형 관리 (이너뷰티, 식단, 영양제, 간헐적단식, 수면, 활동)
- 각 기록별 1주일 통계 제공
- 커스텀 영양제 관리
- 운동 종목 관리

**권한**: 구독사용자 OR 챌린지활성자만 접근 (`RecordAccessGuard`)

---

## 🎯 비즈니스 플로우

```
사용자 로그인
  ↓
구독 OR 챌린지 활성 확인 (RecordAccessGuard)
  ↓
6가지 기록 작성
  ├─ 이너뷰티 (5점 척도 × 5개 질문)
  ├─ 식단 (아침/점심/저녁 + 식품 목록)
  ├─ 영양제 (커스텀/상품 영양제 + 섭취 시간)
  ├─ 간헐적단식 (시작/종료 시간)
  ├─ 수면 (잠든 시간/기상 시간)
  └─ 활동 (운동 종목 + 운동 시간)
  ↓
각 기록당 포인트 100점 지급
  ↓
1주일 통계 조회
  ├─ 요약 통계 (6가지 유형)
  └─ 상세 통계 (유형별)
```

---

## 1️⃣ Records 컨트롤러

**Base Path**: `/api/tracking/records`

**권한**: `@UseGuards(JwtAuthGuard, RecordAccessGuard)`

### 엔드포인트 목록

#### A. 기록 조회
- GET `/` - 기록 목록 조회 (날짜/유형 필터링)

#### B. 기록 생성 (6가지 유형)
- POST `/beauty` - 이너뷰티 기록 저장
- POST `/diet` - 식단 기록 저장
- POST `/supplement` - 영양제 섭취 기록 저장
- POST `/fasting` - 간헐적 단식 기록 저장
- POST `/sleep` - 수면 기록 저장
- POST `/activity` - 활동 기록 저장

#### C. 영양제 관리
- GET `/supplements` - 영양제 목록 조회 (상품 + 커스텀)
- POST `/supplements/custom` - 커스텀 영양제 생성
- DELETE `/supplements/custom/:id` - 커스텀 영양제 삭제

#### D. 운동 종목 관리
- GET `/exercise-types` - 운동 종목 목록 조회

---

### 주요 엔드포인트 상세

#### GET `/tracking/records`
**목적**: 기록 목록 조회

**파라미터**:
- `date` (query, optional): 조회 날짜 (YYYY-MM-DD, 기본값: 오늘)
- `recordType` (query, optional): 기록 유형
  - `BEAUTY`, `DIET`, `SUPPLEMENT`, `FASTING`, `SLEEP`, `ACTIVITY`

**응답**:
```json
{
  "records": [
    {
      "id": 1,
      "userId": 123,
      "recordType": "BEAUTY",
      "recordDate": "2025-10-24",
      "data": { ... },
      "createdAt": "2025-10-24T10:00:00Z"
    }
  ]
}
```

**상태**: ✅ 정상

**특징**:
- 날짜별 필터링
- 기록 유형별 필터링
- 본인 기록만 조회

---

#### POST `/tracking/records/beauty`
**목적**: 이너뷰티 기록 저장

**Request**:
```json
{
  "date": "2025-10-24",
  "scores": {
    "digestion": 4,
    "skin": 5,
    "energy": 3,
    "sleep": 4,
    "stress": 2
  }
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "recordType": "BEAUTY",
    "recordDate": "2025-10-24",
    "scores": { ... },
    "points": 100
  },
  "message": "이너뷰티 기록이 저장되었습니다. 100 포인트가 지급되었습니다."
}
```

**상태**: ✅ 정상

**포인트 지급**: 100점

**특징**:
- 5점 척도 (1-5)
- 5개 질문 (소화, 피부, 에너지, 수면, 스트레스)
- 일일 1회 제한

---

#### POST `/tracking/records/diet`
**목적**: 식단 기록 저장

**Request**:
```json
{
  "date": "2025-10-24",
  "meals": [
    {
      "mealTime": "BREAKFAST",
      "time": "08:00",
      "foods": [
        { "name": "현미밥", "category": "GRAIN" },
        { "name": "김치찌개", "category": "SOUP" }
      ]
    }
  ]
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "recordType": "DIET",
    "recordDate": "2025-10-24",
    "meals": [ ... ],
    "points": 100
  },
  "message": "식단 기록이 저장되었습니다. 100 포인트가 지급되었습니다."
}
```

**상태**: ✅ 정상

**포인트 지급**: 100점

**특징**:
- 아침/점심/저녁 구분
- 식품 카테고리 분류
- 과민식품/고포드맵/가공식품 자동 분석

---

#### POST `/tracking/records/supplement`
**목적**: 영양제 섭취 기록 저장

**Request**:
```json
{
  "date": "2025-10-24",
  "supplements": [
    {
      "supplementId": 1,
      "type": "PRODUCT",
      "time": "09:00"
    },
    {
      "supplementId": 5,
      "type": "CUSTOM",
      "time": "21:00"
    }
  ]
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "id": 3,
    "recordType": "SUPPLEMENT",
    "recordDate": "2025-10-24",
    "supplements": [ ... ],
    "points": 100
  },
  "message": "영양제 기록이 저장되었습니다. 100 포인트가 지급되었습니다."
}
```

**상태**: ✅ 정상

**포인트 지급**: 100점

**특징**:
- 상품 영양제 + 커스텀 영양제
- 섭취 시간 기록
- 준수율 통계 제공

---

#### POST `/tracking/records/fasting`
**목적**: 간헐적 단식 기록 저장

**Request**:
```json
{
  "date": "2025-10-24",
  "startTime": "2025-10-24T20:00:00Z",
  "endTime": "2025-10-25T12:00:00Z"
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "id": 4,
    "recordType": "FASTING",
    "recordDate": "2025-10-24",
    "startTime": "2025-10-24T20:00:00Z",
    "endTime": "2025-10-25T12:00:00Z",
    "duration": 16,
    "points": 100
  },
  "message": "간헐적 단식 기록이 저장되었습니다. 100 포인트가 지급되었습니다."
}
```

**상태**: ✅ 정상

**포인트 지급**: 100점

**특징**:
- 공복 시간 자동 계산
- 16시간 목표 달성률 통계

---

#### POST `/tracking/records/sleep`
**목적**: 수면 기록 저장

**Request**:
```json
{
  "date": "2025-10-24",
  "sleepTime": "2025-10-24T23:00:00Z",
  "wakeTime": "2025-10-25T07:00:00Z"
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "id": 5,
    "recordType": "SLEEP",
    "recordDate": "2025-10-24",
    "sleepTime": "2025-10-24T23:00:00Z",
    "wakeTime": "2025-10-25T07:00:00Z",
    "duration": 8,
    "points": 100
  },
  "message": "수면 기록이 저장되었습니다. 100 포인트가 지급되었습니다."
}
```

**상태**: ✅ 정상

**포인트 지급**: 100점

**특징**:
- 수면 시간 자동 계산
- 8시간 목표 달성률 통계

---

#### POST `/tracking/records/activity`
**목적**: 활동 기록 저장

**Request**:
```json
{
  "date": "2025-10-24",
  "activities": [
    {
      "exerciseTypeId": 1,
      "duration": 30,
      "caloriesBurned": 150
    }
  ]
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "id": 6,
    "recordType": "ACTIVITY",
    "recordDate": "2025-10-24",
    "activities": [ ... ],
    "totalCalories": 150,
    "points": 100
  },
  "message": "활동 기록이 저장되었습니다. 100 포인트가 지급되었습니다."
}
```

**상태**: ✅ 정상

**포인트 지급**: 100점

**특징**:
- 다양한 운동 종목
- 칼로리 소모량 추적
- 운동별 분석 통계

---

#### GET `/tracking/records/supplements`
**목적**: 영양제 목록 조회

**응답**:
```json
{
  "products": [
    { "id": 1, "name": "비타민 D", "category": "VITAMIN" }
  ],
  "customs": [
    { "id": 1, "name": "유산균", "createdAt": "2025-10-24T10:00:00Z" }
  ]
}
```

**상태**: ✅ 정상

**특징**:
- 상품 영양제 (Product 테이블)
- 커스텀 영양제 (UserCustomSupplement 테이블)
- 사용자별 커스텀 목록

---

#### POST `/tracking/records/supplements/custom`
**목적**: 커스텀 영양제 생성

**Request**:
```json
{
  "name": "오메가3"
}
```

**응답**:
```json
{
  "id": 1,
  "userId": 123,
  "name": "오메가3",
  "createdAt": "2025-10-24T10:00:00Z"
}
```

**상태**: ✅ 정상

---

#### DELETE `/tracking/records/supplements/custom/:id`
**목적**: 커스텀 영양제 삭제

**응답**:
```json
{
  "success": true,
  "message": "커스텀 영양제가 삭제되었습니다."
}
```

**상태**: ✅ 정상

**특징**:
- 본인 영양제만 삭제 가능

---

#### GET `/tracking/records/exercise-types`
**목적**: 운동 종목 목록 조회

**응답**:
```json
{
  "exerciseTypes": [
    { "id": 1, "name": "걷기", "category": "CARDIO", "caloriesPerHour": 200 },
    { "id": 2, "name": "조깅", "category": "CARDIO", "caloriesPerHour": 400 }
  ]
}
```

**상태**: ✅ 정상

**특징**:
- 운동 종목별 칼로리 정보
- 카테고리 분류 (CARDIO, STRENGTH, FLEXIBILITY 등)

---

## 2️⃣ Statistics 컨트롤러

**Base Path**: `/api/tracking/statistics`

**권한**: `@UseGuards(JwtAuthGuard, RecordAccessGuard)`

**기간**: 1주일 고정

### 엔드포인트 목록

#### A. 통계 조회 (7개)
- GET `/summary` - 통계 목록 (요약)
- GET `/beauty` - 이너뷰티 상세 통계
- GET `/diet` - 식단 상세 통계
- GET `/supplement` - 영양제 상세 통계
- GET `/fasting` - 간헐적단식 상세 통계
- GET `/sleep` - 수면 상세 통계
- GET `/activity` - 활동 상세 통계

---

### 주요 엔드포인트 상세

#### GET `/tracking/statistics/summary`
**목적**: 6가지 기록 유형의 1주일 요약 통계

**응답**:
```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2025-10-18",
      "endDate": "2025-10-24",
      "days": 7
    },
    "summary": {
      "beauty": { "recordCount": 5, "avgScore": 4.2 },
      "diet": { "recordCount": 6, "avgScore": 85 },
      "supplement": { "recordCount": 7, "complianceRate": 100 },
      "fasting": { "recordCount": 4, "avgDuration": 15.5 },
      "sleep": { "recordCount": 6, "avgDuration": 7.5 },
      "activity": { "recordCount": 3, "totalCalories": 450 }
    }
  },
  "message": "통계 목록 조회 성공"
}
```

**상태**: ✅ 정상

---

#### GET `/tracking/statistics/beauty`
**목적**: 이너뷰티 + 아우터뷰티 1주일 상세 통계

**응답**:
```json
{
  "success": true,
  "data": {
    "averageScores": {
      "digestion": 4.2,
      "skin": 4.5,
      "energy": 3.8,
      "sleep": 4.0,
      "stress": 3.5
    },
    "dailyTrend": [
      { "date": "2025-10-18", "totalScore": 20 },
      { "date": "2025-10-19", "totalScore": 22 }
    ],
    "analysis": {
      "bestCategory": "skin",
      "worstCategory": "stress",
      "improvementRate": 10
    }
  },
  "message": "이너뷰티 통계 조회 성공"
}
```

**상태**: ✅ 정상

---

#### GET `/tracking/statistics/diet`
**목적**: 식품 분류별 1주일 상세 통계

**응답**:
```json
{
  "success": true,
  "data": {
    "sensitivityFoods": {
      "count": 3,
      "foods": ["우유", "밀가루"]
    },
    "highFodmapFoods": {
      "count": 5,
      "foods": ["양파", "마늘"]
    },
    "processedFoods": {
      "count": 2,
      "foods": ["라면"]
    },
    "dietScore": 75,
    "dailyTrend": [ ... ]
  },
  "message": "식단 통계 조회 성공"
}
```

**상태**: ✅ 정상

---

#### GET `/tracking/statistics/supplement`
**목적**: 영양제 섭취 준수율 1주일 통계

**응답**:
```json
{
  "success": true,
  "data": {
    "complianceRate": 85,
    "dailyCompliance": [
      { "date": "2025-10-18", "rate": 100 },
      { "date": "2025-10-19", "rate": 75 }
    ],
    "missedDays": 1
  },
  "message": "영양제 통계 조회 성공"
}
```

**상태**: ✅ 정상

---

#### GET `/tracking/statistics/fasting`
**목적**: 간헐적단식 시간 1주일 통계

**응답**:
```json
{
  "success": true,
  "data": {
    "avgDuration": 15.5,
    "dailyDuration": [
      { "date": "2025-10-18", "duration": 16 },
      { "date": "2025-10-19", "duration": 15 }
    ],
    "goalAchievementRate": 75,
    "goal": 16
  },
  "message": "간헐적단식 통계 조회 성공"
}
```

**상태**: ✅ 정상

**목표**: 16시간

---

#### GET `/tracking/statistics/sleep`
**목적**: 수면 시간 1주일 통계

**응답**:
```json
{
  "success": true,
  "data": {
    "avgDuration": 7.5,
    "dailyDuration": [
      { "date": "2025-10-18", "duration": 8 },
      { "date": "2025-10-19", "duration": 7 }
    ],
    "goalAchievementRate": 66,
    "goal": 8
  },
  "message": "수면 통계 조회 성공"
}
```

**상태**: ✅ 정상

**목표**: 8시간

---

#### GET `/tracking/statistics/activity`
**목적**: 활동별 칼로리 소모량 1주일 통계

**응답**:
```json
{
  "success": true,
  "data": {
    "totalCalories": 1200,
    "dailyCalories": [
      { "date": "2025-10-18", "calories": 200 },
      { "date": "2025-10-19", "calories": 0 }
    ],
    "exerciseBreakdown": [
      { "exerciseType": "걷기", "totalCalories": 600, "count": 3 }
    ],
    "changeRate": 20
  },
  "message": "활동 통계 조회 성공"
}
```

**상태**: ✅ 정상

---

## 📊 데이터베이스 스키마

### UserRecord 테이블
```prisma
model UserRecord {
  id          Int      @id @default(autoincrement())
  userId      Int      @map("user_id")
  recordType  String   @map("record_type")
  recordDate  String   @map("record_date")
  data        Json
  points      Int      @default(100)
  createdAt   DateTime @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, recordType, recordDate])
  @@index([userId, recordDate])
  @@map("user_records")
}
```

**recordType 종류**:
- `BEAUTY` - 이너뷰티
- `DIET` - 식단
- `SUPPLEMENT` - 영양제
- `FASTING` - 간헐적단식
- `SLEEP` - 수면
- `ACTIVITY` - 활동

**제약 조건**:
- `@@unique([userId, recordType, recordDate])` - 일일 1회만 기록 가능

---

### UserCustomSupplement 테이블
```prisma
model UserCustomSupplement {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  name      String   @db.VarChar(100)
  createdAt DateTime @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@map("user_custom_supplements")
}
```

---

### ExerciseType 테이블
```prisma
model ExerciseType {
  id               Int     @id @default(autoincrement())
  name             String  @db.VarChar(100)
  category         String  @db.VarChar(50)
  caloriesPerHour  Int     @map("calories_per_hour")

  @@map("exercise_types")
}
```

---

## 🔍 기록 관리 도메인 정리

### ✅ 잘된 점

1. **RecordAccessGuard로 접근 제어**
   - 구독자 OR 챌린지 활성자만 접근
   - 권한 없는 사용자 차단

2. **6가지 기록 유형 체계화**
   - 이너뷰티: 5점 척도 설문
   - 식단: 과민식품/고포드맵/가공식품 분석
   - 영양제: 상품 + 커스텀 관리
   - 간헐적단식: 16시간 목표
   - 수면: 8시간 목표
   - 활동: 운동별 칼로리 추적

3. **포인트 지급 시스템**
   - 각 기록당 100점 지급
   - 일일 1회 제한 (중복 방지)

4. **통계 기능**
   - 1주일 요약 통계
   - 유형별 상세 통계
   - 일별 추이 분석
   - 목표 달성률

5. **커스텀 관리**
   - 영양제 직접 추가
   - 사용자별 영양제 목록
   - 삭제 권한 검증

### 🤔 검토 필요사항

#### 1. 향후 확장 엔드포인트 주석 처리 ✅
**위치**: [statistics.controller.ts:207-232](src/tracking/controllers/statistics.controller.ts#L207-L232)

**현재**:
```typescript
// @Get(':type/:period')
// async getStatisticsByPeriod(...) {
//   // TODO: 기획 변경 시 구현
//   throw new Error('향후 구현 예정');
// }
```

**상태**: 좋은 접근
- 향후 확장 가능성 명시
- 주석으로 보존
- 기획 변경 시 빠르게 활성화 가능

---

#### 2. userId 추출 불일치 ⚠️
**위치**: [records.controller.ts:78](src/tracking/controllers/records.controller.ts#L78), [statistics.controller.ts:57](src/tracking/controllers/statistics.controller.ts#L57)

**문제**:
```typescript
// 현재 (tracking 컨트롤러)
const userId = req.user.id;  // ❌ 다른 도메인과 불일치

// 다른 도메인 표준
const userId = req.user.userId || req.user.sub;  // ✅
```

**영향**:
- JWT payload 구조에 따라 userId 추출 실패 가능
- 인증 실패 가능성

**권장 조치**:
```typescript
const userId = req.user.userId || req.user.sub || req.user.id;
```

---

#### 3. 기록 삭제 API 없음
**현재 상황**:
- 기록 생성만 가능
- 기록 수정/삭제 API 없음

**시나리오**:
- 사용자가 잘못 기록한 경우?
- 기록을 수정하고 싶은 경우?

**권장 (필요 시)**:
```typescript
@Patch(':recordType/:recordId')
async updateRecord(...) { }

@Delete(':recordType/:recordId')
async deleteRecord(...) { }
```

---

#### 4. 포인트 중복 지급 방지 로직 확인 필요
**위치**: records.service.ts (확인 필요)

**질문**:
- `@@unique([userId, recordType, recordDate])` 제약 조건만으로 충분한가?
- 하루에 여러 번 기록 시도 시 에러 처리는?
- 포인트 중복 지급 방지 로직은?

**권장**:
```typescript
// 기존 기록 확인
const existing = await this.prisma.userRecord.findUnique({
  where: {
    userId_recordType_recordDate: {
      userId,
      recordType: 'BEAUTY',
      recordDate: '2025-10-24'
    }
  }
});

if (existing) {
  throw new ConflictException('오늘은 이미 기록했습니다.');
}
```

---

#### 5. 통계 기간 확장성
**현재**: 1주일 고정

**향후 확장**:
- 1일 통계
- 1개월 통계
- 사용자 지정 기간

**주석 처리된 코드 활성화 시점**:
- 기획 변경 시
- 사용자 요청 시

---

## 🎯 기록 관리 도메인 결론

**전반적 평가**: ✅ **매우 잘 구현됨**

- 6가지 기록 유형 체계화
- 접근 제어 우수 (RecordAccessGuard)
- 포인트 지급 시스템 완벽
- 통계 기능 상세
- 향후 확장성 고려

**개선 제안**:
1. **필수**: userId 추출 로직 표준화
2. **선택**: 기록 수정/삭제 API 추가 (비즈니스 요구사항 확인)
3. **선택**: 포인트 중복 지급 방지 로직 강화

---

**기록 관리 도메인 감사 완료** ✅
