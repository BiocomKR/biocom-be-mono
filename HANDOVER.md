# biocom-mq 프로젝트 인수인계

> **작성일**: 2025-12-01
> **작성자**: Claude Code
> **인수자**: (프로젝트 투입 개발자 또는 AI 에이전트)

## 🚨 필독사항

## 🎯 필독! 형님과 일하는 방법

### 1. 관계 설정
- **형님**: 사용자 (ENTJ, 리더, 결과 중시)
- **나**: 개발 잘하는 동생 (개념은 없지만 실력은 있음)
- **절대 금지**: "당신", "귀하" 같은 표현
- **필수**: 존댓말, "형님"으로 호칭

### 2. 형님의 작업 스타일
- **극도로 싫어하는 것**: 수동 개입, 임시방편
- **원하는 것**: 완전 자동화, 한방 솔루션
- **소통 방식**: 간결하고 명확한 답변
- **피드백**: 거친 표현 = 명확한 가이드라인

### 3. 성공 비결
- 도구가 아닌 **팀원**으로 일하기
- 문제 생기면 즉시 보고
- 해결책 제시할 때 여러 옵션 제공
- 결과물에 집중

### 이 프로젝트는 누구를 위한 것인가?

**AI 에이전트가 사용자 데이터를 이해하기 위한 Graph Database 동기화 시스템입니다.**

- 사용자가 biocom-api에서 기록한 모든 데이터(식단, 수면, 운동, 영양제 등)
- 이 데이터를 PostgreSQL에 저장하는 것은 CRUD용
- 하지만 **AI가 "이 사용자는 어떤 사람인가?"를 이해하려면 Graph 구조가 필요**
- 따라서 PostgreSQL → Neo4j로 비동기 동기화하는 것이 이 프로젝트의 목적

### 왜 별도 프로젝트인가?

1. **biocom-api는 API 서버, 이건 Worker**
   - biocom-api: 사용자 요청에 즉시 응답해야 함
   - biocom-mq: 백그라운드에서 천천히 Neo4j 동기화
   - 섞으면 biocom-api 성능 저하 및 관리 복잡도 증가

2. **독립적인 스케일링**
   - API 서버는 사용자 증가에 따라 스케일링
   - Worker는 Queue 적체에 따라 스케일링
   - 완전히 다른 스케일링 전략 필요

3. **배포 독립성**
   - Neo4j Schema 변경 시 Worker만 배포
   - API 로직 변경 시 API만 배포
   - 서로 영향 없음

---

## 📊 시스템 전체 흐름

### 1. 사용자가 식단을 기록하면...

```
[사용자 앱]
    │
    │ POST /api/tracking/records/food
    ▼
[biocom-api]
    │
    ├─> PostgreSQL에 저장 (즉시)
    │   ✅ user_records 테이블에 INSERT
    │
    └─> Redis Queue에 Job 추가 (비동기)
        ✅ graph-sync-food 큐에 Job 추가

[Redis Queue]
    │
    │ Job: { userId: 1, recordId: 123, foodData: {...} }
    ▼

[biocom-mq Worker]
    │
    ├─> Job 처리
    │   - FoodSyncProcessor가 Job 수신
    │   - Neo4j Service 호출
    │
    └─> Neo4j에 동기화
        ✅ MERGE (User)-[:RECORDED]->(Food)-[:RECORDED_ON]->(Date)
```

### 2. AI 에이전트가 사용자 정보를 조회하면...

```
[AI 에이전트]
    │
    │ "이 사용자는 최근 한 달간 뭘 먹었나?"
    ▼

[Neo4j Graph DB]
    │
    │ MATCH (u:User {id: 1})-[:RECORDED]->(f:Food)-[:RECORDED_ON]->(d:Date)
    │ WHERE d.date >= date() - duration({days: 30})
    │ RETURN f
    ▼

[AI 에이전트]
    │
    │ 음식 목록을 분석하여 답변 생성
    └─> "사용자는 주로 고단백 식단을 섭취하고 있으며..."
```

**핵심**: PostgreSQL은 CRUD용, Neo4j는 AI 컨텍스트용

---

## 🏗️ 기술 아키텍처

### 기술 스택

| 구분 | 기술 | 버전 | 용도 |
|------|------|------|------|
| Runtime | Node.js | 20.x | JavaScript 실행 환경 |
| Framework | NestJS | 10.x | TypeScript 기반 백엔드 프레임워크 |
| Queue | BullMQ | 5.x | Redis 기반 Job Queue |
| Queue Backend | Redis | 7.x | Job 저장소 |
| Target DB | Neo4j | 5.x | Graph Database |
| Container | Docker | 24.x | 컨테이너화 |
| Orchestration | Kubernetes (GKE) | 1.28.x | 컨테이너 오케스트레이션 |
| Cloud | GCP | - | 인프라 |

### 인프라 구성

```
┌─────────────────────────────────────────────────────────────┐
│                         GCP (asia-northeast3)                │
│                                                              │
│  ┌────────────────┐      ┌────────────────┐                │
│  │  biocom-api    │      │  biocom-mq     │                │
│  │  (GKE)         │      │  (GKE)         │                │
│  │                │      │                │                │
│  │  - API Server  │      │  - Worker      │                │
│  │  - PostgreSQL  │      │  - Bull Board  │                │
│  └────────┬───────┘      └────────┬───────┘                │
│           │                       │                         │
│           │                       │                         │
│           └──────────┬────────────┘                         │
│                      │                                      │
│              ┌───────▼────────┐                            │
│              │ Redis          │                            │
│              │ (Memorystore)  │                            │
│              │ - 1GB (M1)     │                            │
│              └────────────────┘                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                         Neo4j Aura                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Neo4j Graph Database                                   │ │
│  │ - URI: neo4j+s://xxxxxxxx.databases.neo4j.io           │ │
│  │ - User: neo4j                                          │ │
│  │ - Password: (Secret)                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Queue 설계

**9개 독립 Queue로 분리한 이유:**

1. **장애 격리**: 하나의 Queue에서 에러 발생해도 다른 Queue는 정상 동작
2. **우선순위 조정**: 중요한 데이터(User, Allergy)는 먼저 처리
3. **처리 속도 모니터링**: Queue별로 처리 속도 및 적체 현황 파악
4. **독립적 스케일링**: 특정 Queue만 Worker 추가 가능 (향후)

**Queue 목록:**

| Queue Name | Priority | 처리 데이터 | 예상 TPS |
|-----------|----------|-----------|----------|
| graph-sync-user | 1 (최고) | 사용자 정보 | 10 |
| graph-sync-allergy | 2 | 알러지 보고서 | 5 |
| graph-sync-mission | 3 | 미션 수행 | 50 |
| graph-sync-balance-game | 3 | 밸런스 게임 | 30 |
| graph-sync-beauty | 4 | 뷰티 기록 | 100 |
| graph-sync-food | 4 | 식단 기록 | 200 |
| graph-sync-fasting | 4 | 단식 기록 | 50 |
| graph-sync-sleep | 4 | 수면 기록 | 100 |
| graph-sync-activity | 4 | 활동 기록 | 150 |

**Retry 전략:**

- 최대 3회 재시도
- 지수 백오프: 1초 → 2초 → 4초
- 3회 실패 시 Failed Queue로 이동 (DLQ)

---

## 🗂️ 프로젝트 구조 상세 설명

### 디렉토리별 역할

```
biocom-mq/
│
├── src/
│   ├── main.ts                       # 애플리케이션 진입점
│   │                                 # - NestFactory.create()
│   │                                 # - Bull Board UI 설정
│   │                                 # - PORT 4001로 실행
│   │
│   ├── app.module.ts                 # Root Module
│   │                                 # - ConfigModule (환경 변수)
│   │                                 # - QueuesModule (9개 Queue)
│   │                                 # - Neo4jModule (Graph DB)
│   │                                 # - HealthModule (Health Check)
│   │
│   ├── config/
│   │   └── configuration.ts          # 환경 변수 로드 및 검증
│   │                                 # - REDIS_HOST, REDIS_PORT
│   │                                 # - NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD
│   │                                 # - PORT, NODE_ENV, LOG_LEVEL
│   │
│   ├── queues/
│   │   ├── queues.module.ts          # Queue Module
│   │   │                             # - BullModule.registerQueue() × 9
│   │   │                             # - Processor 등록
│   │   │
│   │   ├── processors/               # Job Processor 구현
│   │   │   ├── base.processor.ts     # 추상 Base Processor
│   │   │   │                         # - preProcess(), postProcess(), handleError()
│   │   │   │                         # - 공통 로깅 및 에러 처리
│   │   │   │
│   │   │   ├── user-sync.processor.ts        # User 동기화
│   │   │   ├── allergy-sync.processor.ts     # Allergy 동기화
│   │   │   ├── mission-sync.processor.ts     # Mission 동기화
│   │   │   ├── balance-game-sync.processor.ts # BalanceGame 동기화
│   │   │   ├── beauty-sync.processor.ts      # Beauty 동기화
│   │   │   ├── food-sync.processor.ts        # Food 동기화
│   │   │   ├── fasting-sync.processor.ts     # Fasting 동기화
│   │   │   ├── sleep-sync.processor.ts       # Sleep 동기화
│   │   │   └── activity-sync.processor.ts    # Activity 동기화
│   │   │                                     # 각 Processor는:
│   │   │                                     # 1. @Processor('graph-sync-xxx') 데코레이터
│   │   │                                     # 2. @Process() async process(job: Job)
│   │   │                                     # 3. Neo4jService 호출하여 Cypher 실행
│   │   │
│   │   └── types/
│   │       └── job-data.types.ts     # Queue Job 데이터 타입 정의
│   │                                 # - UserSyncData, AllergySyncData, ...
│   │                                 # - class-validator 데코레이터 포함
│   │
│   ├── neo4j/
│   │   ├── neo4j.module.ts           # Neo4j Module
│   │   │                             # - Neo4j Driver 생성 및 DI
│   │   │                             # - onModuleDestroy에서 Driver 종료
│   │   │
│   │   ├── neo4j.service.ts          # Neo4j Connection Service
│   │   │                             # - syncUser(data)
│   │   │                             # - syncAllergy(data)
│   │   │                             # - syncMission(data)
│   │   │                             # - ... (9개 메서드)
│   │   │                             # - Session 관리 (try-finally)
│   │   │                             # - Cypher Query 실행
│   │   │
│   │   ├── queries/                  # Cypher Query 파일
│   │   │   ├── user.cypher.ts        # User 관련 Cypher
│   │   │   ├── allergy.cypher.ts     # Allergy 관련 Cypher
│   │   │   ├── mission.cypher.ts     # Mission 관련 Cypher
│   │   │   ├── balance-game.cypher.ts # BalanceGame 관련 Cypher
│   │   │   ├── beauty.cypher.ts      # Beauty 관련 Cypher
│   │   │   ├── food.cypher.ts        # Food 관련 Cypher
│   │   │   ├── fasting.cypher.ts     # Fasting 관련 Cypher
│   │   │   ├── sleep.cypher.ts       # Sleep 관련 Cypher
│   │   │   └── activity.cypher.ts    # Activity 관련 Cypher
│   │   │                             # 각 파일은 export const XXX_SYNC_QUERY = `...`
│   │   │
│   │   └── types/
│   │       └── neo4j-data.types.ts   # Neo4j 데이터 타입
│   │                                 # - UserNode, AllergyNode, ...
│   │
│   └── health/
│       ├── health.module.ts          # Health Check Module
│       └── health.controller.ts      # Health Check Controller
│                                     # - GET /health
│                                     # - Redis, Neo4j 상태 확인
│
├── test/
│   ├── unit/                         # 단위 테스트
│   │   ├── processors/               # Processor 테스트
│   │   └── services/                 # Service 테스트
│   │
│   └── integration/                  # 통합 테스트
│       ├── redis.integration.spec.ts # Redis 연결 테스트
│       └── neo4j.integration.spec.ts # Neo4j 연결 테스트
│
├── infra-gcp/                        # GCP 인프라 배포 스크립트
│   ├── scripts/
│   │   ├── 01-deploy-infrastructure.sh # Redis Memorystore 생성
│   │   └── 02-deploy-app.sh         # GKE 배포
│   │
│   └── k8s/                          # Kubernetes YAML
│       ├── configmap.yaml            # 환경 변수
│       ├── secret.yaml               # Neo4j 인증 정보
│       ├── deployment.yaml           # Worker Deployment
│       ├── service.yaml              # Bull Board Service
│       └── hpa.yaml                  # Horizontal Pod Autoscaler
│
├── docker-compose.yml                # Local Redis 실행
├── Dockerfile                        # Multi-stage Docker Build
├── .env.example                      # 환경 변수 예제
├── tsconfig.json
├── package.json
└── nest-cli.json
```

---

## 🔄 데이터 동기화 전략

### MERGE vs DELETE+CREATE

**대부분의 데이터: MERGE 패턴 사용**

```cypher
MERGE (u:User {id: $userId})
ON CREATE SET
  u.name = $name,
  u.email = $email,
  u.createdAt = $createdAt
ON MATCH SET
  u.name = $name,
  u.email = $email,
  u.updatedAt = $updatedAt
```

**왜 MERGE인가?**
- 노드가 없으면 생성 (CREATE)
- 노드가 있으면 업데이트 (MATCH)
- 관계(Relationship)가 복잡하게 얽혀있어도 안전
- Transaction 내에서 원자적으로 처리

**DELETE+CREATE를 쓰면 안되는 이유:**
- 관계가 끊어짐: `(User)-[:RECORDED]->(Food)` 같은 관계가 삭제됨
- 다른 노드 영향: 해당 노드를 참조하는 모든 관계가 사라짐
- 복구 불가능: 한 번 삭제하면 관계 정보 복원 불가

**예외: Activity는 DELETE+CREATE**

```cypher
// 1. 기존 Activity 노드 및 관계 전부 삭제
MATCH (d:DailyActivity {id: $dailyActivityId})
OPTIONAL MATCH (d)-[r]-()
DELETE r, d

// 2. 새로 생성
CREATE (d:DailyActivity {...})
CREATE (a1:Activity {...})
CREATE (a2:Activity {...})
CREATE (d)-[:CONTAINS]->(a1)
CREATE (d)-[:CONTAINS]->(a2)
```

**왜 Activity만 DELETE+CREATE인가?**
- Activity는 하루 단위로 완전히 교체됨
- 개별 Activity를 식별할 ID가 없음 (배열로 통째로 전달)
- MERGE로 하려면 모든 Activity를 일일이 비교해야 해서 성능 저하
- 따라서 그냥 전부 지우고 다시 만드는게 빠름

---

## 🚨 주의사항 (반드시 읽을 것)

### 1. Neo4j Session은 반드시 close해라

**❌ 잘못된 코드 (메모리 누수):**

```typescript
async syncUser(data: UserSyncData): Promise<void> {
  const session = this.driver.session();

  await session.run(USER_SYNC_QUERY, { ...data });

  // Session을 닫지 않음 → 메모리 누수 발생
}
```

**✅ 올바른 코드:**

```typescript
async syncUser(data: UserSyncData): Promise<void> {
  const session = this.driver.session();

  try {
    await session.run(USER_SYNC_QUERY, { ...data });
  } finally {
    await session.close(); // 반드시 close
  }
}
```

**왜 중요한가?**
- Neo4j Session은 연결 풀에서 가져옴
- close 안하면 연결 풀이 고갈되어 새로운 Session 생성 불가
- 시간이 지나면 "Too many connections" 에러 발생
- **Worker가 멈춤**

### 2. Cypher Query에는 반드시 Parameter Binding 사용

**❌ 잘못된 코드 (SQL Injection 위험):**

```typescript
const query = `
  MERGE (u:User {id: ${userId}})
  SET u.name = '${name}'
`;
```

**✅ 올바른 코드:**

```typescript
const query = `
  MERGE (u:User {id: $userId})
  SET u.name = $name
`;

await session.run(query, { userId, name });
```

**왜 중요한가?**
- Cypher Injection 방지
- Query Plan 캐싱 (성능 향상)
- 타입 안정성

### 3. DELETE+CREATE는 Transaction으로 감싸라

**❌ 잘못된 코드 (데이터 유실 위험):**

```typescript
// 1. 삭제
await session.run(`
  MATCH (d:DailyActivity {id: $id})
  DELETE d
`, { id });

// 여기서 에러 발생하면?
// → 삭제는 됐는데 생성 안됨 → 데이터 유실!

// 2. 생성
await session.run(`
  CREATE (d:DailyActivity {...})
`, { ... });
```

**✅ 올바른 코드:**

```typescript
const tx = session.beginTransaction();

try {
  // 1. 삭제
  await tx.run(`
    MATCH (d:DailyActivity {id: $id})
    DELETE d
  `, { id });

  // 2. 생성
  await tx.run(`
    CREATE (d:DailyActivity {...})
  `, { ... });

  await tx.commit(); // 성공 시 전체 커밋
} catch (error) {
  await tx.rollback(); // 실패 시 전체 롤백
  throw error;
} finally {
  await session.close();
}
```

### 4. Job Data는 반드시 검증해라

**❌ 잘못된 코드 (타입 체크 없음):**

```typescript
@Process()
async process(job: Job) {
  const data = job.data; // any 타입

  await this.neo4jService.syncUser(data);
  // data에 userId가 없으면? → Neo4j 에러
}
```

**✅ 올바른 코드:**

```typescript
@Process()
async process(job: Job) {
  const data = plainToInstance(UserSyncData, job.data);

  const errors = await validate(data);
  if (errors.length > 0) {
    throw new Error(`Invalid job data: ${errors}`);
  }

  await this.neo4jService.syncUser(data);
}
```

### 5. 환경 변수는 절대 하드코딩하지 마라

**❌ 잘못된 코드:**

```typescript
const driver = neo4j.driver(
  'neo4j+s://abc123.databases.neo4j.io',
  neo4j.auth.basic('neo4j', 'password123')
);
```

**✅ 올바른 코드:**

```typescript
const driver = neo4j.driver(
  this.configService.get<string>('NEO4J_URI'),
  neo4j.auth.basic(
    this.configService.get<string>('NEO4J_USERNAME'),
    this.configService.get<string>('NEO4J_PASSWORD')
  )
);
```

---

## 🔍 모니터링 및 디버깅

### Bull Board 활용

**접속 방법:**

```bash
# Local
http://localhost:4001/admin/queues

# Production (Port Forward)
kubectl port-forward svc/biocom-mq-worker 4001:4001 -n biocom-mq
http://localhost:4001/admin/queues
```

**Bull Board에서 할 수 있는 것:**

1. **Queue 상태 확인**
   - Active: 현재 처리 중인 Job 수
   - Waiting: 대기 중인 Job 수
   - Completed: 완료된 Job 수
   - Failed: 실패한 Job 수

2. **개별 Job 확인**
   - Job ID, 데이터, 상태
   - 에러 메시지 및 Stack Trace
   - 재시도 횟수

3. **Failed Job 재시도**
   - 개별 Job 재시도
   - 전체 Failed Job 재시도

4. **Queue 일시 중지/재개**
   - 긴급 상황 시 Queue 일시 중지
   - 문제 해결 후 재개

5. **Job 수동 추가 (테스트용)**
   - UI에서 직접 Job 추가 가능
   - 테스트 시 유용

### 로그 확인

**Kubernetes Pod 로그:**

```bash
# 전체 로그
kubectl logs -f deployment/biocom-mq-worker -n biocom-mq

# 에러만 필터링
kubectl logs -f deployment/biocom-mq-worker -n biocom-mq | grep ERROR

# 특정 Queue만 필터링
kubectl logs -f deployment/biocom-mq-worker -n biocom-mq | grep graph-sync-food
```

**로그 레벨:**

- DEBUG: 모든 로그 (개발 환경)
- INFO: 주요 동작 로그 (프로덕션)
- WARN: 경고 (재시도 가능한 에러)
- ERROR: 에러 (재시도 불가능한 에러)

### 주요 메트릭

**Queue 메트릭:**

- Job 처리 속도 (jobs/sec)
- Job 대기 시간 (waiting time)
- Job 실패율 (failure rate)
- Queue 적체율 (backlog)

**Neo4j 메트릭:**

- Cypher Query 실행 시간
- 노드/관계 생성 속도
- Session 사용률
- 메모리 사용량

**Redis 메트릭:**

- 메모리 사용률
- 초당 명령 수
- 연결 수
- Eviction 횟수

---

## 🐛 자주 발생하는 문제 및 해결

### 문제 1: Worker가 Job을 처리하지 않음

**증상:**
- Bull Board에서 Job이 Waiting 상태로 계속 머물러 있음
- Active Job 수가 0

**원인:**
1. Worker Pod가 실행되지 않음
2. Redis 연결 실패
3. Processor에서 에러 발생

**해결:**

```bash
# 1. Pod 상태 확인
kubectl get pods -n biocom-mq

# 2. Pod 로그 확인
kubectl logs -f deployment/biocom-mq-worker -n biocom-mq

# 3. Redis 연결 확인
kubectl exec -it <pod-name> -n biocom-mq -- sh
nc -zv $REDIS_HOST $REDIS_PORT

# 4. Worker 재시작
kubectl rollout restart deployment/biocom-mq-worker -n biocom-mq
```

### 문제 2: Neo4j 연결 실패

**증상:**
- 로그에 "Neo4j connection failed" 에러
- Job이 계속 재시도하다가 Failed로 이동

**원인:**
1. Neo4j Aura 인스턴스 중지됨
2. 잘못된 인증 정보
3. 네트워크 이슈

**해결:**

```bash
# 1. Secret 확인
kubectl get secret biocom-mq-secrets -n biocom-mq -o yaml

# 2. 환경 변수 확인
kubectl exec -it <pod-name> -n biocom-mq -- env | grep NEO4J

# 3. Neo4j Aura Console에서 인스턴스 상태 확인

# 4. Worker Pod 재시작
kubectl rollout restart deployment/biocom-mq-worker -n biocom-mq
```

### 문제 3: Job이 계속 실패함

**증상:**
- Bull Board에서 Failed Job이 계속 쌓임
- 같은 Job이 3번 재시도 후 Failed

**원인:**
1. 잘못된 Job 데이터
2. Neo4j Schema 불일치
3. Cypher Query 오류

**해결:**

```bash
# 1. Bull Board에서 Failed Job 확인
http://localhost:4001/admin/queues

# 2. Job 데이터 및 Error Stack 확인
# (Bull Board UI에서 개별 Job 클릭)

# 3. Worker 로그에서 에러 확인
kubectl logs -f deployment/biocom-mq-worker -n biocom-mq | grep ERROR

# 4. Neo4j에서 직접 Cypher 쿼리 테스트
# (Neo4j Browser에서 해당 Cypher 실행)

# 5. 필요시 Job 수동 재시도
# (Bull Board UI에서 Retry 버튼)
```

### 문제 4: Redis 메모리 부족

**증상:**
- Redis에서 OOM (Out of Memory) 에러
- Worker가 Job을 추가할 수 없음

**원인:**
1. 완료된 Job이 너무 많이 쌓임
2. Failed Job이 너무 많음
3. Redis 인스턴스 크기 부족

**해결:**

```bash
# 1. Redis 메모리 사용량 확인
# (GCP Console > Memorystore)

# 2. Queue 설정 확인 (queues.module.ts)
removeOnComplete: { count: 100 },  # 최근 100개만 유지
removeOnFailed: { count: 1000 },   # 실패 1000개 유지

# 3. Bull Board에서 오래된 Job 수동 삭제

# 4. Redis 인스턴스 스케일업 (필요시)
gcloud redis instances update biocom-mq-redis \
  --size=2 \
  --region=asia-northeast3
```

### 문제 5: Worker Pod가 계속 재시작됨 (CrashLoopBackOff)

**증상:**
- `kubectl get pods -n biocom-mq`에서 RESTARTS 횟수가 계속 증가
- Pod 상태가 CrashLoopBackOff

**원인:**
1. Neo4j 인증 실패
2. Redis 연결 실패
3. 환경 변수 누락
4. 코드 에러

**해결:**

```bash
# 1. Pod 로그 확인
kubectl logs <pod-name> -n biocom-mq

# 2. 이전 Pod 로그 확인 (재시작되기 전 로그)
kubectl logs <pod-name> -n biocom-mq --previous

# 3. Pod Describe 확인
kubectl describe pod <pod-name> -n biocom-mq

# 4. Secret/ConfigMap 확인
kubectl get secret biocom-mq-secrets -n biocom-mq -o yaml
kubectl get configmap biocom-mq-config -n biocom-mq -o yaml
```

### ⚠️ Prisma 쿼리 작성 전 필수 확인
- **절대 금지**: 스키마 확인 없이 필드 사용
- **반드시 확인**: `grep -n "필드명" prisma/schema.prisma`
- **실수 사례**: `UserChallenge.sleepScore` 필드가 없는데 쿼리에서 사용 → 런타임 에러
- **교훈**: 다른 코드에서 사용하는 것처럼 보여도 DB에 없을 수 있음 (계산되는 값일 수 있음)

---

## 🚀 배포 가이드

### Local 개발 환경

**1. 환경 변수 설정:**

```bash
cp .env.example .env
# .env 파일 편집하여 Neo4j 인증 정보 입력
```

**2. Docker Compose로 Redis 실행:**

```bash
docker-compose up -d
```

**3. Worker 실행:**

```bash
npm install
npm run start:dev
```

**4. Bull Board 확인:**

```
http://localhost:4001/admin/queues
```

### GCP 배포

**1. Infrastructure 배포 (Redis):**

```bash
cd infra-gcp
./scripts/01-deploy-infrastructure.sh
```

**2. Application 배포 (Worker):**

```bash
./scripts/02-deploy-app.sh
```

**3. 배포 확인:**

```bash
# Pod 상태 확인
kubectl get pods -n biocom-mq

# Pod 로그 확인
kubectl logs -f deployment/biocom-mq-worker -n biocom-mq

# Bull Board 접속 (Port Forward)
kubectl port-forward svc/biocom-mq-worker 4001:4001 -n biocom-mq
```

**4. HPA 확인:**

```bash
kubectl get hpa -n biocom-mq
```

---

## 📝 체크리스트

### 개발 시작 전

- [ ] BIOCOM_GRAPH_DB.md 읽고 Neo4j Schema 이해
- [ ] PROJECT_SPEC.md 읽고 전체 아키텍처 이해
- [ ] CLAUDE.md 읽고 개발 규칙 숙지
- [ ] Local 환경에서 Redis + Neo4j 연결 테스트
- [ ] Bull Board에서 Queue 정상 동작 확인

### Processor 개발 시

- [ ] BaseProcessor 상속
- [ ] @Processor() 데코레이터 사용
- [ ] @Process() 메서드 구현
- [ ] Job Data 타입 정의 및 검증
- [ ] Neo4jService 메서드 호출
- [ ] 단위 테스트 작성

### Neo4j Service 개발 시

- [ ] Session 생성 및 close (try-finally)
- [ ] Parameter Binding 사용
- [ ] MERGE 패턴 사용 (Activity 제외)
- [ ] Transaction 사용 (DELETE+CREATE 시)
- [ ] Cypher Query 파일 분리
- [ ] 통합 테스트 작성

### 배포 전

- [ ] 모든 테스트 통과
- [ ] Lint & Format 확인
- [ ] .env.example 업데이트
- [ ] README.md 업데이트
- [ ] CHANGELOG.md 작성 (있으면)

### 배포 후

- [ ] Pod 정상 실행 확인
- [ ] Bull Board 접속 확인
- [ ] Health Check API 확인
- [ ] Redis 연결 확인
- [ ] Neo4j 연결 확인
- [ ] HPA 정상 동작 확인
- [ ] 로그에 에러 없는지 확인

---

## 🤝 협업 가이드

### Git Workflow

1. **Feature 브랜치 생성:**

```bash
git checkout -b feature/add-new-processor
```

2. **개발 및 커밋:**

```bash
git add .
git commit -m "feat: Add new processor for XXX"
```

3. **PR 생성:**

- PR 템플릿에 따라 작성
- 변경 사항 설명
- 테스트 결과 첨부

4. **코드 리뷰 후 Merge:**

- Squash Merge 사용
- Merge 후 브랜치 삭제

### Commit Convention

```bash
feat: 새로운 기능 추가
fix: 버그 수정
refactor: 코드 리팩토링
docs: 문서 수정
test: 테스트 코드
chore: 빌드, 패키지 등
```

---

## 📞 문의 및 지원

- **Slack**: #biocom-mq 채널
- **이슈 트래킹**: GitHub Issues
- **긴급 문의**: 형님에게 직접 연락

---

**작성자**: Claude Code
**최종 업데이트**: 2025-12-01
**버전**: 1.0.0

---

## 🎯 마지막 당부

**이 프로젝트는 단순한 Worker가 아닙니다.**

AI 에이전트가 사용자를 이해하고, 맞춤형 서비스를 제공하기 위한 **핵심 인프라**입니다.

- PostgreSQL: CRUD용 (빠른 읽기/쓰기)
- Neo4j: AI 컨텍스트용 (관계 기반 추론)

**데이터 동기화가 실패하면 AI가 사용자를 이해하지 못합니다.**

따라서:
- 절대 Session을 닫지 않는 실수를 하지 마세요
- 절대 Parameter Binding을 안쓰는 실수를 하지 마세요
- 절대 Transaction 없이 DELETE+CREATE 하지 마세요

**안정성과 정확성이 가장 중요합니다.**

형님한테 욕먹지 않으려면 이 문서를 최소 3번 읽고 시작하세요. 🙏
