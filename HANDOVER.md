# biocom-mq 프로젝트 인수인계

> **작성일**: 2025-12-15
> **버전**: 2.0.0

## 🎯 프로젝트 목적

**biocom-api의 백그라운드 작업을 비동기로 처리하는 Message Queue Worker입니다.**

### 처리하는 작업
1. **앱 이벤트 로깅** - GA4 스타일 앱 이벤트 DB 저장
2. **푸시 알림 발송** - FCM 기반 푸시 메시지 발송
3. **주문 상태 동기화** - 플레이오토 배송 상태 DB 반영

### 왜 별도 프로젝트인가?

1. **트래픽 분산**
   - 대량 작업(1000만건 주문 동기화 등)을 직접 처리하면 API 서버 부하
   - MQ로 분산 처리하면 안정적

2. **독립적인 스케일링**
   - API 서버는 사용자 요청에 따라 스케일링
   - Worker는 Queue 적체에 따라 스케일링

3. **배포 독립성**
   - Worker 로직 변경 시 API 재배포 불필요

---

## 📊 시스템 흐름

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│             │         │             │         │             │
│  biocom-api │ ──────> │    Redis    │ ──────> │  biocom-mq  │
│  (Producer) │  Job    │   (Queue)   │  Job    │ (Consumer)  │
│             │         │             │         │             │
└─────────────┘         └─────────────┘         └─────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────┐
                                                │ PostgreSQL  │
                                                │  + FCM      │
                                                └─────────────┘
```

### 예시: 푸시 알림 발송

```
[biocom-api / biocom-bo-api]
    │
    │ QueueService.addPushNotification({ userId, title, body })
    ▼
[Redis Queue: push-notification]
    │
    ▼
[biocom-mq: PushNotificationProcessor]
    │
    ├─> FCM으로 푸시 발송
    └─> PushNotificationLog 테이블에 결과 저장
```

---

## 📊 Queue 목록

| Queue 이름 | Processor | 처리 내용 |
|-----------|-----------|----------|
| `app-event` | AppEventProcessor | AppEvent 테이블에 이벤트 저장 |
| `push-notification` | PushNotificationProcessor | FCM으로 푸시 발송, PushNotificationLog 기록 |
| `order-sync` | OrderSyncProcessor | Order/Shipping 테이블 상태 업데이트 |

---

## 📁 프로젝트 구조

```
biocom-mq/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── common/
│   │   ├── services/prisma.service.ts
│   │   └── utils/kst-date.util.ts
│   ├── processors/
│   │   ├── app-event.processor.ts
│   │   ├── push-notification.processor.ts
│   │   └── order-sync.processor.ts
│   ├── push/
│   │   ├── firebase-admin.module.ts
│   │   └── providers/fcm.provider.ts
│   ├── queues/
│   │   └── queues.module.ts
│   └── health/
├── prisma/
│   └── schema.prisma
└── infra-gcp/
    └── k8s/
```

---

## 🔧 로컬 개발

```bash
# 1. Redis 실행
docker-compose up -d

# 2. 환경 변수 설정
cp .env.example .env

# 3. Prisma 클라이언트 생성
npx prisma generate

# 4. Worker 실행
npm run start:dev

# 5. Bull Board 확인
http://localhost:4001/admin/queues
```

---

## 🚨 주의사항

### 스키마 변경 시
biocom-api, biocom-bo-api와 동일한 스키마를 사용하므로:
1. 세 프로젝트 모두 schema.prisma 동기화
2. 각 프로젝트에서 `npx prisma generate` 실행

### 에러 처리
```typescript
// ✅ 올바른 예시 - throw로 재시도
catch (error) {
  this.logger.error('에러', error);
  throw error; // 재시도 트리거
}

// ❌ 잘못된 예시 - throw 없으면 재시도 안됨
catch (error) {
  this.logger.error('에러', error);
  // throw 없음!
}
```

### 날짜 처리
```typescript
// ✅ 올바른 예시
import { getNowKST } from '../common/utils/kst-date.util';
const now = getNowKST();

// ❌ 잘못된 예시
const now = new Date(); // UTC 문제
```

---

## 📚 관련 프로젝트

- **biocom-api**: 유저 백엔드 (Producer)
- **biocom-bo-api**: 관리자 백엔드 (Producer)

---

**최종 업데이트**: 2025-12-15
