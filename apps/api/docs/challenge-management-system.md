# 챌린지 관리 시스템 구현 문서

> 작성일: 2025-07-30  
> 작성자: Claude Code + 형님

## 📋 개요

기존의 하드코딩된 챌린지 시스템을 백오피스에서 완전히 관리 가능한 데이터 기반 시스템으로 전환했습니다.

## 🎯 형님의 요구사항

### 최종 목표
1. **백오피스에서 챌린지를 생성 및 관리**
   - 시작일, 종료일, 챌린지 기간 설정
   - 챌린지별로 독립적인 운영

2. **설문 관리**
   - 사전/사후 설문 사용 여부를 챌린지별로 결정
   - 가능한 모든 경우의 수 지원:
     - 설문 없음 (사전X, 사후X)
     - 사전 설문만
     - 사후 설문만
     - 둘 다 있음

3. **미션 관리**
   - 챌린지별로 어떤 미션을 사용할지 선택
   - 미션별 포인트도 챌린지마다 다르게 설정

### 핵심 원칙
- **정적인 구조 대신 테이블에 저장된(정의된) 대로 실행**
- 코드의 하드코딩 제거
- 백오피스만으로 모든 것을 관리

## 🔧 구현 내용

### 1. 데이터베이스 스키마 변경

#### ChallengePeriod 테이블 확장
```prisma
model ChallengePeriod {
  id          Int       @id @default(autoincrement())
  name        String    @db.VarChar(100)              
  startDate   DateTime  @map("start_date") @db.Date   
  endDate     DateTime  @map("end_date") @db.Date     
  totalDays   Int       @default(21) @map("total_days") 
  isActive    Boolean   @default(false) @map("is_active") 
  description String?   @db.Text
  
  // 설문 관련 필드 (새로 추가)
  hasSurveyBefore    Boolean   @default(false) @map("has_survey_before")
  hasSurveyAfter     Boolean   @default(false) @map("has_survey_after")
  surveyBeforeFromDay Int?     @map("survey_before_from_day") // 사전설문 시작일차
  surveyAfterFromDay  Int?     @map("survey_after_from_day")  // 사후설문 시작일차
  
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime? @updatedAt @map("updated_at")
  
  // Relations
  challengeMissions ChallengeMission[]
  
  @@map("challenge_periods")
}
```

#### ChallengeMission 테이블 생성
```prisma
model ChallengeMission {
  id            Int      @id @default(autoincrement())
  challengeId   Int      @map("challenge_id")
  missionId     Int      @map("mission_id")
  points        Int      // 챌린지별 미션 포인트
  activeFromDay Int?     @map("active_from_day") // 활성화 시작 일차
  activeToDay   Int?     @map("active_to_day")   // 활성화 종료 일차
  isActive      Boolean  @default(true) @map("is_active")
  sortOrder     Int      @default(0) @map("sort_order")
  
  // Relations
  challenge     ChallengePeriod @relation(fields: [challengeId], references: [id])
  mission       Mission @relation(fields: [missionId], references: [id])
  
  @@map("challenge_missions")
}
```

### 2. 서비스 코드 리팩토링

#### SurveyService 변경사항
- 하드코딩된 날짜('2025-06-30') 제거
- 챌린지 설정에 따른 설문 가능 여부 체크
- 사전 설문 없이도 사후 설문 가능하도록 수정

```typescript
// 현재 활성 챌린지 확인
const activeChallenge = await this.challengePeriodService.getActivePeriod();

// 설문 사용 여부 확인
if (createSurveyAnswerDto.type === 'before' && !activeChallenge.hasSurveyBefore) {
  throw new BadRequestException('이 챌린지는 사전 설문을 사용하지 않습니다.');
}

// 설문 가능 일차 확인
const currentDay = await this.challengePeriodService.calculateChallengeDay(date);
const surveyFromDay = activeChallenge.surveyBeforeFromDay || 1;
if (currentDay < surveyFromDay) {
  throw new BadRequestException(`사전 설문은 ${surveyFromDay}일차부터 가능합니다.`);
}
```

#### MissionService 변경사항
- 하드코딩된 미션 조회 로직 제거
- ChallengeMission 테이블 기반 미션 조회
- 챌린지별 포인트 적용

```typescript
// 챌린지-미션 매핑에서 해당 일차에 활성화된 미션 조회
const challengeMissions = await this.prisma.challengeMission.findMany({
  where: {
    challengeId: activeChallenge.id,
    isActive: true,
    OR: [
      // 전체 기간 활성 미션
      { activeFromDay: null, activeToDay: null },
      // 현재 일차가 활성 범위에 포함되는 미션
      {
        AND: [
          { OR: [{ activeFromDay: null }, { activeFromDay: { lte: challengeDay } }] },
          { OR: [{ activeToDay: null }, { activeToDay: { gte: challengeDay } }] }
        ]
      }
    ]
  },
  include: { mission: true },
  orderBy: { sortOrder: 'asc' }
});
```

### 3. 설문 시작 일차 설계 결정

형님과 논의한 결과 **옵션 1**을 선택:
- surveyBeforeFromDay = 1 → 챌린지 1일차부터 가능
- surveyAfterFromDay = 21 → 챌린지 21일차부터 가능

**선택 이유:**
- 직관적이고 이해하기 쉬움
- 백오피스에서 날짜 계산 없이 숫자만 입력
- 챌린지 재사용 시 편리

## 📊 현재 상태

### 데이터베이스
- challenge_periods 테이블: 설문 관련 필드 추가 완료
- challenge_missions 테이블: 생성 완료
- 기존 챌린지 데이터 마이그레이션 완료

### 코드
- ChallengePeriodService: 챌린지 기간 관리
- SurveyService: 챌린지 설정 기반 설문 처리
- MissionService: 챌린지-미션 매핑 기반 미션 조회
- PrismaService: 새 테이블 getter 추가

### 테스트 결과
- ✅ 챌린지 설정에 따른 미션 조회
- ✅ 챌린지별 포인트 적용
- ✅ 특정 일차 미션 활성화 (선언문 1일차, 자기칭찬 10일차)
- ✅ 설문 가능 여부 체크

## 🚀 백오피스에서 가능한 것들

1. **챌린지 생성/수정**
   - 이름, 설명, 기간 설정
   - 설문 사용 여부 설정
   - 설문 시작 일차 설정

2. **미션 구성**
   - 사용할 미션 선택
   - 미션별 포인트 설정
   - 활성화 기간 설정 (특정 일차만 또는 전체 기간)

3. **예시 시나리오**
   - "A 챌린지: 설문 없이, 미션 5개로 7일간"
   - "B 챌린지: 사전/사후 설문 있고, 미션 10개로 21일간"
   - "C 챌린지: 사후 설문만, 미션 7개로 14일간"

## 📝 향후 고려사항

1. **챌린지 템플릿**
   - 자주 사용하는 챌린지 구성을 템플릿으로 저장
   - 템플릿 기반 빠른 챌린지 생성

2. **미션 그룹화**
   - 관련 미션들을 그룹으로 관리
   - 그룹 단위로 챌린지에 추가

3. **챌린지 참여자 관리**
   - 특정 사용자 그룹만 참여 가능한 챌린지
   - 초대 코드 기반 참여

## 🔗 관련 파일

- `/prisma/schema.prisma` - 스키마 정의
- `/src/challenge/challenge-period.service.ts` - 챌린지 기간 관리
- `/src/survey/survey.service.ts` - 설문 서비스
- `/src/mission/mission.service.ts` - 미션 서비스
- `/src/common/services/prisma.service.ts` - Prisma 서비스

---

이 문서는 2025년 7월 30일 작업 내용을 정리한 것입니다.