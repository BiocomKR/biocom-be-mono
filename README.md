# biocom-mq

> **BullMQ 기반 비동기 그래프 데이터베이스 동기화 Worker**
>
> biocom-api의 PostgreSQL 데이터를 Neo4j Graph Database로 비동기 동기화하여 AI 에이전트가 활용할 수 있도록 지원합니다.

## 🎯 프로젝트 개요

biocom-mq는 biocom-api와 분리된 독립적인 Message Queue Consumer Backend입니다.

- **Producer**: biocom-api (PostgreSQL 저장 후 Queue에 Job 추가)
- **Consumer**: biocom-mq (Queue에서 Job 처리하여 Neo4j 동기화)
- **Queue Backend**: Redis (GCP Memorystore)
- **Target DB**: Neo4j Graph Database (Neo4j Aura)

### 핵심 기능

✅ 9개 데이터 타입별 독립 Queue 운영
✅ 지수 백오프 Retry 전략
✅ Dead Letter Queue (DLQ) 관리
✅ Bull Board UI를 통한 Queue 모니터링
✅ Health Check 및 Metrics API
✅ GKE 기반 Auto Scaling

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

# Neo4j Aura (실제 인스턴스)
NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password-here

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

| Queue Name | 처리 데이터 | Neo4j Node Types |
|-----------|------------|-----------------|
| graph-sync-user | 사용자 정보 | User |
| graph-sync-allergy | 알러지 보고서 | AllergyReport |
| graph-sync-mission | 미션 수행 | Mission, Date |
| graph-sync-balance-game | 밸런스 게임 | BalanceGame, Date |
| graph-sync-beauty | 뷰티 기록 | Beauty, Date |
| graph-sync-food | 식단 기록 | Food, Date |
| graph-sync-fasting | 단식 기록 | Fasting, Date |
| graph-sync-sleep | 수면 기록 | Sleep, Date |
| graph-sync-activity | 활동 기록 | DailyActivity, Activity, ActivityType, Date |

## 🏗️ 아키텍처

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│             │         │             │         │             │
│  biocom-api │ ──────> │    Redis    │ ──────> │  biocom-mq  │
│  (Producer) │  Job    │   (Queue)   │  Job    │ (Consumer)  │
│             │         │             │         │             │
└─────────────┘         └─────────────┘         └─────────────┘
                                                        │
                                                        │ Cypher
                                                        ▼
                                                ┌─────────────┐
                                                │             │
                                                │   Neo4j     │
                                                │  Graph DB   │
                                                │             │
                                                └─────────────┘
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
│   │   ├── queues.module.ts          # Queue Module
│   │   ├── processors/               # Job Processor 구현
│   │   │   ├── base.processor.ts     # 추상 Base Processor
│   │   │   ├── user-sync.processor.ts
│   │   │   ├── allergy-sync.processor.ts
│   │   │   ├── mission-sync.processor.ts
│   │   │   ├── balance-game-sync.processor.ts
│   │   │   ├── beauty-sync.processor.ts
│   │   │   ├── food-sync.processor.ts
│   │   │   ├── fasting-sync.processor.ts
│   │   │   ├── sleep-sync.processor.ts
│   │   │   └── activity-sync.processor.ts
│   │   └── types/                    # Queue Job 타입 정의
│   │       └── job-data.types.ts
│   ├── neo4j/                        # Neo4j 관련
│   │   ├── neo4j.module.ts           # Neo4j Module
│   │   ├── neo4j.service.ts          # Neo4j Connection Service
│   │   ├── queries/                  # Cypher Query 파일
│   │   │   ├── user.cypher.ts
│   │   │   ├── allergy.cypher.ts
│   │   │   ├── mission.cypher.ts
│   │   │   ├── balance-game.cypher.ts
│   │   │   ├── beauty.cypher.ts
│   │   │   ├── food.cypher.ts
│   │   │   ├── fasting.cypher.ts
│   │   │   ├── sleep.cypher.ts
│   │   │   └── activity.cypher.ts
│   │   └── types/                    # Neo4j 데이터 타입
│   │       └── neo4j-data.types.ts
│   └── health/                       # Health Check
│       ├── health.module.ts
│       └── health.controller.ts
├── test/                             # 테스트 코드
│   ├── unit/                         # 단위 테스트
│   └── integration/                  # 통합 테스트
├── docker-compose.yml                # Local Redis 실행
├── Dockerfile                        # Multi-stage Docker Build
├── .env.example                      # 환경 변수 예제
├── tsconfig.json
├── package.json
└── nest-cli.json
```

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

### 테스트

```bash
# 전체 테스트
npm run test

# 단위 테스트
npm run test:unit

# 통합 테스트
npm run test:integration

# 커버리지
npm run test:cov
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
    "redis": { "status": "up" },
    "neo4j": { "status": "up" }
  }
}
```

### Metrics

```bash
GET /metrics

# Response (Prometheus 형식)
# HELP queue_jobs_total Total number of jobs
# TYPE queue_jobs_total counter
queue_jobs_total{queue="graph-sync-user",status="completed"} 1234
queue_jobs_total{queue="graph-sync-user",status="failed"} 5
...
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
- Job 수동 추가 (테스트용)

## 🚢 Deployment (GCP/GKE)

### 1. Infrastructure 배포

```bash
cd infra-gcp
./scripts/01-deploy-infrastructure.sh
```

이 스크립트는 다음을 생성합니다:
- Redis Memorystore 인스턴스 (M1, 1GB)

### 2. Application 배포

```bash
./scripts/02-deploy-app.sh
```

이 스크립트는 다음을 수행합니다:
- Docker 이미지 빌드 및 Artifact Registry 푸시
- Kubernetes ConfigMap, Secret 생성
- Worker Deployment 배포 (초기 1 replica)
- HPA (Horizontal Pod Autoscaler) 설정
- Service 생성

### 환경별 배포

```bash
# Development
./scripts/02-deploy-app.sh dev

# Production
./scripts/02-deploy-app.sh prod
```

## 📊 Monitoring

### Kubernetes

```bash
# Pod 상태 확인
kubectl get pods -n biocom-mq

# Pod 로그 확인
kubectl logs -f deployment/biocom-mq-worker -n biocom-mq

# HPA 상태 확인
kubectl get hpa -n biocom-mq

# Pod 상세 정보
kubectl describe pod <pod-name> -n biocom-mq
```

### Bull Board (Production)

```bash
# Port Forward로 접속
kubectl port-forward svc/biocom-mq-worker 4001:4001 -n biocom-mq

# Browser에서 접속
http://localhost:4001/admin/queues
```

### Redis (Production)

```bash
# Cloud Console에서 Memorystore 모니터링
# - CPU 사용률
# - 메모리 사용률
# - 초당 명령 수
# - 연결 수
```

### Neo4j (Production)

```bash
# Neo4j Aura Console에서 모니터링
# - Query 성능
# - 노드/관계 수
# - 메모리 사용량
# - 연결 수
```

## 🐛 Troubleshooting

### Worker가 Job을 처리하지 않음

**증상**: Bull Board에서 Job이 Waiting 상태로 계속 머물러 있음

**원인**:
1. Worker Pod가 실행되지 않음
2. Redis 연결 실패
3. Processor 에러

**해결**:
```bash
# 1. Pod 상태 확인
kubectl get pods -n biocom-mq

# 2. Pod 로그 확인
kubectl logs -f deployment/biocom-mq-worker -n biocom-mq

# 3. Redis 연결 확인
kubectl exec -it <pod-name> -n biocom-mq -- sh
nc -zv $REDIS_HOST $REDIS_PORT
```

### Neo4j 연결 실패

**증상**: 로그에 "Neo4j connection failed" 에러

**원인**:
1. Neo4j Aura 인스턴스 중지됨
2. 잘못된 인증 정보
3. 네트워크 이슈

**해결**:
```bash
# 1. Secret 확인
kubectl get secret biocom-mq-secrets -n biocom-mq -o yaml

# 2. 환경 변수 확인
kubectl exec -it <pod-name> -n biocom-mq -- env | grep NEO4J

# 3. Neo4j Aura Console에서 인스턴스 상태 확인

# 4. Worker Pod 재시작
kubectl rollout restart deployment/biocom-mq-worker -n biocom-mq
```

### Job이 계속 실패함

**증상**: Bull Board에서 Failed Job이 계속 쌓임

**원인**:
1. 잘못된 Job 데이터
2. Neo4j Schema 불일치
3. Cypher Query 오류

**해결**:
```bash
# 1. Bull Board에서 Failed Job 확인
http://localhost:4001/admin/queues

# 2. Job 데이터 및 Error Stack 확인
# (Bull Board UI에서 개별 Job 클릭)

# 3. Worker 로그 확인
kubectl logs -f deployment/biocom-mq-worker -n biocom-mq | grep ERROR

# 4. Neo4j에서 직접 Cypher 쿼리 테스트
# (Neo4j Browser에서 해당 Cypher 실행)

# 5. 필요시 Job 수동 재시도
# (Bull Board UI에서 Retry 버튼)
```

### Redis 메모리 부족

**증상**: Redis에서 OOM 에러

**원인**:
1. 완료된 Job이 쌓임 (removeOnComplete 설정 확인)
2. Failed Job이 너무 많음
3. Redis 인스턴스 크기 부족

**해결**:
```bash
# 1. Redis 메모리 사용량 확인
# (GCP Console > Memorystore)

# 2. Queue 설정 확인 (src/queues/queues.module.ts)
removeOnComplete: { count: 100 },  # 최근 100개만 유지
removeOnFailed: { count: 1000 },   # 실패 1000개 유지

# 3. Bull Board에서 오래된 Job 수동 삭제

# 4. Redis 인스턴스 스케일업 (필요시)
gcloud redis instances update biocom-mq-redis \
  --size=2 \
  --region=asia-northeast3
```

## 📚 관련 문서

- [PROJECT_SPEC.md](./PROJECT_SPEC.md) - 전체 프로젝트 기술 명세
- [CLAUDE.md](./CLAUDE.md) - AI 에이전트용 개발 가이드
- [BIOCOM_GRAPH_DB.md](./BIOCOM_GRAPH_DB.md) - Neo4j Schema 및 Cypher 쿼리
- [HANDOVER.md](./HANDOVER.md) - 인수인계 문서

## 🤝 Contributing

### Commit Convention

```bash
feat: 새로운 기능 추가
fix: 버그 수정
refactor: 코드 리팩토링
docs: 문서 수정
test: 테스트 코드
chore: 빌드, 패키지 등
```

### 개발 Workflow

1. Feature 브랜치 생성
2. 코드 작성 및 테스트
3. Lint & Format 확인
4. PR 생성
5. 코드 리뷰 후 Merge

## 📝 License

Proprietary - 바이브코딩

## 👥 Team

- Backend Lead: [형님]
- AI Assistant: Claude Code

---

**Last Updated**: 2025-12-01
**Version**: 1.0.0
