# biocom-mq

> **BullMQ 기반 비동기 작업 처리 Worker**
>
> 푸시 알림 발송, 앱 이벤트 로깅, 주문 상태 동기화 등 비동기 작업을 처리합니다.

## 🎯 프로젝트 개요

biocom-mq는 biocom-api와 분리된 독립적인 Message Queue Consumer Backend입니다.

- **Producer**: biocom-api (API 요청 처리 후 Queue에 Job 추가)
- **Consumer**: biocom-mq (Queue에서 Job 처리)
- **Queue Backend**: Redis (GCP Memorystore)

### 핵심 기능

✅ FCM 푸시 알림 발송 (단일/다중/전체)
✅ 앱 이벤트 로깅 (사용자 행동 추적)
✅ 플레이오토 주문 상태 동기화
✅ 지수 백오프 Retry 전략
✅ Bull Board UI를 통한 Queue 모니터링
✅ Health Check 및 Metrics API

> **Note**: Neo4j 그래프 DB 동기화 기능은 deprecated되었습니다. 해당 기능은 별도 Python 서버에서 처리 예정입니다.

## 🚀 Quick Start

### Prerequisites

```bash
Node.js >= 20.0.0
Docker >= 24.0.0
Docker Compose >= 2.20.0
```

### Local Development Setup

1. **환경 변수 설정**

```bash
cp .env.example .env
# .env 파일을 열어서 아래 값들을 설정하세요
```

필수 환경 변수:
```bash
# Redis (Local Docker)
REDIS_HOST=localhost
REDIS_PORT=6379

# Firebase (푸시 알림용)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key

# Database
DATABASE_URL=postgresql://...

# Application
PORT=4001
NODE_ENV=development
LOG_LEVEL=debug
```

2. **Docker Compose로 Redis 실행**

```bash
docker-compose up -d
```

이 명령으로 다음 서비스들이 실행됩니다:
- Redis (localhost:6379)
- Redis Commander (localhost:8081) - Redis GUI

3. **패키지 설치**

```bash
npm install
```

4. **Worker 실행**

```bash
# 개발 모드 (Hot Reload)
npm run start:dev

# 프로덕션 모드
npm run build
npm run start:prod
```

5. **Bull Board 접속**

```
http://localhost:4001/admin/queues
```

Worker가 실행되면 Bull Board UI에서 모든 Queue의 상태를 실시간으로 확인할 수 있습니다.

## 📊 Queue 구조

| Queue Name | 처리 기능 | 설명 |
|-----------|----------|------|
| push-notification | FCM 푸시 알림 | 단일/다중/전체 사용자 푸시 발송 |
| app-event | 앱 이벤트 로깅 | 사용자 행동 이벤트 DB 저장 |
| order-sync | 주문 상태 동기화 | 플레이오토 ERP 주문 상태 연동 |

### Queue 공통 설정

```typescript
QUEUE_OPTIONS = {
  attempts: 3,           // 최대 3회 재시도
  backoff: exponential,  // 지수 백오프 (1초부터 시작)
  removeOnComplete: 100, // 완료된 작업 최대 100개 보관
  removeOnFail: 1000     // 실패한 작업 최대 1000개 보관
}
```

## 🏗️ 아키텍처

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│             │         │             │         │             │
│  biocom-api │ ──────> │    Redis    │ ──────> │  biocom-mq  │
│  (Producer) │  Job    │   (Queue)   │  Job    │ (Consumer)  │
│             │         │             │         │             │
└─────────────┘         └─────────────┘         └─────────────┘
                                                       │
                                      ┌────────────────┼────────────────┐
                                      │                │                │
                                      ▼                ▼                ▼
                               ┌───────────┐   ┌───────────┐   ┌───────────┐
                               │    FCM    │   │  Prisma   │   │ Playauto  │
                               │  (Push)   │   │   (DB)    │   │  (ERP)    │
                               └───────────┘   └───────────┘   └───────────┘
```

## 📁 프로젝트 구조

```
biocom-mq/
├── src/
│   ├── main.ts                       # 애플리케이션 진입점
│   ├── app.module.ts                 # Root Module
│   ├── config/                       # 설정 파일
│   │   └── configuration.ts          # ConfigService 설정
│   ├── queues/                       # Queue 관련
│   │   └── queues.module.ts          # Queue 등록 및 설정
│   ├── processors/                   # Job Processor 구현
│   │   ├── base.processor.ts         # 추상 Base Processor
│   │   ├── push-notification.processor.ts  # 푸시 알림 처리
│   │   ├── app-event.processor.ts    # 앱 이벤트 저장
│   │   └── order-sync.processor.ts   # 주문 상태 동기화
│   ├── push/                         # 푸시 관련
│   │   ├── firebase-admin.module.ts  # Firebase Admin SDK
│   │   └── providers/
│   │       └── fcm.provider.ts       # FCM 발송 Provider
│   ├── common/                       # 공통 유틸리티
│   │   └── utils/
│   │       └── kst-date.util.ts      # KST 날짜 처리
│   └── health/                       # Health Check
│       ├── health.module.ts
│       └── health.controller.ts
├── prisma/
│   └── schema.prisma                 # DB 스키마 (biocom-api와 공유)
├── docker-compose.yml                # Local Redis 실행
├── Dockerfile                        # Multi-stage Docker Build
├── .env.example                      # 환경 변수 예제
├── tsconfig.json
├── package.json
└── nest-cli.json
```

## 📬 푸시 알림 상세

### 발송 유형

| 타입 | 설명 | Job 데이터 |
|-----|------|----------|
| `user` | 단일 사용자 | `{ type: 'user', userId, title, body, data? }` |
| `users` | 특정 사용자 그룹 | `{ type: 'users', userIds[], title, body, data? }` |
| `all` | 전체 사용자 | `{ type: 'all', title, body, data?, marketingOnly? }` |

### 푸시 타입 분류

```typescript
enum PushType {
  SYSTEM,        // 시스템 공지 (점검, 업데이트)
  REMIND,        // 리마인더 (챌린지, 미션)
  MARKETING,     // 마케팅 (이벤트, 쿠폰)
  TRANSACTIONAL, // 거래 알림 (주문, 배송)
  ETC            // 기타
}
```

### 주요 기능

- FCM 배치 처리 (500개 기기 단위)
- 무효한 토큰 자동 비활성화
- PushNotificationLog에 상세 기록
- PushToken 통계 업데이트 (성공/실패 카운트)

## 📦 주문 동기화 상세

### 플레이오토 상태 매핑

| 플레이오토 상태 | Order Status | Shipping Status |
|---------------|--------------|-----------------|
| 결제완료 | PAID | PENDING |
| 출고완료 | SHIPPING | IN_TRANSIT |
| 배송완료 | DELIVERED | DELIVERED |
| 구매결정/판매완료 | COMPLETED | - |

### 특징

- 상태 역행 방지 (우선순위 기반)
- OrderStateLog 자동 생성
- 트랜잭션 처리로 데이터 일관성 보장

## 🔧 주요 명령어

### 개발

```bash
# 개발 서버 실행
npm run start:dev

# 빌드
npm run build

# 프로덕션 실행
npm run start:prod

# 린트
npm run lint

# 포맷팅
npm run format
```

### Docker

```bash
# Local Redis 실행
docker-compose up -d

# Local Redis 종료
docker-compose down

# Redis CLI 접속
docker exec -it biocom-mq-redis redis-cli

# Redis 모니터링
docker exec -it biocom-mq-redis redis-cli MONITOR
```

## 🌐 API Endpoints

### Health Check

```bash
GET /health

# Response
{
  "status": "ok",
  "info": {
    "redis": { "status": "up" }
  }
}
```

### Bull Board

```bash
# Queue 관리 UI
http://localhost:4001/admin/queues
```

Bull Board에서 할 수 있는 것:
- 모든 Queue의 실시간 상태 확인
- Job 목록 조회 (Active, Waiting, Completed, Failed)
- 개별 Job 상세 정보 및 로그 확인
- Failed Job 재시도
- Queue 일시 중지/재개

## 🚢 Deployment (GCP/GKE)

### Application 배포

```bash
./infra-gcp/scripts/02-deploy-app.sh --project-id api-dev-biocom --yes
```

이 스크립트는 다음을 수행합니다:
- Docker 이미지 빌드 및 Artifact Registry 푸시
- Kubernetes ConfigMap, Secret 생성
- Worker Deployment 배포
- HPA (Horizontal Pod Autoscaler) 설정

## 📊 Monitoring

### Kubernetes

```bash
# Pod 상태 확인
kubectl get pods -n biocom-api

# Pod 로그 확인
kubectl logs -f deployment/biocom-mq -n biocom-api

# HPA 상태 확인
kubectl get hpa -n biocom-api
```

### Bull Board (Production)

```bash
# Port Forward로 접속
kubectl port-forward svc/biocom-mq 4001:4001 -n biocom-api

# Browser에서 접속
http://localhost:4001/admin/queues
```

## 🐛 Troubleshooting

### Worker가 Job을 처리하지 않음

**증상**: Bull Board에서 Job이 Waiting 상태로 계속 머물러 있음

**해결**:
```bash
# 1. Pod 상태 확인
kubectl get pods -n biocom-api

# 2. Pod 로그 확인
kubectl logs -f deployment/biocom-mq -n biocom-api

# 3. Redis 연결 확인
kubectl exec -it <pod-name> -n biocom-api -- sh
nc -zv $REDIS_HOST $REDIS_PORT
```

### 푸시 알림이 발송되지 않음

**원인**:
1. Firebase 인증 정보 오류
2. 무효한 FCM 토큰
3. FCM 서버 오류

**해결**:
```bash
# 1. Secret 확인
kubectl get secret biocom-mq-secrets -n biocom-api -o yaml

# 2. 환경 변수 확인
kubectl exec -it <pod-name> -n biocom-api -- env | grep FIREBASE

# 3. Bull Board에서 Failed Job 에러 메시지 확인
```

### Job이 계속 실패함

**해결**:
```bash
# 1. Bull Board에서 Failed Job 확인
http://localhost:4001/admin/queues

# 2. Job 데이터 및 Error Stack 확인
# (Bull Board UI에서 개별 Job 클릭)

# 3. Worker 로그 확인
kubectl logs -f deployment/biocom-mq -n biocom-api | grep ERROR
```

## 📚 기술 스택

| 구분 | 기술 | 버전 |
|-----|------|-----|
| 메시지큐 | BullMQ | 5.1.0 |
| 캐시 | Redis (ioredis) | 5.3.2 |
| 푸시 | Firebase Admin SDK | 13.6.0 |
| DB | Prisma | 6.19.0 |
| 프레임워크 | NestJS | 10.0.0 |
| 모니터링 | Bull Board | 5.23.0 |

## 📝 Commit Convention

```bash
feat: 새로운 기능 추가
fix: 버그 수정
refactor: 코드 리팩토링
docs: 문서 수정
chore: 빌드, 패키지 등
```

---

* 작성자: 엄신우
* 작성일: 24/12/01
* 수정일: 24/12/18
