# 휴대폰 인증 기반 로그인/회원가입 API 가이드

## 📋 목차
1. [휴대폰 간편 로그인 (신규)](#1-휴대폰-간편-로그인-신규)
2. [휴대폰 회원가입](#2-휴대폰-회원가입)
3. [약관 정보](#3-약관-정보)

---

## 1. 휴대폰 간편 로그인 (신규)

### ⭐ 간편 로그인 (권장)
**통신사 + 휴대폰번호만으로 로그인 시작**

### API 호출 순서
```
1. POST /api/auth/phone-request              → 간편 인증 요청 (자동으로 본인인증 시작)
2. POST /api/phone-verification/verify       → 본인인증 확인
3. POST /api/auth/phone-login                → 로그인
```

### 1단계: 간편 인증 요청
**기존 회원인지 자동으로 확인하고 본인인증을 시작합니다.**

```bash
POST /api/auth/phone-request
Content-Type: application/json

{
  "telecom": "SKT",           # SKT, KTF, LGT, SKM, KTM, LGM
  "mobile": "01012345678"     # 하이픈 없이
}
```

**성공 응답:**
```json
{
  "success": true,
  "message": "SMS가 발송되었습니다. 인증번호를 확인해주세요.",
  "data": {
    "certNumber": "2025111201234567"  # 본인인증 거래번호
  },
  "timestamp": "2025-11-12T10:00:00.000Z"
}
```

**실패 응답 (미가입 사용자):**
```json
{
  "success": false,
  "statusCode": 404,
  "message": "등록되지 않은 휴대폰 번호입니다. 회원가입을 먼저 진행해주세요."
}
```


### 2단계: 본인인증 확인
```bash
POST /api/phone-verification/verify
Content-Type: application/json

{
  "certNumber": "2025111201234567",     # 1단계에서 받은 certNumber
  "otpNumber": "123456"                 # SMS로 받은 6자리 인증번호
}
```

**응답:**
```json
{
  "success": true,
  "ci": "CI값 (암호화된 고유식별값)",
  "di": "DI값 (암호화된 중복가입확인값)",
  "message": "본인인증이 완료되었습니다."
}
```

### 3단계: 로그인
```bash
POST /api/auth/phone-login
Content-Type: application/json

{
  "certNumber": "2025111201234567",  # 2단계에서 받은 certNumber
  "mobile": "01012345678"
}
```

**성공 응답:**
```json
{
  "user": {
    "id": 1,
    "name": "홍길동",
    "mobile": "01012345678",
    "birthDate": "19900101",
    "telecom": "SKT",
    "createdAt": "2025-11-12T15:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a1b2c3d4e5f6..."
}
```

**실패 응답 (미가입 사용자):**
```json
{
  "success": false,
  "statusCode": 401,
  "message": "등록되지 않은 휴대폰 번호입니다. 회원가입을 먼저 진행해주세요."
}
```

---

## 2. 휴대폰 회원가입

### API 호출 순서
```
1. POST /api/phone-verification/request     → 본인인증 요청
2. POST /api/phone-verification/verify      → 본인인증 확인
3. POST /api/auth/phone-register            → 회원가입
```

### 1~2단계: 본인인증 (로그인과 동일)
위 로그인 1~2단계와 동일하게 진행

### 3단계: 회원가입
```bash
POST /api/auth/phone-register
Content-Type: application/json

{
  "certNumber": "2025111201234567",    # 본인인증에서 받은 certNumber
  "name": "홍길동",
  "mobile": "01012345678",
  "birthDate": "19900101",            # YYYYMMDD
  "telecom": "SKT",                   # SKT, KTF, LGT, SKM, KTM, LGM
  "sex": "01",                        # 01: 남자, 02: 여자
  "localCode": "01",                  # 01: 내국인, 02: 외국인

  // 필수 약관 (3개)
  "agreeToTerms": true,               # [필수] 서비스 이용약관 동의
  "agreeToAge14": true,               # [필수] 만 14세 이상 확인
  "agreeToPrivacy": true,             # [필수] 개인정보 수집 이용 동의

  // 선택 약관 (2개)
  "agreeToThirdParty": false,         # [선택] 제3자 정보 제공 동의
  "agreeToMarketing": false           # [선택] 마케팅 알림 수신 동의
}
```

**성공 응답:**
```json
{
  "user": {
    "id": 1,
    "name": "홍길동",
    "mobile": "01012345678",
    "birthDate": "19900101",
    "telecom": "SKT",
    "createdAt": "2025-11-12T15:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a1b2c3d4e5f6..."
}
```

**실패 응답 (이미 가입된 경우):**
```json
{
  "success": false,
  "statusCode": 409,
  "message": "이미 등록된 휴대폰 번호입니다."
}
```

**실패 응답 (필수 약관 미동의):**
```json
{
  "success": false,
  "statusCode": 409,
  "message": "필수 약관에 모두 동의해주세요."
}
```

---

## 3. 약관 정보

### 필수 약관 (3개)
반드시 `true`로 전송해야 회원가입 가능

| 필드명 | 설명 | 필수 여부 |
|--------|------|-----------|
| `agreeToTerms` | 서비스 이용약관 동의 | ✅ 필수 |
| `agreeToAge14` | 만 14세 이상 확인 | ✅ 필수 |
| `agreeToPrivacy` | 개인정보 수집 이용 동의 | ✅ 필수 |

### 선택 약관 (2개)
사용자 선택에 따라 `true` 또는 `false` (기본값: `false`)

| 필드명 | 설명 | 필수 여부 |
|--------|------|-----------|
| `agreeToThirdParty` | 제3자 정보 제공 동의 | ⭕ 선택 |
| `agreeToMarketing` | 마케팅 알림 수신 동의 | ⭕ 선택 |

---

## 4. 통신사 코드

| 코드 | 통신사명 |
|------|----------|
| `SKT` | SK텔레콤 |
| `KTF` | KT |
| `LGT` | LG U+ |
| `SKM` | SK텔레콤 (알뜰폰) |
| `KTM` | KT (알뜰폰) |
| `LGM` | LG U+ (알뜰폰) |

---

## 5. 주의사항

### 본인인증 유효시간
- 본인인증 완료 후 **10분 이내**에 로그인/회원가입을 완료해야 합니다.
- 10분 초과 시 본인인증을 처음부터 다시 진행해야 합니다.

### 휴대폰 번호 형식
- **하이픈 없이** 숫자만 입력: `01012345678`
- 정규식: `^01[0-9]{8,9}$`

### 생년월일 형식
- **8자리 숫자**: `YYYYMMDD`
- 예시: `19900101`

### 토큰 관리
- `accessToken`: API 요청 시 `Authorization: Bearer {accessToken}` 헤더에 포함
- `refreshToken`: accessToken 만료 시 갱신용 (별도 API 사용)

---

## 6. 에러 코드

| 상태 코드 | 메시지 | 의미 |
|-----------|--------|------|
| `400` | 입력값 검증 오류 | 필드 형식이 올바르지 않음 |
| `401` | 본인인증 정보를 찾을 수 없습니다 | certNumber가 잘못되었거나 만료됨 |
| `401` | 등록되지 않은 휴대폰 번호입니다 | 로그인 시 미가입 사용자 |
| `404` | 등록되지 않은 휴대폰 번호입니다 | 간편 로그인 시 미가입 사용자 |
| `409` | 이미 등록된 휴대폰 번호입니다 | 회원가입 시 이미 가입된 사용자 |
| `409` | 필수 약관에 모두 동의해주세요 | 필수 약관 미동의 |

---

## 7. 테스트 예시 (curl)

### 간편 로그인 전체 플로우 (권장)
```bash
# 1. 간편 인증 요청
curl -X POST http://localhost:10804/api/auth/phone-request \
  -H "Content-Type: application/json" \
  -d '{
    "telecom": "SKT",
    "mobile": "01012345678"
  }'

# 2. 본인인증 확인
curl -X POST http://localhost:10804/api/phone-verification/verify \
  -H "Content-Type: application/json" \
  -d '{
    "certNumber": "2025111201234567",
    "otpNumber": "123456"
  }'

# 3. 로그인
curl -X POST http://localhost:10804/api/auth/phone-login \
  -H "Content-Type: application/json" \
  -d '{
    "certNumber": "2025111201234567",
    "mobile": "01012345678"
  }'
```

### 회원가입 전체 플로우
```bash

# 2. 본인인증 확인
curl -X POST http://localhost:10804/api/phone-verification/request \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "01012345678",
    "birthDay": "19900101",
    "userName": "홍길동",
    "telecom": "KTF",
    "sex": "01",
    "localCode": "01"
  }'

# 2. 본인인증 확인
curl -X POST http://localhost:10804/api/phone-verification/verify \
  -H "Content-Type: application/json" \
  -d '{
    "certNumber": "2025111201234567",
    "otpNumber": "123456"
  }'

# 3. 회원가입
curl -X POST http://localhost:10804/api/auth/phone-register \
  -H "Content-Type: application/json" \
  -d '{
    "certNumber": "2025111201234567",
    "name": "홍길동",
    "mobile": "01012345678",
    "birthDate": "19900101",
    "telecom": "SKT",
    "sex": "01",
    "localCode": "01",
    "agreeToTerms": true,
    "agreeToAge14": true,
    "agreeToPrivacy": true,
    "agreeToThirdParty": false,
    "agreeToMarketing": false
  }'
```

---

**문서 버전:** 1.0
**최종 업데이트:** 2025-11-12
**담당자:** Backend Team
