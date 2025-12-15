# biocom-mq AI 개발 가이드

> **프로젝트**: BullMQ 기반 비동기 메시지 큐 Worker
> **버전**: 2.0.0
> **작성일**: 2025-12-15

---

## 🎯 프로젝트 개요

### 역할
biocom-mq는 **BullMQ Worker**로, Redis Queue에서 메시지를 받아 백그라운드 작업을 처리한다.

- 앱 이벤트 로깅
- 푸시 알림 발송 (FCM)
- 주문 상태 동기화 (플레이오토 → DB)

### 핵심 원칙
1. **타입 안전성**: TypeScript, `any` 사용 금지
2. **에러 처리**: try-catch로 감싸고, 명확한 에러 로깅
3. **재시도 가능성**: 멱등성(Idempotency) 보장
4. **트랜잭션**: DB 쓰기 작업은 트랜잭션으로 처리

---

## 📁 프로젝트 구조

```
biocom-mq/
├── src/
│   ├── app.module.ts                # 루트 모듈
│   ├── main.ts                      # 엔트리 포인트
│   ├── config/                      # 설정 모듈
│   ├── common/                      # 공통 유틸리티
│   │   ├── services/prisma.service.ts
│   │   └── utils/kst-date.util.ts
│   ├── processors/                  # BullMQ Processor
│   │   ├── app-event.processor.ts   # 앱 이벤트 저장
│   │   ├── push-notification.processor.ts # FCM 푸시 발송
│   │   └── order-sync.processor.ts  # 주문 상태 동기화
│   ├── push/                        # Firebase 푸시 모듈
│   │   ├── firebase-admin.module.ts
│   │   └── providers/fcm.provider.ts
│   ├── queues/                      # Queue 설정
│   │   └── queues.module.ts
│   └── health/                      # Health Check
├── prisma/
│   └── schema.prisma
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## 📊 Queue 목록

| Queue 이름 | Processor | 처리 내용 |
|-----------|-----------|----------|
| `app-event` | AppEventProcessor | AppEvent 테이블에 이벤트 저장 |
| `push-notification` | PushNotificationProcessor | FCM으로 푸시 발송, PushNotificationLog 기록 |
| `order-sync` | OrderSyncProcessor | Order/Shipping 테이블 상태 업데이트 |

---

## 🔧 개발 규칙

### 1. Processor 작성 규칙

```typescript
@Processor('queue-name')
export class MyProcessor extends WorkerHost {
  private readonly logger = new Logger(MyProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<MyJobData>): Promise<any> {
    this.logger.log(`Job 시작: ${job.id}`);

    try {
      // 비즈니스 로직
      await this.prisma.$transaction(async (tx) => {
        // DB 작업
      });

      this.logger.log(`Job 완료: ${job.id}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Job 실패: ${job.id}`, error);
      throw error; // 반드시 throw! (BullMQ 재시도 트리거)
    }
  }
}
```

### 2. 날짜 처리

```typescript
// ✅ 올바른 예시
import { getNowKST } from '../common/utils/kst-date.util';
const now = getNowKST();

// ❌ 잘못된 예시
const now = new Date(); // UTC 문제 발생
```

### 3. 에러 처리 패턴

```typescript
// ✅ 올바른 예시 - throw로 재시도 트리거
async process(job: Job): Promise<any> {
  try {
    await this.doSomething();
    return { success: true };
  } catch (error) {
    this.logger.error('에러 발생', error);
    throw error; // 반드시 throw!
  }
}

// ❌ 잘못된 예시 - throw 없음 (재시도 안됨)
async process(job: Job): Promise<any> {
  try {
    await this.doSomething();
  } catch (error) {
    this.logger.error('에러 발생', error);
    // throw 없음! BullMQ는 성공으로 간주
  }
}
```

---

## 🚨 중요 규칙

### 절대 금지 사항

- ❌ **any 타입 사용**
- ❌ **에러를 catch만 하고 throw 안함** (재시도 안됨)
- ❌ **환경변수 하드코딩**
- ❌ **new Date() 사용** (getNowKST() 사용)

### 필수 사항

- ✅ **Logger 사용** (console.log 금지)
- ✅ **환경변수는 ConfigService로 관리**
- ✅ **DB 작업은 트랜잭션으로**
- ✅ **스키마 변경 시 다른 프로젝트도 동기화**

---

## 🐳 로컬 개발 환경

```bash
# Redis 실행
docker-compose up -d

# Worker 실행
npm run start:dev

# Bull Board 접속
http://localhost:4001/admin/queues
```

---

## 📝 커밋 규칙

```
feat: 새 기능
fix: 버그 수정
refactor: 리팩토링
docs: 문서 수정
test: 테스트 코드
chore: 빌드, 패키지 등
```

---

**최종 업데이트**: 2025-12-15
