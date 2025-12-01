# 그래프 DB 기술 검토 문서

> 작성일: 2025-11-28
> 검토자: Claude Code (with 형님)
> 상태: 기술 검토 단계

---

## 1. 검토 배경

### 현재 AI 챗봇 아키텍처의 문제점

```
바이오컴 앱
  ↓
AI 에이전트 API 호출
  ↓
JSON 응답 (수 MB)
  ↓
파싱 + LLM 토큰 주입 (💸 비용 폭탄)
```

**주요 문제:**
1. **데이터 크기**: JSON 트래픽 부하
2. **파싱 리소스**: CPU/메모리 소모
3. **토큰 비용**: LLM에 전체 JSON 주입 시 토큰 소모 심각 ⭐ (가장 큰 문제)

### 제안된 해결 방안

**그래프 DB 도입:**
- AI 에이전트가 직접 그래프 DB 쿼리
- 필요한 관계만 선택적으로 추출
- 토큰 비용 대폭 절감

---

## 2. 그래프 DB 개요

### 2.1 그래프 DB란?

**데이터 저장 방식:**
- **노드 (Node)**: 엔티티 (사용자, 영양제, 영양소 등)
- **관계 (Relationship)**: 노드 간 연결 (화살표)
- **속성 (Property)**: 노드/관계의 데이터

**예시:**
```
(User:홍길동) --[TOOK_SUPPLEMENT {date: 2025-11-28, morning: true}]--> (Product:바이오밸런스)
     |                                                                          |
     |--[HAS_GOAL {target: '면역력'}]---------------------------->        (Effect:면역력)
                                                                                |
                                                          (Nutrient:아연) <--[CONTAINS]
```

### 2.2 RDB vs 그래프 DB

| 항목 | PostgreSQL (현재) | Neo4j (제안) |
|------|------------------|-------------|
| 데이터 구조 | 테이블 + 외래키 | 노드 + 관계 |
| 관계 표현 | JOIN (느림) | 포인터 (빠름) |
| 스키마 | 고정 | 유연 (스키마리스) |
| 복잡한 관계 탐색 | 느림 (다중 JOIN) | 빠름 (네이티브) |
| 저장 용량 | 거의 무제한 | 거의 무제한 |
| 인덱스 | 있음 | 있음 |

### 2.3 왜 AI 챗봇에 적합한가?

**PostgreSQL 방식:**
```sql
-- 여러 JOIN으로 데이터 추출
SELECT ... FROM users u
JOIN user_records ur ON ...
JOIN products p ON ...
JOIN product_nutrients pn ON ...
-- 전체 결과를 JSON으로 변환 → LLM에 주입 (토큰 폭탄)
```

**Neo4j 방식:**
```cypher
// 필요한 관계만 딱 쿼리
MATCH (u:User {id: 1})-[took:TOOK]->(s:Supplement)-[:CONTAINS]->(n:Nutrient)
WHERE took.count < n.recommended
RETURN n.name, n.recommended, count(took) as actual
// 결과만 LLM에 주입 (토큰 절약)
```

---

## 3. 제안 아키텍처

### 3.1 전체 시스템 구조

```
┌─────────────────────────────────────────────┐
│               바이오컴 앱                     │
└─────────────────────────────────────────────┘
                    ↓ HTTP
┌─────────────────────────────────────────────┐
│          biocom-api (NestJS)                │
│  - Controller, Service                      │
│  - PostgreSQL 저장 (Source of Truth)        │
│  - BullMQ Producer (큐에 작업 추가)          │
└─────────────────────────────────────────────┘
                    ↓
          [Redis Queue - BullMQ]
                    ↓
┌─────────────────────────────────────────────┐
│          biocom-mq (별도 프로젝트)           │
│  - BullMQ Consumer                          │
│  - Neo4j Driver                             │
│  - 그래프 DB 동기화 Worker                   │
└─────────────────────────────────────────────┘
                    ↓
          [Neo4j Graph Database]
                    ↑
┌─────────────────────────────────────────────┐
│          AI 에이전트 (별도 시스템)            │
│  - Neo4j 직접 쿼리                           │
│  - 필요한 관계만 추출                         │
│  - LLM에 최소 토큰 주입                       │
└─────────────────────────────────────────────┘
```

### 3.2 데이터 흐름

**1. 사용자 기록 저장:**
```typescript
// biocom-api/src/tracking/services/tracking.service.ts
async createSupplementRecord(userId, dto) {
  // Step 1: PostgreSQL 저장 (즉시)
  const record = await this.prisma.userRecord.create(...);

  // Step 2: BullMQ 큐에 작업 추가 (비동기, 논블로킹)
  await this.graphSyncQueue.add('sync-supplement', {
    userId,
    recordId: record.id,
    productId: dto.metadata.productId,
    date: record.date,
    metadata: dto.metadata,
  });

  return record; // 즉시 응답 (사용자 대기 시간 0)
}
```

**2. Worker가 그래프 DB 동기화:**
```typescript
// biocom-mq/src/processors/graph-sync.processor.ts
@Process('sync-supplement')
async handleSupplementSync(job: Job) {
  const { userId, productId, date, metadata } = job.data;

  // Neo4j에 직접 저장
  await this.neo4jService.createSupplementRecord({
    userId,
    productId,
    date,
    morning: metadata.morning,
    afternoon: metadata.afternoon,
    evening: metadata.evening,
  });
}
```

**3. AI 에이전트가 활용:**
```cypher
// AI 에이전트에서 실행
MATCH (u:User {id: $userId})-[r:TOOK_SUPPLEMENT]->(p:Product)-[:CONTAINS]->(n:Nutrient)
WHERE r.date >= date() - duration('P7D')
RETURN n.name, sum(r.morning + r.afternoon + r.evening) as intake
```

### 3.3 장점

1. **토큰 비용 절감** ⭐
   - 전체 JSON vs 필요한 관계만
   - 예상 토큰 절감: 80~90%

2. **사용자 경험 유지**
   - 앱은 기존 속도 그대로 (PostgreSQL 저장만 기다림)
   - 그래프 동기화는 백그라운드 (BullMQ)

3. **장애 격리**
   - 그래프 DB 장애 시에도 앱 정상 동작
   - PostgreSQL이 Source of Truth

4. **확장성**
   - Worker 스케일 아웃 가능
   - Redis가 버퍼 역할

5. **재처리 가능**
   - 동기화 실패 시 자동 재시도
   - BullMQ의 재시도 정책 활용

---

## 4. 프로젝트 분리 전략

### 4.1 왜 별도 프로젝트인가?

**기존 경험 기반:**
- 이전 프로젝트에서 백엔드-MQ 분리 운영 경험 있음
- 리소스 격리, 독립 배포, 장애 격리 효과 검증됨

**프로젝트 구조:**
```
biocom-api/           # 기존 NestJS API
└── BullMQ Producer만 추가

biocom-mq/            # 신규 Worker 프로젝트 (별도 repo)
├── BullMQ Consumer
├── Neo4j Driver
└── 그래프 동기화 로직
```

### 4.2 GKE 배포 구조

```yaml
# biocom-api Deployment
spec:
  replicas: 3  # 트래픽 따라 오토스케일

# biocom-mq Deployment
spec:
  replicas: 2  # 큐 길이 따라 오토스케일
```

**리소스 할당:**
- API Pod: CPU 500m, Memory 512Mi
- Worker Pod: CPU 250m, Memory 256Mi

---

## 5. 기술 선택

### 5.1 그래프 DB: Neo4j

**선택 이유:**
- 가장 성숙한 그래프 DB (2007년부터)
- LLM 통합 사례 많음
- Cypher 쿼리 언어 직관적
- 클라우드(Aura) / 셀프호스팅 선택 가능

**대안:**
- Memgraph: 더 빠르지만 생태계 작음
- Amazon Neptune: AWS 종속

**배포 옵션:**
1. **Neo4j Aura** (클라우드) - 추천
   - 관리 불필요
   - 무료 티어 (테스트용)
   - 유료: $65/월~

2. **GKE 셀프호스팅**
   - Helm Chart 제공
   - 비용: GKE 리소스만
   - 관리 필요

### 5.2 메시지 큐: BullMQ

**선택 이유:**
- 기존 프로젝트 사용 경험 있음
- Redis 기반 (이미 사용 중)
- 자동 재시도, Dead Letter Queue 지원

**큐 네이밍 전략:**
- `graph-sync-supplement`
- `graph-sync-diet`
- `graph-sync-exercise`
- (역할별로 큐 분리 - 이전 프로젝트 경험 기반)

---

## 6. 데이터 모델

### 6.1 노드 타입

```cypher
// 사용자
(User {
  id: number,
  // 필요시 추가 속성
})

// 영양제 제품
(Product {
  id: number,
  name: string,
  category: string
})

// 영양소
(Nutrient {
  name: string,
  recommendedDaily: number
})

// 건강 효과
(HealthEffect {
  name: string,
  description: string
})
```

### 6.2 관계 타입

```cypher
// 사용자 → 영양제 섭취
(User)-[TOOK_SUPPLEMENT {
  date: date,
  morning: boolean,
  afternoon: boolean,
  evening: boolean
}]->(Product)

// 영양제 → 영양소 포함
(Product)-[CONTAINS {
  amount: number,
  unit: string
}]->(Nutrient)

// 영양소 → 건강 효과
(Nutrient)-[SUPPORTS]->(HealthEffect)

// 사용자 → 건강 목표
(User)-[HAS_GOAL {
  priority: number
}]->(HealthEffect)
```

### 6.3 인덱스 전략

```cypher
// User.id (필수)
CREATE CONSTRAINT user_id_unique FOR (u:User) REQUIRE u.id IS UNIQUE;

// Product.id (필수)
CREATE CONSTRAINT product_id_unique FOR (p:Product) REQUIRE p.id IS UNIQUE;

// Nutrient.name
CREATE INDEX nutrient_name_index FOR (n:Nutrient) ON (n.name);

// 관계의 date (날짜 범위 검색 많으면)
CREATE INDEX took_date_index FOR ()-[r:TOOK_SUPPLEMENT]-() ON (r.date);
```

### 6.4 용량 예상

**바이오컴 프로젝트 1년 기준:**
```
노드:
- 사용자: 10만 명
- 영양제: 1만 개
- 영양소: 100개
- 건강효과: 50개
= 총 11만 개

관계:
- TOOK_SUPPLEMENT: 10만 × 365 × 3 = 1억 개
- CONTAINS: 1만 × 5 = 5만 개
- SUPPORTS: 100 × 3 = 300개
= 총 1억 개

필요 리소스:
- 메모리: 4~8GB
- 디스크: 수십 GB
- 쿼리 속도: 밀리초 단위
```

---

## 7. 구현 로드맵

### Phase 1: PoC (Proof of Concept)
- [ ] Neo4j Aura 무료 계정 생성
- [ ] biocom-mq 프로젝트 생성 (최소 구조)
- [ ] 영양제 기록 1개 타입만 동기화 테스트
- [ ] AI 에이전트에서 쿼리 테스트

### Phase 2: 영양제 전체 적용
- [ ] biocom-api에 BullMQ Producer 추가
- [ ] biocom-mq Worker 구현
- [ ] GKE 배포 (2개 Deployment)
- [ ] 기존 데이터 마이그레이션 배치

### Phase 3: 확장
- [ ] 식단 기록 동기화
- [ ] 운동 기록 동기화
- [ ] 수면 기록 동기화
- [ ] AI 에이전트 전면 적용

### Phase 4: 운영 최적화
- [ ] 모니터링 대시보드 (Bull Board)
- [ ] 동기화 성공률 메트릭
- [ ] 성능 튜닝
- [ ] 비용 최적화

---

## 8. 리스크 및 대응

### 8.1 기술적 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| 그래프 DB 학습 곡선 | 중 | PoC로 충분히 테스트 |
| Neo4j 비용 | 중 | 무료 티어로 시작, 필요시 셀프호스팅 |
| 데이터 일관성 | 낮 | PostgreSQL이 Source of Truth |
| 동기화 지연 | 낮 | BullMQ 재시도 정책 |

### 8.2 운영 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| 그래프 DB 장애 | 낮 | AI 챗봇만 영향, 앱은 정상 |
| Worker 장애 | 낮 | 큐에 적재, 복구 시 자동 처리 |
| 초기 마이그레이션 | 중 | 배치 작업, 단계적 적용 |

---

## 9. 기대 효과

### 9.1 정량적 효과

- **토큰 비용 절감**: 80~90% 예상
- **AI 응답 속도**: 2~3배 향상 (파싱 시간 제거)
- **관계 쿼리 속도**: PostgreSQL 대비 10~100배

### 9.2 정성적 효과

- AI 챗봇 품질 향상 (더 풍부한 컨텍스트 활용 가능)
- 시스템 확장성 확보 (향후 다른 AI 기능에도 활용)
- 개발 생산성 향상 (관계 쿼리 단순화)

---

## 10. 의사결정 포인트

### 검토 중인 사항:
1. ✅ 아키텍처 타당성 검증 완료
2. ✅ 프로젝트 분리 전략 확정 (biocom-api + biocom-mq)
3. ✅ 기술 스택 선정 (Neo4j + BullMQ)
4. ⏳ 비용 검토 필요 (Neo4j Aura vs 셀프호스팅)
5. ⏳ PoC 일정 및 리소스 확정 대기

### 다음 액션:
- [ ] 경영진/의사결정권자 승인
- [ ] PoC 착수 여부 결정
- [ ] 예산 확보 (Neo4j 라이선스)

---

## 11. 참고 자료

### 11.1 Neo4j 공식 문서
- https://neo4j.com/docs/
- https://neo4j.com/developer/cypher/

### 11.2 AI + 그래프 DB 사례
- LangChain Neo4j Integration
- LlamaIndex Knowledge Graph
- OpenAI + Neo4j RAG Examples

### 11.3 관련 기술 블로그
- Neo4j + LLM Best Practices
- BullMQ Production Guide

---

## 부록: Q&A

### Q1. 그래프 DB는 언제 나온 기술인가?
- 기술 자체: 2007년 Neo4j 1.0 (약 20년)
- AI 결합: 2022~2023년 ChatGPT 이후 급부상
- 현재: AI/LLM 시대의 핵심 기술로 재조명

### Q2. 노드 저장 용량은?
- 이론적 최대: 약 340억 개 (32비트 ID)
- 실제 제약: 디스크/메모리 (RDB와 동일)
- 바이오컴 규모: 전혀 문제없음

### Q3. 인덱스 개념이 있나?
- ✅ 있음 (B-tree, Full-text, Composite Index)
- 노드/관계 속성 모두 인덱스 가능
- 다만 관계는 포인터로 연결되어 있어 인덱스 의존도 낮음

### Q4. 스키마가 있나?
- 스키마리스 (NoSQL 스타일)
- 하지만 제약조건 걸 수 있음 (선택적)
- 일관성은 애플리케이션 코드로 관리 권장

### Q5. 기존 BullMQ 경험 활용 가능?
- ✅ 가능
- 큐 이름 분리 전략 그대로 적용
- Slack 에러 알람 연동 재사용
- 도커 로그 모니터링 방식 동일

---

**문서 버전:** 1.0
**마지막 수정:** 2025-11-28
**다음 리뷰:** PoC 완료 후
