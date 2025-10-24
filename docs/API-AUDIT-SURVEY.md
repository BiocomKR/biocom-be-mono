# 서베이 도메인 API 감사

> 작성일: 2025-10-24
> 분석자: Claude
> 상태: ✅ 완료

---

## 📍 서베이 도메인 구조

**컨트롤러**: Survey (11개 엔드포인트)

**주요 기능**:
- 챌린지 사전/사후 설문
- 동물 캐릭터 배정 (설문 결과 기반)
- 설문 결과 비교

---

## 🎯 비즈니스 플로우

```
챌린지 구매
  ↓
챌린지 시작
  ↓
사전 설문 (Before) - GET /surveys/:surveyId/before
  ↓
설문 완료 - POST /surveys/:surveyId/complete
  ↓
동물 캐릭터 배정 🐰🐻🦊
  ↓
챌린지 진행 (21일)
  ↓
사후 설문 (After) - GET /surveys/:surveyId/after
  ↓
설문 완료 - POST /surveys/:surveyId/complete
  ↓
결과 비교 - GET /surveys/:surveyId/comparison
```

---

## 1️⃣ Survey 컨트롤러

**Base Path**: `/api/surveys`

### 엔드포인트 그룹

#### A. 상태 확인
- GET `/challenges/:productId/status` - 설문 상태 확인

#### B. 질문 관리
- GET `/questions` - 질문 목록 조회
- GET `/questions/:id` - 특정 질문 조회
- GET `/options` - 선택지 조회

#### C. 답변 관리
- GET `/answers/me` - 내 답변 조회
- GET `/answers/question/:questionId` - 질문별 답변 조회

#### D. 결과 관리
- GET `/results/me` - 내 결과 조회

#### E. 설문 실행 (surveyId 기반)
- GET `/:surveyId/:type` - 설문 질문 조회 (before/after)
- POST `/:surveyId/complete` - 설문 완료
- GET `/:surveyId/comparison` - 결과 비교

---

### 주요 엔드포인트 상세

#### GET `/surveys/challenges/:productId/status`
**목적**: 챌린지별 사용자 설문 상태 확인

**응답**:
```json
{
  "success": true,
  "data": {
    "hasActiveCh allenge": true,
    "hasBefore": true,
    "hasAfter": false,
    "nextAction": "WAIT_FOR_AFTER"
  }
}
```

**nextAction 값**:
- `NEED_BEFORE`: 사전 설문 필요
- `WAIT_FOR_AFTER`: 사후 설문 대기 (챌린지 진행 중)
- `NEED_AFTER`: 사후 설문 필요
- `COMPLETED`: 모든 설문 완료

**상태**: ✅ 정상

**특징**:
- 서비스 진입 시 이 API를 호출하여 화면 라우팅 결정
- Product 기반으로 챌린지 식별

---

#### GET `/surveys/options`
**목적**: 공통 선택지 조회

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "optionText": "그렇지 않다",
      "score": 0
    },
    {
      "id": 2,
      "optionText": "약간 그렇지 않다",
      "score": -3
    },
    {
      "id": 3,
      "optionText": "보통이다",
      "score": -7
    },
    {
      "id": 4,
      "optionText": "약간 그렇다",
      "score": -10
    },
    {
      "id": 5,
      "optionText": "그렇다",
      "score": -14
    }
  ]
}
```

**상태**: ✅ 정상

**특징**:
- 5개 공통 선택지 (모든 질문에 동일하게 사용)
- **점수가 낮을수록 증상이 심함** (음수 스케일)

---

#### GET `/surveys/:surveyId/:type`
**목적**: 설문 질문 조회

**파라미터**:
- `surveyId`: 설문 ID
- `type`: `before` | `after`

**응답**:
```json
{
  "success": true,
  "data": {
    "surveyId": 1,
    "type": "before",
    "questions": [
      {
        "id": 1,
        "categoryCode": "SKIN_HEALTH",
        "categoryName": "피부 건강",
        "questionText": "피부가 건조하거나 가려운 증상이 있나요?",
        "sortOrder": 1
      }
    ]
  }
}
```

**상태**: ✅ 정상

**카테고리**:
- `SKIN_HEALTH`: 피부 건강
- `METABOLISM`: 신진대사
- `IMMUNE_BALANCE`: 면역 밸런스
- `GUT_HEALTH`: 장 건강

---

#### POST `/surveys/:surveyId/complete`
**목적**: 설문 완료 및 동물 캐릭터 배정

**Request**:
```json
{
  "type": "before",
  "answers": [
    {
      "questionId": 1,
      "optionId": 3
    },
    {
      "questionId": 2,
      "optionId": 4
    }
  ]
}
```

**응답**:
```json
{
  "success": true,
  "data": {
    "surveyId": 1,
    "type": "before",
    "animalCharacter": "토끼",
    "categoryResults": [
      {
        "categoryCode": "SKIN_HEALTH",
        "categoryName": "피부 건강",
        "totalScore": -17,
        "animalCharacter": "토끼"
      }
    ]
  }
}
```

**주요 로직**:
1. 답변 저장
2. 카테고리별 점수 합산
3. **CategoryDetail 테이블 기반 동물 캐릭터 배정**
4. SurveyResult 저장

**상태**: ✅ 정상

**특징**:
- Before 설문 완료 시 동물 캐릭터 배정
- After 설문 완료 시 개선도 측정

---

#### GET `/surveys/:surveyId/comparison`
**목적**: 사전/사후 설문 결과 비교

**응답**:
```json
{
  "success": true,
  "data": {
    "surveyId": 1,
    "categories": [
      {
        "categoryCode": "SKIN_HEALTH",
        "categoryName": "피부 건강",
        "beforeScore": -17,
        "afterScore": -5,
        "improvement": 12,
        "improvementPercentage": 70.6
      }
    ],
    "overall": {
      "beforeTotal": -50,
      "afterTotal": -15,
      "totalImprovement": 35,
      "improvementPercentage": 70.0
    }
  }
}
```

**상태**: ✅ 정상

**특징**:
- 카테고리별 개선도 표시
- 전체 개선도 계산
- 퍼센티지로 시각화 가능

---

## 📊 서베이 도메인 정리

### ✅ 잘된 점
1. **체계적인 설문 구조**
   - 4가지 카테고리 (피부/신진대사/면역/장)
   - 사전/사후 설문 분리
   - 공통 선택지 사용

2. **동물 캐릭터 시스템**
   - 설문 결과 기반 자동 배정
   - CategoryDetail 테이블로 관리

3. **비교 분석 기능**
   - 사전/사후 점수 비교
   - 개선도 퍼센티지 계산
   - 카테고리별 상세 분석

4. **상태 관리**
   - nextAction으로 다음 단계 명확히 안내
   - 중복 설문 방지

### 🤔 검토 필요사항

#### 1. 개별 답변 저장 API 비활성화
**위치**: Line 277

```typescript
// 개별 답변 저장 API는 비활성화 (complete API로 통합)
// @Post('answers') - deprecated
```

**현재**:
- 개별 답변 저장 불가
- 반드시 전체 설문 완료(complete)로만 저장 가능

**질문**:
- 설문 중간 저장 기능이 필요하지 않나?
- 사용자가 일시 정지 후 이어서 할 수 없음

#### 2. userId 추출 로직
- 다른 도메인과 다르게 `req.user.sub` 사용
- Challenge, Mission은 `req.user.userId || req.user.sub`
- 표준화 필요

---

## 🎯 서베이 도메인 결론

**전반적 평가**: ✅ **매우 잘 구현됨**

- 설문 구조 체계적
- 동물 캐릭터 배정 로직 완벽
- 비교 분석 기능 훌륭
- 상태 관리 명확

**개선 제안**:
- 중간 저장 기능 고려 (optional)
- userId 추출 로직 표준화

---

**서베이 도메인 감사 완료** ✅
