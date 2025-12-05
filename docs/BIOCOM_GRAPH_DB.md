# 🗄️ Neo4j 그래프 스키마 설계 V2

> 📌 **기반 API**: `GET /api/tracking/statistics/ai-agent`
>
> 📅 **작성일**: 2025-11-28

---

## 🔐 Neo4j Aura 접속 정보

| 항목 | 값 |
|------|-----|
| **콘솔** | [Neo4j Aura Console](https://console-preview.neo4j.io/tools/query) |
| **계정** | `ai@biocom.kr` / `bico0519!!` |

```env
# Neo4j Graph DB (Aura)
NEO4J_URI=neo4j+s://27c48749.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=jqlf6TctHvZk2N4Rc8_Rj_8RUf614PVQz4VPr5F7KjE
NEO4J_DATABASE=neo4j
AURA_INSTANCEID=27c48749
AURA_INSTANCENAME=Instance01
```

---

## 📑 목차

1. [API 응답 데이터 분석](#1-api-응답-데이터-분석)
2. [그래프 스키마 설계](#2-그래프-스키마-설계)
3. [노드 정의](#3-노드-정의)
4. [관계 정의](#4-관계-정의)
5. [Cypher 스키마 초기화](#5-cypher-스키마-초기화)
6. [데이터 저장 Cypher 쿼리](#6-데이터-저장-cypher-쿼리)
7. [Nest.js TypeScript 타입 정의](#7-nestjs-typescript-타입-정의)

---

# 1️⃣ API 응답 데이터 분석

## 📦 API 응답 구조

```json
{
  "success": true,
  "data": {
    "음식물과민증검사결과": [...],
    "이름": "최대길",
    "이너뷰티유형": "배 빵빵 펭귄",
    "AI코치유형": "헨리",
    "MBTI": "없음",
    "자기선언문": "...",
    "칭찬하기": "없음",
    "1일1미션": ["허브티 한 잔 마시기", ...],
    "밸런스게임": [...],
    "뷰티": [...],
    "식단": [...],
    "영양제": "없음",
    "간헐적단식": [...],
    "수면": [...],
    "활동": [...]
  }
}
```

## 📊 데이터 카테고리 분류

| 카테고리 | 필드명 | 특성 | 저장 방식 |
|:---------|:-------|:-----|:----------|
| 👤 **사용자 프로필** | 이름, 이너뷰티유형, AI코치유형, MBTI | 고정 속성 | `User` 노드 속성 |
| 🚨 **알러지 검사** | 음식물과민증검사결과 | 레벨별 음식 목록 | `AllergyReport` 노드 |
| 📝 **자기선언문** | 자기선언문 | 텍스트 | `User` 노드 속성 |
| 🎯 **일일 미션** | 1일1미션 | 배열 | `Mission` 노드 (N개) |
| 🎮 **밸런스게임** | 밸런스게임 | 날짜별 선택 | `BalanceGame` 노드 |
| 💄 **뷰티 점수** | 뷰티 | 날짜별 상세 점수 | `Beauty` 노드 |
| 🍽️ **식단** | 식단 | 날짜별 음식 상세 | `Food` 노드 |
| 💊 **영양제** | 영양제 | 날짜별 영양제 섭취 | `Supplement` 노드 |
| ⏰ **단식** | 간헐적단식 | 날짜별 단식 기록 | `Fasting` 노드 |
| 😴 **수면** | 수면 | 날짜별 수면 기록 | `Sleep` 노드 |
| 🏃 **활동** | 활동 | 날짜별 활동 상세 | `Activity` 노드 |

---

# 2️⃣ 그래프 스키마 설계

## 🕸️ 전체 그래프 구조

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              Neo4j 그래프 구조 V2                                        │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                            (User) 중심 노드                                       │   │
│  │  chart_id, name, innerBeautyType, aiCoachType, mbti, selfDeclaration           │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│           │              │              │              │              │                 │
│           │              │              │              │              │                 │
│  ┌────────┴────┐  ┌──────┴──────┐  ┌────┴────┐  ┌─────┴─────┐  ┌─────┴─────┐          │
│  │             │  │             │  │         │  │           │  │           │          │
│  ▼             ▼  ▼             ▼  ▼         ▼  ▼           ▼  ▼           ▼          │
│                                                                                         │
│  [:HAS_ALLERGY_REPORT]     [:HAS_MISSION]    [:PLAYED_GAME]   [:HAS_DATE]   [:HAS_SUMMARY]│
│           │                      │                 │               │              │     │
│           ▼                      ▼                 ▼               ▼              ▼     │
│  ┌─────────────────┐   ┌─────────────────┐  ┌─────────────┐  ┌─────────┐  ┌───────────┐│
│  │ AllergyReport   │   │    Mission      │  │ BalanceGame │  │  Date   │  │WeeklySummary││
│  │ level1~5 foods  │   │ content, type   │  │ title,option│  │ date    │  │ embedding  ││
│  └─────────────────┘   └─────────────────┘  └─────────────┘  └────┬────┘  └───────────┘│
│                                                                    │                    │
│                           ┌──────────────┬──────────────┬─────────┼─────────┬─────────┐  │
│                           │              │              │         │         │         │  │
│                           ▼              ▼              ▼         ▼         ▼         ▼  │
│                     [:HAS_BEAUTY]  [:HAS_FASTING] [:HAS_SLEEP] [:HAS_ACTIVITY] [:ATE_FOOD] [:TOOK_SUPPLEMENT]│
│                           │              │              │         │         │         │  │
│                           ▼              ▼              ▼         ▼         ▼         ▼  │
│                    ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────┐  ┌──────┐  ┌────────┐  │
│                    │  Beauty   │  │  Fasting  │  │   Sleep   │  │Daily│  │ Food │  │Supplement│ │
│                    │ inner/outer│  │ hours     │  │ hours     │  │Activ│  │ name │  │ intake │  │
│                    │ 8 scores  │  │ start/end │  │ bed/wake  │  │ity  │  │allergy│  │count   │  │
│                    └───────────┘  └───────────┘  └───────────┘  └──┬──┘  └──────┘  └───┬────┘  │
│                                                                     │                   │       │
│                                                                     │ [:INCLUDES]       │[:IS_TYPE]│
│                                                                     ▼                   ▼       │
│                                                              ┌────────────┐      ┌──────────────┐│
│                                                              │  Activity  │      │SupplementType││
│                                                              │ type, cal  │      │ name         ││
│                                                              └────────────┘      └──────┬───────┘│
│                                                                     │                   │       │
│                                                                     │ [:IS_TYPE]        │[:CONTAINS]│
│                                                                     ▼                   ▼       │
│                                                              ┌────────────┐      ┌──────────┐  │
│                                                              │ActivityType│      │ Nutrient │  │
│                                                              │ code, name │      │   name   │  │
│                                                              │ calRate    │      └──────────┘  │
│                                                              └────────────┘                    │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## 🔗 데이터 흐름별 관계

```
User (chart_id: "TA11150002")
│
├── 📋 프로필 정보
│   속성: name, innerBeautyType, aiCoachType, mbti, selfDeclaration
│
├── [:HAS_ALLERGY_REPORT] ──► AllergyReport
│   │   level1Foods ~ level5Foods, testedAt
│
├── [:HAS_MISSION] ──► Mission (N개)
│   │   content: "허브티 한 잔 마시기", type: "DAILY"
│
├── [:PLAYED_GAME] ──► BalanceGame
│   │   title, description, option, keyword, linkedProduct, playedAt
│
├── [:HAS_DATE] ──► Date (날짜별)
│   │   date_id: "TA11150002_2025-11-28"
│   │   │
│   │   ├── [:HAS_BEAUTY] ──► Beauty
│   │   │       totalScore, innerBeautyScore, outerBeautyScore
│   │   │
│   │   ├── [:HAS_FASTING] ──► Fasting
│   │   │       startDateTime, endDateTime, fastingHours
│   │   │
│   │   ├── [:HAS_SLEEP] ──► Sleep
│   │   │       bedDateTime, wakeDateTime, sleepHours
│   │   │
│   │   ├── [:HAS_ACTIVITY] ──► DailyActivity
│   │   │       │   totalCalories, activityCount
│   │   │       │
│   │   │       └── [:INCLUDES] ──► Activity
│   │   │               │   activityTime, durationMinutes, estimatedCalories
│   │   │               │
│   │   │               └── [:IS_TYPE] ──► ActivityType (마스터)
│   │   │
│   │   ├── [:ATE_FOOD] ──► Food (N개)
│   │   │       diet, foodName, allergyFoods, allergyScore
│   │   │
│   │   └── [:TOOK_SUPPLEMENT] ──► Supplement (N개)
│   │           │   intakeCount, recommendedCount
│   │           │
│   │           └── [:IS_TYPE] ──► SupplementType (마스터)
│   │                   │
│   │                   └── [:CONTAINS] ──► Nutrient (마스터)
│   │
└── [:HAS_SUMMARY] ──► WeeklySummary
        week_id, summaryText, embedding[]
```

---

# 3️⃣ 노드 정의

## 👤 User 노드

```typescript
interface UserNode {
  // 🔑 Primary Key
  chart_id: string;           // "TA11150002"
  created_at: datetime;
  updated_at?: datetime;

  // 📋 프로필 정보
  name?: string;              // "최대길"
  inner_beauty_type?: string; // "배 빵빵 펭귄"
  ai_coach_type?: string;     // "헨리"
  mbti?: string;              // "INTJ" | "없음"
  self_declaration?: string;  // 자기선언문
  praise_message?: string;    // 칭찬하기
}
```

---

## 🚨 AllergyReport 노드

```typescript
interface AllergyReportNode {
  // 🔑 Primary Key
  report_id: string;          // "{chart_id}_allergy"
  chart_id: string;

  // 📊 레벨별 음식 (쉼표 구분 문자열)
  level1_foods: string;       // "카카오,캐슈너트,..."
  level2_foods: string;
  level3_foods: string;
  level4_foods: string;
  level5_foods: string;       // ⚠️ 가장 위험

  tested_at?: datetime;
  created_at: datetime;
  updated_at?: datetime;
}
```

---

## 🎯 Mission 노드

```typescript
interface MissionNode {
  // 🔑 Primary Key
  mission_id: string;         // "{chart_id}_mission_{index}"
  chart_id: string;

  content: string;            // "허브티 한 잔 마시기"
  mission_type: string;       // "DAILY" | "WEEKLY" | "CHALLENGE"
  order_index: number;
  created_at: datetime;
}
```

---

## 🎮 BalanceGame 노드

```typescript
interface BalanceGameNode {
  // 🔑 Primary Key
  game_id: string;            // "{chart_id}_game_{timestamp}"
  chart_id: string;

  title: string;              // "외모 버프"
  description: string;        // "둘 중 하나만 가질 수 있다면..."
  selected_option: string;    // "장원영 얼굴"
  keyword: string;            // "활성산소"
  linked_product: string;     // "영데이즈"
  played_at: datetime;
  created_at: datetime;
}
```

---

## 💄 Beauty 노드

```typescript
interface BeautyNode {
  // 🔑 Primary Key
  date_id: string;            // "{chart_id}_{date}"

  // 📊 점수
  total_score: number;        // 140
  inner_beauty_score: number; // 70
  outer_beauty_score: number; // 70

  // 📋 상세 점수 (JSON 문자열)
  inner_beauty_details: string;  // "[{\"no\":1,\"score\":25}, ...]"
  outer_beauty_details: string;  // "[{\"no\":1,\"score\":25}, ...]"

  score?: number;  // 하위 호환
  created_at: datetime;
  updated_at?: datetime;
}
```

---

## 🍽️ Food 노드

```typescript
interface FoodNode {
  // 🔑 Primary Key
  food_id: string;            // "{chart_id}_{date}_{diet}_{foodName}_{timestamp}"

  food_name: string;
  diet_type: string;          // "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | "LATENIGHT"
  is_fasting: boolean;
  image_url?: string;

  // 🚨 알러지 정보
  allergy_foods: string;      // JSON: "[{\"name\":\"밀가루\",\"level\":2}]"
  allergy_score: number;      // 0~5

  // 🏭 가공식품
  processed_count: number;
  processed_foods: string;    // JSON: "[\"빵\",\"햄\"]"

  // 🌾 포드맵
  high_fodmap_count: number;
  high_fodmap_foods: string;  // JSON: "[\"마늘\",\"양파\"]"

  created_at: datetime;
}
```

---

## ⏰ Fasting 노드

```typescript
interface FastingNode {
  // 🔑 Primary Key
  date_id: string;            // "{chart_id}_{date}"

  start_datetime: datetime;   // 2025-11-27T20:00:00
  end_datetime: datetime;     // 2025-11-28T12:00:00
  fasting_hours: number;      // 16.0

  // 🎯 목표 (선택)
  target_hours?: number;
  is_completed?: boolean;

  created_at: datetime;
  updated_at?: datetime;
}
```

---

## 😴 Sleep 노드

```typescript
interface SleepNode {
  // 🔑 Primary Key
  date_id: string;            // "{chart_id}_{date}"

  bed_datetime: datetime;     // 2025-11-27T23:30:00
  wake_datetime: datetime;    // 2025-11-28T07:00:00
  sleep_hours: number;        // 7.5

  // 🎯 목표 (선택)
  target_hours?: number;
  is_completed?: boolean;

  created_at: datetime;
  updated_at?: datetime;
}
```

---

## 📊 DailyActivity 노드

```typescript
interface DailyActivityNode {
  // 🔑 Primary Key
  date_id: string;            // "{chart_id}_{date}"

  total_calories: number;
  activity_count: number;
  total_duration_minutes: number;
  created_at: datetime;
  updated_at?: datetime;
}
```

---

## 🏃 Activity 노드

```typescript
interface ActivityNode {
  // 🔑 Primary Key
  activity_id: string;        // "{chart_id}_{date}_{index}"

  name: string;               // "걷기"
  calories_burned: number;    // 140
  activity_time: string;      // "00:40:00"
  duration_minutes: number;   // 40
  image_url?: string;

  // 🔗 ActivityType 연결
  activity_type_code: string; // "WALKING"

  created_at: datetime;
  updated_at?: datetime;
}
```

---

## 📚 ActivityType 노드 (마스터 데이터)

```typescript
interface ActivityTypeNode {
  // 🔑 Primary Key
  code: string;               // "WALKING"

  name: string;               // "걷기"
  base_minutes: number;       // 10
  calorie_rate: number;       // 35 (10분당 칼로리)
  created_at: datetime;
}
```

---

## 💊 Supplement 노드

```typescript
interface SupplementNode {
  // 🔑 Primary Key
  supplement_id: string;      // "{chart_id}_{date}_{index}"

  intake_count: number;       // 2 (실제 섭취 개수)
  recommended_count: number;  // 2 (권장 섭취 개수)
  created_at: datetime;
}
```

---

## 📚 SupplementType 노드 (마스터 데이터)

```typescript
interface SupplementTypeNode {
  // 🔑 Primary Key
  supplement_type_id: string; // "supplement_type_clean_balance"

  supplement_name: string;    // "클린 밸런스"
  created_at: datetime;
}
```

---

## 🌿 Nutrient 노드 (마스터 데이터)

```typescript
interface NutrientNode {
  // 🔑 Primary Key
  nutrient_id: string;        // "nutrient_chlorella"

  nutrient_name: string;      // "클로렐라"
  created_at: datetime;
}
```

---

# 4️⃣ 관계 정의

## 📋 관계 목록

| 관계 | 시작 노드 | 종료 노드 | 설명 |
|:-----|:----------|:----------|:-----|
| `HAS_DATE` | User | Date | 사용자의 날짜별 기록 |
| `HAS_ALLERGY_REPORT` | User | AllergyReport | 알러지 검사 결과 |
| `HAS_MISSION` | User | Mission | 1일 1미션 |
| `PLAYED_GAME` | User | BalanceGame | 밸런스 게임 기록 |
| `HAS_SUMMARY` | User | WeeklySummary | 주간 요약 |
| `HAS_BEAUTY` | Date | Beauty | 뷰티 점수 |
| `HAS_FASTING` | Date | Fasting | 단식 기록 |
| `HAS_SLEEP` | Date | Sleep | 수면 기록 |
| `HAS_ACTIVITY` | Date | DailyActivity | 일일 활동 집계 |
| `ATE_FOOD` | Date | Food | 섭취한 음식 |
| `TOOK_SUPPLEMENT` | Date | Supplement | 섭취한 영양제 |
| `INCLUDES` | DailyActivity | Activity | 개별 활동 포함 |
| `IS_TYPE` | Activity | ActivityType | 활동 유형 참조 |
| `IS_TYPE` | Supplement | SupplementType | 영양제 유형 참조 |
| `CONTAINS` | SupplementType | Nutrient | 영양제의 영양소 포함 |

## 🔢 관계 카디널리티

```
User (1) ─[:HAS_DATE]────────────► Date (N)
User (1) ─[:HAS_ALLERGY_REPORT]──► AllergyReport (1)
User (1) ─[:HAS_MISSION]─────────► Mission (N)
User (1) ─[:PLAYED_GAME]─────────► BalanceGame (N)
User (1) ─[:HAS_SUMMARY]─────────► WeeklySummary (N)

Date (1) ─[:HAS_BEAUTY]──────────► Beauty (1)
Date (1) ─[:HAS_FASTING]─────────► Fasting (1)
Date (1) ─[:HAS_SLEEP]───────────► Sleep (1)
Date (1) ─[:HAS_ACTIVITY]────────► DailyActivity (1)
Date (1) ─[:ATE_FOOD]────────────► Food (N)
Date (1) ─[:TOOK_SUPPLEMENT]─────► Supplement (N)

DailyActivity (1) ─[:INCLUDES]───► Activity (N)
Activity (N) ─[:IS_TYPE]─────────► ActivityType (1)

Supplement (N) ─[:IS_TYPE]───────► SupplementType (1)
SupplementType (1) ─[:CONTAINS]──► Nutrient (N)
```

---

# 5️⃣ Cypher 스키마 초기화

## 🔒 제약조건 (Constraints)

```cypher
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔑 유니크 제약조건
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// User
CREATE CONSTRAINT user_chart_id IF NOT EXISTS
FOR (u:User) REQUIRE u.chart_id IS UNIQUE;

// Date
CREATE CONSTRAINT date_id IF NOT EXISTS
FOR (d:Date) REQUIRE d.date_id IS UNIQUE;

// AllergyReport
CREATE CONSTRAINT allergy_report_id IF NOT EXISTS
FOR (ar:AllergyReport) REQUIRE ar.report_id IS UNIQUE;

// Mission
CREATE CONSTRAINT mission_id IF NOT EXISTS
FOR (m:Mission) REQUIRE m.mission_id IS UNIQUE;

// BalanceGame
CREATE CONSTRAINT balance_game_id IF NOT EXISTS
FOR (bg:BalanceGame) REQUIRE bg.game_id IS UNIQUE;

// Food
CREATE CONSTRAINT food_id IF NOT EXISTS
FOR (f:Food) REQUIRE f.food_id IS UNIQUE;

// Activity
CREATE CONSTRAINT activity_id IF NOT EXISTS
FOR (a:Activity) REQUIRE a.activity_id IS UNIQUE;

// ActivityType (마스터)
CREATE CONSTRAINT activity_type_code IF NOT EXISTS
FOR (at:ActivityType) REQUIRE at.code IS UNIQUE;

// SupplementType (마스터)
CREATE CONSTRAINT supplement_type_id IF NOT EXISTS
FOR (st:SupplementType) REQUIRE st.supplement_type_id IS UNIQUE;

// Nutrient (마스터)
CREATE CONSTRAINT nutrient_id IF NOT EXISTS
FOR (n:Nutrient) REQUIRE n.nutrient_id IS UNIQUE;

// Supplement
CREATE CONSTRAINT supplement_id IF NOT EXISTS
FOR (s:Supplement) REQUIRE s.supplement_id IS UNIQUE;

// WeeklySummary
CREATE CONSTRAINT weekly_summary_id IF NOT EXISTS
FOR (ws:WeeklySummary) REQUIRE ws.week_id IS UNIQUE;
```

## 📇 인덱스 (Indexes)

```cypher
// 📅 날짜 검색용
CREATE INDEX date_date IF NOT EXISTS FOR (d:Date) ON (d.date);

// 🍽️ 음식 검색용
CREATE INDEX food_name IF NOT EXISTS FOR (f:Food) ON (f.food_name);
CREATE INDEX food_diet_type IF NOT EXISTS FOR (f:Food) ON (f.diet_type);

// 🏃 활동 검색용
CREATE INDEX activity_name IF NOT EXISTS FOR (a:Activity) ON (a.name);

// 💊 영양제 검색용
CREATE INDEX supplement_type_name IF NOT EXISTS
FOR (st:SupplementType) ON (st.supplement_name);

CREATE INDEX nutrient_name IF NOT EXISTS
FOR (n:Nutrient) ON (n.nutrient_name);

// 🎮 밸런스게임 날짜 검색
CREATE INDEX balance_game_played_at IF NOT EXISTS
FOR (bg:BalanceGame) ON (bg.played_at);
```

## 📚 마스터 데이터 초기화 (ActivityType)

```cypher
// ActivityType 마스터 데이터 생성
UNWIND [
  {code: 'WALKING', name: '걷기', baseMinutes: 10, calorieRate: 35},
  {code: 'RUNNING', name: '달리기', baseMinutes: 10, calorieRate: 100},
  {code: 'YOGA', name: '요가', baseMinutes: 10, calorieRate: 35},
  {code: 'PILATES', name: '필라테스', baseMinutes: 10, calorieRate: 50},
  {code: 'WEIGHT_TRAINING', name: '웨이트 트레이닝', baseMinutes: 10, calorieRate: 70},
  {code: 'SWIMMING', name: '수영', baseMinutes: 10, calorieRate: 100},
  {code: 'INDOOR_CYCLING', name: '실내 자전거', baseMinutes: 10, calorieRate: 70},
  {code: 'OUTDOOR_CYCLING', name: '야외 자전거', baseMinutes: 10, calorieRate: 90},
  {code: 'HIKING', name: '등산 / 하이킹', baseMinutes: 10, calorieRate: 75},
  {code: 'JUMP_ROPE', name: '줄넘기', baseMinutes: 10, calorieRate: 90},
  {code: 'BOXING', name: '복싱', baseMinutes: 10, calorieRate: 110},
  {code: 'CLIMBING', name: '클라이밍', baseMinutes: 10, calorieRate: 80},
  {code: 'TENNIS_SQUASH', name: '테니스 / 스쿼시', baseMinutes: 10, calorieRate: 90},
  {code: 'F45_CROSSFIT', name: 'F45 / 크로스핏', baseMinutes: 10, calorieRate: 110},
  {code: 'ZUMBA_GX', name: '줌바 / GX', baseMinutes: 10, calorieRate: 80},
  {code: 'GOLF', name: '골프', baseMinutes: 10, calorieRate: 50},
  {code: 'STAIR_CLIMBING', name: '계단 오르기', baseMinutes: 10, calorieRate: 80},
  {code: 'BODYWEIGHT_EXERCISE', name: '맨몸 운동 / 홈트', baseMinutes: 10, calorieRate: 80}
] AS type

MERGE (at:ActivityType {code: type.code})
ON CREATE SET
  at.name = type.name,
  at.base_minutes = type.baseMinutes,
  at.calorie_rate = type.calorieRate,
  at.created_at = datetime()
ON MATCH SET
  at.name = type.name,
  at.base_minutes = type.baseMinutes,
  at.calorie_rate = type.calorieRate
```

---

# 6️⃣ 데이터 저장 Cypher 쿼리

## 📌 저장 전략: 동기화 (Sync) 방식

> **💡 핵심 원칙**: 같은 `chart_id`로 API가 호출될 때마다 데이터가 **정확히 동기화**되어야 함

### 노드별 저장 전략

| 노드 | 카디널리티 | 저장 전략 | 설명 |
|:-----|:-----------|:----------|:-----|
| **User** | 1:1 | `MERGE + UPDATE` | chartId당 1개, 프로필 업데이트 |
| **AllergyReport** | 1:1 | `MERGE + UPDATE` | chartId당 1개, 검사 결과 업데이트 |
| **Date** | 1:N | `MERGE` | 날짜당 1개 |
| **Beauty** | 날짜당 1개 | `MERGE + UPDATE` | 덮어쓰기 |
| **Fasting** | 날짜당 1개 | `MERGE + UPDATE` | 덮어쓰기 |
| **Sleep** | 날짜당 1개 | `MERGE + UPDATE` | 덮어쓰기 |
| **DailyActivity** | 날짜당 1개 | `MERGE + UPDATE` | 덮어쓰기 |
| **Mission** | 1:N | `DELETE + CREATE` | 전체 교체 |
| **BalanceGame** | 1:N | `DELETE + CREATE` | 전체 교체 |
| **Food** | 날짜당 N개 | `DELETE + CREATE` | 날짜별 전체 교체 |
| **Supplement** | 날짜당 N개 | `DELETE + CREATE` | 날짜별 전체 교체 |
| **Activity** | 날짜당 N개 | `DELETE + CREATE` | 날짜별 전체 교체 |

### 동기화 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│  📡 API 호출: GET /api/tracking/statistics/ai-agent            │
│  (chartId: TA11150002 의 전체 데이터 반환)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: 👤 User + Profile (MERGE)                              │
│  → 기존 User 있으면 프로필 업데이트, 없으면 생성                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: 🚨 AllergyReport (MERGE)                               │
│  → 기존 결과 있으면 업데이트, 없으면 생성                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: 🎯 Mission (DELETE → CREATE)                           │
│  → 기존 미션 전체 삭제 후 새로 생성                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: 🎮 BalanceGame (DELETE → CREATE)                       │
│  → 기존 게임 기록 전체 삭제 후 새로 생성                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: 📅 날짜별 데이터 동기화 (각 날짜에 대해)                │
│  ├── Beauty, Fasting, Sleep, DailyActivity: MERGE (덮어쓰기)    │
│  ├── Food: 해당 날짜 기존 Food 삭제 → 새로 CREATE               │
│  ├── Supplement: 해당 날짜 기존 Supplement 삭제 → 새로 CREATE   │
│  └── Activity: 해당 날짜 기존 Activity 삭제 → 새로 CREATE       │
└─────────────────────────────────────────────────────────────────┘
```

### 왜 DELETE + CREATE 인가?

> **⚠️ 시나리오**: 사용자가 식단 수정

```
T1: 사용자가 아침에 "빵" 기록
    → Food 노드: [빵]

T2: 사용자가 "빵"을 삭제하고 "샐러드"로 변경
    API 응답: [샐러드]

❌ MERGE 방식 문제점:
    → 기존 "빵" 노드 유지 + "샐러드" 노드 추가
    → 결과: [빵, 샐러드] ← 잘못됨!

✅ DELETE + CREATE 방식:
    → 기존 Food 전체 삭제
    → 새로 [샐러드] 생성
    → 결과: [샐러드] ← 정확함!
```

---

## 6.1 👤 User + Profile 저장 (MERGE)

```cypher
MERGE (u:User {chart_id: $chartId})
ON CREATE SET
  u.created_at = datetime()
SET
  u.name = $name,
  u.inner_beauty_type = $innerBeautyType,
  u.ai_coach_type = $aiCoachType,
  u.mbti = $mbti,
  u.self_declaration = $selfDeclaration,
  u.praise_message = $praiseMessage,
  u.updated_at = datetime()
RETURN u
```

**📥 파라미터 예시:**
```javascript
{
  chartId: "TA11150002",
  name: "최대길",
  innerBeautyType: "배 빵빵 펭귄",
  aiCoachType: "헨리",
  mbti: "없음",
  selfDeclaration: "자기선언문 내용...",
  praiseMessage: "없음"
}
```

---

## 6.2 🚨 AllergyReport 저장

```cypher
MATCH (u:User {chart_id: $chartId})

MERGE (u)-[:HAS_ALLERGY_REPORT]->(ar:AllergyReport {report_id: $reportId})
ON CREATE SET
  ar.chart_id = $chartId,
  ar.created_at = datetime()
SET
  ar.level1_foods = $level1Foods,
  ar.level2_foods = $level2Foods,
  ar.level3_foods = $level3Foods,
  ar.level4_foods = $level4Foods,
  ar.level5_foods = $level5Foods,
  ar.tested_at = datetime($testedAt),
  ar.updated_at = datetime()

RETURN ar
```

**📥 파라미터 예시:**
```javascript
{
  chartId: "TA11150002",
  reportId: "TA11150002_allergy",
  level1Foods: "카카오,캐슈너트,헤이즐넛,...",
  level2Foods: "아몬드,해바라기씨,...",
  level3Foods: "코코넛,마카다미아너트,...",
  level4Foods: "브라질너트,잣,완두콩",
  level5Foods: "땅콩",
  testedAt: "2025-01-15T00:00:00"
}
```

---

## 6.3 🎯 Mission 저장 (DELETE → CREATE)

### Step 1: 기존 Mission 전체 삭제

```cypher
MATCH (u:User {chart_id: $chartId})-[:HAS_MISSION]->(m:Mission)
DETACH DELETE m
```

### Step 2: 새 Mission 생성 (배치)

```cypher
MATCH (u:User {chart_id: $chartId})

UNWIND $missions AS mission
CREATE (u)-[:HAS_MISSION]->(m:Mission {
  mission_id: mission.missionId,
  chart_id: $chartId,
  content: mission.content,
  mission_type: mission.missionType,
  order_index: mission.orderIndex,
  created_at: datetime()
})

RETURN count(m) AS missionCount
```

**📥 파라미터 예시:**
```javascript
{
  chartId: "TA11150002",
  missions: [
    { missionId: "TA11150002_mission_0", content: "허브티 한 잔 마시기", missionType: "DAILY", orderIndex: 0 },
    { missionId: "TA11150002_mission_1", content: "10분 명상", missionType: "DAILY", orderIndex: 1 },
    { missionId: "TA11150002_mission_2", content: "햇빛 보며 산책하기", missionType: "DAILY", orderIndex: 2 }
  ]
}
```

---

## 6.4 🎮 BalanceGame 저장 (DELETE → CREATE)

### Step 1: 기존 BalanceGame 전체 삭제

```cypher
MATCH (u:User {chart_id: $chartId})-[:PLAYED_GAME]->(bg:BalanceGame)
DETACH DELETE bg
```

### Step 2: 새 BalanceGame 생성 (배치)

```cypher
MATCH (u:User {chart_id: $chartId})

UNWIND $games AS game
CREATE (u)-[:PLAYED_GAME]->(bg:BalanceGame {
  game_id: game.gameId,
  chart_id: $chartId,
  title: game.title,
  description: game.description,
  selected_option: game.selectedOption,
  keyword: game.keyword,
  linked_product: game.linkedProduct,
  played_at: datetime(game.playedAt),
  created_at: datetime()
})

RETURN count(bg) AS gameCount
```

**📥 파라미터 예시:**
```javascript
{
  chartId: "TA11150002",
  games: [
    {
      gameId: "TA11150002_game_0",
      title: "외모 버프",
      description: "둘 중 하나만 가질 수 있다면 어떤걸 선택할래?",
      selectedOption: "장원영 얼굴",
      keyword: "활성산소",
      linkedProduct: "영데이즈",
      playedAt: "2025-09-26T02:43:52.678Z"
    }
  ]
}
```

---

## 6.5 💄 Beauty 저장 (확장)

```cypher
MATCH (u:User {chart_id: $chartId})
MERGE (u)-[:HAS_DATE]->(d:Date {date_id: $dateId})
ON CREATE SET
  d.date = date($date),
  d.created_at = datetime()

MERGE (d)-[:HAS_BEAUTY]->(b:Beauty {date_id: $dateId})
ON CREATE SET
  b.created_at = datetime()
SET
  b.total_score = $totalScore,
  b.inner_beauty_score = $innerBeautyScore,
  b.outer_beauty_score = $outerBeautyScore,
  b.inner_beauty_details = $innerBeautyDetails,
  b.outer_beauty_details = $outerBeautyDetails,
  b.score = $totalScore,  // 하위 호환
  b.updated_at = datetime()

RETURN b
```

**📥 파라미터 예시:**
```javascript
{
  chartId: "TA11150002",
  dateId: "TA11150002_2025-10-27",
  date: "2025-10-27",
  totalScore: 150,
  innerBeautyScore: 80,
  outerBeautyScore: 70,
  innerBeautyDetails: JSON.stringify([{no: 1, score: 25}, {no: 2, score: 15}, ...]),
  outerBeautyDetails: JSON.stringify([{no: 1, score: 15}, {no: 2, score: 20}, ...])
}
```

---

## 6.6 🍽️ Food 저장 (날짜별 DELETE → CREATE)

### Step 1: 해당 날짜의 기존 Food 전체 삭제

```cypher
MATCH (u:User {chart_id: $chartId})-[:HAS_DATE]->(d:Date {date_id: $dateId})-[:ATE_FOOD]->(f:Food)
DETACH DELETE f
```

### Step 2: Date 노드 보장 + 새 Food 생성 (배치)

```cypher
MATCH (u:User {chart_id: $chartId})
MERGE (u)-[:HAS_DATE]->(d:Date {date_id: $dateId})
ON CREATE SET
  d.date = date($date),
  d.created_at = datetime()

WITH d
UNWIND $foods AS food
CREATE (d)-[:ATE_FOOD]->(f:Food {
  food_id: food.foodId,
  food_name: food.foodName,
  diet_type: food.dietType,
  is_fasting: food.isFasting,
  image_url: food.imageUrl,
  allergy_foods: food.allergyFoods,
  allergy_score: food.allergyScore,
  processed_count: food.processedCount,
  processed_foods: food.processedFoods,
  high_fodmap_count: food.highFodmapCount,
  high_fodmap_foods: food.highFodmapFoods,
  created_at: datetime()
})

RETURN count(f) AS foodCount
```

**📥 파라미터 예시:**
```javascript
{
  chartId: "TA11150002",
  dateId: "TA11150002_2025-10-27",
  date: "2025-10-27",
  foods: [
    {
      foodId: "TA11150002_2025-10-27_BREAKFAST_0",
      foodName: "무화과 샐러드",
      dietType: "BREAKFAST",
      isFasting: false,
      imageUrl: null,
      allergyFoods: JSON.stringify([{name: "오징어", level: 4}]),
      allergyScore: 1,
      processedCount: 0,
      processedFoods: JSON.stringify([]),
      highFodmapCount: 1,
      highFodmapFoods: JSON.stringify(["사과"])
    },
    {
      foodId: "TA11150002_2025-10-27_LUNCH_0",
      foodName: "닭가슴살 샐러드",
      dietType: "LUNCH",
      isFasting: false,
      imageUrl: null,
      allergyFoods: JSON.stringify([]),
      allergyScore: 0,
      processedCount: 0,
      processedFoods: JSON.stringify([]),
      highFodmapCount: 0,
      highFodmapFoods: JSON.stringify([])
    }
  ]
}
```

> **💡 Note**: `food_id`는 `{chartId}_{date}_{dietType}_{index}` 형식으로 변경.
> timestamp 대신 index 사용하여 동일 데이터 재저장 시 일관성 유지.

---

## 6.7 ⏰ Fasting 저장

```cypher
MATCH (u:User {chart_id: $chartId})
MERGE (u)-[:HAS_DATE]->(d:Date {date_id: $dateId})
ON CREATE SET
  d.date = date($date),
  d.created_at = datetime()

MERGE (d)-[:HAS_FASTING]->(f:Fasting {date_id: $dateId})
ON CREATE SET
  f.created_at = datetime()
SET
  f.start_datetime = datetime($startDateTime),
  f.end_datetime = datetime($endDateTime),
  f.fasting_hours = $fastingHours,
  f.updated_at = datetime()

RETURN f
```

---

## 6.8 😴 Sleep 저장

```cypher
MATCH (u:User {chart_id: $chartId})
MERGE (u)-[:HAS_DATE]->(d:Date {date_id: $dateId})
ON CREATE SET
  d.date = date($date),
  d.created_at = datetime()

MERGE (d)-[:HAS_SLEEP]->(s:Sleep {date_id: $dateId})
ON CREATE SET
  s.created_at = datetime()
SET
  s.bed_datetime = datetime($bedDateTime),
  s.wake_datetime = datetime($wakeDateTime),
  s.sleep_hours = $sleepHours,
  s.updated_at = datetime()

RETURN s
```

---

## 6.9 🏃 Activity 저장 (날짜별 DELETE → CREATE)

### Step 1: 해당 날짜의 기존 Activity 전체 삭제

```cypher
MATCH (u:User {chart_id: $chartId})-[:HAS_DATE]->(d:Date {date_id: $dateId})
      -[:HAS_ACTIVITY]->(da:DailyActivity)-[:INCLUDES]->(a:Activity)
DETACH DELETE a
```

### Step 2: DailyActivity 업데이트 (MERGE)

```cypher
MATCH (u:User {chart_id: $chartId})
MERGE (u)-[:HAS_DATE]->(d:Date {date_id: $dateId})
ON CREATE SET
  d.date = date($date),
  d.created_at = datetime()

MERGE (d)-[:HAS_ACTIVITY]->(da:DailyActivity {date_id: $dateId})
ON CREATE SET
  da.created_at = datetime()
SET
  da.total_calories = $totalCalories,
  da.activity_count = $activityCount,
  da.total_duration_minutes = $totalDurationMinutes,
  da.updated_at = datetime()

RETURN da
```

### Step 3: 새 Activity 생성 (배치) + ActivityType 연결

```cypher
MATCH (da:DailyActivity {date_id: $dateId})

UNWIND $activities AS activity
MATCH (at:ActivityType {code: activity.activityTypeCode})

CREATE (da)-[:INCLUDES]->(a:Activity {
  activity_id: activity.activityId,
  name: activity.name,
  activity_time: activity.activityTime,
  duration_minutes: activity.durationMinutes,
  calories_burned: activity.estimatedCalories,
  activity_type_code: activity.activityTypeCode,
  image_url: activity.imageUrl,
  created_at: datetime()
})

CREATE (a)-[:IS_TYPE]->(at)

RETURN count(a) AS activityCount
```

**📥 파라미터 예시:**
```javascript
{
  chartId: "TA11150002",
  dateId: "TA11150002_2025-10-27",
  date: "2025-10-27",
  totalCalories: 500,
  activityCount: 3,
  totalDurationMinutes: 130,
  activities: [
    {
      activityId: "TA11150002_2025-10-27_0",
      activityTypeCode: "YOGA",
      name: "요가",
      activityTime: "01:00:00",
      durationMinutes: 60,
      estimatedCalories: 210,
      imageUrl: null
    },
    {
      activityId: "TA11150002_2025-10-27_1",
      activityTypeCode: "WALKING",
      name: "걷기",
      activityTime: "00:40:00",
      durationMinutes: 40,
      estimatedCalories: 140,
      imageUrl: null
    },
    {
      activityId: "TA11150002_2025-10-27_2",
      activityTypeCode: "PILATES",
      name: "필라테스",
      activityTime: "00:30:00",
      durationMinutes: 30,
      estimatedCalories: 150,
      imageUrl: null
    }
  ]
}
```

> **💡 Note**: `activity_id`는 `{chartId}_{date}_{index}` 형식.
> 같은 날짜에 같은 운동을 여러 번 해도 index로 구분됨.

---

## 6.10 💊 Supplement 저장 (날짜별 DELETE → CREATE)

### Step 1: 해당 날짜의 기존 Supplement 전체 삭제

```cypher
MATCH (u:User {chart_id: $chartId})-[:HAS_DATE]->(d:Date {date_id: $dateId})-[:TOOK_SUPPLEMENT]->(s:Supplement)
DETACH DELETE s
```

### Step 2: Date 노드 보장 + 새 Supplement 생성 (배치) + Master Data 연결

```cypher
MATCH (u:User {chart_id: $chartId})
MERGE (u)-[:HAS_DATE]->(d:Date {date_id: $dateId})
ON CREATE SET
  d.date = date($date),
  d.created_at = datetime()

WITH d
UNWIND $supplements AS supplement

// SupplementType Master Data
MERGE (st:SupplementType {supplement_name: supplement.supplementName})
ON CREATE SET
  st.supplement_type_id = 'supplement_type_' + toLower(replace(supplement.supplementName, ' ', '_')),
  st.created_at = datetime()

// Supplement intake record
CREATE (d)-[:TOOK_SUPPLEMENT]->(s:Supplement {
  supplement_id: supplement.supplementId,
  intake_count: supplement.intakeCount,
  recommended_count: supplement.recommendedCount,
  created_at: datetime()
})
CREATE (s)-[:IS_TYPE]->(st)

// Nutrient Master Data relationships
WITH st, supplement
UNWIND supplement.nutrients AS nutrientName
MERGE (n:Nutrient {nutrient_name: nutrientName})
ON CREATE SET
  n.nutrient_id = 'nutrient_' + toLower(replace(nutrientName, ' ', '_')),
  n.created_at = datetime()
MERGE (st)-[:CONTAINS]->(n)

RETURN count(DISTINCT s) AS supplementCount
```

**📥 파라미터 예시:**
```javascript
{
  chartId: "TA11150002",
  dateId: "TA11150002_2025-11-26",
  date: "2025-11-26",
  supplements: [
    {
      supplementId: "TA11150002_2025-11-26_0",
      supplementName: "클린 밸런스",
      intakeCount: 2,
      recommendedCount: 2,
      nutrients: ["클로렐라", "비타민A", "비타민B3(나이아신)", "비타민C", "비타민D", "비타민E", "아연"]
    },
    {
      supplementId: "TA11150002_2025-11-26_1",
      supplementName: "오메가3",
      intakeCount: 1,
      recommendedCount: 1,
      nutrients: ["EPA", "DHA", "비타민E"]
    }
  ]
}
```

> **💡 Note**:
> - SupplementType과 Nutrient는 Master Data로 자동 생성됨
> - 같은 영양제명이 여러 날짜에 나오면 SupplementType은 재사용됨
> - Nutrient도 마찬가지로 재사용되며, SupplementType과 N:N 관계

---

# 7️⃣ Nest.js TypeScript 타입 정의

## 📦 API 응답 타입

```typescript
// types/biocom-api.types.ts

export interface BiocomAIAgentResponse {
  success: boolean;
  data: AIAgentData;
  message: string;
}

export interface AIAgentData {
  음식물과민증검사결과: AllergyTestResult[];
  이름: string;
  이너뷰티유형: string;
  AI코치유형: string;
  MBTI: string;
  자기선언문: string;
  칭찬하기: string;
  '1일1미션': string[];
  밸런스게임: BalanceGameItem[];
  뷰티: BeautyItem[];
  식단: DietItem[];
  영양제: string;
  간헐적단식: FastingItem[];
  수면: SleepItem[];
  활동: ActivityItem[];
}

export interface AllergyTestResult {
  chartId: string;
  userName: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
  level5: string;
}

export interface BalanceGameItem {
  title: string;
  description: string;
  option: string;
  keyword: string;
  linkedProduct: string;
  createdAt: string;
}

export interface BeautyItem {
  date: string;
  totalScore: number;
  innerBeautyScore: number;
  outerBeautyScore: number;
  innerBeauty: { no: number; score: number }[];
  outerBeauty: { no: number; score: number }[];
}

export interface DietItem {
  date: string;
  diet: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'LATENIGHT';
  foodName: string | null;
  imageUrl: string | null;
  isFasting: boolean;
  allergyFoods: { name: string; level: number }[];
  allergyScore: number;
  processedCount: number;
  processedFoods: string[];
  highFodmapCount: number;
  highFodmapFoods: string[];
}

export interface FastingItem {
  date: string;
  startDateTime: string;
  endDateTime: string;
  fastingHours: number;
}

export interface SleepItem {
  date: string;
  bedDateTime: string;
  wakeDateTime: string;
  sleepHours: number;
}

export interface ActivityItem {
  date: string;
  imageUrl: string | null;
  activityTime: string;
  activityType: {
    code: string;
    name: string;
    base_minutes: number;
    calorie_rate: number;
  };
  totalDuration: number;
  durationInMinutes: number;
  estimatedCalories: number;
}
```

---

## 🗃️ Neo4j 노드 타입

```typescript
// types/neo4j-nodes.types.ts

export interface Neo4jUserNode {
  chart_id: string;
  name?: string;
  inner_beauty_type?: string;
  ai_coach_type?: string;
  mbti?: string;
  self_declaration?: string;
  praise_message?: string;
  created_at: string;
  updated_at?: string;
}

export interface Neo4jAllergyReportNode {
  report_id: string;
  chart_id: string;
  level1_foods: string;
  level2_foods: string;
  level3_foods: string;
  level4_foods: string;
  level5_foods: string;
  tested_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface Neo4jMissionNode {
  mission_id: string;
  chart_id: string;
  content: string;
  mission_type: string;
  order_index: number;
  created_at: string;
}

export interface Neo4jBalanceGameNode {
  game_id: string;
  chart_id: string;
  title: string;
  description: string;
  selected_option: string;
  keyword: string;
  linked_product: string;
  played_at: string;
  created_at: string;
}

export interface Neo4jBeautyNode {
  date_id: string;
  total_score: number;
  inner_beauty_score: number;
  outer_beauty_score: number;
  inner_beauty_details: string;  // JSON
  outer_beauty_details: string;  // JSON
  score?: number;  // 하위 호환
  created_at: string;
  updated_at?: string;
}

export interface Neo4jFoodNode {
  food_id: string;
  food_name: string;
  diet_type: string;
  is_fasting: boolean;
  image_url?: string;
  allergy_foods: string;      // JSON
  allergy_score: number;
  processed_count: number;
  processed_foods: string;    // JSON
  high_fodmap_count: number;
  high_fodmap_foods: string;  // JSON
  created_at: string;
}

export interface Neo4jFastingNode {
  date_id: string;
  start_datetime: string;
  end_datetime: string;
  fasting_hours: number;
  target_hours?: number;
  is_completed?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Neo4jSleepNode {
  date_id: string;
  bed_datetime: string;
  wake_datetime: string;
  sleep_hours: number;
  target_hours?: number;
  is_completed?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Neo4jDailyActivityNode {
  date_id: string;
  total_calories: number;
  activity_count: number;
  total_duration_minutes: number;
  created_at: string;
  updated_at?: string;
}

export interface Neo4jActivityNode {
  activity_id: string;
  name: string;
  activity_time: string;
  duration_minutes: number;
  calories_burned: number;
  activity_type_code: string;
  image_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface Neo4jActivityTypeNode {
  code: string;
  name: string;
  base_minutes: number;
  calorie_rate: number;
  created_at: string;
}
```

---

# 📎 부록: 쿼리 최적화 가이드

## 🔍 인과관계 분석 쿼리 예시

> **질문**: "라면 먹은 날 수면이 어땠어?"

```cypher
// 특정 음식 섭취 후 수면 품질 분석
MATCH (u:User {chart_id: $chartId})-[:HAS_DATE]->(d:Date)-[:ATE_FOOD]->(f:Food)
WHERE f.food_name CONTAINS '라면'
  AND d.date >= date($startDate) AND d.date <= date($endDate)

OPTIONAL MATCH (u)-[:HAS_DATE]->(d2:Date)-[:HAS_SLEEP]->(s:Sleep)
WHERE d2.date >= d.date AND d2.date <= date(d.date) + duration('P1D')

RETURN
  d.date AS food_date,
  f.food_name AS food_name,
  f.processed_foods AS processed_foods,
  d2.date AS sleep_date,
  s.sleep_hours AS sleep_hours,
  s.bed_datetime AS bed_time,
  s.wake_datetime AS wake_time
ORDER BY d.date DESC
```

---

## 📊 상관관계 분석 쿼리 예시

> **질문**: "운동한 날 잠을 더 잘 자나요?"

```cypher
// 운동량과 수면의 상관관계
MATCH (u:User {chart_id: $chartId})-[:HAS_DATE]->(d:Date)
WHERE d.date >= date($startDate) AND d.date <= date($endDate)

OPTIONAL MATCH (d)-[:HAS_ACTIVITY]->(da:DailyActivity)
OPTIONAL MATCH (d)-[:HAS_SLEEP]->(s:Sleep)

WITH d,
     COALESCE(da.total_calories, 0) AS calories,
     COALESCE(s.sleep_hours, 0) AS sleep_hours,
     CASE
       WHEN da.total_calories >= 500 THEN 'HIGH'
       WHEN da.total_calories >= 200 THEN 'MEDIUM'
       WHEN da.total_calories > 0 THEN 'LOW'
       ELSE 'NONE'
     END AS activity_level

RETURN
  activity_level,
  avg(sleep_hours) AS avg_sleep,
  count(*) AS days
ORDER BY
  CASE activity_level
    WHEN 'HIGH' THEN 1
    WHEN 'MEDIUM' THEN 2
    WHEN 'LOW' THEN 3
    ELSE 4
  END
```

---

## 📌 문서 정보

| 항목 | 값 |
|:-----|:---|
| **버전** | 1.0.0 |
| **최종 업데이트** | 2025-11-28 |
| **작성자** | Claude Code |
