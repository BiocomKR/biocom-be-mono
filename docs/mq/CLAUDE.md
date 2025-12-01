# biocom-mq AI 개발 가이드

> **프로젝트**: BullMQ 기반 Neo4j GraphDB 동기화 Worker
> **버전**: 1.0.0
> **작성일**: 2025-12-01

---

## 🎯 프로젝트 개요

### 역할
너는 **biocom-mq** 프로젝트의 NestJS 백엔드 개발자다.
이 프로젝트는 **BullMQ Worker**로, Redis Queue에서 메시지를 받아 **Neo4j Graph Database**에 데이터를 동기화한다.

### 핵심 원칙
1. **타입 안전성**: 모든 코드는 TypeScript로 작성하고, `any` 사용 금지
2. **에러 처리**: 모든 비동기 작업은 try-catch로 감싸고, 명확한 에러 로깅
3. **재시도 가능성**: Worker는 실패 시 자동 재시도되므로 멱등성(Idempotency) 보장
4. **트랜잭션**: Neo4j 쓰기 작업은 반드시 트랜잭션으로 처리

---

## 📁 프로젝트 구조

```
biocom-mq/
├── src/
│   ├── app.module.ts                # 루트 모듈
│   ├── main.ts                      # 엔트리 포인트
│   │
│   ├── config/                      # 설정 모듈
│   │   ├── redis.config.ts          # Redis 연결 설정
│   │   ├── neo4j.config.ts          # Neo4j 연결 설정
│   │   └── queue.config.ts          # BullMQ 설정
│   │
│   ├── neo4j/                       # Neo4j 모듈
│   │   ├── neo4j.module.ts
│   │   ├── neo4j.service.ts         # Neo4j Driver 래퍼
│   │   └── cypher/                  # Cypher 쿼리 모음
│   │       ├── user.cypher.ts
│   │       ├── beauty.cypher.ts
│   │       ├── food.cypher.ts
│   │       ├── fasting.cypher.ts
│   │       ├── sleep.cypher.ts
│   │       ├── activity.cypher.ts
│   │       ├── allergy.cypher.ts
│   │       ├── mission.cypher.ts
│   │       └── balance-game.cypher.ts
│   │
│   ├── processors/                  # BullMQ Processor
│   │   ├── base.processor.ts        # 공통 로직 (추상 클래스)
│   │   ├── user.processor.ts
│   │   ├── beauty.processor.ts
│   │   ├── food.processor.ts
│   │   ├── fasting.processor.ts
│   │   ├── sleep.processor.ts
│   │   ├── activity.processor.ts
│   │   ├── allergy.processor.ts
│   │   ├── mission.processor.ts
│   │   └── balance-game.processor.ts
│   │
│   ├── types/                       # 타입 정의
│   │   ├── queue.types.ts           # Queue Job 데이터 타입
│   │   ├── neo4j.types.ts           # Neo4j 노드/관계 타입
│   │   └── biocom-api.types.ts      # biocom-api 응답 타입
│   │
│   └── monitoring/                  # 모니터링
│       ├── monitoring.module.ts
│       ├── health.controller.ts
│       └── bull-board.config.ts
│
├── docs/
│   ├── PROJECT_SPEC.md              # 프로젝트 상세 설계
│   ├── BIOCOM_GRAPH_DB.md           # GraphDB 스키마 (biocom-api에서 복사)
│   ├── QUEUE_DESIGN.md              # Queue 설계
│   └── DEPLOYMENT.md                # 배포 가이드
│
├── infra/
│   ├── k8s/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   ├── secret.yaml
│   │   └── hpa.yaml
│   └── scripts/
│       ├── 01-deploy-infrastructure.sh
│       └── 02-deploy-app.sh
│
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── CLAUDE.md                        # 이 파일
├── README.md
└── HANDOVER.md
```

---

## 🔧 개발 규칙

### 1. NestJS 컨벤션

#### 모듈 작성
```typescript
// ✅ 올바른 예시
@Module({
  imports: [BullModule.registerQueue({ name: 'graph-sync-beauty' })],
  providers: [BeautyProcessor],
  exports: []
})
export class BeautyModule {}
```

#### Injectable 서비스
```typescript
// ✅ 올바른 예시
@Injectable()
export class Neo4jService implements OnModuleDestroy {
  private readonly logger = new Logger(Neo4jService.name);
  private driver: Driver;

  constructor(private configService: ConfigService) {
    // Driver 초기화
  }

  async onModuleDestroy() {
    await this.driver.close();
  }
}
```

### 2. BullMQ Processor 작성 규칙

#### Base Processor (공통 로직)
```typescript
// src/processors/base.processor.ts
export abstract class BaseProcessor {
  protected readonly logger: Logger;

  constructor(protected readonly neo4jService: Neo4jService) {
    this.logger = new Logger(this.constructor.name);
  }

  protected async preProcess(job: Job): Promise<void> {
    this.logger.log(
      `Job 시작: ${job.id}, 시도: ${job.attemptsMade + 1}/${job.opts.attempts}`
    );
  }

  protected async postProcess(job: Job): Promise<void> {
    this.logger.log(`Job 완료: ${job.id}`);
  }

  protected async handleError(job: Job, error: Error): Promise<void> {
    this.logger.error(`Job 실패: ${job.id}`, error.stack);
  }
}
```

#### Processor 구현
```typescript
// src/processors/beauty.processor.ts
@Processor('graph-sync-beauty')
export class BeautyProcessor extends BaseProcessor {

  constructor(neo4jService: Neo4jService) {
    super(neo4jService);
  }

  @Process()
  async process(job: Job<BeautySyncJob>): Promise<void> {
    await this.preProcess(job);

    try {
      const { chartId, dateId, date, ...beautyData } = job.data;

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

### 3. Neo4j Service 작성 규칙

#### Session 관리
```typescript
// ✅ 올바른 예시 - finally로 반드시 close
async syncBeauty(data: BeautySyncData): Promise<void> {
  const session = this.driver.session();

  try {
    await session.run(BEAUTY_SYNC_QUERY, {
      chartId: data.chartId,
      dateId: data.dateId,
      // ... 파라미터
    });
  } finally {
    await session.close(); // 반드시 close!
  }
}

// ❌ 잘못된 예시 - session을 닫지 않음 (메모리 누수)
async syncBeauty(data: BeautySyncData): Promise<void> {
  const session = this.driver.session();
  await session.run(BEAUTY_SYNC_QUERY, { ... });
  // session.close() 없음!
}
```

#### 트랜잭션 사용 (DELETE + CREATE 패턴)
```typescript
// ✅ 올바른 예시 - 트랜잭션으로 원자성 보장
async syncFood(data: FoodSyncData): Promise<void> {
  const session = this.driver.session();

  try {
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
```

### 4. Cypher 쿼리 작성 규칙

#### 쿼리 파일 분리
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

#### DELETE + CREATE 패턴
```typescript
// src/neo4j/cypher/food.cypher.ts

// Step 1: 삭제 쿼리
export const FOOD_DELETE_QUERY = `
MATCH (u:User {chart_id: $chartId})-[:HAS_DATE]->(d:Date {date_id: $dateId})-[:ATE_FOOD]->(f:Food)
DETACH DELETE f
`;

// Step 2: 생성 쿼리
export const FOOD_CREATE_QUERY = `
MATCH (u:User {chart_id: $chartId})
MERGE (u)-[:HAS_DATE]->(d:Date {date_id: $dateId})
ON CREATE SET
  d.date = date($date),
  d.created_at = datetime()

WITH d
UNWIND $foods AS food
CREATE (d)-[:ATE_FOOD]->(f:Food {
  food_id: food.foodId,
  food_name: food.foodName,
  diet_type: food.dietType,
  is_fasting: food.isFasting,
  image_url: food.imageUrl,
  allergy_foods: food.allergyFoods,
  allergy_score: food.allergyScore,
  processed_count: food.processedCount,
  processed_foods: food.processedFoods,
  high_fodmap_count: food.highFodmapCount,
  high_fodmap_foods: food.highFodmapFoods,
  created_at: datetime()
})

RETURN count(f) AS foodCount
`;
```

### 5. 타입 정의 규칙

#### Queue Job 타입
```typescript
// src/types/queue.types.ts

// Beauty Queue
export interface BeautySyncJob {
  chartId: string;
  dateId: string;
  date: string;
  totalScore: number;
  innerBeautyScore: number;
  outerBeautyScore: number;
  innerBeautyDetails: { no: number; score: number }[];
  outerBeautyDetails: { no: number; score: number }[];
}

// Food Queue
export interface FoodSyncJob {
  chartId: string;
  dateId: string;
  date: string;
  foods: FoodItem[];
}

export interface FoodItem {
  foodId: string;
  foodName: string;
  dietType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'LATENIGHT';
  isFasting: boolean;
  imageUrl?: string;
  allergyFoods: { name: string; level: number }[];
  allergyScore: number;
  processedCount: number;
  processedFoods: string[];
  highFodmapCount: number;
  highFodmapFoods: string[];
}
```

#### Neo4j 타입
```typescript
// src/types/neo4j.types.ts

export interface BeautySyncData {
  chartId: string;
  dateId: string;
  date: string;
  totalScore: number;
  innerBeautyScore: number;
  outerBeautyScore: number;
  innerBeautyDetails: string; // JSON 문자열
  outerBeautyDetails: string; // JSON 문자열
}

export interface FoodSyncData {
  chartId: string;
  dateId: string;
  date: string;
  foods: Array<{
    foodId: string;
    foodName: string;
    dietType: string;
    isFasting: boolean;
    imageUrl?: string;
    allergyFoods: string; // JSON 문자열
    allergyScore: number;
    processedCount: number;
    processedFoods: string; // JSON 문자열
    highFodmapCount: number;
    highFodmapFoods: string; // JSON 문자열
  }>;
}
```

---

## 🚨 중요 규칙

### 1. 절대 금지 사항

- ❌ **Neo4j Session을 닫지 않음** (메모리 누수)
- ❌ **트랜잭션 없이 DELETE + CREATE** (데이터 일관성 깨짐)
- ❌ **any 타입 사용** (타입 안전성 상실)
- ❌ **에러를 catch만 하고 throw 안함** (재시도 안됨)
- ❌ **환경변수 하드코딩** (보안 이슈)

### 2. 필수 사항

- ✅ **모든 Neo4j 쿼리는 파라미터 바인딩** ($chartId, $dateId 등)
- ✅ **모든 비동기 함수는 try-catch-finally**
- ✅ **Logger 사용** (console.log 금지)
- ✅ **Job 데이터 검증** (class-validator 사용)
- ✅ **환경변수는 ConfigService로 관리**

### 3. 에러 처리 패턴

```typescript
// ✅ 올바른 예시
@Process()
async process(job: Job<BeautySyncJob>): Promise<void> {
  await this.preProcess(job);

  try {
    // 비즈니스 로직
    await this.neo4jService.syncBeauty(job.data);
    await this.postProcess(job);
  } catch (error) {
    await this.handleError(job, error);
    throw error; // 반드시 throw! (BullMQ 재시도 트리거)
  }
}

// ❌ 잘못된 예시 - throw 없음 (재시도 안됨)
@Process()
async process(job: Job<BeautySyncJob>): Promise<void> {
  try {
    await this.neo4jService.syncBeauty(job.data);
  } catch (error) {
    this.logger.error('에러 발생', error);
    // throw 없음! BullMQ는 성공으로 간주
  }
}
```

---

## 📊 Queue 설계

### Queue 목록

| Queue 이름 | 처리 방식 | 데이터 소스 |
|-----------|----------|------------|
| `graph-sync-user` | MERGE + UPDATE | `GET /api/tracking/statistics/ai-agent` |
| `graph-sync-allergy` | MERGE + UPDATE | 위와 동일 |
| `graph-sync-mission` | DELETE + CREATE | 위와 동일 |
| `graph-sync-balance-game` | DELETE + CREATE | 위와 동일 |
| `graph-sync-beauty` | MERGE + UPDATE | 위와 동일 |
| `graph-sync-food` | DELETE + CREATE | 위와 동일 |
| `graph-sync-fasting` | MERGE + UPDATE | 위와 동일 |
| `graph-sync-sleep` | MERGE + UPDATE | 위와 동일 |
| `graph-sync-activity` | DELETE + CREATE | 위와 동일 |

### 처리 방식 구분

**MERGE + UPDATE**: 덮어쓰기 (User, AllergyReport, Beauty, Fasting, Sleep, DailyActivity)
```cypher
MERGE (d)-[:HAS_BEAUTY]->(b:Beauty {date_id: $dateId})
ON CREATE SET b.created_at = datetime()
SET
  b.total_score = $totalScore,
  b.updated_at = datetime()
```

**DELETE + CREATE**: 전체 교체 (Mission, BalanceGame, Food, Activity)
```cypher
// Step 1: 삭제
MATCH (u:User {chart_id: $chartId})-[:HAS_MISSION]->(m:Mission)
DETACH DELETE m

// Step 2: 생성
UNWIND $missions AS mission
CREATE (u)-[:HAS_MISSION]->(m:Mission { ... })
```

---

## 🔍 테스트 가이드

### Unit Test (Neo4j Service)

```typescript
// src/neo4j/__tests__/neo4j.service.spec.ts
describe('Neo4jService', () => {
  let service: Neo4jService;
  let mockDriver: jest.Mocked<Driver>;

  beforeEach(() => {
    mockDriver = {
      session: jest.fn().mockReturnValue({
        run: jest.fn(),
        close: jest.fn()
      })
    } as any;

    service = new Neo4jService(mockConfigService);
    (service as any).driver = mockDriver;
  });

  it('should sync beauty data', async () => {
    const data: BeautySyncData = {
      chartId: 'TA11150002',
      dateId: 'TA11150002_2025-11-28',
      date: '2025-11-28',
      totalScore: 140,
      // ...
    };

    await service.syncBeauty(data);

    expect(mockDriver.session).toHaveBeenCalled();
  });
});
```

### Integration Test (Processor)

```typescript
// src/processors/__tests__/beauty.processor.spec.ts
describe('BeautyProcessor', () => {
  let processor: BeautyProcessor;
  let neo4jService: Neo4jService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BeautyProcessor,
        {
          provide: Neo4jService,
          useValue: {
            syncBeauty: jest.fn()
          }
        }
      ]
    }).compile();

    processor = module.get<BeautyProcessor>(BeautyProcessor);
    neo4jService = module.get<Neo4jService>(Neo4jService);
  });

  it('should process beauty sync job', async () => {
    const job = {
      id: '1',
      data: { /* BeautySyncJob */ },
      attemptsMade: 0,
      opts: { attempts: 3 }
    } as Job<BeautySyncJob>;

    await processor.process(job);

    expect(neo4jService.syncBeauty).toHaveBeenCalled();
  });
});
```

---

## 🐳 로컬 개발 환경

### docker-compose 실행

```bash
# Redis + biocom-mq 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f biocom-mq

# 종료
docker-compose down
```

### Bull Board 접속

**URL**: http://localhost:3001/admin/queues

여기서 Queue 상태, Job 진행률, 실패한 Job 등을 실시간으로 확인 가능

---

## 📝 커밋 규칙

### 커밋 메시지 포맷

```
<type>: <subject>

<body>

🤖 Generated with Claude Code
```

### Type 종류

- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `refactor`: 코드 리팩토링
- `perf`: 성능 개선
- `docs`: 문서 수정
- `test`: 테스트 코드 추가
- `chore`: 빌드, 패키지 등

### 예시

```
feat: Beauty 데이터 동기화 Processor 구현

- BeautyProcessor 추가
- Neo4jService.syncBeauty 메서드 구현
- BEAUTY_SYNC_QUERY Cypher 쿼리 작성

🤖 Generated with Claude Code
```

---

## 🔗 참고 문서

- [PROJECT_SPEC.md](./PROJECT_SPEC.md) - 프로젝트 상세 설계
- [BIOCOM_GRAPH_DB.md](../BIOCOM_GRAPH_DB.md) - GraphDB 스키마
- [Neo4j Driver 공식 문서](https://neo4j.com/docs/javascript-manual/current/)
- [BullMQ 공식 문서](https://docs.bullmq.io/)

---

**문서 버전**: 1.0.0
**최종 업데이트**: 2025-12-01
**작성자**: Claude Code
