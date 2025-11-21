# FCM (Firebase Cloud Messaging) 통합 가이드

## 목차

1. [개요](#개요)
2. [Firebase 프로젝트 설정](#firebase-프로젝트-설정)
3. [백엔드 설정](#백엔드-설정)
4. [클라이언트 설정](#클라이언트-설정)
5. [푸시 발송](#푸시-발송)
6. [트러블슈팅](#트러블슈팅)

---

## 개요

Biocom은 **Firebase Cloud Messaging (FCM)**을 사용하여 iOS/Android 앱에 푸시 알림을 전송합니다.

### 시스템 구성

```
[React Native 앱]
    ↓ 1. FCM 토큰 발급
[Firebase]
    ↓ 2. 토큰 전송
[Biocom API]
    ↓ 3. DB 저장
[PostgreSQL]

[Biocom API]
    ↓ 4. 푸시 발송 요청
[Firebase Admin SDK]
    ↓ 5. FCM으로 전송
[Firebase]
    ↓ 6. 푸시 전달
[React Native 앱]
```

---

## Firebase 프로젝트 설정

### 1. Firebase 프로젝트 확인

**현재 사용 중인 프로젝트:**
- 개발: `BiocomChallengeDev`
- 운영: `BiocomChallenge`

**새 프로젝트 생성 시:**
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. **"프로젝트 만들기"** 클릭
3. 프로젝트 이름 입력 (예: `BiocomChallengeDev`)
4. Google Analytics 설정 (선택사항)
5. 프로젝트 생성 완료

### 2. Android 앱 추가

1. Firebase Console → 프로젝트 선택 (`BiocomChallengeDev`)
2. 좌측 메뉴 → **프로젝트 개요** 옆 ⚙️ 아이콘 → **프로젝트 설정**
3. **내 앱** 섹션 → **앱 추가** → **Android** 선택
4. **Android 패키지 이름** 입력: `com.biocom.challenge` (실제 패키지명 확인 필요)
5. 앱 닉네임 입력 (선택사항): `BiocomChallenge Android`
6. **앱 등록** 클릭
7. `google-services.json` 다운로드
8. React Native 프로젝트의 `BiocomChallenge/android/app/` 디렉토리에 복사

**⚠️ 패키지 이름 확인:**
```bash
# Android 패키지명 확인
cat android/app/src/main/AndroidManifest.xml | grep package
```

### 3. iOS 앱 추가

1. Firebase Console → 프로젝트 설정 → **내 앱** 섹션
2. **앱 추가** → **iOS** 선택
3. **iOS 번들 ID** 입력: `com.biocom.challenge` (Xcode에서 확인)
4. 앱 닉네임 입력 (선택사항): `BiocomChallenge iOS`
5. **앱 등록** 클릭
6. `GoogleService-Info.plist` 다운로드
7. Xcode에서 프로젝트 루트에 드래그 앤 드롭 (Copy items if needed 체크)

**⚠️ 번들 ID 확인:**
- Xcode → 프로젝트 선택 → **General** 탭 → **Bundle Identifier**

### 4. Service Account Key 발급 (백엔드용)

1. Firebase Console → 프로젝트 설정 (⚙️)
2. 상단 탭에서 **서비스 계정** 선택
3. **Firebase Admin SDK** 섹션 확인
4. **새 비공개 키 생성** 버튼 클릭
5. 확인 팝업에서 **키 생성** 클릭
6. JSON 키 파일 자동 다운로드: `biocomchallengedev-firebase-adminsdk-xxxxx.json`
7. 파일명 변경 (선택): `biocom-firebase-admin-key.json`

**⚠️ 중요 보안 사항:**
- 이 파일은 **Firebase 프로젝트의 전체 권한**을 가집니다
- **절대 Git에 커밋하지 마세요**
- **공개 저장소에 업로드 금지**
- 실수로 노출 시 즉시 Firebase Console에서 키 삭제

```bash
# .gitignore에 추가 (이미 추가되어 있음)
biocom-firebase-admin-key.json
*-firebase-adminsdk-*.json
*.serviceAccountKey.json
```

**키 파일 저장 위치:**
```bash
# 개발 환경
biocom-api/config/biocom-firebase-admin-key.json

# 운영 환경 (환경변수 사용 권장)
# GitHub Secrets, AWS Secrets Manager 등
```

---

## 백엔드 설정 (현재 구축된 시스템)

### 1. 의존성

**설치된 패키지**:
```json
// package.json
{
  "dependencies": {
    "firebase-admin": "^12.0.0"
  }
}
```

### 2. Firebase Admin SDK 초기화 구조

**파일**: `src/push/firebase-admin.module.ts`

**현재 구현된 방식**:
- Service Account JSON 파일 경로 방식 사용
- 환경변수: `FIREBASE_SERVICE_ACCOUNT_PATH` (선택사항)
- 기본 경로: `./biocomchallengedev-firebase-adminsdk-fbsvc-9373a3598f.json`

```typescript
@Global()
@Module({
  providers: [
    {
      provide: 'FIREBASE_ADMIN',
      useFactory: (configService: ConfigService) => {
        // 환경변수에서 경로 읽기 (없으면 기본값)
        const serviceAccountPath = configService.get<string>(
          'FIREBASE_SERVICE_ACCOUNT_PATH',
          './biocomchallengedev-firebase-adminsdk-fbsvc-9373a3598f.json',
        );

        if (!admin.apps.length) {
          const serviceAccount = require(path.resolve(process.cwd(), serviceAccountPath));

          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });

          console.log('✅ Firebase Admin SDK 초기화 완료');
        }

        return admin;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['FIREBASE_ADMIN'],
})
export class FirebaseAdminModule {}
```

**파일 위치**:
```
biocom-api/
├── biocomchallengedev-firebase-adminsdk-fbsvc-9373a3598f.json  ← Service Account Key
├── src/
│   └── push/
│       └── firebase-admin.module.ts  ← Firebase 초기화
└── .env
```

**⚠️ 중요 보안 사항**:
- Service Account Key 파일은 `.gitignore`에 포함되어 있음
- 실제 파일은 서버에만 존재
- 새 개발자는 Firebase Console에서 직접 다운로드 필요

**환경변수 설정 (선택사항)**:

`.env` 파일에 추가 시:
```bash
# Firebase Admin SDK 설정 (선택사항 - 기본값이 이미 설정됨)
FIREBASE_SERVICE_ACCOUNT_PATH=./biocomchallengedev-firebase-adminsdk-fbsvc-9373a3598f.json
```

### 3. FCM Provider 구현

**파일**: `src/push/providers/fcm.provider.ts`

```typescript
@Injectable()
export class FcmProvider implements IPushProvider {
  readonly name = 'FCM';

  constructor(
    @Inject('FIREBASE_ADMIN') private readonly admin: admin.app.App,
  ) {}

  async sendToToken(token: string, message: PushMessage): Promise<PushSendResult> {
    const fcmMessage: admin.messaging.Message = {
      token,
      notification: {
        title: message.title,
        body: message.body,
        imageUrl: message.imageUrl,
      },
      data: message.data ? convertToStringRecord(message.data) : undefined,
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    };

    const messageId = await this.admin.messaging().send(fcmMessage);
    return { success: true, messageId };
  }
}
```

---

## 클라이언트 설정

### 1. React Native 의존성 설치

**BiocomChallenge 앱**에 이미 설치되어 있습니다:

```json
// package.json
{
  "dependencies": {
    "@react-native-firebase/app": "^23.5.0",
    "@react-native-firebase/messaging": "^23.5.0"
  }
}
```

### 2. Firebase 초기화

**파일**: `BiocomChallenge/src/firebase/integration.ts`

```typescript
import messaging from '@react-native-firebase/messaging';

export const initialize = async (options: {
  enableMessaging: boolean;
  enableAnalytics: boolean;
}) => {
  if (options.enableMessaging) {
    // FCM 백그라운드 핸들러 등록
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background message received:', remoteMessage);
      // 백그라운드 처리 로직
    });
  }
};
```

### 3. 푸시 권한 요청

**파일**: `BiocomChallenge/src/hooks/usePushNotification.ts`

```typescript
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

export const requestPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  // Android는 별도 권한 불필요 (Android 13+ 제외)
  return true;
};
```

### 4. FCM 토큰 발급 및 등록

```typescript
import messaging from '@react-native-firebase/messaging';
import { registerToken } from '../api/pushApi';

export const registerFCMToken = async () => {
  // 1. FCM 토큰 발급
  const fcmToken = await messaging().getToken();

  // 2. 서버에 등록
  await registerToken({
    provider: 'FCM',
    token: fcmToken,
    platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    deviceId: await DeviceInfo.getUniqueId(),
  });

  console.log('FCM Token registered:', fcmToken);
};
```

### 5. 포그라운드 메시지 수신

```typescript
import messaging from '@react-native-firebase/messaging';

useEffect(() => {
  const unsubscribe = messaging().onMessage(async (remoteMessage) => {
    console.log('Foreground message:', remoteMessage);

    // 알림 표시
    Alert.alert(
      remoteMessage.notification?.title || '알림',
      remoteMessage.notification?.body || ''
    );

    // 데이터 처리
    if (remoteMessage.data?.action === 'sync_data') {
      await syncDataFromServer();
    }
  });

  return unsubscribe;
}, []);
```

### 6. 백그라운드 메시지 수신

**파일**: `index.js` (앱 루트)

```typescript
import messaging from '@react-native-firebase/messaging';

// 앱 진입점에서 등록
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('Background message:', remoteMessage);

  // Silent Push 처리
  if (remoteMessage.data?.silent === 'true') {
    // 데이터 동기화 로직
    await syncInBackground(remoteMessage.data);
  }
});
```

### 7. 알림 탭 시 처리

```typescript
import messaging from '@react-native-firebase/messaging';

useEffect(() => {
  // 앱이 백그라운드에 있을 때 알림 탭
  messaging().onNotificationOpenedApp((remoteMessage) => {
    console.log('Notification opened (background):', remoteMessage);

    // 딥링크 처리
    if (remoteMessage.data?.screen) {
      navigation.navigate(remoteMessage.data.screen);
    }
  });

  // 앱이 종료된 상태에서 알림 탭
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        console.log('Notification opened (quit):', remoteMessage);
        // 딥링크 처리
      }
    });
}, []);
```

### 8. 토큰 갱신 처리

```typescript
useEffect(() => {
  const unsubscribe = messaging().onTokenRefresh(async (newToken) => {
    console.log('FCM Token refreshed:', newToken);

    // 서버에 새 토큰 등록
    await registerToken({
      provider: 'FCM',
      token: newToken,
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
      deviceId: await DeviceInfo.getUniqueId(),
    });
  });

  return unsubscribe;
}, []);
```

---

## 푸시 발송

### 1. 단일 유저 발송

**API 엔드포인트**:
```
POST /push/admin/send-to-user
```

**Request**:
```json
{
  "userId": 123,
  "title": "새로운 챌린지가 시작되었습니다!",
  "body": "7일 물 마시기 챌린지에 참여해보세요",
  "imageUrl": "https://example.com/challenge.png",
  "data": {
    "challengeId": "456",
    "screen": "ChallengeDetail"
  }
}
```

**Response**:
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

### 2. Silent Push 발송

```json
{
  "userId": 123,
  "title": "",
  "body": "",
  "silent": true,
  "data": {
    "action": "sync_challenge_ranking",
    "challengeId": "456"
  }
}
```

### 3. Topic 발송

**Topic 구독**:
```typescript
await messaging().subscribeToTopic('marketing');
```

**서버에서 Topic 발송**:
```
POST /push/topics/send
```

```json
{
  "topic": "marketing",
  "title": "특별 이벤트 알림",
  "body": "지금 바로 확인하세요!",
  "data": {
    "eventId": "789"
  }
}
```

---

## FCM 메시지 구조

### 일반 푸시

```json
{
  "token": "fcm_token_here",
  "notification": {
    "title": "제목",
    "body": "본문",
    "imageUrl": "https://..."
  },
  "data": {
    "key1": "value1",
    "key2": "value2"
  },
  "android": {
    "priority": "high",
    "notification": {
      "sound": "default",
      "channelId": "default"
    }
  },
  "apns": {
    "payload": {
      "aps": {
        "sound": "default",
        "badge": 1
      }
    }
  }
}
```

### Silent Push

```json
{
  "token": "fcm_token_here",
  "data": {
    "action": "sync_data",
    "timestamp": "2025-11-21T10:00:00Z"
  },
  "android": {
    "priority": "normal"
  },
  "apns": {
    "headers": {
      "apns-priority": "5",
      "apns-push-type": "background"
    },
    "payload": {
      "aps": {
        "contentAvailable": true
      }
    }
  }
}
```

---

## 트러블슈팅

### 1. 토큰 발급 실패

**증상**:
```
Error: [messaging/registration-error] Unable to get FCM token
```

**원인**:
- `google-services.json` (Android) 또는 `GoogleService-Info.plist` (iOS) 누락
- Firebase 프로젝트에 앱이 등록되지 않음

**해결**:
1. Firebase Console에서 앱 등록 확인
2. 설정 파일이 올바른 위치에 있는지 확인
3. 앱 재빌드

### 2. 푸시 수신 안 됨

**증상**:
- 서버에서 발송 성공했으나 기기에서 알림 안 옴

**체크리스트**:
- ✅ 푸시 권한 허용 확인
- ✅ 토큰이 서버에 정상 등록되었는지 확인
- ✅ FCM Console에서 테스트 메시지 발송 시도
- ✅ 백그라운드 핸들러 등록 확인

**Android 추가 체크**:
```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

**iOS 추가 체크**:
- Xcode → Signing & Capabilities → **Push Notifications** 추가
- APNs 인증서 설정 확인

### 3. Invalid Registration Token

**증상**:
```json
{
  "errorCode": "messaging/invalid-registration-token"
}
```

**원인**:
- 토큰이 만료됨
- 앱 삭제 후 재설치
- FCM 프로젝트 변경

**해결**:
- 자동으로 토큰 비활성화 처리됨 (이미 구현됨)
- 앱에서 토큰 재발급 및 등록

### 4. Rate Limit 초과

**증상**:
```json
{
  "errorCode": "messaging/quota-exceeded"
}
```

**원인**:
- FCM 무료 할당량 초과
- 너무 많은 요청

**해결**:
- Firebase 프로젝트를 **Blaze** (종량제) 플랜으로 업그레이드
- 발송 빈도 조절
- 배치 발송 사용 (최대 500개)

### 5. Silent Push가 작동 안 함 (iOS)

**증상**:
- Silent Push 발송했으나 백그라운드 핸들러 실행 안 됨

**원인**:
- iOS는 Silent Push를 **보장하지 않음**
- 배터리 절약 모드에서 제한
- 하루 발송 횟수 제한

**해결**:
- 중요한 알림은 일반 Push 사용
- Silent Push는 보조 수단으로만 활용
- iOS Background Modes 설정 확인

---

## 모범 사례

### 1. 토큰 관리

✅ **DO**:
- 앱 시작 시 토큰 발급 및 등록
- 토큰 갱신 리스너 등록
- 로그아웃 시 토큰 삭제

❌ **DON'T**:
- 토큰을 로컬에만 저장 (서버 등록 필수)
- 토큰 갱신 무시

### 2. 메시지 작성

✅ **DO**:
- 제목: 50자 이내
- 본문: 100자 이내
- 이미지: 1MB 이하
- 간결하고 명확한 메시지

❌ **DON'T**:
- 과도하게 긴 메시지
- 이모지 남용
- 마케팅 스팸성 메시지 과다 발송

### 3. 발송 시간

✅ **DO**:
- 사용자 타임존 고려
- 야간 푸시 동의 확인
- 적절한 발송 빈도 유지

❌ **DON'T**:
- 새벽 시간 무차별 발송
- 1시간에 여러 번 발송
- 사용자 동의 없는 마케팅 푸시

### 4. 데이터 구조

✅ **DO**:
```json
{
  "data": {
    "type": "challenge",
    "id": "123",
    "action": "open",
    "screen": "ChallengeDetail"
  }
}
```

❌ **DON'T**:
```json
{
  "data": {
    "complexObject": { /* 중첩 객체 */ },
    "largeArray": [/* 큰 배열 */]
  }
}
```

---

## 참고 자료

- [FCM 공식 문서](https://firebase.google.com/docs/cloud-messaging)
- [React Native Firebase 문서](https://rnfirebase.io/)
- [Biocom API 레퍼런스](./PUSH_API_REFERENCE.md)
- [Biocom ERD](./PUSH_ERD.md)

---

## 지원

문제가 발생하면:
1. [트러블슈팅 가이드](./PUSH_TROUBLESHOOTING.md) 확인
2. FCM Console에서 로그 확인
3. 서버 로그 확인 (`push_notification_logs` 테이블)
4. GitHub Issues에 질문 남기기
