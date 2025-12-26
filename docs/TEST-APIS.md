# 테스트용 API 목록

> **주의**: 이 API들은 Swagger에 노출되지 않으며, 운영 데이터 셋업/테스트 목적으로만 사용합니다.
>
> 생성일: 2025-12-26

---

## 1. 사용자 배치 등록

**Endpoint**: `POST /api/auth/phone-register-test`

**인증**: 불필요 (`@Public`)

**설명**: 여러 사용자를 한 번에 등록합니다.

**Request Body**:
```json
[
  {
    "name": "홍길동",
    "mobile": "01012345678",
    "birthDate": "19900101",
    "sex": "01",
    "telecom": "SKT"
  },
  {
    "name": "김철수",
    "mobile": "01087654321",
    "birthDate": "19850515",
    "sex": "01",
    "telecom": "KTF"
  }
]
```

**필드 설명**:
- `name`: 이름
- `mobile`: 휴대폰 번호 (하이픈 없이)
- `birthDate`: 생년월일 (YYYYMMDD)
- `sex`: 성별 (01=남자, 02=여자)
- `telecom`: 통신사 (SKT, KTF, LGT, SKM, KTM, LGM)

**Response**:
```json
{
  "success": true,
  "message": "2명 회원가입이 완료되었습니다.",
  "data": [
    { "id": 1, "name": "홍길동", "mobile": "01012345678" },
    { "id": 2, "name": "김철수", "mobile": "01087654321" }
  ]
}
```

---

## 2. 챌린지 배치 생성 (PENDING)

**Endpoint**: `POST /api/challenges/quick-start-test`

**인증**: 불필요 (`@Public`)

**설명**: 여러 사용자의 챌린지를 한 번에 생성합니다. (PENDING 상태)

**Request Body**:
```json
[1, 2, 3, 4, 5]
```
- userId 배열
- `startDate`는 `2025-12-29` 고정

**Response**:
```json
{
  "success": true,
  "message": "5명 챌린지 시작 완료",
  "data": [
    { "success": true, "userId": 1, "data": {...} },
    { "success": true, "userId": 2, "data": {...} }
  ]
}
```

---

## 3. 사전설문 배치 등록

**Endpoint**: `POST /api/surveys/complete-test`

**인증**: 불필요 (`@Public`)

**설명**: 여러 사용자의 사전설문 답변을 한 번에 등록합니다.

**Request Body**:
```json
[
  [1, 3, 3, 3, 4, 5, 4, 4, 4, 3, 4, 4, 2, 4, 5, 3, 4, 3, 3, 4, 3, 2, 2, 5, 5, 5],
  [2, 3, 3, 3, 4, 5, 4, 4, 4, 3, 4, 4, 2, 4, 5, 3, 4, 3, 3, 4, 3, 2, 2, 5, 5, 5]
]
```
- 2D 배열 형식
- 각 배열의 **0번째**: userId
- 그 뒤 **25개**: optionId (questionId 1~20, 41~45에 매핑)
- `type`: BEFORE 고정
- `surveyId`: 1 고정

**questionId 매핑**:
```
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 41, 42, 43, 44, 45]
```

**Response**:
```json
{
  "success": true,
  "message": "2명 사전설문 등록 완료",
  "data": [
    { "success": true, "userId": 1, "count": 25 },
    { "success": true, "userId": 2, "count": 25 }
  ]
}
```

---

## 4. PENDING 챌린지 즉시 활성화

**Endpoint**: `POST /api/challenges/scheduler/activate-all-pending`

**인증**: 불필요 (`@Public`)

**설명**: 날짜 조건 무시하고 모든 PENDING 챌린지를 ACTIVE로 즉시 전환합니다.

**Request Body**: 없음

**Response**:
```json
{
  "success": true,
  "message": "PENDING 챌린지 활성화 완료: 성공 39건, 실패 0건",
  "data": {
    "success": 39,
    "fail": 0,
    "total": 39
  }
}
```

**처리 내용**:
1. `user_challenges.status`: PENDING → ACTIVE
2. `users.status`: NEWCOMER → CHALLENGER
3. `daily_progress` Day 1 생성
4. 영양제 기록 7일치 생성

---

## 사용 순서 (일괄 사용자 셋업)

```bash
# 1. 사용자 등록
POST /api/auth/phone-register-test

# 2. 챌린지 생성 (PENDING)
POST /api/challenges/quick-start-test

# 3. 사전설문 등록
POST /api/surveys/complete-test

# 4. 챌린지 활성화 (PENDING → ACTIVE)
POST /api/challenges/scheduler/activate-all-pending
```
