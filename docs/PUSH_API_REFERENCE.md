# 푸시 API 레퍼런스

## 목차

1. [개요](#개요)
2. [인증](#인증)
3. [Rate Limiting](#rate-limiting)
4. [토큰 관리 API](#토큰-관리-api)
5. [푸시 발송 API](#푸시-발송-api)
6. [Topic API](#topic-api)
7. [로그 및 통계 API](#로그-및-통계-api)
8. [에러 코드](#에러-코드)

---

## 개요

Biocom Push API는 RESTful API로, JWT 기반 인증을 사용합니다.

**Base URL**: `https://api.biocom.kr/v1`

**Swagger UI**: `https://api.biocom.kr/api`

---

## 인증

모든 API는 JWT 인증이 필요합니다.

### Authorization Header

```
Authorization: Bearer <JWT_TOKEN>
```

### 토큰 발급

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 123,
      "email": "user@example.com",
      "name": "홍길동"
    }
  }
}
```

---

## Rate Limiting

### 제한 정책

| 엔드포인트 | TTL | 제한 |
|------------|-----|------|
| `POST /push/notifications/test` | 60초 | 10회 |
| `POST /push/tokens` | 60초 | 20회 |
| Admin API | - | 제한 없음 |

### Rate Limit 초과 시

**Response** (HTTP 429):
```json
{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests",
  "error": "Too Many Requests"
}
```

---

## 토큰 관리 API

### 1. 토큰 등록/업데이트

**POST** `/push/tokens`

사용자의 FCM 토큰을 등록하거나 업데이트합니다.

**Request**:
```json
{
  "provider": "FCM",
  "token": "fcm_token_abc123...",
  "platform": "IOS",
  "deviceId": "iPhone12_UUID",
  "deviceModel": "iPhone 12",
  "osVersion": "17.2.1",
  "appVersion": "1.0.0"
}
```

**Request Fields**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| provider | string | ✅ | `FCM`, `ONESIGNAL`, `APNS` |
| token | string | ✅ | 푸시 토큰 (최대 255자) |
| platform | string | ⚠️ | `IOS`, `ANDROID`, `WEB` |
| deviceId | string | ⚠️ | 디바이스 고유 ID |
| deviceModel | string | ❌ | 디바이스 모델명 |
| osVersion | string | ❌ | OS 버전 |
| appVersion | string | ❌ | 앱 버전 |

**Response** (201 Created):
```json
{
  "id": 456,
  "userId": 123,
  "provider": "FCM",
  "token": "fcm_token_abc123...",
  "platform": "IOS",
  "deviceId": "iPhone12_UUID",
  "isActive": true,
  "createdAt": "2025-11-21T10:00:00Z",
  "updatedAt": "2025-11-21T10:00:00Z"
}
```

**중복 토큰 처리**:
- 같은 `userId` + `deviceId` + `provider` 조합이 있으면 **기존 토큰 무효화** 후 새 토큰 등록
- `invalidReason`: `TOKEN_REASSIGNED_TO_NEW_DEVICE`

---

### 2. 내 토큰 목록 조회

**GET** `/push/tokens`

현재 로그인한 유저의 모든 활성 토큰을 조회합니다.

**Response** (200 OK):
```json
[
  {
    "id": 456,
    "userId": 123,
    "provider": "FCM",
    "token": "fcm_token_abc...",
    "platform": "IOS",
    "deviceId": "iPhone12_UUID",
    "isActive": true,
    "lastUsedAt": "2025-11-21T09:00:00Z",
    "successCount": 50,
    "failureCount": 2,
    "createdAt": "2025-11-01T10:00:00Z"
  },
  {
    "id": 457,
    "userId": 123,
    "provider": "FCM",
    "token": "fcm_token_def...",
    "platform": "ANDROID",
    "deviceId": "GalaxyS23_UUID",
    "isActive": true,
    "lastUsedAt": "2025-11-20T18:00:00Z",
    "successCount": 30,
    "failureCount": 0,
    "createdAt": "2025-11-10T14:00:00Z"
  }
]
```

---

### 3. 특정 디바이스 토큰 삭제

**DELETE** `/push/tokens/:deviceId`

특정 디바이스의 토큰을 비활성화합니다 (로그아웃 시 사용).

**Path Parameters**:
- `deviceId`: 디바이스 ID (예: `iPhone12_UUID`)

**Response** (200 OK):
```json
{
  "message": "토큰이 삭제되었습니다"
}
```

---

### 4. 내 모든 토큰 삭제

**DELETE** `/push/tokens`

현재 로그인한 유저의 모든 토큰을 비활성화합니다.

**Response** (200 OK):
```json
{
  "message": "모든 토큰이 삭제되었습니다"
}
```

---

## 푸시 발송 API

### 1. 테스트 푸시 (자신에게 발송)

**POST** `/push/notifications/test`

현재 로그인한 유저의 모든 기기에 테스트 푸시를 전송합니다.

**Request**:
```json
{
  "title": "테스트 푸시",
  "body": "정상적으로 수신되었습니다!",
  "imageUrl": "https://example.com/image.png",
  "data": {
    "screen": "Home",
    "action": "open"
  },
  "silent": false,
  "isTest": true
}
```

**Request Fields**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| title | string | ✅ | 푸시 제목 (최대 100자) |
| body | string | ✅ | 푸시 본문 (최대 500자) |
| imageUrl | string | ❌ | 이미지 URL |
| data | object | ❌ | 추가 데이터 (JSON) |
| silent | boolean | ❌ | Silent Push 여부 (기본: false) |
| isTest | boolean | ❌ | 테스트 발송 여부 (기본: false) |

**Response** (201 Created):
```json
{
  "success": true,
  "message": "푸시 전송 완료",
  "data": {
    "sentCount": 2,
    "failureCount": 0
  }
}
```

**Silent Push 예시**:
```json
{
  "title": "",
  "body": "",
  "silent": true,
  "data": {
    "action": "sync_challenge_ranking",
    "challengeId": "123"
  }
}
```

---

### 2. 특정 유저에게 발송 (관리자)

**POST** `/push/admin/send-to-user`

**⚠️ 관리자 전용** - 특정 유저의 모든 기기에 푸시를 전송합니다.

**Request**:
```json
{
  "userId": 123,
  "title": "챌린지 완료 축하!",
  "body": "7일 물 마시기 챌린지를 완료하셨습니다",
  "imageUrl": "https://example.com/badge.png",
  "data": {
    "challengeId": "456",
    "screen": "ChallengeResult"
  },
  "isTest": false
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "푸시 전송 완료",
  "data": {
    "sentCount": 2,
    "failureCount": 0
  }
}
```

---

### 3. 여러 유저에게 발송 (관리자)

**POST** `/push/admin/send-to-users`

**⚠️ 관리자 전용** - 여러 유저에게 푸시를 전송합니다.

**Request**:
```json
{
  "userIds": [123, 456, 789],
  "title": "새로운 이벤트 시작!",
  "body": "지금 바로 확인하세요",
  "data": {
    "eventId": "999",
    "screen": "EventDetail"
  }
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "푸시 전송 완료",
  "data": {
    "sentCount": 6,
    "failureCount": 0
  }
}
```

---

### 4. 전체 유저에게 발송 (관리자)

**POST** `/push/admin/send-to-all`

**⚠️ 관리자 전용** - 모든 유저에게 푸시를 전송합니다 (공지사항 등).

**Request**:
```json
{
  "title": "서비스 점검 안내",
  "body": "11월 22일 02:00~04:00 서비스 점검이 있습니다",
  "data": {
    "type": "maintenance",
    "startTime": "2025-11-22T02:00:00Z",
    "endTime": "2025-11-22T04:00:00Z"
  },
  "marketingOnly": false
}
```

**Request Fields**:
- `marketingOnly` (boolean): `true`면 마케팅 수신 동의한 유저만 발송

**Response** (201 Created):
```json
{
  "success": true,
  "message": "푸시 전송 완료",
  "data": {
    "sentCount": 1523,
    "failureCount": 12
  }
}
```

---

## Topic API

### 1. Topic 구독

**POST** `/push/topics/subscribe`

FCM Topic을 구독합니다.

**Request**:
```json
{
  "topic": "marketing",
  "tokens": ["fcm_token_abc...", "fcm_token_def..."]
}
```

**Request Fields**:
- `topic` (string, 필수): Topic 이름
- `tokens` (string[], 선택): 토큰 배열 (생략 시 유저의 모든 활성 토큰)

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Topic 구독 완료"
}
```

**주요 Topic 목록**:
- `all-users`: 전체 유저
- `marketing`: 마케팅 수신 동의 유저
- `inactive-7days`: 7일간 미접속 유저
- `event/{eventId}`: 특정 이벤트 참가자

---

### 2. Topic 구독 해제

**POST** `/push/topics/unsubscribe`

FCM Topic 구독을 해제합니다.

**Request**:
```json
{
  "topic": "marketing"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Topic 구독 해제 완료"
}
```

---

### 3. Topic으로 푸시 발송 (관리자)

**POST** `/push/topics/send`

**⚠️ 관리자 전용** - Topic에 구독한 모든 유저에게 푸시를 전송합니다.

**Request**:
```json
{
  "topic": "marketing",
  "title": "특별 할인 이벤트",
  "body": "오늘만 50% 할인!",
  "imageUrl": "https://example.com/event.png",
  "data": {
    "eventId": "sale-2025-11"
  }
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Topic 푸시 전송 완료",
  "data": {
    "messageId": "fcm_message_id_xyz"
  }
}
```

---

## 로그 및 통계 API

### 1. 푸시 로그 조회 (관리자)

**GET** `/push/admin/logs`

푸시 발송 로그를 조회합니다.

**Query Parameters**:
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| page | number | ❌ | 페이지 번호 (기본: 1) |
| limit | number | ❌ | 페이지 크기 (기본: 20, 최대: 100) |
| userId | number | ❌ | 유저 ID 필터 |
| success | boolean | ❌ | 성공/실패 필터 |
| type | string | ❌ | 푸시 타입 필터 |
| startDate | string | ❌ | 시작 날짜 (ISO 8601) |
| endDate | string | ❌ | 종료 날짜 (ISO 8601) |
| isTest | boolean | ❌ | 테스트 발송 필터 |

**Example**:
```
GET /push/admin/logs?page=1&limit=20&success=false&startDate=2025-11-01T00:00:00Z
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": 12345,
      "userId": 123,
      "pushTokenId": 456,
      "title": "챌린지 알림",
      "body": "새 챌린지가 시작되었습니다",
      "type": "CHALLENGE",
      "success": false,
      "errorCode": "messaging/invalid-registration-token",
      "errorMessage": "The registration token is not a valid FCM registration token",
      "sentAt": "2025-11-21T10:30:00Z",
      "readAt": null,
      "clickedAt": null,
      "isTest": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 1523,
    "totalPages": 77
  }
}
```

---

### 2. 푸시 통계 조회 (관리자)

**GET** `/push/admin/stats`

푸시 발송 통계를 조회합니다.

**Query Parameters**:
- `startDate` (string, 필수): 시작 날짜 (ISO 8601)
- `endDate` (string, 필수): 종료 날짜 (ISO 8601)
- `isTest` (boolean, 선택): 테스트 발송 포함 여부 (기본: false)

**Example**:
```
GET /push/admin/stats?startDate=2025-11-01T00:00:00Z&endDate=2025-11-30T23:59:59Z
```

**Response** (200 OK):
```json
{
  "totalSent": 15234,
  "successCount": 14521,
  "failureCount": 713,
  "readCount": 8234,
  "clickedCount": 3421,
  "successRate": 95.3,
  "readRate": 54.0,
  "clickRate": 22.4,
  "byType": [
    {
      "type": "CHALLENGE",
      "count": 8523,
      "successCount": 8234,
      "failureCount": 289
    },
    {
      "type": "EVENT",
      "count": 4321,
      "successCount": 4102,
      "failureCount": 219
    },
    {
      "type": "MARKETING",
      "count": 2390,
      "successCount": 2185,
      "failureCount": 205
    }
  ]
}
```

---

### 3. 푸시 로그 상태 업데이트 (유저)

**PATCH** `/push/notifications/logs/status`

푸시 알림을 읽거나 클릭했을 때 상태를 업데이트합니다.

**Request**:
```json
{
  "logId": 12345,
  "status": "READ"
}
```

**Request Fields**:
- `logId` (number, 필수): 로그 ID
- `status` (string, 필수): `READ` 또는 `CLICKED`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "상태 업데이트 완료"
}
```

**Business Logic**:
- `READ`: `readAt` 타임스탬프 업데이트
- `CLICKED`: `clickedAt` 타임스탬프 업데이트 (자동으로 `readAt`도 설정)
- 이미 상태가 업데이트된 경우 중복 업데이트 방지

---

## 에러 코드

### HTTP 상태 코드

| 코드 | 의미 | 설명 |
|------|------|------|
| 200 | OK | 요청 성공 |
| 201 | Created | 리소스 생성 성공 |
| 400 | Bad Request | 잘못된 요청 (필수 필드 누락 등) |
| 401 | Unauthorized | 인증 실패 (JWT 없음/만료) |
| 403 | Forbidden | 권한 없음 (Admin API) |
| 404 | Not Found | 리소스 없음 |
| 429 | Too Many Requests | Rate Limit 초과 |
| 500 | Internal Server Error | 서버 오류 |

### FCM 에러 코드

푸시 발송 실패 시 `errorCode` 필드에 포함됩니다.

| 에러 코드 | 의미 | 조치 |
|-----------|------|------|
| `messaging/invalid-registration-token` | 토큰 무효 | 자동으로 토큰 비활성화 처리 |
| `messaging/registration-token-not-registered` | 토큰 미등록 | 자동으로 토큰 비활성화 처리 |
| `messaging/invalid-package-name` | 패키지명 불일치 | Firebase 설정 확인 |
| `messaging/message-rate-exceeded` | 발송 속도 초과 | 잠시 후 재시도 |
| `messaging/quota-exceeded` | 할당량 초과 | Firebase Blaze 플랜 업그레이드 |
| `messaging/third-party-auth-error` | APNs 인증 오류 | APNs 인증서 확인 (iOS) |
| `messaging/server-unavailable` | FCM 서버 장애 | 잠시 후 재시도 |

---

## 예제 코드

### React Native (클라이언트)

#### 토큰 등록
```typescript
import { registerToken } from '../api/pushApi';
import messaging from '@react-native-firebase/messaging';
import DeviceInfo from 'react-native-device-info';
import { Platform } from 'react-native';

const fcmToken = await messaging().getToken();

await registerToken({
  provider: 'FCM',
  token: fcmToken,
  platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
  deviceId: await DeviceInfo.getUniqueId(),
  deviceModel: await DeviceInfo.getModel(),
  osVersion: await DeviceInfo.getSystemVersion(),
  appVersion: await DeviceInfo.getVersion(),
});
```

#### 푸시 로그 상태 업데이트
```typescript
import { updatePushLogStatus } from '../api/pushApi';

// 푸시 수신 시
messaging().onMessage(async (remoteMessage) => {
  const logId = remoteMessage.data?.logId;

  if (logId) {
    await updatePushLogStatus({
      logId: Number(logId),
      status: 'READ',
    });
  }
});

// 푸시 탭 시
messaging().onNotificationOpenedApp((remoteMessage) => {
  const logId = remoteMessage.data?.logId;

  if (logId) {
    await updatePushLogStatus({
      logId: Number(logId),
      status: 'CLICKED',
    });
  }
});
```

### NestJS (백엔드)

#### 푸시 발송
```typescript
import { PushNotificationService } from './push-notification.service';

@Injectable()
export class ChallengeService {
  constructor(
    private readonly pushService: PushNotificationService,
  ) {}

  async notifyChallengers(challengeId: number) {
    const participants = await this.getChallengeParticipants(challengeId);

    await this.pushService.sendToUsers(
      participants.map(p => p.userId),
      {
        title: '챌린지 시작!',
        body: '오늘의 챌린지를 완료해보세요',
        data: {
          challengeId: challengeId.toString(),
          screen: 'ChallengeDetail',
        },
      },
    );
  }
}
```

---

## Postman Collection

Postman Collection 다운로드: [Biocom_Push_API.postman_collection.json](./postman/Biocom_Push_API.postman_collection.json)

**포함 사항**:
- 모든 엔드포인트 예제 요청
- 환경변수 설정 (Base URL, JWT Token)
- 테스트 스크립트

---

## 변경 이력

### v1.2.0 (2025-11-21)
- Silent Push 지원 추가 (`silent` 필드)
- API 문서 업데이트

### v1.1.0 (2024-11-15)
- 푸시 로그 상태 업데이트 API 추가
- 통계 API 추가

### v1.0.0 (2024-11-01)
- 초기 API 릴리스
- 토큰 관리, 푸시 발송, Topic, 로그 API

---

## 참고 문서

- [FCM 통합 가이드](./PUSH_FCM_GUIDE.md)
- [ERD](./PUSH_ERD.md)
- [트러블슈팅 가이드](./PUSH_TROUBLESHOOTING.md)
- [Swagger UI](https://api.biocom.kr/api)
