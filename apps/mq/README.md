# biocom-mq

> **BullMQ 기반 비동기 메시지 큐 Worker**
>
> biocom-api의 백그라운드 작업을 비동기로 처리하여 트래픽 분산 및 안정적인 서비스 운영을 지원합니다.

## 🎯 프로젝트 개요

biocom-mq는 biocom-api와 분리된 독립적인 Message Queue Consumer Backend입니다.

- **Producer**: biocom-api, biocom-bo-api (PostgreSQL 저장 후 Queue에 Job 추가)
- **Consumer**: biocom-mq (Queue에서 Job 처리)
- **Queue Backend**: Redis (GCP Memorystore)
- **Target DB**: PostgreSQL (GCP Cloud SQL)

### 핵심 기능

✅ 3개 도메인별 독립 Queue 운영
✅ 지수 백오프 Retry 전략
✅ Bull Board UI를 통한 Queue 모니터링
✅ Health Check API
✅ GKE 기반 Auto Scaling

## 📊 Queue 구조

| Queue Name | 처리 내용 | 설명 |
|-----------|----------|------|
| app-event | 앱 이벤트 로깅 | GA4 스타일 앱 이벤트 DB 저장 |
| push-notification | 푸시 알림 발송 | FCM 기반 푸시 메시지 발송 |
| order-sync | 주문 상태 동기화 | 플레이오토 배송 상태 DB 반영 |

## 🏗️ 아키텍처

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│             │         │             │         │             │
│  biocom-api │ ──────> │    Redis    │ ──────> │  biocom-mq  │
│  (Producer) │  Job    │   (Queue)   │  Job    │ (Consumer)  │
│             │         │             │         │             │
└─────────────┘         └─────────────┘         └─────────────┘
                                                        │
                                                        │ Prisma
                                                        ▼
                                                ┌─────────────┐
                                                │             │
                                                │ PostgreSQL  │
                                                │  + FCM      │
                                                │             │
                                                └─────────────┘
```

## 🚀 Quick Start

### Prerequisites

```bash
Node.js >= 20.0.0
Docker >= 24.0.0
```

### Local Development Setup

1. **환경 변수 설정**

```bash
cp .env.example .env
```

필수 환경 변수:
```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Database
DATABASE_URL="postgresql://..."

# Application
PORT=4001
NODE_ENV=development
```

2. **Docker Compose로 Redis 실행**

```bash
docker-compose up -d
```

3. **패키지 설치 및 실행**

```bash
npm install
npm run start:dev
```

4. **Bull Board 접속**

```
http://localhost:4001/admin/queues
```

## 📁 프로젝트 구조

### 루트 파일

| 파일 | 용도 |
|-----|------|
| `package.json` | npm 의존성 및 스크립트 |
| `tsconfig.json` | TypeScript 설정 |
| `nest-cli.json` | NestJS CLI 설정 |
| `Dockerfile` | Docker 빌드 설정 |
| `docker-compose.yml` | 로컬 Redis 실행용 |
| `.env.*` | 환경 변수 (local, dev, prod) |
| `HANDOVER.md` | 인수인계 문서 |
| `CLAUDE.md` | Claude AI 가이드라인 |
| `*-firebase-*.json` | Firebase 푸시 알림용 서비스 계정 |

### 폴더 구조

```
biocom-mq/
├── src/
│   ├── main.ts                       # 애플리케이션 진입점
│   ├── app.module.ts                 # Root Module
│   ├── config/                       # 설정 파일
│   ├── common/                       # 공통 유틸리티
│   │   ├── services/prisma.service.ts
│   │   └── utils/kst-date.util.ts
│   ├── processors/                   # Job Processor 구현
│   │   ├── app-event.processor.ts    # 앱 이벤트 처리
│   │   ├── push-notification.processor.ts # 푸시 발송 처리
│   │   └── order-sync.processor.ts   # 주문 동기화 처리
│   ├── push/                         # Firebase 푸시 모듈
│   │   ├── firebase-admin.module.ts
│   │   └── providers/fcm.provider.ts
│   ├── queues/                       # Queue 설정
│   │   └── queues.module.ts
│   └── health/                       # Health Check
├── prisma/
│   └── schema.prisma                 # Prisma 스키마
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## 🔧 주요 명령어

```bash
# 개발 서버 실행
npm run start:dev

# 빌드
npm run build

# 프로덕션 실행
npm run start:prod

# Prisma 클라이언트 생성
npx prisma generate
```

## 🌐 API Endpoints

### Health Check

```bash
GET /health
```

### Bull Board

```bash
http://localhost:4001/admin/queues
```

## 🚢 Deployment (GCP/GKE)

```bash
cd infra-gcp
./scripts/02-deploy-app.sh
```

## 📚 관련 프로젝트

- **biocom-api**: 유저 백엔드 (Producer)
- **biocom-bo-api**: 관리자 백엔드 (Producer)

---

**Last Updated**: 2025-12-15
**Version**: 2.0.0
