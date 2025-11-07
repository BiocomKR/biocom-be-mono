# 휴대폰 본인인증 API 가이드

## 📋 개요
NHN KCP 본인확인 HUB API를 사용한 3단계 휴대폰 본인인증 프로세스

## 🔄 API 실행 순서

### 전체 플로우
```
1단계: 실명 확인 (POST /phone-verification/identity)
   ↓
   ├─ SK/KT 통신사: SMS 자동 발송 → 3단계로 이동
   └─ LG 통신사: 2단계로 이동

2단계: SMS 발송 (POST /phone-verification/sms) [LG 통신사만]
   ↓

3단계: 인증번호 확인 (POST /phone-verification/confirm)
   ↓
   본인인증 완료 (CI/DI 획득)
```

---

## 🔐 환경변수 설정 (필수)

```env
# NHN KCP 설정
KCP_SITE_CODE=your_site_code
KCP_CERT_INFO=your_cert_info
KCP_WEB_SITE_ID=your_web_site_id
KCP_CALLBACK_NUMBER=15441234
```

---

## 📡 API 상세

### 1단계: 실명 확인

#### Endpoint
```
POST /phone-verification/identity
```

#### Request Body
```json
{
  "phoneNumber": "01012345678",
  "birthDay": "19900101",
  "userName": "홍길동",
  "telecom": "KTF",
  "sex": "01",
  "localCode": "01"
}
```

#### Request Parameters
| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|------|------|------|
| phoneNumber | string | Y | 휴대폰 번호 (하이픈 없이) | "01012345678" |
| birthDay | string | Y | 생년월일 (YYYYMMDD) | "19900101" |
| userName | string | Y | 명의자 이름 | "홍길동" |
| telecom | enum | Y | 통신사 코드 | "SKT", "KTF", "LGT", "SKM", "KTM", "LGM" |
| sex | enum | Y | 성별 코드 | "01"(남), "02"(여) |
| localCode | enum | N | 내/외국인 코드 (기본값: "01") | "01"(내국인), "02"(외국인) |

#### 통신사 코드 (telecom)
- `SKT`: SK텔레콤
- `KTF`: KT
- `LGT`: LG U+
- `SKM`: SK텔레콤 알뜰폰
- `KTM`: KT 알뜰폰
- `LGM`: LG U+ 알뜰폰

#### Response
```json
{
  "certNumber": "24441464718083",
  "smsSent": "Y",
  "message": "SMS가 발송되었습니다. 인증번호를 확인해주세요."
}
```

#### Response Fields
| 필드 | 타입 | 설명 |
|------|------|------|
| certNumber | string | 본인확인 거래번호 (이후 API 호출 시 필수) |
| smsSent | string | SMS 발송 여부 ("Y": 발송됨, "N": 미발송) |
| message | string | 안내 메시지 |

#### 통신사별 동작
- **SK/KT (SKT, KTF, SKM, KTM)**: 이 단계에서 SMS 자동 발송 → 바로 3단계로 이동
- **LG (LGT, LGM)**: SMS 미발송 (`smsSent: "N"`) → 2단계 호출 필요

#### 특수 처리: MVNO (알뜰폰)
- **KTM, LGM**: 사업자 조회 API 자동 호출 → 실명 확인 진행
- **SKM**: 사업자 조회 없이 바로 실명 확인 진행

---

### 2단계: SMS 발송 (LG 통신사만)

#### Endpoint
```
POST /phone-verification/sms
```

#### Request Body
```json
{
  "certNumber": "24441464718083"
}
```

#### Request Parameters
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| certNumber | string | Y | 1단계에서 받은 거래번호 |

#### Response
```json
{
  "smsSent": "Y",
  "message": "인증번호가 발송되었습니다."
}
```

#### 사용 시나리오
1. **LG 통신사 (LGT, LGM)**: 1단계 완료 후 필수 호출
2. **SK/KT 통신사**: 인증번호 재전송 시 사용 가능

---

### 3단계: 인증번호 확인

#### Endpoint
```
POST /phone-verification/confirm
```

#### Request Body
```json
{
  "certNumber": "24441464718083",
  "otpNumber": "123456"
}
```

#### Request Parameters
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| certNumber | string | Y | 1단계에서 받은 거래번호 |
| otpNumber | string | Y | SMS로 받은 6자리 인증번호 |

#### Response
```json
{
  "ci": "xSgRrMK/yp7L...sjMw6SDK8Rg==",
  "di": "MC0G...WrDWo+Y=",
  "phoneNumber": "01012345678",
  "message": "본인인증이 완료되었습니다."
}
```

#### Response Fields
| 필드 | 타입 | 설명 |
|------|------|------|
| ci | string | CI (개인 고유 연계정보) - 모든 사이트에서 동일한 값 |
| di | string | DI (업체별 중복가입 확인정보) - 사이트별 고유 값 |
| phoneNumber | string | 인증된 휴대폰 번호 |
| message | string | 완료 메시지 |

#### CI/DI 활용
- **CI**: 본인확인 기관에서 발급한 개인 고유값 (크로스 사이트 중복 확인 가능)
- **DI**: 사이트별 고유값 (해당 사이트 내 중복 가입 확인용)

---

## 🎯 사용 시나리오

### Case 1: SK텔레콤 사용자
```
1. POST /phone-verification/identity (telecom: "SKT")
   → Response: { certNumber: "xxx", smsSent: "Y", ... }
   → SMS 자동 발송됨

2. (사용자가 SMS 확인)

3. POST /phone-verification/confirm
   → Response: { ci: "xxx", di: "xxx", ... }
   → 본인인증 완료
```

### Case 2: KT 사용자
```
1. POST /phone-verification/identity (telecom: "KTF")
   → Response: { certNumber: "xxx", smsSent: "Y", ... }
   → SMS 자동 발송됨

2. (사용자가 SMS 확인)

3. POST /phone-verification/confirm
   → Response: { ci: "xxx", di: "xxx", ... }
   → 본인인증 완료
```

### Case 3: LG U+ 사용자
```
1. POST /phone-verification/identity (telecom: "LGT")
   → Response: { certNumber: "xxx", smsSent: "N", ... }
   → SMS 미발송

2. POST /phone-verification/sms
   → Response: { smsSent: "Y", ... }
   → SMS 발송됨

3. (사용자가 SMS 확인)

4. POST /phone-verification/confirm
   → Response: { ci: "xxx", di: "xxx", ... }
   → 본인인증 완료
```

### Case 4: KT 알뜰폰 사용자
```
1. POST /phone-verification/identity (telecom: "KTM")
   → 내부적으로 MVNO 사업자 조회 먼저 실행
   → Response: { certNumber: "xxx", smsSent: "Y", ... }
   → SMS 자동 발송됨

2. (사용자가 SMS 확인)

3. POST /phone-verification/confirm
   → Response: { ci: "xxx", di: "xxx", ... }
   → 본인인증 완료
```

---

## ❌ 에러 처리

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "본인확인 거래번호를 찾을 수 없습니다. 먼저 실명 확인 API를 호출해주세요.",
  "error": "Not Found"
}
```

**발생 원인:**
- 2단계 또는 3단계에서 잘못된 `certNumber` 전달
- 1단계를 건너뛰고 2/3단계 호출

### 400 Bad Request (Validation Error)
```json
{
  "statusCode": 400,
  "message": [
    "올바른 휴대폰 번호 형식이 아닙니다.",
    "생년월일은 8자리 숫자로 입력해주세요. (YYYYMMDD)"
  ],
  "error": "Bad Request"
}
```

**발생 원인:**
- 입력 형식 오류 (휴대폰 번호, 생년월일, 인증번호 등)

### KCP API 에러
```json
{
  "statusCode": 500,
  "message": "KCP API 호출 실패: [에러 메시지]",
  "error": "Internal Server Error"
}
```

---

## 🔍 검증 규칙

### phoneNumber
- 정규식: `^01[0-9]{8,9}$`
- 예시: "01012345678", "01098765432"
- 하이픈 없이 숫자만

### birthDay
- 형식: YYYYMMDD (8자리 숫자)
- 정규식: `^\d{8}$`
- 예시: "19900101", "20000512"

### otpNumber
- 형식: 6자리 숫자
- 정규식: `^\d{6}$`
- 예시: "123456", "987654"

---

## 📊 데이터베이스 로그

모든 인증 시도는 `phone_verification_logs` 테이블에 기록됩니다.

### 로그 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| cert_number | VARCHAR(14) | KCP 발급 거래번호 |
| phone_number | VARCHAR(11) | 휴대폰 번호 |
| telecom | VARCHAR(3) | 통신사 코드 |
| user_name | VARCHAR(50) | 사용자 이름 |
| birth_day | VARCHAR(8) | 생년월일 |
| sex | VARCHAR(1) | 성별 코드 |
| ci | VARCHAR(500) | CI (인증 완료 시) |
| di | VARCHAR(500) | DI (인증 완료 시) |
| verification_status | VARCHAR(20) | PENDING, COMPLETED, FAILED |
| step | VARCHAR(20) | IDENTITY, SMS_SENT, VERIFIED |
| created_at | TIMESTAMP | 생성 시각 (KST) |
| updated_at | TIMESTAMP | 수정 시각 (KST) |

### 단계별 로그 상태
```
1단계 완료 → { step: "IDENTITY", verificationStatus: "PENDING" }
2단계 완료 → { step: "SMS_SENT", verificationStatus: "PENDING" }
3단계 완료 → { step: "VERIFIED", verificationStatus: "COMPLETED", ci: "xxx", di: "xxx" }
```

---

## ⚙️ 기술 스펙

### 타임아웃
- KCP API 호출: 10초

### 로깅
- 모든 주요 단계에서 Logger 사용
- 거래번호, 통신사, 사용자명 등 주요 정보 기록

### 보안
- KCP 서명(Signature) 기반 API 호출
- 환경변수로 민감정보 관리
- 감사 로그 자동 저장

---

## 🧪 테스트 방법

### Swagger UI 접속
```
http://localhost:4001/docs
```

### 테스트 순서
1. "휴대폰 본인인증" 섹션 선택
2. `POST /phone-verification/identity` 실행
3. 응답에서 `certNumber` 복사
4. (LG 통신사인 경우) `POST /phone-verification/sms` 실행
5. 실제 SMS 수신 확인
6. `POST /phone-verification/confirm`에 `certNumber`와 `otpNumber` 입력
7. CI/DI 획득 확인

---

## 📝 주의사항

1. **거래번호 (certNumber) 관리**
   - 1단계에서 받은 거래번호를 반드시 저장
   - 2/3단계 호출 시 동일한 거래번호 사용

2. **통신사별 차이**
   - SK/KT: 2단계 생략 가능
   - LG: 2단계 필수

3. **알뜰폰 (MVNO)**
   - KTM/LGM: 내부적으로 사업자 조회 먼저 실행
   - 일반 사용자는 신경 쓸 필요 없음

4. **CI/DI 저장**
   - 본인인증 완료 후 CI/DI를 사용자 테이블에 저장
   - 중복 가입 확인 시 활용

5. **법적 요구사항**
   - 모든 본인인증 시도는 감사 로그로 저장됨
   - 로그 데이터는 법적으로 보관 의무 있음

---

## 🔗 관련 문서
- [NHN KCP 본인확인 HUB API 문서](https://sir.kr/main/service/p_cert_hub.php)
- [개인정보보호법 본인확인 가이드](https://www.privacy.go.kr/)
