# biocom-mq 프로젝트 상세 설계 문서

> **버전**: 1.0.0
> **작성일**: 2025-12-01
> **작성자**: Claude Code
> **프로젝트**: BullMQ 기반 GraphDB 동기화 Worker

---

## 📑 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [시스템 아키텍처](#2-시스템-아키텍처)
3. [기술 스택](#3-기술-스택)
4. [디렉토리 구조](#4-디렉토리-구조)
5. [Queue 설계](#5-queue-설계)
6. [Worker 구현 전략](#6-worker-구현-전략)
7. [Neo4j 연동](#7-neo4j-연동)
8. [에러 처리 및 재시도](#8-에러-처리-및-재시도)
9. [모니터링](#9-모니터링)
10. [배포 전략](#10-배포-전략)

---

## 1. 프로젝트 개요

### 1.1 목적

**biocom-api**에서 발생하는 사용자 기록 데이터를 **Neo4j Graph Database**에 비동기로 동기화하는 Worker 프로젝트

### 1.2 핵심 기능

- **BullMQ Consumer**: Redis Queue에서 메시지 수신
- **Neo4j Writer**: GraphDB에 노드/관계 저장
- **에러 핸들링**: Dead Letter Queue, 자동 재시도
- **모니터링**: Bull Board 대시보드

### 1.3 비기능 요구사항

| 항목 | 요구사항 |
|------|----------|
| **처리량** | 초당 100건 이상 |
| **지연시간** | 평균 1초 이내 |
| **가용성** | 99.9% |
| **확장성** | Worker Pod 수평 확장 |

---

## 2. 시스템 아키텍처

### 2.1 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                      biocom-api                              │
│  - NestJS API Server                                         │
│  - PostgreSQL 저장 (Source of Truth)                         │
│  - BullMQ Producer (Queue에 작업 추가)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │   Redis (GCP Memorystore) │
          │   - BullMQ Queue         │
          │   - 타입별 Queue 분리     │
          └────────────┬───────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     biocom-mq (이 프로젝트)                   │
│  - NestJS Worker                                             │
│  - BullMQ Consumer                                           │
│  - Neo4j Driver                                              │
│  - GraphDB 동기화 Processor                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │   Neo4j Aura            │
          │   - Graph Database      │
          │   - AI 에이전트 쿼리용   │
          └────────────────────────┘
```

### 2.2 데이터 흐름

```
사용자 기록 생성 (biocom-api)
  │
  ├─→ PostgreSQL 저장 (즉시) ✅
  │
  └─→ Queue.add('graph-sync-beauty', data) (비동기) 🔄
           │
           ▼
      Redis Queue 적재
           │
           ▼
      biocom-mq Worker 처리
           │
           ├─→ Neo4j에 노드/관계 저장
           │
           ├─→ 성공 시: Job 완료 ✅
           │
           └─→ 실패 시: 재시도 (최대 3회) 🔁
                   │
                   └─→ 3회 실패 시: Dead Letter Queue 📮
```

---

## 3. 기술 스택

### 3.1 프레임워크

| 항목 | 기술 | 버전 | 이유 |
|------|------|------|------|
| **Runtime** | Node.js | 20.x | LTS |
| **Framework** | NestJS | 10.x | 타입 안전성, DI |
| **Language** | TypeScript | 5.x | 타입 체크 |

### 3.2 핵심 라이브러리

| 항목 | 라이브러리 | 버전 | 용도 |
|------|-----------|------|------|
| **Queue** | BullMQ | 5.x | 메시지 큐 |
| **GraphDB** | neo4j-driver | 5.x | Neo4j 연결 |
| **Redis** | ioredis | 5.x | Redis 클라이언트 |
| **Monitoring** | @bull-board/nestjs | 5.x | Queue 모니터링 |

### 3.3 개발 도구

- **Linter**: ESLint
- **Formatter**: Prettier
- **Test**: Jest
- **Docker**: Multi-stage build

---

## 4. 디렉토리 구조

```
biocom-mq/
├── src/
│   ├── app.module.ts                # 루트 모듈
│   ├── main.ts                      # 애플리케이션 엔트리
│   │
│   ├── config/                      # 설정
│   │   ├── redis.config.ts
│   │   ├── neo4j.config.ts
│   │   └── queue.config.ts
│   │
│   ├── neo4j/                       # Neo4j 모듈
│   │   ├── neo4j.module.ts
│   │   ├── neo4j.service.ts
│   │   └── cypher/                  # Cypher 쿼리
│   │       ├── user.cypher.ts
│   │       ├── beauty.cypher.ts
│   │       ├── food.cypher.ts
│   │       └── ...
│   │
│   ├── processors/                  # BullMQ Processor
│   │   ├── beauty.processor.ts
│   │   ├── food.processor.ts
│   │   ├── fasting.processor.ts
│   │   ├── sleep.processor.ts
│   │   ├── activity.processor.ts
│   │   └── base.processor.ts        # 공통 로직
│   │
│   ├── types/                       # 타입 정의
│   │   ├── queue.types.ts
│   │   ├── neo4j.types.ts
│   │   └── biocom-api.types.ts      # biocom-api 응답 타입
│   │
│   └── monitoring/                  # 모니터링
│       ├── monitoring.module.ts
│       └── health.controller.ts
│
├── docs/                            # 문서
│   ├── ARCHITECTURE.md
│   ├── QUEUE_DESIGN.md
│   ├── GRAPHDB_SCHEMA.md
│   └── DEPLOYMENT.md
│
├── infra/                           # 인프라
│   ├── k8s/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── secret.yaml
│   └── scripts/
│       └── deploy.sh
│
├── .env.example
├── Dockerfile
├── docker-compose.yml               # 로컬 개발용
├── package.json
├── tsconfig.json
├── CLAUDE.md                        # AI 개발 가이드
├── README.md
└── HANDOVER.md
```

---

## 5. Queue 설계

### 5.1 Queue 네이밍 전략

**형식**: `graph-sync-{type}`

| Queue 이름 | 목적 | 데이터 소스 |
|-----------|------|------------|
| `graph-sync-beauty` | 뷰티 점수 동기화 | `GET /api/tracking/statistics/ai-agent` |
| `graph-sync-food` | 식단 기록 동기화 | 위와 동일 |
| `graph-sync-fasting` | 단식 기록 동기화 | 위와 동일 |
| `graph-sync-sleep` | 수면 기록 동기화 | 위와 동일 |
| `graph-sync-activity` | 활동 기록 동기화 | 위와 동일 |
| `graph-sync-user` | 사용자 프로필 동기화 | 위와 동일 |
| `graph-sync-allergy` | 알러지 검사 동기화 | 위와 동일 |
| `graph-sync-mission` | 1일1미션 동기화 | 위와 동일 |
| `graph-sync-balance-game` | 밸런스게임 동기화 | 위와 동일 |

### 5.2 Job Data 구조

```typescript
// graph-sync-beauty
interface BeautySyncJob {
  chartId: string;           // "TA11150002"
  dateId: string;            // "TA11150002_2025-11-28"
  date: string;              // "2025-11-28"
  totalScore: number;
  innerBeautyScore: number;
  outerBeautyScore: number;
  innerBeautyDetails: { no: number; score: number }[];
  outerBeautyDetails: { no: number; score: number }[];
}

// graph-sync-food
interface FoodSyncJob {
  chartId: string;
  dateId: string;
  date: string;
  foods: Array<{
    foodId: string;
    foodName: string;
    dietType: string;
    isFasting: boolean;
    imageUrl?: string;
    allergyFoods: { name: string; level: number }[];
    allergyScore: number;
    processedCount: number;
    processedFoods: string[];
    highFodmapCount: number;
    highFodmapFoods: string[];
  }>;
}

// 기타 Queue도 동일한 패턴
```

### 5.3 Queue 옵션

```typescript
{
  defaultJobOptions: {
    attempts: 3,                   // 최대 재시도 3회
    backoff: {
      type: 'exponential',         // 지수 백오프
      delay: 1000                  // 1초 -> 2초 -> 4초
    },
    removeOnComplete: 100,         // 완료된 Job 100개만 유지
    removeOnFail: 1000             // 실패한 Job 1000개 유지 (디버깅용)
  }
}
```

---

## 6. Worker 구현 전략

### 6.1 Base Processor (공통 로직)

```typescript
// src/processors/base.processor.ts
export abstract class BaseProcessor {
  protected readonly logger: Logger;

  constructor(
    protected readonly neo4jService: Neo4jService
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Job 처리 전 공통 로직
   */
  protected async preProcess(job: Job): Promise<void> {
    this.logger.log(`Job 시작: ${job.id}, 시도: ${job.attemptsMade + 1}/${job.opts.attempts}`);
  }

  /**
   * Job 처리 후 공통 로직
   */
  protected async postProcess(job: Job): Promise<void> {
    this.logger.log(`Job 완료: ${job.id}`);
  }

  /**
   * 에러 처리 공통 로직
   */
  protected async handleError(job: Job, error: Error): Promise<void> {
    this.logger.error(`Job 실패: ${job.id}`, error.stack);

    // Slack 알람 (선택)
    if (job.attemptsMade >= job.opts.attempts) {
      await this.sendSlackAlert(job, error);
    }
  }
}
```

### 6.2 Beauty Processor 예시

```typescript
// src/processors/beauty.processor.ts
@Processor('graph-sync-beauty')
export class BeautyProcessor extends BaseProcessor {

  @Process()
  async process(job: Job<BeautySyncJob>): Promise<void> {
    await this.preProcess(job);

    try {
      const { chartId, dateId, date, ...beautyData } = job.data;

      // Neo4j에 저장
      await this.neo4jService.syncBeauty({
        chartId,
        dateId,
        date,
        totalScore: beautyData.totalScore,
        innerBeautyScore: beautyData.innerBeautyScore,
        outerBeautyScore: beautyData.outerBeautyScore,
        innerBeautyDetails: JSON.stringify(beautyData.innerBeautyDetails),
        outerBeautyDetails: JSON.stringify(beautyData.outerBeautyDetails)
      });

      await this.postProcess(job);
    } catch (error) {
      await this.handleError(job, error);
      throw error; // BullMQ가 재시도 처리
    }
  }
}
```

---

## 7. Neo4j 연동

### 7.1 Neo4j Service

```typescript
// src/neo4j/neo4j.service.ts
@Injectable()
export class Neo4jService implements OnModuleDestroy {
  private driver: Driver;

  constructor(private configService: ConfigService) {
    this.driver = neo4j.driver(
      this.configService.get('NEO4J_URI'),
      neo4j.auth.basic(
        this.configService.get('NEO4J_USERNAME'),
        this.configService.get('NEO4J_PASSWORD')
      )
    );
  }

  /**
   * Beauty 노드 동기화 (MERGE 방식)
   */
  async syncBeauty(data: BeautySyncData): Promise<void> {
    const session = this.driver.session();

    try {
      await session.run(BEAUTY_SYNC_QUERY, {
        chartId: data.chartId,
        dateId: data.dateId,
        date: data.date,
        totalScore: data.totalScore,
        innerBeautyScore: data.innerBeautyScore,
        outerBeautyScore: data.outerBeautyScore,
        innerBeautyDetails: data.innerBeautyDetails,
        outerBeautyDetails: data.outerBeautyDetails
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Food 노드 동기화 (DELETE + CREATE 방식)
   */
  async syncFood(data: FoodSyncData): Promise<void> {
    const session = this.driver.session();

    try {
      // 트랜잭션으로 처리
      await session.writeTransaction(async (tx) => {
        // Step 1: 기존 Food 삭제
        await tx.run(FOOD_DELETE_QUERY, {
          chartId: data.chartId,
          dateId: data.dateId
        });

        // Step 2: 새 Food 생성
        await tx.run(FOOD_CREATE_QUERY, {
          chartId: data.chartId,
          dateId: data.dateId,
          date: data.date,
          foods: data.foods
        });
      });
    } finally {
      await session.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.driver.close();
  }
}
```

### 7.2 Cypher 쿼리 관리

```typescript
// src/neo4j/cypher/beauty.cypher.ts
export const BEAUTY_SYNC_QUERY = `
MATCH (u:User {chart_id: $chartId})
MERGE (u)-[:HAS_DATE]->(d:Date {date_id: $dateId})
ON CREATE SET
  d.date = date($date),
  d.created_at = datetime()

MERGE (d)-[:HAS_BEAUTY]->(b:Beauty {date_id: $dateId})
ON CREATE SET
  b.created_at = datetime()
SET
  b.total_score = $totalScore,
  b.inner_beauty_score = $innerBeautyScore,
  b.outer_beauty_score = $outerBeautyScore,
  b.inner_beauty_details = $innerBeautyDetails,
  b.outer_beauty_details = $outerBeautyDetails,
  b.score = $totalScore,
  b.updated_at = datetime()

RETURN b
`;
```

---

## 8. 에러 처리 및 재시도

### 8.1 재시도 전략

| 항목 | 설정 |
|------|------|
| **최대 재시도 횟수** | 3회 |
| **백오프 타입** | Exponential |
| **초기 지연** | 1초 |
| **최대 지연** | 60초 |

### 8.2 에러 분류

```typescript
export enum ErrorType {
  TRANSIENT = 'TRANSIENT',      // 재시도 가능 (네트워크 오류 등)
  PERMANENT = 'PERMANENT',      // 재시도 불가 (데이터 오류 등)
  UNKNOWN = 'UNKNOWN'
}

export function classifyError(error: Error): ErrorType {
  // Neo4j 연결 오류 → TRANSIENT
  if (error.message.includes('ServiceUnavailable')) {
    return ErrorType.TRANSIENT;
  }

  // 데이터 검증 오류 → PERMANENT
  if (error.message.includes('Invalid')) {
    return ErrorType.PERMANENT;
  }

  return ErrorType.UNKNOWN;
}
```

### 8.3 Dead Letter Queue

```typescript
@OnQueueFailed()
async onFailed(job: Job, error: Error) {
  if (job.attemptsMade >= job.opts.attempts) {
    // DLQ로 이동
    await this.deadLetterQueue.add('failed-job', {
      originalQueue: job.queue.name,
      jobId: job.id,
      jobData: job.data,
      error: error.message,
      timestamp: new Date()
    });
  }
}
```

---

## 9. 모니터링

### 9.1 Bull Board (Queue 대시보드)

```typescript
// src/monitoring/monitoring.module.ts
@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter
    }),
    BullBoardModule.forFeature({
      name: 'graph-sync-beauty',
      adapter: BullMQAdapter
    }),
    // ... 다른 Queue들
  ]
})
export class MonitoringModule {}
```

**접속 URL**: `http://localhost:3000/admin/queues`

### 9.2 Health Check

```typescript
// src/monitoring/health.controller.ts
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }

  @Get('redis')
  async checkRedis(): Promise<{ status: string }> {
    // Redis 연결 체크
  }

  @Get('neo4j')
  async checkNeo4j(): Promise<{ status: string }> {
    // Neo4j 연결 체크
  }
}
```

### 9.3 메트릭

- **처리량**: Job 완료 수 / 초
- **실패율**: 실패 Job 수 / 전체 Job 수
- **지연시간**: Job 추가 → 완료 시간
- **Queue 길이**: 대기 중인 Job 수

---

## 10. 배포 전략

### 10.1 인프라 구조

**biocom-mq는 완전히 별도의 Git 저장소 및 배포 파이프라인**

```
biocom-api (기존)                    biocom-mq (신규)
├── PostgreSQL (Cloud SQL)           ├── Redis (Memorystore) ✨ 신규
├── GKE Deployment (API)             ├── GKE Deployment (Worker) ✨ 신규
└── 기존 배포 스크립트 유지           └── 자체 배포 스크립트 ✨ 신규
```

### 10.2 biocom-mq 인프라 스크립트

#### 01-deploy-infrastructure.sh (Redis 생성)

```bash
#!/bin/bash
# biocom-mq 인프라 구축 스크립트 (Redis Memorystore만 생성)

set -e

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# 기본값
PROJECT_ID=""
REGION="asia-northeast3"
REDIS_INSTANCE_NAME="biocom-redis-dev"
REDIS_TIER="BASIC"
REDIS_MEMORY_SIZE_GB=1

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--project-id)
      PROJECT_ID="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -z "$PROJECT_ID" ]]; then
  echo "Usage: $0 --project-id <PROJECT_ID>"
  exit 1
fi

log_info "GCP 프로젝트 설정: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

# Redis API 활성화
log_info "Redis API 활성화 중..."
gcloud services enable redis.googleapis.com --project="$PROJECT_ID"

# Redis 인스턴스 생성
log_info "Redis 인스턴스 생성 중... (약 5분 소요)"
gcloud redis instances create "$REDIS_INSTANCE_NAME" \
  --region="$REGION" \
  --tier="$REDIS_TIER" \
  --size="$REDIS_MEMORY_SIZE_GB" \
  --project="$PROJECT_ID" \
  --redis-version=redis_7_0 \
  --network=projects/$PROJECT_ID/global/networks/biocom-cluster-dev-vpc \
  || log_info "Redis 인스턴스가 이미 존재합니다."

# Redis IP 확인
REDIS_HOST=$(gcloud redis instances describe "$REDIS_INSTANCE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format="value(host)")

log_success "✅ Redis 인스턴스 생성 완료!"
log_info "Redis Host: $REDIS_HOST"
log_info "Redis Port: 6379"

echo
log_success "🎉 biocom-mq 인프라 구축 완료!"
log_info "다음 단계: ./02-deploy-app.sh --project-id $PROJECT_ID"
```

#### 02-deploy-app.sh (biocom-mq 배포)

```bash
#!/bin/bash
# biocom-mq 애플리케이션 배포 스크립트

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# 기본값
PROJECT_ID=""
CLUSTER_NAME="biocom-cluster-dev"
ZONE="asia-northeast3-a"
REGION="asia-northeast3"
NAMESPACE="biocom-api"
REDIS_INSTANCE_NAME="biocom-redis-dev"

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--project-id)
      PROJECT_ID="$2"
      shift 2
      ;;
    -y|--yes)
      AUTO_APPROVE=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -z "$PROJECT_ID" ]]; then
  echo "Usage: $0 --project-id <PROJECT_ID> [--yes]"
  exit 1
fi

# GCP 인증
log_info "GCP 프로젝트 설정 중..."
gcloud config set project "$PROJECT_ID"

# kubeconfig 설정
log_info "Kubeconfig 설정 중..."
gcloud container clusters get-credentials "$CLUSTER_NAME" \
  --zone="$ZONE" \
  --project="$PROJECT_ID"

# Redis Host 조회
log_info "Redis Host 조회 중..."
REDIS_HOST=$(gcloud redis instances describe "$REDIS_INSTANCE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format="value(host)")

log_info "Redis Host: $REDIS_HOST"

# Docker 이미지 빌드 및 푸시
log_info "🔨 Docker 이미지 빌드 중..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

IMAGE_TAG=$(date +%Y%m%d%H%M%S)
IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-mq:$IMAGE_TAG"
LATEST_URL="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-mq:latest"

docker buildx build \
  --platform linux/amd64 \
  -t "$IMAGE_URL" \
  -t "$LATEST_URL" \
  --push \
  .

log_success "✅ Docker 이미지 푸시 완료: $IMAGE_URL"

# Kubernetes 배포
log_info "☸️  Kubernetes 리소스 배포 중..."
cd "$SCRIPT_DIR/../k8s"

# ConfigMap 업데이트 (Redis Host)
sed -i.bak "s/REDIS_HOST: .*/REDIS_HOST: \"$REDIS_HOST\"/" configmap.yaml
kubectl apply -f configmap.yaml

# Secret 생성
log_info "Secret 생성 중..."
kubectl create secret generic biocom-mq-secrets \
  --namespace="$NAMESPACE" \
  --from-literal=NEO4J_URI="neo4j+s://27c48749.databases.neo4j.io" \
  --from-literal=NEO4J_USERNAME="neo4j" \
  --from-literal=NEO4J_PASSWORD="jqlf6TctHvZk2N4Rc8_Rj_8RUf614PVQz4VPr5F7KjE" \
  --dry-run=client -o yaml | kubectl apply -f -

# Deployment 배포
log_info "Deployment 배포 중..."
sed -i.bak "s|image: .*|image: $IMAGE_URL|" deployment.yaml
kubectl apply -f deployment.yaml

# Service 배포
kubectl apply -f service.yaml

# HPA 배포
kubectl apply -f hpa.yaml

# 배포 상태 확인
log_info "배포 상태 확인 중..."
kubectl rollout status deployment/biocom-mq -n "$NAMESPACE" --timeout=300s

log_success "🎉 biocom-mq 배포 완료!"

echo
log_info "Pod 상태:"
kubectl get pods -n "$NAMESPACE" -l app=biocom-mq

echo
log_info "Service 상태:"
kubectl get svc -n "$NAMESPACE" -l app=biocom-mq

echo
log_info "Bull Board 접속:"
log_info "  kubectl port-forward -n $NAMESPACE svc/biocom-mq 3001:3001"
log_info "  http://localhost:3001/admin/queues"
```

### 10.3 GKE Deployment

```yaml
# infra/k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: biocom-mq
  namespace: biocom-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: biocom-mq
  template:
    metadata:
      labels:
        app: biocom-mq
    spec:
      containers:
      - name: biocom-mq
        image: asia-northeast3-docker.pkg.dev/api-dev-biocom/biocom-api/biocom-mq:latest
        ports:
        - containerPort: 3001
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_HOST
          valueFrom:
            configMapKeyRef:
              name: biocom-mq-config
              key: REDIS_HOST
        - name: REDIS_PORT
          value: "6379"
        - name: NEO4J_URI
          valueFrom:
            secretKeyRef:
              name: biocom-mq-secrets
              key: NEO4J_URI
        - name: NEO4J_USERNAME
          valueFrom:
            secretKeyRef:
              name: biocom-mq-secrets
              key: NEO4J_USERNAME
        - name: NEO4J_PASSWORD
          valueFrom:
            secretKeyRef:
              name: biocom-mq-secrets
              key: NEO4J_PASSWORD
        - name: NEO4J_DATABASE
          value: "neo4j"
        resources:
          requests:
            cpu: "250m"
            memory: "256Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
```

### 10.4 Auto Scaling (HPA)

```yaml
# infra/k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: biocom-mq-hpa
  namespace: biocom-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: biocom-mq
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### 10.5 배포 순서

```bash
# Step 1: biocom-mq 프로젝트 클론
git clone https://github.com/your-org/biocom-mq.git
cd biocom-mq

# Step 2: 인프라 구축 (Redis)
./infra/scripts/01-deploy-infrastructure.sh --project-id api-dev-biocom

# Step 3: 애플리케이션 배포 (biocom-mq Worker)
./infra/scripts/02-deploy-app.sh --project-id api-dev-biocom --yes

# Step 4: 배포 확인
kubectl get pods -n biocom-api -l app=biocom-mq
kubectl logs -n biocom-api -l app=biocom-mq --tail=100
```

---

## 📌 부록: 환경변수

```bash
# .env.example

# Redis (BullMQ)
REDIS_HOST=10.x.x.x
REDIS_PORT=6379
REDIS_PASSWORD=

# Neo4j Aura
NEO4J_URI=neo4j+s://27c48749.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=jqlf6TctHvZk2N4Rc8_Rj_8RUf614PVQz4VPr5F7KjE
NEO4J_DATABASE=neo4j

# Monitoring
BULL_BOARD_ENABLED=true
BULL_BOARD_PATH=/admin/queues

# 로그 레벨
LOG_LEVEL=info
```

---

**문서 버전**: 1.0.1
**마지막 업데이트**: 2025-12-01
**작성자**: Claude Code
