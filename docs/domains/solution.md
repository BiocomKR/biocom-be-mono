# 맞춤 솔루션 도메인 설계

## 개요

맞춤 솔루션은 사용자의 건강 유형(동물 캐릭터)에 따라 영양제와 식단을 추천하는 기능입니다.

### 핵심 기능
1. **동물유형별 영양제 추천** - 1,2,3순위 + 맞춤 포뮬러(세트)
2. **동물유형별 식단 추천** - 라인업별 (오리지널, 시그니처 등)
3. **과민증 필터링** - 검사결과 기반 edible 판단
4. **조건부 추천** - 수면점수, 글루텐 과민증 등 조건별 추가 추천

---

## 테이블 구조

### 기존 테이블 (확장)

| 테이블 | 상태 | 변경 내용 |
|--------|------|----------|
| `HealthTypeAnimal` | 확장 | `metadata` JSON 필드 추가 |
| `HealthTypeAnimalProduct` | 확장 | `type`, `keyword`, `recommendReason`, `dosage`, `mechanisms` 필드 추가 |
| `Product` | 확장 | `lineupId`, 영양성분 필드 추가 |
| `SupplementNutrient` | 유지 | 영양제 성분 (문자열 기반, 변경 없음) |

### 신규 테이블

| 테이블 | 용도 |
|--------|------|
| `ProductLineup` | 식단 라인업 (오리지널, 시그니처, 저속노화, 저포드맵) |
| `Ingredient` | 알레르겐 마스터 (검사결과 매칭용) |
| `ProductIngredient` | 식단-알레르겐 연결 |
| `IngredientAlias` | 성분명 표기 변형 |
| `ConditionalRecommendation` | 조건부 추천 (메타드림, 리셋데이) |

---

## 설계 결정 히스토리

### 1. 영양제 성분 vs 알레르겐 분리 결정

**배경**
- 기존 `SupplementNutrient` 테이블: 영양제 성분을 문자열로 저장
- 신규 요구사항: 식단 알레르겐을 검사결과와 매칭해야 함

**검토한 방안**

| 방안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. 통합 | `Ingredient` 마스터로 영양제 성분 + 알레르겐 통합 | 일관된 구조 | 마이그레이션 복잡, 불필요한 복잡도 |
| B. 분리 | 영양제는 기존 유지, 알레르겐만 신규 | 변경 최소화 | 테이블 분산 |

**결정: B안 (분리)**

**이유**
1. **영양제 성분 (NUTRIENT)**
   - 용도: 화면에 보여주기만 함 (성분별 메커니즘 표시)
   - 매칭 필요 없음
   - 기존 `SupplementNutrient` 문자열 방식으로 충분

2. **식단 알레르겐 (ALLERGEN)**
   - 용도: 검사결과와 매칭 → edible 판단
   - 정확한 매칭 필요 ("대두" = "대두콩" = "대두(간장,두부)")
   - FK 기반 + Alias 테이블 필요

```
# 영양제 성분 - 기존 유지 (문자열)
SupplementNutrient
├── productId: 101, nutrientName: "아연"
├── productId: 101, nutrientName: "마그네슘"

# 식단 알레르겐 - 신규 (FK 기반)
Ingredient (마스터)
├── id: 1, key: "soybean", name: "대두", type: ALLERGEN
├── id: 2, key: "milk", name: "우유", type: ALLERGEN

IngredientAlias (표기 변형)
├── ingredientId: 1, alias: "대두콩"
├── ingredientId: 1, alias: "대두(간장,두부)"

ProductIngredient (연결)
├── productId: 201, ingredientId: 1 (대두)
├── productId: 201, ingredientId: 2 (우유)
```

---

### 2. HealthTypeAnimalProduct 확장 vs AnimalTypeProduct 신규

**배경**
- 기존 `HealthTypeAnimalProduct`: 동물유형별 영양제 연결 (displayOrder만 있음)
- 신규 요구사항: 식단 연결, 추천이유, 복용법, 메커니즘 등 추가 필요

**검토한 방안**

| 방안 | 설명 |
|------|------|
| A. 기존 확장 | `HealthTypeAnimalProduct`에 필드 추가 |
| B. 신규 생성 | `AnimalTypeProduct` 새로 만들기 |

**결정: A안 (기존 확장)**

**이유**
1. 기존 테이블이 이미 동일한 역할 수행 중
2. `survey.service.ts`에서 사용 중 - 호환성 유지
3. 필드 추가만으로 요구사항 충족 가능

**추가 필드**
```prisma
model HealthTypeAnimalProduct {
  // 기존 필드
  id                 Int
  healthTypeAnimalId Int
  productId          Int
  displayOrder       Int      // → priority로 rename 권장
  isActive           Boolean

  // 추가 필드
  type               String   // "SUPPLEMENT" | "DIET" | "FORMULA"
  keyword            String?  // "장벽 복구", "독소 배출"
  recommendReason    String?  // 추천 이유
  dosage             String?  // "1일 1회, 1회 3정"
  mechanisms         Json?    // 성분별 메커니즘 (영양제용)
}
```

---

### 3. 메타데이터 JSON vs 정규화 테이블

**배경**
- 시너지 효과, 섭취 가이드 등 동물유형별 텍스트 데이터
- 변경 빈도 낮음 (신제품 출시 주기: 연 수회)

**검토한 방안**

| 방안 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. 정규화 | `AnimalSynergyEffect`, `AnimalDietCategory` 등 테이블 분리 | 구조 명확 | 테이블 과다, 조인 복잡 |
| B. JSON | `HealthTypeAnimal.metadata`에 JSON 저장 | 단순, 유연 | 쿼리 제한 |

**결정: B안 (JSON)**

**이유**
1. 변경 빈도 낮음 - 정규화 이점 적음
2. 동물유형 4개 고정 - 데이터 규모 작음
3. 읽기 전용 데이터 - 복잡한 쿼리 불필요
4. Admin에서 JSON 에디터로 관리 가능

**metadata 구조**
```json
{
  "synergyEffects": [...],      // 시너지 효과 4개
  "intakeGuide": {              // 섭취 가이드
    "diet": { "routine": "...", "synergy": "..." },
    "supplement": { "formula": "..." }
  },
  "dietRecommendation": {       // 식단 추천 (점심/저녁)
    "lunch": { "lineupKey": "LOW_FODMAP", "priority": 1 },
    "dinner": { "lineupKey": "ORIGINAL", "priority": 2 }
  }
}
```

---

## ERD

```
┌─────────────────────┐
│  HealthTypeAnimal   │
├─────────────────────┤
│  id                 │
│  healthType         │──────────────────────────────┐
│  animalName         │                              │
│  metadata (JSON)    │                              │
└─────────────────────┘                              │
         │                                           │
         │ 1:N                                       │
         ▼                                           │
┌─────────────────────────┐                          │
│ HealthTypeAnimalProduct │                          │
├─────────────────────────┤                          │
│  healthTypeAnimalId     │◄─────────────────────────┘
│  productId              │───────┐
│  type                   │       │
│  priority               │       │
│  keyword                │       │
│  recommendReason        │       │
│  mechanisms (JSON)      │       │
└─────────────────────────┘       │
                                  │
         ┌────────────────────────┘
         │
         ▼
┌─────────────────────┐       ┌─────────────────────┐
│      Product        │       │   ProductLineup     │
├─────────────────────┤       ├─────────────────────┤
│  id                 │       │  id                 │
│  name               │       │  key                │
│  lineupId           │──────►│  name               │
│  calories           │       │  description        │
│  netCarbs           │       └─────────────────────┘
│  protein            │
│  fat                │
│  fiber              │
└─────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────┐       ┌─────────────────────┐
│  ProductIngredient  │       │    Ingredient       │
├─────────────────────┤       ├─────────────────────┤
│  productId          │       │  id                 │
│  ingredientId       │──────►│  key                │
│  type (ALLERGEN)    │       │  name               │
└─────────────────────┘       │  type (ALLERGEN)    │
                              └─────────────────────┘
                                       │
                                       │ 1:N
                                       ▼
                              ┌─────────────────────┐
                              │  IngredientAlias    │
                              ├─────────────────────┤
                              │  ingredientId       │
                              │  alias              │
                              └─────────────────────┘
```

---

## 과민증 필터링 로직

```typescript
// 1. 유저의 4,5단계 과민증 조회
const sensitivities = await prisma.userFoodSensitivity.findMany({
  where: { userId, level: { in: [4, 5] } }
});

// 2. 식단의 알레르겐과 비교
const diets = await prisma.product.findMany({
  where: { lineupId },
  include: {
    productIngredients: {
      include: { ingredient: true }
    }
  }
});

// 3. edible 판단
diets.map(diet => ({
  ...diet,
  edible: !diet.productIngredients.some(pi =>
    sensitivities.some(s => s.ingredientId === pi.ingredientId)
  )
}));
```

---

## 마이그레이션 계획

### Phase 1: 신규 테이블 생성
1. `ProductLineup` 생성
2. `Ingredient` 생성 (type: ALLERGEN만)
3. `IngredientAlias` 생성
4. `ProductIngredient` 생성
5. `ConditionalRecommendation` 생성

### Phase 2: 기존 테이블 확장
6. `HealthTypeAnimal`에 `metadata` 필드 추가
7. `HealthTypeAnimalProduct`에 `type`, `keyword`, `recommendReason`, `dosage`, `mechanisms` 추가
8. `Product`에 `lineupId`, 영양성분 필드 추가

### Phase 3: 데이터 입력
9. Seed 데이터 입력

---

## 관련 파일

- 설계 문서: `/repo/맞춤솔루션설계.md`
- Seed 데이터: `/repo/biocom-api/prisma/seed/solution/`
- 원본 데이터: `/repo/이너뷰티 맞춤 영양제 *.md`, `/repo/이너뷰티 맞춤 식단 *.md`

---

* 작성자: 엄신우
* 작성일: 25/12/19
