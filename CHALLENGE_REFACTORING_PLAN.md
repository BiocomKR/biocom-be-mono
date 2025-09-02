# 챌린지 시스템 대규모 리팩토링 계획

> 작성일: 2024-12-28  
> 최종 수정: 2025-08-28  
> 작성자: Claude Code  
> 상태: 기획 정리 및 현행 시스템 분석 완료

## 📋 개요
기존 이벤트 기반 챌린지 시스템을 개인별 챌린지 수행권 기반으로 전면 개편

## 🔄 주요 변경사항

### 1. 인증 시스템 전면 개편

#### 기존 방식
- 이메일 + 비밀번호 로그인
- SNS 로그인 (카카오, 네이버 등)
- JWT 토큰 기반 인증

#### 변경 방식
- **휴대폰번호 전용 인증**
  - 회원가입: 이름 + 휴대폰번호만 입력
  - 본인인증: PG사(포트원) SMS 인증
  - 인증번호: 4~6자리 숫자
  - SNS 로그인 완전 제거 (추후 개발 예정)

#### 기술 스택
- PG사: 포트원 (계약 예정)
- 본인인증 API + 결제 API 활용
- 구현 시점: 포트원 계약 후 API 제공 시

### 2. 챌린지 수행 프로세스 재설계

#### 기존 프로세스
```
관리자가 이벤트 생성 
→ 수행기간 설정 (예: 2024.01.01 ~ 2024.01.21)
→ 참여자 모집
→ 모든 참여자 동일 기간 진행
```

#### 신규 프로세스
```
사용자가 챌린지 수행권 구매
→ "활성화 가능" 상태
→ 사용자가 활성화 버튼 클릭
→ 클릭일로부터 21일간 개인 챌린지 진행
→ 21일 후 자동 종료
```

### 3. 챌린지 수행권 시스템

#### 핵심 규칙
- **구매**: 여러 개 구매 가능
- **활성화**: 한 번에 1개만 활성화 가능
- **순차 진행**: 진행 중인 챌린지 종료 후 다음 챌린지 활성화 가능
- **선택 활성화**: 여러 수행권 보유 시 사용자가 선택하여 활성화
- **유효기간**: 미정 (정책 논의 필요)

#### 필요 데이터
- 수행권 구매 이력
- 수행권 활성화 상태
- 개인별 챌린지 시작일/종료일
- 미션 수행 기록

### 4. 챌린지 기간 관리

#### 절대 기간 원칙
- **챌린지 기간**: 활성화일 + N일 (백오피스에서 설정)
- **자동 종료**: 설정된 기간 경과 시 수행 여부와 무관하게 종료
- **수행 기록**: 수행한 날짜만 기록 (미수행일은 기록 없음)
- **기간 설정**: 백오피스에서 챌린지 생성 시 총 수행일 입력 (예: 7일, 14일, 21일, 30일 등)

#### 예시 (21일 챌린지의 경우)
```
활성화일: 2024.01.01
종료일: 2024.01.21 (자동 계산: 활성화일 + 21일)
수행 기록: 
- 2024.01.01 (Day 1) ✓
- 2024.01.02 (Day 2) ✗ (기록 없음)
- 2024.01.03 (Day 3) ✓
...
```

### 5. 미션 구조

- **미션 데이터**: 챌린지별 설정된 기간만큼 미리 정의 (기초 데이터)
- **미션 할당**: Day 1 ~ Day N까지 각각 다른 미션
- **동적 생성**: 없음 (모든 미션 사전 정의)
- **유연한 기간**: 7일, 14일, 21일, 30일 등 다양한 기간의 챌린지 지원

## 🔧 기술적 고려사항

### 유지되는 부분
- 쇼핑몰 관련 모든 기능
- 기본 사용자 정보 구조
- 미션 기초 데이터

### 변경 필요 부분
- 인증/로그인 API
- 챌린지 참여 로직
- 이벤트 기간 관리 방식
- 미션 수행 검증 로직

### 미결정 사항
- events, missions 테이블 구조 유지 vs 재설계
- 기존 테스트 데이터 마이그레이션 방법
- 수행권 유효기간 정책

## 📊 영향도 분석 (예정)

### 영향받는 API 목록
- [ ] Auth 관련 전체
- [ ] Event 관련 일부
- [ ] Mission 수행 관련
- [ ] User 프로필 관련

### 영향받는 테이블
- [ ] users (휴대폰번호 필수화)
- [ ] events (기간 관리 변경)
- [ ] missions (개인별 할당)
- [ ] 신규: challenge_tickets (수행권)
- [ ] 신규: user_challenges (개인 챌린지)

## 🚧 작업 계획 (미정)

### Phase 1: 설계 및 분석
- DB 스키마 재설계
- API 영향도 상세 분석
- 마이그레이션 전략 수립

### Phase 2: 인증 시스템 개편
- 휴대폰 인증 구현
- 기존 로그인 제거
- 포트원 연동

### Phase 3: 챌린지 시스템 개편
- 수행권 구매/관리
- 개인별 챌린지 진행
- 미션 수행 로직 수정

### Phase 4: 테스트 및 마이그레이션
- 통합 테스트
- 데이터 마이그레이션
- 배포 준비

## 📊 현행 시스템 분석 (2025-08-28 추가)

### 1. 현재 아키텍처 구조

#### 이벤트 중심 설계
```
Event (챌린지의 중심)
  ├─ EventMission (미션 연결)
  ├─ EventSurvey (설문 연결)  
  ├─ EventQuiz (퀴즈 연결)
  ├─ EventContent (컨텐츠 연결)
  └─ EventUser (참여자 관리)
```

### 2. 각 구성요소별 테이블 구조

#### Mission (미션) 시스템
| 테이블명 | 역할 | 주요 필드 |
|---------|------|----------|
| `missions` | 미션 마스터 정의 | code, name, points, requireUpload |
| `mission_schedules` | 일차별 미션 상세 | day, title, description, data(JSON) |
| `event_missions` | 이벤트-미션 매핑 | eventId, missionId, activeFromDay, activeToDay |
| `mission_completions` | 수행 기록 | eventUserId, eventMissionId, day, completedAt |

#### Survey (설문) 시스템
| 테이블명 | 역할 | 주요 필드 |
|---------|------|----------|
| `surveys` | 설문 마스터 | title, description, type |
| `survey_questions` | 설문 질문 | surveyId, question, sortOrder |
| `survey_options` | 질문 선택지 | questionId, optionText, sortOrder |
| `event_surveys` | 이벤트-설문 매핑 | eventId, surveyId |
| `survey_answers` | 사용자 답변 | userId, surveyOptionId, eventUserId |

#### Quiz (퀴즈) 시스템
| 테이블명 | 역할 | 주요 필드 |
|---------|------|----------|
| `quizzes` | 퀴즈 문제 은행 | title, question, options(JSON), correctAnswer |
| `event_quizzes` | 이벤트-퀴즈 매핑 | eventId, quizId, day |
| `quiz_answers` | 퀴즈 답변 | eventUserId, eventQuizId, selectedAnswer, isCorrect |

#### Content (컨텐츠) 시스템
| 테이블명 | 역할 | 주요 필드 |
|---------|------|----------|
| `contents` | 컨텐츠 마스터 | title, content, type |
| `content_files` | 첨부 파일 | contentId, fileUrl, fileName |
| `event_contents` | 이벤트-컨텐츠 매핑 | eventId, contentId, day |

### 3. 현행 시스템의 설계 의도

#### 장점
- **재사용성**: 모든 구성요소(미션, 퀴즈, 설문, 컨텐츠)를 여러 챌린지에서 재사용 가능
- **유연성**: 각 챌린지마다 다른 구성 가능
- **일차별 관리**: 챌린지 기간(7일, 14일, 21일, 30일 등)의 각 날짜별로 다른 활동 설정 가능
- **확장성**: 새로운 챌린지 추가 시 기존 자산 활용 가능

#### 한계점
- **복잡성**: 관계 테이블이 많아 쿼리가 복잡해짐
- **이벤트 의존성**: 모든 참여자가 동일한 기간(startDate~endDate)에 참여
- **개인화 부족**: 개인별 진행 상황 관리가 어려움

### 4. 리팩토링 시 활용 가능한 부분

#### 유지 가능한 구조
- ✅ 미션, 퀴즈, 설문, 컨텐츠 **마스터 테이블**
- ✅ 일차별 매핑 구조 (day 필드)
- ✅ 수행 기록 관리 체계

#### 변경 필요한 구조
- ❌ Event 테이블의 고정 기간(startDate/endDate) → 개인별 시작일
- ❌ EventUser 중심 진행 → 챌린지 수행권 중심
- ❌ 일괄 참여 방식 → 개인별 활성화 방식

### 5. 신규 챌린지 수행권 시스템 설계 방향

#### 필요한 신규 테이블
```sql
-- 챌린지 마스터 (기존 Event 테이블 대체/개선)
challenges (
  id,
  name,
  description,
  totalDays,  -- 백오피스에서 설정 (7, 14, 21, 30 등)
  price,      -- 수행권 가격
  isActive,
  createdAt,
  updatedAt
)

-- 챌린지 수행권 구매 내역
challenge_tickets (
  id,
  userId,
  challengeId,
  purchaseDate,
  activationDate,
  expirationDate,
  status (PURCHASED/ACTIVATED/COMPLETED/EXPIRED)
)

-- 개인별 챌린지 진행 상태
user_challenges (
  id,
  userId,
  ticketId,
  startDate,      -- 활성화 날짜
  endDate,        -- startDate + challenge.totalDays
  currentDay,
  completedDays,
  status
)
```

## 📝 작업 노트

- **2024-12-28**: 초기 리팩토링 계획 수립
- **2025-08-28**: 현행 시스템 상세 분석 완료
- 형님 의견: "기존 설계를 유지하면서 부분적으로 수정할 것인가, 아니면 전반적인 점검을 할 것인가" - 추가 논의 필요
- 포트원 계약 후 구체적인 API 스펙 확인 필요
- 테스트 데이터이므로 기존 데이터 삭제 가능

---

*이 문서는 계속 업데이트될 예정입니다.*