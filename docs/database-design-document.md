# 바이오컴 API 데이터베이스 설계 문서

> 작성일: 2025-07-30  
> 버전: 2.0  
> 작성자: Claude Code & 개발팀

## 1. 개요

### 1.1 배경
기존 챌린지 전용 시스템을 범용 이벤트 관리 시스템으로 확장 개편

### 1.2 주요 변경사항
- 챌린지 전용 구조 → 범용 이벤트 시스템
- JSON 기반 설정 → 관계 테이블 기반 구조
- 로그성 테이블 → 구조화된 데이터 관리

## 2. 설계 원칙

### 2.1 핵심 원칙
1. **이벤트 중심 설계**: 모든 활동은 이벤트를 중심으로 관리
2. **재사용성**: 미션, 설문 등 컴포넌트의 재사용 가능
3. **확장성**: 새로운 이벤트 타입과 활동 추가 용이
4. **데이터 무결성**: 명확한 관계 설정으로 정합성 보장

### 2.2 설계 결정사항
- `event_users` 테이블을 통한 참여자 관리
- 활동별 전용 테이블 분리 (survey_answers, mission_completions, quiz_answers)
- 중복 데이터 제거 (survey_results, activity_records 삭제)

## 3. 테이블 구조

### 3.1 사용자 및 인증 시스템

#### users (사용자)
- 기본 사용자 정보 관리
- 이메일 기반 인증
- 포인트 잔액 관리

#### file_uploads (파일 업로드)
- 사용자 업로드 파일 관리
- 미션 인증 사진 등 저장

#### point_histories (포인트 이력)
- 포인트 적립/사용 내역
- 관련 활동 추적 가능

### 3.2 이벤트 관리 시스템

#### event_periods (이벤트 기간)
- 모든 이벤트의 마스터 테이블
- 타입: EVENT, SURVEY, PROMOTION, CHALLENGE
- 기간 기반 관리

#### event_users (이벤트 참여자)
- **핵심 테이블**: 이벤트와 사용자 간의 관계
- 참여 상태 관리: ACTIVE, COMPLETED
- 통계 정보: 총 포인트, 완료 일수

### 3.3 미션 시스템

#### missions (미션 마스터)
- 재사용 가능한 미션 정의
- 코드 기반 고유 식별

#### mission_schedules (미션 일정)
- 일차별 미션 내용 관리
- JSON 기반 유연한 데이터 구조

#### event_missions (이벤트-미션 매핑)
- 이벤트별 미션 구성
- 활성화 기간 설정 가능

#### mission_completions (미션 완료)
- 참여자의 미션 수행 기록
- 인증 파일 연결

### 3.4 설문 시스템

#### surveys (설문 마스터)
- 설문 세트 관리
- 재사용 가능한 구조

#### survey_questions (설문 질문)
- 설문별 또는 공통 질문
- 카테고리별 분류

#### survey_options (설문 선택지)
- 공통 선택지 마스터
- 점수 체계 포함

#### event_surveys (이벤트-설문 매핑)
- 이벤트별 설문 구성
- 설문 타입 설정 (before/after)

#### survey_answers (설문 답변)
- 참여자의 설문 답변
- event_user_id를 통한 연결

### 3.5 퀴즈 시스템

#### event_quizzes (이벤트 퀴즈)
- 이벤트별 일차별 퀴즈
- JSON 기반 선택지

#### quiz_answers (퀴즈 답변)
- 참여자의 퀴즈 답변
- 정답 여부 및 획득 포인트

### 3.6 기타

#### category_details (카테고리 상세)
- 카테고리별 캐릭터 정보
- 설문 결과 분석용
* 사용 안하게 될 가능성 상당히 높음
* 기존 설계의 잔재

#### imweb_info (아임웹 연동)
- 외부 시스템 연동 정보
- OAuth 토큰 관리

## 4. 주요 관계

### 4.1 이벤트 참여 플로우
```
users → event_users → survey_answers
                   → mission_completions
                   → quiz_answers
```

### 4.2 컴포넌트 재사용
```
missions → event_missions → event_periods
surveys → event_surveys → event_periods
```

## 5. 데이터 마이그레이션

### 5.1 테이블 이름 변경
- challenge_periods → event_periods
- challenge_missions → event_missions

### 5.2 삭제된 테이블
- survey_results: 불필요한 중복 데이터
- activity_records: 구조화되지 않은 로그성 데이터

### 5.3 추가된 테이블
- event_users: 이벤트 참여자 관리
- surveys: 설문 마스터
- mission_completions: 미션 수행 기록
- quiz_answers: 퀴즈 답변

## 6. 인덱스 전략

### 6.1 주요 인덱스
- event_users: (event_id, user_id) UNIQUE
- event_users: (event_id, status) - 상태별 조회
- mission_completions: (event_user_id, day) - 일차별 조회
- survey_answers: (event_user_id, survey_question_id, type) UNIQUE

## 7. 확장 고려사항

### 7.1 새로운 이벤트 타입
- event_periods.type에 새로운 값 추가
- 필요시 관계 테이블 추가 (예: event_coupons)

### 7.2 새로운 활동 타입
- event_users와 연결되는 새로운 테이블 추가
- 기존 패턴 따라 구현

## 8. 성능 최적화

### 8.1 쿼리 최적화
- 이벤트별 통계: event_users 테이블에서 직접 조회
- 참여자별 활동: event_user_id 기반 인덱스 활용

### 8.2 데이터 보관
- 종료된 이벤트 데이터 아카이빙 고려
- 시계열 데이터 파티셔닝 검토

## 9. 보안 고려사항

### 9.1 개인정보
- 비밀번호: bcrypt 해시
- 민감 정보: 별도 암호화 고려

### 9.2 접근 제어
- event_user_id 기반 데이터 접근 제한
- 관리자/사용자 권한 분리

## 10. 모니터링 및 운영

### 10.1 주요 지표
- 이벤트별 참여율
- 미션 완료율
- 퀴즈 정답률
- 일별 활성 사용자

### 10.2 데이터 정합성
- event_users.total_points 검증
- 관계 무결성 체크

## 부록: ERD
[complete-system-erd.md](./complete-system-erd.md) 참조