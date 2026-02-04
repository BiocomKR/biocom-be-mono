# Topic 발송 로그 전략

## 📋 개요

FCM Topic 기반 푸시 발송의 로그 저장 전략을 정의합니다.

**작성일**: 2025-11-20
**관련 파일**:
- [src/push/services/push-topic.service.ts](../../src/push/services/push-topic.service.ts)
- [src/push/providers/fcm.provider.ts](../../src/push/providers/fcm.provider.ts)

---

## 🎯 Topic 발송의 특성

### 1. 일반 발송 vs Topic 발송 비교

| 구분 | 일반 발송 (sendToUser) | Topic 발송 (sendToTopic) |
|------|----------------------|------------------------|
| **수신자** | 특정 유저 1명 | Topic 구독자 전체 (수백~수천 명) |
| **발송 방식** | 유저별 FCM 토큰으로 개별 발송 | FCM Topic으로 1회 발송 |
| **로그 저장** | 유저별 개별 로그 (userId, pushTokenId 모두 존재) | **수신자 정보 없음** |
| **FCM API 호출** | N명 → N회 호출 | N명 → 1회 호출 |
| **비용** | 높음 (호출 횟수 많음) | 낮음 (호출 1회) |
| **DB 부하** | 높음 (로그 N개) | 낮음 (로그 0~1개) |

### 2. Topic 발송의 문제점

- **수신자 추적 불가**: FCM이 어떤 유저에게 실제로 전송했는지 알 수 없음
- **userId/pushTokenId 없음**: PushNotificationLog의 NOT NULL 제약에 위배
- **통계 어려움**: 유저별 수신/읽음/클릭 분석 불가

---

## 💡 전략 결정: Hybrid 방식

### 전략 A: 로그 저장 안함 (현재 구현) ✅ **채택**

**장점**:
- Topic 발송의 본래 목적(대량 발송)에 부합
- DB 부하 최소화
- 구현 단순

**단점**:
- 통계 데이터 없음
- 발송 이력 추적 어려움

**적용 범위**:
- 마케팅 푸시 (이벤트, 쿠폰, 프로모션)
- 시스템 공지 (점검, 업데이트)
- 전체 공지

**구현 상태**:
```typescript
// src/push/services/push-topic.service.ts:112-136
async sendToTopic(dto: SendPushToTopicDto) {
  const result = await this.fcmProvider.sendToTopic(dto.topic, {
    title: dto.title,
    body: dto.body,
    imageUrl: dto.imageUrl,
    data: dto.data,
  });
  // ⚠️ 로그 저장 안함
  return result;
}
```

---

### 전략 B: Campaign 로그만 저장 (권장 보완)

**목적**: Topic 발송 이력 최소 추적

**방법**:
1. `PushCampaign` 테이블 신규 생성 (마이그레이션 필요)
2. Topic 발송시 Campaign 로그 1개만 저장
3. 유저별 로그는 저장하지 않음

**Schema 예시**:
```prisma
model PushCampaign {
  id            Int       @id @default(autoincrement())
  topic         String    // 'marketing', 'all-users' 등
  title         String
  body          String
  imageUrl      String?   @map("image_url")
  data          Json?
  type          String    // PushNotificationType enum
  success       Boolean
  messageId     String?   @map("message_id")
  errorCode     String?   @map("error_code")
  errorMessage  String?   @map("error_message")
  sentAt        DateTime  @map("sent_at")

  @@index([topic])
  @@index([sentAt])
  @@map("push_campaigns")
}
```

**장점**:
- Topic 발송 이력 추적 가능
- DB 부하 최소 (발송 1회당 로그 1개)
- 관리자가 "언제 무슨 마케팅 푸시 보냈는지" 확인 가능

**단점**:
- 유저별 수신 여부는 여전히 알 수 없음
- Schema 마이그레이션 필요

**구현 예시**:
```typescript
async sendToTopic(dto: SendPushToTopicDto) {
  const result = await this.fcmProvider.sendToTopic(dto.topic, {
    title: dto.title,
    body: dto.body,
    imageUrl: dto.imageUrl,
    data: dto.data,
  });

  // Campaign 로그 저장
  await this.prisma.pushCampaign.create({
    data: {
      topic: dto.topic,
      title: dto.title,
      body: dto.body,
      imageUrl: dto.imageUrl,
      data: dto.data,
      type: PushNotificationType.MARKETING, // dto에서 받거나 추론
      success: result.success,
      messageId: result.messageId,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      sentAt: new Date(),
    },
  });

  return result;
}
```

---

### 전략 C: 클라이언트 읽음 추적 (선택적 보완)

**목적**: 유저별 읽음/클릭 통계 수집

**방법**:
1. Topic 푸시 수신시 클라이언트가 자동으로 `PATCH /push/notifications/logs/status` 호출
2. 서버는 해당 유저의 로그 생성 (campaignId 포함)
3. 이후 읽음/클릭시 업데이트

**장점**:
- 유저별 수신/읽음/클릭 통계 가능
- 마케팅 효과 분석 가능 (오픈율, 클릭율)

**단점**:
- 클라이언트 구현 필요
- 앱이 꺼져있으면 추적 불가
- DB 부하 증가 (수신자 수만큼 로그 생성)

**적용 시나리오**:
- 중요한 마케팅 캠페인 (A/B 테스트 필요)
- 오픈율/클릭율 분석이 필요한 경우

---

## 🎯 최종 권장 전략

### Phase 1: 현재 상태 유지 (전략 A)
- Topic 발송시 로그 저장 안함
- 마케팅/공지 푸시에 사용
- **적용 중**: `src/push/services/push-topic.service.ts:112-136`

### Phase 2: Campaign 로그 추가 (전략 B) - 향후 도입
- `PushCampaign` 테이블 추가
- Topic 발송 이력만 추적
- **필요시 마이그레이션 작업**

### Phase 3: 클라이언트 추적 (전략 C) - 선택적
- 중요 캠페인에만 적용
- 클라이언트 SDK 업데이트 필요

---

## 📝 관련 API

### 현재 구현된 Topic API

| 엔드포인트 | 메서드 | 설명 | 로그 저장 |
|-----------|--------|------|----------|
| `/push/topics/subscribe` | POST | Topic 구독 | ❌ |
| `/push/topics/unsubscribe` | POST | Topic 구독 해제 | ❌ |
| `/push/topics/send` | POST | Topic 푸시 발송 | ❌ |

### 추후 추가 고려 API (전략 B 도입시)

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/push/campaigns` | GET | 캠페인 로그 조회 |
| `/push/campaigns/:id` | GET | 캠페인 상세 조회 |

---

## 🔄 마이그레이션 가이드 (전략 B 도입시)

### 1. Schema 추가
```bash
# prisma/schema.prisma에 PushCampaign 모델 추가
npx prisma migrate dev --name add_push_campaign
npx prisma generate
```

### 2. Service 수정
```typescript
// src/push/services/push-topic.service.ts
// sendToTopic 메서드에 Campaign 로그 저장 로직 추가
```

### 3. 관리자 조회 API 추가
```typescript
// src/push/controllers/push-notification.controller.ts
@Get('campaigns')
async getPushCampaigns() { /* ... */ }
```

---

## 📊 통계 수집 비교

| 통계 항목 | 일반 발송 | Topic (전략 A) | Topic (전략 B) | Topic (전략 C) |
|----------|----------|---------------|---------------|---------------|
| 발송 이력 | ✅ | ❌ | ✅ | ✅ |
| 유저별 수신 | ✅ | ❌ | ❌ | ✅ |
| 유저별 읽음 | ✅ | ❌ | ❌ | ✅ |
| 유저별 클릭 | ✅ | ❌ | ❌ | ✅ |
| 오픈율 | ✅ | ❌ | ❌ | ✅ |
| 클릭율 | ✅ | ❌ | ❌ | ✅ |
| DB 부하 | 높음 | 낮음 | 낮음 | 중간 |
| FCM 비용 | 높음 | 낮음 | 낮음 | 낮음 |

---

## ✅ 결론

**현재 구현**: 전략 A (로그 저장 안함)
- Topic 발송의 본래 목적에 부합
- 대량 발송시 효율적

**권장 보완**: 전략 B (Campaign 로그)
- 발송 이력 추적 필요시 도입
- DB 부하 최소로 이력 관리

**선택 사항**: 전략 C (클라이언트 추적)
- 마케팅 분석이 중요한 경우에만 적용
- 클라이언트 개발 리소스 필요

---

**작성자**: Claude Code
**최종 업데이트**: 2025-11-20
