# 챌린지 시스템 MVP 최종 설계

> 작성일: 2025-08-28  
> 작성자: Claude Code  
> 상태: MVP 최종 확정

## 🎯 MVP 범위
- **포함**: 챌린지 핵심 기능 (미션, 설문, 퀴즈, 컨텐츠, 기록)
- **제외**: 1:1 상담 시스템 (추후 구현)

## 🏗️ 챌린지 계층 구조

```mermaid
graph TD
    A[챌린지] --> B[4대 구성요소]
    
    B --> C[미션]
    B --> D[설문]
    B --> E[퀴즈]
    B --> F[컨텐츠]
    
    C --> G[일반 미션]
    C --> H[기록형 미션]
    
    H --> I[기록 시스템]
    I --> J[식단]
    I --> K[수면]
    I --> L[운동]
    I --> M[물섭취]
    
    F --> N[강의]
    F --> O[칼럼]
    
    N --> P[주차별 공개]
    O --> P
    
    style A fill:#ff5252
    style B fill:#ffeb3b
    style H fill:#4fc3f7
    style I fill:#81c784
```

## 📊 전체 시스템 구조

```mermaid
graph TB
    subgraph "사용자 앱"
        A[챌린지 대시보드]
        B[미션 화면]
        C[기록 화면]
        D[컨텐츠 화면]
        E[설문/퀴즈]
    end
    
    subgraph "백엔드 API"
        subgraph "챌린지 시스템"
            F[챌린지 관리]
            G[미션 처리]
            H[기록 관리]
            I[컨텐츠 제공]
            J[설문/퀴즈 처리]
        end
    end
    
    subgraph "데이터베이스"
        subgraph "챌린지 데이터"
            K[(challenges)]
            L[(missions)]
            M[(tracking)]
            N[(contents)]
            O[(surveys/quizzes)]
        end
        P[(user_progress)]
    end
    
    A --> F
    B --> G
    C --> H
    D --> I
    E --> J
    
    F --> K
    G --> L
    H --> M
    I --> N
    J --> O
    
    G -.->|기록형 미션| H
    F --> P
    
    F -.->|관리| G
    F -.->|관리| I
    F -.->|관리| J
    F -.->|관리| H
    
    style F fill:#ffebee
    style A fill:#e1f5fe
    style K fill:#fff3e0
    style L fill:#fff3e0
    style M fill:#fff3e0
    style N fill:#fff3e0
    style O fill:#fff3e0
    style P fill:#e8f5e9
```

## 🔄 챌린지 라이프사이클

```mermaid
sequenceDiagram
    autonumber
    participant User as 사용자
    participant App as 앱
    participant API as 백엔드
    participant DB as Database
    participant External as 외부 시스템
    
    Note over User,External: === 1. 챌린지 구매 및 활성화 ===
    
    User->>App: 챌린지 구매권 구매
    App->>API: POST /challenges/purchase
    API->>External: PG사 결제 처리 (추후)
    External-->>API: 결제 완료
    API->>DB: 구매권 저장
    DB-->>API: OK
    API-->>App: 구매 완료
    App-->>User: "구매 완료, 활성화 가능"
    
    User->>App: 챌린지 활성화 클릭
    App->>API: POST /challenges/activate
    API->>DB: 챌린지 시작일 = Today
    API->>DB: 종료일 = Today + 21일
    DB-->>API: 활성화 완료
    API-->>App: 챌린지 활성화 성공
    App-->>User: "챌린지가 시작되었습니다!"
    
    Note over User,External: === 2. 일일 챌린지 수행 (Day N) ===
    
    User->>App: 앱 실행 (Day N)
    App->>API: GET /challenges/my-active
    API->>DB: 활성 챌린지 조회
    API->>DB: 현재 Day 계산 (Today - StartDate + 1)
    DB-->>API: Day N 정보
    API->>DB: Day N 구성요소 조회
    DB-->>API: 미션, 설문, 퀴즈, 컨텐츠 목록
    API-->>App: Day N 대시보드 데이터
    App-->>User: 오늘의 챌린지 표시
    
    Note over User,External: === 3. 미션 수행 (일반/기록형) ===
    
    alt 일반 미션 (퀴즈, 상담 등)
        User->>App: 일반 미션 선택
        App->>API: POST /missions/{id}/complete
        API->>DB: 미션 완료 처리
        API->>DB: 포인트 적립
        DB-->>API: 완료
        API-->>App: 미션 완료 + 포인트
        App-->>User: "100P 획득!"
        
    else 기록형 미션 (식단, 수면 등)
        User->>App: "식단 기록하고 300P" 클릭
        App->>App: 기록 화면으로 이동
        User->>App: 식단 3회 입력
        App->>API: POST /tracking/DIET/record
        API->>DB: 기록 저장
        API->>DB: 연관 미션 체크
        API->>DB: 3/3 완료시 미션 자동 완료
        API->>DB: 포인트 적립
        DB-->>API: 완료
        API-->>App: 기록 + 미션 완료
        App-->>User: "기록 완료! 300P 획득!"
    end
    
    Note over User,External: === 4. 컨텐츠 시청 ===
    
    User->>App: 컨텐츠 탭 선택
    App->>API: GET /contents/week/{weekNumber}
    API->>DB: 현재 주차 계산 (Day 1-7: 1주차)
    DB-->>API: 해당 주차 컨텐츠
    API-->>App: 강의/칼럼 목록
    App-->>User: 컨텐츠 목록 표시
    
    User->>App: 강의 시청
    App->>API: POST /contents/{id}/view
    API->>DB: 시청 기록 확인
    alt 최초 시청
        API->>DB: 시청 포인트 지급
        DB-->>API: 200P 적립
        API-->>App: 시청 완료 + 포인트
        App-->>User: "최초 시청! 200P 획득!"
    else 재시청
        API-->>App: 시청 완료
        App-->>User: 시청 완료
    end
    
    Note over User,External: === 5. 일일 진행률 확인 ===
    
    User->>App: 진행률 확인
    App->>API: GET /challenges/{id}/progress
    API->>DB: 오늘 할당된 활동 조회
    API->>DB: 완료된 활동 조회
    DB-->>API: 진행 데이터
    API->>API: 진행률 계산
    API-->>App: 진행률 정보
    App-->>User: "오늘 진행률: 75%"
    
    Note over User,External: === 6. 21일 후 챌린지 종료 ===
    
    App->>API: GET /challenges/{id}/status
    API->>DB: Day 21 도달 확인
    DB-->>API: 챌린지 종료
    API->>DB: 최종 통계 생성
    DB-->>API: 결과 데이터
    API-->>App: 챌린지 종료 알림
    App-->>User: "챌린지 완료!"
    
    User->>App: 결과 리포트 확인
    App->>API: GET /challenges/{id}/report
    API->>DB: 전체 수행 데이터 집계
    DB-->>API: 리포트 데이터
    API-->>App: 결과 리포트
    App-->>User: 최종 리포트 표시
```

## 🗂️ 데이터 플로우

```mermaid
graph LR
    subgraph "Day N 데이터 흐름"
        A[사용자 활성화] -->|Day 1 시작| B[일차별 구성 로드]
        B --> C{구성요소 확인}
        
        C -->|미션| D[일반 미션]
        C -->|미션| E[기록형 미션]
        C -->|설문| F[설문 조사]
        C -->|퀴즈| G[퀴즈]
        C -->|컨텐츠| H[강의/칼럼]
        
        E -->|데이터 공유| I[기록 시스템]
        
        D --> J[포인트 적립]
        E --> J
        F --> J
        G --> J
        H --> J
        
        J --> K[일일 진행률]
        K --> L[Day N+1]
        
        style A fill:#e1f5fe
        style J fill:#fff59d
        style K fill:#c8e6c9
    end
```

## 💾 핵심 데이터 모델

```mermaid
erDiagram
    CHALLENGES ||--o{ USER_CHALLENGES : "구매/활성화"
    USER_CHALLENGES ||--o{ DAILY_PROGRESS : "일별 진행"
    
    CHALLENGES ||--o{ CHALLENGE_DAY_CONFIGS : "일차별 구성"
    CHALLENGE_DAY_CONFIGS ||--o{ EVENT_MISSIONS : "미션 할당"
    CHALLENGE_DAY_CONFIGS ||--o{ EVENT_SURVEYS : "설문 할당"
    CHALLENGE_DAY_CONFIGS ||--o{ EVENT_QUIZZES : "퀴즈 할당"
    CHALLENGE_DAY_CONFIGS ||--o{ EVENT_CONTENTS : "컨텐츠 할당"
    
    MISSIONS ||--o{ EVENT_MISSIONS : "미션 정의"
    MISSIONS ||--o{ MISSION_COMPLETIONS : "수행 기록"
    
    MISSIONS ||--|| TRACKING_ITEMS : "기록형 미션"
    TRACKING_ITEMS ||--o{ TRACKING_RECORDS : "기록 데이터"
    
    CONTENTS ||--o{ CONTENT_VIEWS : "시청 기록"
    CONTENTS ||--o{ CONTENT_PRODUCTS : "상품 연결"
    
    USER_CHALLENGES ||--o{ MISSION_COMPLETIONS : "미션 수행"
    USER_CHALLENGES ||--o{ TRACKING_RECORDS : "기록 입력"
    USER_CHALLENGES ||--o{ CONTENT_VIEWS : "컨텐츠 시청"
```

## 📈 상태 전이 다이어그램

```mermaid
stateDiagram-v2
    [*] --> PURCHASED: 챌린지 구매
    
    PURCHASED --> ACTIVATED: 사용자 활성화
    
    ACTIVATED --> DAY_1: 챌린지 시작
    
    DAY_1 --> DAY_N: 일일 진행
    DAY_N --> DAY_N: 활동 수행
    
    DAY_N --> DAY_21: 마지막 날
    
    DAY_21 --> COMPLETED: 21일 경과
    
    COMPLETED --> REPORT: 결과 리포트
    
    REPORT --> [*]: 종료
    
    PURCHASED --> EXPIRED: 유효기간 만료
    EXPIRED --> [*]
    
    note right of ACTIVATED
        활성화 시점부터
        21일 카운트 시작
    end note
    
    note right of DAY_N
        - 미션 수행
        - 기록 입력
        - 컨텐츠 시청
        - 설문/퀴즈 참여
    end note
```

## 🎯 MVP 핵심 지표

```mermaid
graph TD
    subgraph "일일 지표"
        A[일일 활동 수] --> B[일일 완료율]
        C[일일 포인트] --> B
    end
    
    subgraph "주차별 지표"
        D[1주차 진행률] --> E[주차별 완료율]
        F[2주차 진행률] --> E
        G[3주차 진행률] --> E
    end
    
    subgraph "최종 지표"
        B --> H[전체 수행률]
        E --> H
        H --> I[챌린지 성공/실패]
    end
    
    style I fill:#ffd54f
```

## ✅ MVP 체크리스트

### 필수 구현
- [x] 챌린지 구매권 시스템
- [x] 개인별 챌린지 활성화
- [x] Day 기반 진행 관리
- [x] 4대 구성요소 (미션, 설문, 퀴즈, 컨텐츠)
- [x] 기록 시스템 (미션과 연동)
- [x] 포인트 시스템
- [x] 주차별 컨텐츠 공개
- [x] 결과 리포트

### 추후 구현
- [ ] 1:1 상담 시스템
- [ ] 푸시 알림
- [ ] 보상 시스템
- [ ] 소셜 기능

---

*이 문서는 12월 오픈을 위한 MVP 최종 설계입니다.*