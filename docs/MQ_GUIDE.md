# biocom-api → biocom-mq 연동 가이드

> **대상**: biocom-api 백엔드 개발자 (NestJS)
> **목적**: BullMQ Queue를 통해 GraphDB 동기화 Job을 biocom-mq Worker에게 전달
> **작성일**: 2025-12-01

---

## 📋 목차

1. [개요](#개요)
2. [BullMQ Producer 설정](#bullmq-producer-설정)
3. [9개 Queue Job 명세](#9개-queue-job-명세)
4. [Producer Service 구현](#producer-service-구현)
5. [API 엔드포인트 연동](#api-엔드포인트-연동)
6. [에러 처리](#에러-처리)
7. [테스트 가이드](#테스트-가이드)

---

## 개요

### 아키텍처

```
┌─────────────────┐         ┌─────────────┐         ┌──────────────────┐
│   biocom-api    │         │    Redis    │         │   biocom-mq      │
│   (Producer)    │────────▶│   Queue     │────────▶│   (Consumer)     │
│                 │         │             │         │                  │
│  - NestJS       │  Job    │  - BullMQ   │  Job    │  - NestJS        │
│  - PostgreSQL   │  Enqueue│  - Port     │  Dequeue│  - Neo4j Driver  │
│                 │         │    6379     │         │                  │
└─────────────────┘         └─────────────┘         └──────────────────┘
```

### 데이터 흐름

1. **biocom-api**: 사용자 데이터 CRUD 처리 (PostgreSQL)
2. **biocom-api**: 데이터 변경 후 Redis Queue에 Job 추가 (Producer)
3. **Redis**: BullMQ Queue에 Job 저장
4. **biocom-mq**: Queue에서 Job을 꺼내서 처리 (Consumer)
5. **biocom-mq**: Neo4j GraphDB에 데이터 동기화

---

## BullMQ Producer 설정

### 1. 패키지 설치

```bash
npm install @nestjs/bullmq bullmq
```

### 2. 환경변수 설정

```bash
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # 로컬에서는 비워두기

# GCP 프로덕션 (Redis Memorystore)
# REDIS_HOST=10.x.x.x
# REDIS_PASSWORD=your-redis-password
```

### 3. Configuration 모듈

```typescript
// src/config/configuration.ts
export default () => ({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
});
```

### 4. BullMQ Module 등록 (app.module.ts)

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),

    // BullMQ Root 설정
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
        },
      }),
    }),

    // GraphSync Module 추가
    GraphSyncModule,
  ],
})
export class AppModule {}
```

---

## 9개 Queue Job 명세

### Queue 목록

| Queue 이름 | 타입 인터페이스 | 설명 |
|-----------|----------------|------|
| `graph-sync-user` | `UserSyncJob` | 사용자 기본 정보 |
| `graph-sync-beauty` | `BeautySyncJob` | 뷰티 점수 |
| `graph-sync-food` | `FoodSyncJob` | 음식 섭취 기록 |
| `graph-sync-fasting` | `FastingSyncJob` | 단식 기록 |
| `graph-sync-sleep` | `SleepSyncJob` | 수면 기록 |
| `graph-sync-activity` | `ActivitySyncJob` | 운동 기록 |
| `graph-sync-allergy` | `AllergyReportSyncJob` | 알레르기 검사 |
| `graph-sync-mission` | `MissionSyncJob` | 미션 목록 |
| `graph-sync-balance-game` | `BalanceGameSyncJob` | 밸런스 게임 |
| `graph-sync-supplement` | `SupplementSyncJob` | 영양제 섭취 기록 |

### Job 타입 정의

```typescript
// src/graph-sync/types/queue.types.ts

// 1. User Queue
export interface UserSyncJob {
  chartId: string;
  name: string;
  innerBeautyType: string;
  outerBeautyType: string;
  gender: string;
  age: number;
}

// 2. Beauty Queue
export interface BeautySyncJob {
  chartId: string;
  dateId: string;
  date: string; // ISO date: "2025-11-28"
  totalScore: number;
  innerBeautyScore: number;
  outerBeautyScore: number;
  innerBeautyDetails: Array<{ no: number; score: number }>;
  outerBeautyDetails: Array<{ no: number; score: number }>;
}

// 3. Food Queue
export interface FoodSyncJob {
  chartId: string;
  dateId: string;
  date: string;
  foods: Array<{
    foodId: string;
    foodName: string;
    dietType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'LATENIGHT';
    isFasting: boolean;
    imageUrl?: string;
    allergyFoods: Array<{ name: string; level: number }>;
    allergyScore: number;
    processedCount: number;
    processedFoods: string[];
    highFodmapCount: number;
    highFodmapFoods: string[];
  }>;
}

// 4. Fasting Queue
export interface FastingSyncJob {
  chartId: string;
  dateId: string;
  date: string;
  startDateTime: string; // ISO 8601: "2025-11-28T20:00:00"
  endDateTime: string;
  fastingHours: number;
  isFastingDay: boolean;
}

// 5. Sleep Queue
export interface SleepSyncJob {
  chartId: string;
  dateId: string;
  date: string;
  bedDateTime: string;
  wakeDateTime: string;
  sleepHours: number;
  sleepQuality: 'GOOD' | 'NORMAL' | 'POOR';
}

// 6. Activity Queue
export interface ActivitySyncJob {
  chartId: string;
  dateId: string;
  date: string;
  totalCalories: number;
  activityCount: number;
  totalDurationMinutes: number;
  activities: Array<{
    activityId: string;
    activityTypeId: string;
    activityName: string;
    durationMinutes: number;
    calories: number;
    intensity: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
}

// 7. Allergy Report Queue
export interface AllergyReportSyncJob {
  chartId: string;
  testDate: string;
  allergenCount: number;
  allergenDetails: Array<{
    name: string;
    level: number;
    category: string;
  }>;
  hasTestResult: boolean;
}

// 8. Mission Queue
export interface MissionSyncJob {
  chartId: string;
  missions: Array<{
    missionId: string;
    description: string;
    isCompleted: boolean;
    completedDate?: string;
    rewardPoints: number;
    category: 'DAILY' | 'WEEKLY' | 'SPECIAL';
  }>;
}

// 9. Balance Game Queue
export interface BalanceGameSyncJob {
  chartId: string;
  balanceGames: Array<{
    gameId: string;
    question: string;
    optionA: string;
    optionB: string;
    userChoice: 'A' | 'B';
    playedDate: string;
    resultAnalysis: string;
  }>;
}

// 10. Supplement Queue
export interface SupplementSyncJob {
  chartId: string;
  dateId: string;
  date: string;
  supplements: Array<{
    supplementId: string;
    supplementName: string;
    intakeCount: number;
    recommendedCount: number;
    nutrients: string[];
  }>;
}
```

---

## Producer Service 구현

### 1. GraphSync Module 생성

```typescript
// src/graph-sync/graph-sync.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GraphSyncService } from './graph-sync.service';

@Module({
  imports: [
    // 10개 Queue 등록
    BullModule.registerQueue(
      { name: 'graph-sync-user' },
      { name: 'graph-sync-beauty' },
      { name: 'graph-sync-food' },
      { name: 'graph-sync-fasting' },
      { name: 'graph-sync-sleep' },
      { name: 'graph-sync-activity' },
      { name: 'graph-sync-allergy' },
      { name: 'graph-sync-mission' },
      { name: 'graph-sync-balance-game' },
      { name: 'graph-sync-supplement' },
    ),
  ],
  providers: [GraphSyncService],
  exports: [GraphSyncService],
})
export class GraphSyncModule {}
```

### 2. GraphSync Service 구현

```typescript
// src/graph-sync/graph-sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  UserSyncJob,
  BeautySyncJob,
  FoodSyncJob,
  FastingSyncJob,
  SleepSyncJob,
  ActivitySyncJob,
  AllergyReportSyncJob,
  MissionSyncJob,
  BalanceGameSyncJob,
  SupplementSyncJob,
} from './types/queue.types';

@Injectable()
export class GraphSyncService {
  private readonly logger = new Logger(GraphSyncService.name);

  constructor(
    @InjectQueue('graph-sync-user') private userQueue: Queue<UserSyncJob>,
    @InjectQueue('graph-sync-beauty') private beautyQueue: Queue<BeautySyncJob>,
    @InjectQueue('graph-sync-food') private foodQueue: Queue<FoodSyncJob>,
    @InjectQueue('graph-sync-fasting') private fastingQueue: Queue<FastingSyncJob>,
    @InjectQueue('graph-sync-sleep') private sleepQueue: Queue<SleepSyncJob>,
    @InjectQueue('graph-sync-activity') private activityQueue: Queue<ActivitySyncJob>,
    @InjectQueue('graph-sync-allergy') private allergyQueue: Queue<AllergyReportSyncJob>,
    @InjectQueue('graph-sync-mission') private missionQueue: Queue<MissionSyncJob>,
    @InjectQueue('graph-sync-balance-game') private balanceGameQueue: Queue<BalanceGameSyncJob>,
    @InjectQueue('graph-sync-supplement') private supplementQueue: Queue<SupplementSyncJob>,
  ) {}

  /**
   * User 동기화
   */
  async syncUser(data: UserSyncJob): Promise<string> {
    try {
      const job = await this.userQueue.add('sync', data);
      this.logger.log(`User sync job enqueued: ${job.id}`);
      return job.id!;
    } catch (error) {
      this.logger.error(`Failed to enqueue user sync job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Beauty 동기화
   */
  async syncBeauty(data: BeautySyncJob): Promise<string> {
    try {
      const job = await this.beautyQueue.add('sync', data);
      this.logger.log(`Beauty sync job enqueued: ${job.id}`);
      return job.id!;
    } catch (error) {
      this.logger.error(`Failed to enqueue beauty sync job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Food 동기화
   */
  async syncFood(data: FoodSyncJob): Promise<string> {
    try {
      const job = await this.foodQueue.add('sync', data);
      this.logger.log(`Food sync job enqueued: ${job.id}`);
      return job.id!;
    } catch (error) {
      this.logger.error(`Failed to enqueue food sync job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fasting 동기화
   */
  async syncFasting(data: FastingSyncJob): Promise<string> {
    try {
      const job = await this.fastingQueue.add('sync', data);
      this.logger.log(`Fasting sync job enqueued: ${job.id}`);
      return job.id!;
    } catch (error) {
      this.logger.error(`Failed to enqueue fasting sync job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sleep 동기화
   */
  async syncSleep(data: SleepSyncJob): Promise<string> {
    try {
      const job = await this.sleepQueue.add('sync', data);
      this.logger.log(`Sleep sync job enqueued: ${job.id}`);
      return job.id!;
    } catch (error) {
      this.logger.error(`Failed to enqueue sleep sync job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Activity 동기화
   */
  async syncActivity(data: ActivitySyncJob): Promise<string> {
    try {
      const job = await this.activityQueue.add('sync', data);
      this.logger.log(`Activity sync job enqueued: ${job.id}`);
      return job.id!;
    } catch (error) {
      this.logger.error(`Failed to enqueue activity sync job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Allergy Report 동기화
   */
  async syncAllergyReport(data: AllergyReportSyncJob): Promise<string> {
    try {
      const job = await this.allergyQueue.add('sync', data);
      this.logger.log(`Allergy report sync job enqueued: ${job.id}`);
      return job.id!;
    } catch (error) {
      this.logger.error(`Failed to enqueue allergy report sync job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mission 동기화
   */
  async syncMissions(data: MissionSyncJob): Promise<string> {
    try {
      const job = await this.missionQueue.add('sync', data);
      this.logger.log(`Mission sync job enqueued: ${job.id}`);
      return job.id!;
    } catch (error) {
      this.logger.error(`Failed to enqueue mission sync job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Balance Game 동기화
   */
  async syncBalanceGames(data: BalanceGameSyncJob): Promise<string> {
    try {
      const job = await this.balanceGameQueue.add('sync', data);
      this.logger.log(`Balance game sync job enqueued: ${job.id}`);
      return job.id!;
    } catch (error) {
      this.logger.error(`Failed to enqueue balance game sync job: ${error.message}`);
      throw error;
    }
  }

  /**
   * Supplement 동기화
   */
  async syncSupplements(data: SupplementSyncJob): Promise<string> {
    try {
      const job = await this.supplementQueue.add('sync', data);
      this.logger.log(`Supplement sync job enqueued: ${job.id}`);
      return job.id!;
    } catch (error) {
      this.logger.error(`Failed to enqueue supplement sync job: ${error.message}`);
      throw error;
    }
  }
}
```

---

## API 엔드포인트 연동

### 1. Beauty API 예시

```typescript
// src/beauty/beauty.controller.ts
import { Controller, Post, Body, Logger } from '@nestjs/common';
import { BeautyService } from './beauty.service';
import { GraphSyncService } from '../graph-sync/graph-sync.service';
import { CreateBeautyDto } from './dto/create-beauty.dto';

@Controller('beauty')
export class BeautyController {
  private readonly logger = new Logger(BeautyController.name);

  constructor(
    private readonly beautyService: BeautyService,
    private readonly graphSyncService: GraphSyncService,
  ) {}

  @Post()
  async create(@Body() createBeautyDto: CreateBeautyDto) {
    // Step 1: PostgreSQL에 저장
    const beauty = await this.beautyService.create(createBeautyDto);

    // Step 2: GraphDB 동기화 Job 추가 (Fire-and-Forget)
    this.graphSyncService
      .syncBeauty({
        chartId: beauty.chartId,
        dateId: beauty.dateId,
        date: beauty.date.toISOString().split('T')[0], // "2025-11-28"
        totalScore: beauty.totalScore,
        innerBeautyScore: beauty.innerBeautyScore,
        outerBeautyScore: beauty.outerBeautyScore,
        innerBeautyDetails: beauty.innerBeautyDetails,
        outerBeautyDetails: beauty.outerBeautyDetails,
      })
      .catch((error) => {
        this.logger.error(`Failed to sync beauty to GraphDB: ${error.message}`);
        // Queue 실패는 무시 (PostgreSQL 저장은 성공)
      });

    return beauty;
  }
}
```

### 2. Food API 예시

```typescript
// src/food/food.controller.ts
import { Controller, Post, Body, Logger } from '@nestjs/common';
import { FoodService } from './food.service';
import { GraphSyncService } from '../graph-sync/graph-sync.service';
import { CreateFoodDto } from './dto/create-food.dto';

@Controller('food')
export class FoodController {
  private readonly logger = new Logger(FoodController.name);

  constructor(
    private readonly foodService: FoodService,
    private readonly graphSyncService: GraphSyncService,
  ) {}

  @Post()
  async create(@Body() createFoodDto: CreateFoodDto) {
    // Step 1: PostgreSQL에 저장
    const food = await this.foodService.create(createFoodDto);

    // Step 2: 해당 날짜의 모든 음식 조회
    const foodsOnDate = await this.foodService.findByDate(
      food.chartId,
      food.dateId,
    );

    // Step 3: GraphDB 동기화 Job 추가
    this.graphSyncService
      .syncFood({
        chartId: food.chartId,
        dateId: food.dateId,
        date: food.date.toISOString().split('T')[0],
        foods: foodsOnDate.map((f) => ({
          foodId: f.foodId,
          foodName: f.foodName,
          dietType: f.dietType,
          isFasting: f.isFasting,
          imageUrl: f.imageUrl,
          allergyFoods: f.allergyFoods,
          allergyScore: f.allergyScore,
          processedCount: f.processedCount,
          processedFoods: f.processedFoods,
          highFodmapCount: f.highFodmapCount,
          highFodmapFoods: f.highFodmapFoods,
        })),
      })
      .catch((error) => {
        this.logger.error(`Failed to sync food to GraphDB: ${error.message}`);
      });

    return food;
  }
}
```

### 3. User API 예시

```typescript
// src/user/user.controller.ts
import { Controller, Patch, Body, Param, Logger } from '@nestjs/common';
import { UserService } from './user.service';
import { GraphSyncService } from '../graph-sync/graph-sync.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly userService: UserService,
    private readonly graphSyncService: GraphSyncService,
  ) {}

  @Patch(':chartId')
  async update(
    @Param('chartId') chartId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    // Step 1: PostgreSQL 업데이트
    const user = await this.userService.update(chartId, updateUserDto);

    // Step 2: GraphDB 동기화
    this.graphSyncService
      .syncUser({
        chartId: user.chartId,
        name: user.name,
        innerBeautyType: user.innerBeautyType,
        outerBeautyType: user.outerBeautyType,
        gender: user.gender,
        age: user.age,
      })
      .catch((error) => {
        this.logger.error(`Failed to sync user to GraphDB: ${error.message}`);
      });

    return user;
  }
}
```

---

## 에러 처리

### 1. Fire-and-Forget 패턴

```typescript
// ✅ 올바른 예시: Queue 실패해도 PostgreSQL 저장은 성공
@Post()
async create(@Body() dto: CreateBeautyDto) {
  const beauty = await this.beautyService.create(dto);

  // Promise를 await하지 않고 catch만 추가
  this.graphSyncService.syncBeauty({...}).catch((error) => {
    this.logger.error(`GraphDB sync failed: ${error.message}`);
  });

  return beauty; // PostgreSQL 저장 결과 즉시 반환
}

// ❌ 잘못된 예시: Queue 실패 시 전체 API 실패
@Post()
async create(@Body() dto: CreateBeautyDto) {
  const beauty = await this.beautyService.create(dto);

  // await를 사용하면 Queue 실패 시 API 전체 실패
  await this.graphSyncService.syncBeauty({...});

  return beauty;
}
```

### 2. 트랜잭션 외부 처리

```typescript
// ✅ 올바른 예시: Queue는 트랜잭션 외부에서 호출
@Post()
async create(@Body() dto: CreateBeautyDto) {
  // Step 1: 트랜잭션으로 PostgreSQL 저장
  const beauty = await this.connection.transaction(async (manager) => {
    return await manager.save(Beauty, dto);
  });

  // Step 2: 트랜잭션 종료 후 Queue 추가
  this.graphSyncService.syncBeauty({...}).catch(...);

  return beauty;
}
```

### 3. Retry 옵션 (필요시)

```typescript
// GraphSyncService에서 Job 옵션 추가
async syncBeauty(data: BeautySyncJob): Promise<string> {
  const job = await this.beautyQueue.add('sync', data, {
    attempts: 3, // 최대 3번 재시도
    backoff: {
      type: 'exponential',
      delay: 1000, // 1초 → 2초 → 4초
    },
    removeOnComplete: 100, // 완료 후 100개만 보관
    removeOnFail: 1000, // 실패 후 1000개만 보관
  });

  return job.id!;
}
```

---

## 테스트 가이드

### 1. Unit Test (GraphSyncService)

```typescript
// src/graph-sync/graph-sync.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { GraphSyncService } from './graph-sync.service';

describe('GraphSyncService', () => {
  let service: GraphSyncService;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'test-job-id' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphSyncService,
        {
          provide: getQueueToken('graph-sync-beauty'),
          useValue: mockQueue,
        },
        // ... 나머지 Queue도 동일하게 Mock
      ],
    }).compile();

    service = module.get<GraphSyncService>(GraphSyncService);
  });

  it('should enqueue beauty sync job', async () => {
    const jobId = await service.syncBeauty({
      chartId: 'TA11150002',
      dateId: 'TA11150002_2025-11-28',
      date: '2025-11-28',
      totalScore: 140,
      innerBeautyScore: 70,
      outerBeautyScore: 70,
      innerBeautyDetails: [{ no: 1, score: 10 }],
      outerBeautyDetails: [{ no: 1, score: 10 }],
    });

    expect(jobId).toBe('test-job-id');
    expect(mockQueue.add).toHaveBeenCalledWith('sync', expect.any(Object));
  });
});
```

### 2. Integration Test (Controller)

```typescript
// src/beauty/beauty.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BeautyController } from './beauty.controller';
import { BeautyService } from './beauty.service';
import { GraphSyncService } from '../graph-sync/graph-sync.service';

describe('BeautyController', () => {
  let controller: BeautyController;
  let beautyService: BeautyService;
  let graphSyncService: GraphSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BeautyController],
      providers: [
        {
          provide: BeautyService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 1, chartId: 'TA11150002' }),
          },
        },
        {
          provide: GraphSyncService,
          useValue: {
            syncBeauty: jest.fn().mockResolvedValue('job-id'),
          },
        },
      ],
    }).compile();

    controller = module.get<BeautyController>(BeautyController);
    beautyService = module.get<BeautyService>(BeautyService);
    graphSyncService = module.get<GraphSyncService>(GraphSyncService);
  });

  it('should create beauty and enqueue sync job', async () => {
    const dto = { chartId: 'TA11150002', totalScore: 140 };
    const result = await controller.create(dto);

    expect(beautyService.create).toHaveBeenCalledWith(dto);
    expect(graphSyncService.syncBeauty).toHaveBeenCalled();
    expect(result).toEqual({ id: 1, chartId: 'TA11150002' });
  });
});
```

### 3. Bull Board 모니터링

**biocom-mq Worker의 Bull Board 접속**:

```
http://localhost:20804/admin/queues
```

- 각 Queue의 Job 상태 확인 (Waiting, Active, Completed, Failed)
- Failed Job의 에러 메시지 및 Stack Trace 확인
- Job 재시도 (Retry Failed Jobs)

### 4. 통합 테스트 (E2E)

```bash
# 1. biocom-mq Worker 실행 확인
curl http://localhost:20804/health

# 2. biocom-api에서 Beauty 저장 API 호출
curl -X POST http://localhost:8001/api/beauty \
  -H "Content-Type: application/json" \
  -d '{
    "chartId": "TA11150002",
    "dateId": "TA11150002_2025-11-28",
    "date": "2025-11-28",
    "totalScore": 140,
    "innerBeautyScore": 70,
    "outerBeautyScore": 70,
    "innerBeautyDetails": [{"no": 1, "score": 10}],
    "outerBeautyDetails": [{"no": 1, "score": 10}]
  }'

# 3. Bull Board에서 Job 처리 확인
# http://localhost:20804/admin/queues

# 4. Neo4j에서 데이터 확인
# Neo4j Browser에서 Cypher 실행:
MATCH (u:User {chart_id: "TA11150002"})-[:HAS_DATE]->(d:Date {date_id: "TA11150002_2025-11-28"})-[:HAS_BEAUTY]->(b:Beauty)
RETURN u, d, b
```

---

## 요약

### biocom-api 개발자가 해야 할 일

1. ✅ **BullMQ 패키지 설치** (`@nestjs/bullmq`, `bullmq`)
2. ✅ **Redis 연결 설정** (app.module.ts에 BullModule.forRoot 추가)
3. ✅ **GraphSyncModule 생성** (9개 Queue 등록)
4. ✅ **GraphSyncService 구현** (9개 sync 메서드)
5. ✅ **타입 정의** (src/graph-sync/types/queue.types.ts)
6. ✅ **API Controller에 연동** (Fire-and-Forget 패턴)
7. ✅ **Unit Test 작성**
8. ✅ **E2E Test 수행**

### 주의사항

- **Fire-and-Forget**: Queue 실패해도 PostgreSQL 저장은 성공 처리
- **트랜잭션 외부**: Queue는 DB 트랜잭션 외부에서 호출
- **타입 안전성**: 모든 Job 데이터는 TypeScript 인터페이스로 정의
- **에러 로깅**: Queue 실패 시 Logger로 에러 기록 (alert 설정 가능)

---

**문서 버전**: 2.0.0 (NestJS)
**작성일**: 2025-12-01
**작성자**: biocom-mq Team
