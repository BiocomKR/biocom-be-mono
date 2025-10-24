# 컨텐츠 도메인 API 감사

> 작성일: 2025-10-24
> 분석자: Claude
> 상태: ✅ 완료

---

## 📍 컨텐츠 도메인 구조

**컨트롤러**: Content (7개 엔드포인트)

**주요 기능**:
- 강의 목록 조회 (주차별, 챌린지별)
- 칼럼 조회 (검색, 정렬, 페이징)
- 컨텐츠 시청 완료 (포인트 지급)
- 인기 컨텐츠 조회

---

## 🎯 비즈니스 플로우

```
사용자 로그인
  ↓
챌린지 시작 (또는 구독)
  ↓
강의 목록 조회 - GET /contents/lectures?week=1&productId=123
  ↓
강의 상세 조회 - GET /contents/:id
  ↓
강의 시청
  ↓
시청 완료 - POST /contents/:id/complete
  ↓
포인트 지급 (최초 1회만)
  ↓
DailyProgress 업데이트 (contentsViewed++)
```

---

## 1️⃣ Content 컨트롤러

**Base Path**: `/api/contents`

### 엔드포인트 목록

#### A. 강의 관리
- GET `/lectures` - 강의 목록 조회 (주차별, 챌린지별)
- GET `/:id` - 컨텐츠 상세 조회
- POST `/:id/complete` - 컨텐츠 시청 완료 ✅

#### B. 칼럼 관리
- GET `/columns` - 칼럼 목록 조회 (검색, 정렬, 페이징)
- GET `/columns/today` - 오늘의 칼럼 (최신 5개)

#### C. 인기 컨텐츠
- GET `/popular/list` - 인기 컨텐츠 조회

---

### 주요 엔드포인트 상세

#### GET `/contents/lectures`
**목적**: 사용자 상태에 따른 강의 목록 조회

**Query Parameters**:
- `week`: 주차 (1, 2, 3)
- `productId`: 챌린지 상품 ID

**인증**: ✅ 필요 (JWT)

**응답**:
```json
{
  "success": true,
  "message": "강의 목록이 성공적으로 조회되었습니다.",
  "data": {
    "lectures": [
      {
        "id": 1,
        "title": "1주차 강의 - 건강의 기초",
        "weekNumber": 1,
        "dayNumber": 1,
        "type": "LECTURE",
        "accessLevel": "CHALLENGE_ONLY",
        "viewCount": 1234,
        "points": 50
      }
    ],
    "userStatus": {
      "hasActiveChallenge": true,
      "hasSubscription": false
    }
  }
}
```

**특징**:
- 사용자 상태(챌린지/구독)에 따라 접근 가능한 강의만 반환
- 주차별 필터링 가능
- 챌린지별 맞춤 강의 제공

**상태**: ✅ 정상

---

#### GET `/contents/columns`
**목적**: 칼럼 목록 조회 (검색, 정렬, 페이징)

**Query Parameters**:
- `page`: 페이지 번호 (default: 1)
- `limit`: 페이지당 항목 수 (default: 10)
- `search`: 검색어 (제목, 내용)
- `sort`: 정렬 (`popular` | `latest`)

**인증**: ❌ 불필요 (공개)

**응답**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 10,
        "title": "비타민D 섭취 가이드",
        "type": "COLUMN",
        "viewCount": 523,
        "createdAt": "2025-10-20T10:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 50,
      "itemsPerPage": 10
    }
  }
}
```

**정렬 옵션**:
- `popular`: 조회수 높은 순
- `latest`: 최신순 (기본값)

**상태**: ✅ 정상

---

#### GET `/contents/columns/today`
**목적**: 오늘의 칼럼 조회 (롤링 배너용)

**인증**: ❌ 불필요

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "id": 15,
      "title": "면역력 강화 5가지 방법",
      "viewCount": 892,
      "createdAt": "2025-10-24T09:00:00Z"
    }
  ]
}
```

**특징**:
- 최신 칼럼 5개만 반환
- 메인 화면 롤링 배너용
- 캐싱 적용 권장

**상태**: ✅ 정상

---

#### GET `/contents/:id`
**목적**: 컨텐츠 상세 조회

**인증**: ❌ 불필요 (선택적)

**응답**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "1주차 강의 - 건강의 기초",
    "content": "<p>HTML 컨텐츠</p>",
    "type": "LECTURE",
    "weekNumber": 1,
    "dayNumber": 1,
    "viewCount": 1235,
    "points": 50,
    "accessLevel": "CHALLENGE_ONLY",
    "contentFiles": [
      {
        "fileUrl": "https://...",
        "fileName": "lecture1.pdf",
        "fileSize": 1024000
      }
    ]
  }
}
```

**주요 로직**:
1. 비활성화된 컨텐츠는 404 반환
2. 로그인된 사용자: 조회수 증가 (중복 방지)
3. 비로그인 사용자: 조회수 증가 (매번)

**특징**:
- HTML 컨텐츠는 XSS 방지 처리됨 (DOMPurify)
- 첨부파일 목록 포함
- 접근 권한 레벨 표시

**상태**: ✅ 정상

---

#### POST `/contents/:id/complete`
**목적**: 컨텐츠 시청 완료 및 포인트 지급

**인증**: ✅ 필수 (JWT)

**Request**: Body 없음 (Path Parameter만)

**응답**:
```json
{
  "success": true,
  "data": {
    "contentId": 1,
    "userId": 123,
    "isFirstView": true,
    "pointsEarned": 50,
    "challengeInfo": {
      "productId": 5,
      "challengeName": "21일 건강 챌린지",
      "currentDay": 3
    },
    "viewedAt": "2025-10-24T15:30:00+09:00"
  }
}
```

**주요 로직**:
```typescript
1. 컨텐츠 존재 확인 (isActive: true)
2. 이미 시청했는지 확인 (content_views 테이블)
3. 활성 챌린지 조회
4. 최초 시청인 경우:
   - 포인트 지급 (기본 50점)
   - ContentView 레코드 생성
   - DailyProgress 업데이트 (contentsViewed++)
5. 재시청인 경우:
   - 포인트 미지급
   - pointsEarned: 0 반환
```

**포인트 지급 규칙**:
- ✅ 최초 시청: content.points (기본 50점)
- ❌ 재시청: 0점
- ✅ 챌린지 참여자만 DailyProgress 업데이트
- ❌ 비챌린지 사용자: 시청 기록만 저장

**상태**: ✅ 정상

**특징**:
- 중복 포인트 지급 방지 완벽
- 챌린지 진행도 자동 반영
- 트랜잭션 처리로 데이터 일관성 보장

---

#### GET `/contents/popular/list`
**목적**: 인기 컨텐츠 조회

**Query Parameters**:
- `limit`: 조회 개수 (default: 5)

**인증**: ❌ 불필요

**응답**:
```json
{
  "success": true,
  "data": [
    {
      "id": 8,
      "title": "장 건강의 모든 것",
      "type": "COLUMN",
      "viewCount": 2341
    }
  ]
}
```

**정렬**: 조회수 높은 순

**상태**: ✅ 정상

---

## 📊 컨텐츠 접근 권한 시스템

### ContentAccessLevel Enum
```typescript
enum ContentAccessLevel {
  ALL,                  // 모든 사용자
  CHALLENGE_ONLY,       // 챌린지 참여자만
  SUBSCRIPTION_ONLY,    // 구독자만
  CHALLENGE_OR_SUB      // 챌린지 또는 구독자
}
```

### 접근 제어 로직
- 컨텐츠 조회 시 사용자 상태 확인
- 권한 없으면 필터링 (403이 아닌 목록에서 제외)
- 상세 조회 시에는 권한 경고 표시

---

## 🔒 보안 기능

### 1. XSS 방지
- **DOMPurify** 라이브러리 사용
- HTML 컨텐츠 생성/수정 시 자동 sanitize
- 허용된 태그/속성만 통과

```typescript
ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1-h6',
               'blockquote', 'a', 'ul', 'ol', 'li',
               'img', 'div', 'span', 'table' 등]

ALLOWED_ATTR: ['href', 'src', 'alt', 'title',
               'width', 'height', 'style', 'class' 등]
```

### 2. 권한 검증
- JWT 인증 (시청 완료 API)
- 컨텐츠 접근 레벨 체크
- 비활성화 컨텐츠 차단

---

## 📋 컨텐츠 도메인 정리

### ✅ 잘된 점
1. **명확한 접근 권한 시스템**
   - 4단계 접근 레벨 (ALL, CHALLENGE_ONLY, SUBSCRIPTION_ONLY, CHALLENGE_OR_SUB)
   - 사용자 상태 기반 필터링

2. **중복 포인트 지급 방지**
   - ContentView 테이블로 시청 이력 관리
   - 최초 1회만 포인트 지급

3. **챌린지 연동**
   - 활성 챌린지 자동 인식
   - DailyProgress 자동 업데이트
   - 진행도 추적 완벽

4. **보안 처리**
   - XSS 방지 (DOMPurify)
   - HTML sanitization
   - 권한 검증

5. **다양한 조회 옵션**
   - 주차별, 챌린지별 필터링
   - 검색, 정렬, 페이징
   - 인기 컨텐츠 별도 조회

### 🤔 검토 필요사항

#### 1. userId 추출 로직 일관성
**현재**:
```typescript
// content.controller.ts
req.user.userId  // ✅ 일관성 있음
```

**다른 도메인**:
```typescript
// survey.controller.ts
req.user.sub  // ❌ 다름

// challenge.controller.ts
req.user.userId || req.user.sub  // ❌ 복잡함
```

**제안**: 전체 프로젝트에서 `req.user.userId`로 통일

#### 2. 조회수 증가 로직
**현재**:
- 로그인 사용자: 중복 방지 (OK)
- 비로그인 사용자: 매번 증가 (봇 공격 취약)

**제안**:
- IP 기반 중복 체크
- 또는 세션 기반 중복 체크
- 하루 1회로 제한

#### 3. 캐싱 부재
**현재**:
- 모든 요청이 DB 조회
- 인기 컨텐츠, 오늘의 칼럼 등은 자주 조회됨

**제안**:
- Redis 캐싱 추가
- TTL 5분~10분
- 특히 `/columns/today`, `/popular/list`

---

## 🎯 컨텐츠 도메인 결론

**전반적 평가**: ✅ **매우 우수**

**장점**:
- 접근 권한 시스템 체계적
- 포인트 지급 로직 완벽
- 보안 처리 철저 (XSS 방지)
- 챌린지 연동 자연스러움

**개선 제안**:
1. userId 추출 로직 통일
2. 조회수 증가 봇 방지
3. 인기 컨텐츠 캐싱 추가 (선택적)

---

**컨텐츠 도메인 감사 완료** ✅
