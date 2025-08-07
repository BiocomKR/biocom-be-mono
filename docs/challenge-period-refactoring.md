# 챌린지 기간 관리 리팩토링 가이드

## 1. 현재 문제점
- 챌린지 시작일이 `2025-06-30`로 하드코딩
- 21일 이후 로직 처리 불가
- 새로운 챌린지 시작 시 코드 수정 필요

## 2. 해결 방안

### 2.1 새 테이블 추가
```prisma
model ChallengePeriod {
  id          Int       @id @default(autoincrement())
  name        String    
  startDate   DateTime  @map("start_date")
  endDate     DateTime  @map("end_date")
  totalDays   Int       @default(21)
  isActive    Boolean   @default(false)
  description String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime? @updatedAt
  
  @@map("challenge_periods")
}
```

### 2.2 수정이 필요한 파일들

#### 1) quiz.service.ts
```typescript
// 기존
const challengeStartDate = parseKoreanDate('2025-06-30');

// 변경
const activePeriod = await this.getActiveChallengePeriod();
const challengeStartDate = activePeriod.startDate;
```

#### 2) mission.service.ts
```typescript
// 동일하게 하드코딩된 날짜를 DB 조회로 변경
```

#### 3) survey.service.ts
```typescript
// 21일 이후 사후설문 가능 여부 체크 로직
const activePeriod = await this.getActiveChallengePeriod();
const daysSinceStart = getDaysDifferenceKST(now, activePeriod.startDate);
const canTakeAfterSurvey = daysSinceStart >= activePeriod.totalDays;
```

### 2.3 새로운 서비스 메서드

```typescript
// challenge-period.service.ts
class ChallengePeriodService {
  // 현재 활성 챌린지 조회
  async getActivePeriod(): Promise<ChallengePeriod> {
    const period = await this.prisma.challengePeriod.findFirst({
      where: { isActive: true }
    });
    
    if (!period) {
      throw new NotFoundException('활성화된 챌린지가 없습니다.');
    }
    
    return period;
  }

  // 챌린지 일차 계산
  async calculateChallengeDay(date: Date): Promise<number> {
    const period = await this.getActivePeriod();
    const day = getDaysDifferenceKST(date, period.startDate) + 1;
    
    // 챌린지 종료 체크
    if (day > period.totalDays) {
      throw new BadRequestException('챌린지가 종료되었습니다.');
    }
    
    return day;
  }

  // 새 챌린지 시작
  async startNewChallenge(data: CreateChallengePeriodDto): Promise<ChallengePeriod> {
    // 기존 활성 챌린지 비활성화
    await this.prisma.challengePeriod.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });
    
    // 새 챌린지 생성
    return this.prisma.challengePeriod.create({
      data: {
        ...data,
        endDate: addDays(data.startDate, data.totalDays - 1),
        isActive: true
      }
    });
  }
}
```

### 2.4 마이그레이션 순서

1. **테이블 생성**
   ```bash
   npx prisma migrate dev --name add-challenge-periods
   ```

2. **초기 데이터 입력**
   ```sql
   INSERT INTO challenge_periods (name, start_date, end_date, total_days, is_active)
   VALUES ('2025년 7월 건강 챌린지', '2025-07-01', '2025-07-21', 21, true);
   ```

3. **서비스 리팩토링**
   - ChallengePeriodService 생성
   - 각 서비스에서 하드코딩된 날짜 제거
   - 의존성 주입

4. **테스트**
   - 일차 계산 테스트
   - 챌린지 종료 시 동작 테스트
   - 새 챌린지 시작 테스트

### 2.5 추가 고려사항

1. **챌린지 간 공백 기간**
   - 이전 챌린지 종료 ~ 다음 챌린지 시작 사이

2. **사용자 알림**
   - 챌린지 시작/종료 알림
   - 남은 일수 표시

3. **관리자 기능**
   - 챌린지 생성/수정 API
   - 챌린지 통계 조회