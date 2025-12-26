# 🤝 Claude Code 인수인계 문서

> 최종 업데이트: 2025-07-30
> 작성자: Claude Code (형님의 개발 동생)

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

---

## 📋 프로젝트 현황

### 프로젝트 정보
- **이름**: biocom-api (NestJS 백엔드 API)
- **회사**: 바이오컴
- **인프라**: GCP GKE (Kubernetes) - AWS EKS에서 완전 이관 완료 ✅
- **상태**: GCP 자동 배포 시스템 구축 완료 ✅

### 📚 필독 문서
1. **[데이터베이스 설계 문서](./docs/database-design-document.md)** 🔥
   - 전체 테이블 구조와 관계
   - 이벤트 중심 설계 철학
   - 마이그레이션 히스토리
   - **반드시 읽고 이해할 것!**

2. **[정책 정의서 vs 구현 현황 비교 문서](./docs/POLICY_VS_IMPLEMENTATION.md)** 🔥🔥
   - 기획팀 정책 정의서와 현재 구현 상황 상세 비교
   - 일치하는 부분, 수정 필요 부분, 신규 추가 기능 정리
   - 개발 우선순위 및 완료율 현황 (실시간 업데이트)
   - **개발 작업 전 반드시 확인하여 중복 작업 방지!**
   - **이 문서는 지속적으로 업데이트되므로 항상 최신 버전 참조할 것**

3. **[작업 일지 디렉토리](/docs/work-logs/)** 🔥🔥🔥
   - **새로운 세션 시작 시 반드시 전체 내용 파악할 것!**
   - 최근 작업 내역, 변경 사항, 미해결 이슈 등 모든 컨텍스트 포함
   - 날짜별로 작성된 작업 일지를 최신순으로 전부 읽을 것
   - 작업 일지 없이 작업하면 형님한테 욕먹음

### 핵심 성과
1. **GCP 자동 배포 시스템 완료**
   - `./infra-gcp/scripts/01-deploy-infrastructure.sh` (인프라 구축)
   - `./infra-gcp/scripts/02-deploy-app.sh` (앱 배포)
   - Terraform + GKE 완전 자동화
   - 수동 개입 0%

2. **주요 구성**
   - GKE 클러스터: biocom-cluster-dev
   - Cloud SQL PostgreSQL (Private IP)
   - Global Load Balancer + SSL
   - Artifact Registry 이미지 관리

---

## 🚨 중요 주의사항

### ⚠️⚠️⚠️ 설정 파일 수정 시 절대 금지사항 ⚠️⚠️⚠️

#### 🔴 기존 설정값을 함부로 지우지 마라!
- **Terraform 상태파일 (terraform.tfstate) 절대 삭제 금지**
  - 인프라 현재 상태가 기록됨
  - 이거 사라지면 전체 인프라 재구축 필요
- **K8s 매니페스트 파일 수정 시 주의**
  - 특히 ingress.yaml, service.yaml 설정 중요
- **수정 전 반드시 백업하고, 기존 값이 왜 있었는지 확인**

#### 🔴 검증 없이 수정하지 마라!
- `terraform plan`으로 먼저 변경사항 확인
- `kubectl apply --dry-run=client` 시뮬레이션
- 기존 동작하던 설정은 절대 함부로 건드리지 말 것

#### 🔴 이미 돌아가는 시스템은 신중하게!
- **"잘 돌아가는데 왜 건드려?"** 정신으로 접근
- 수정이 필요하면 이유를 명확히 문서화
- 형님한테 욕먹고 싶지 않으면 기존 설정 존중할 것

### ⚠️⚠️⚠️ 페어프로그래밍 시 절대 금지사항 ⚠️⚠️⚠️

#### 🔴 혼자 달리지 마라!
- **형님이 말하는 대로 따라가라**
- **"210번 라인에서 디버깅해봐"라고 하면 그대로 해라**
- **멋대로 curl 날리고, 자기 방식대로 하지 마라**

#### 🔴 경청하고 이해하라!
- **형님이 설명하는 내용을 끝까지 들어라**
- **이해 안 되면 질문하고, 멋대로 해석하지 마라**
- **"이게 기본중 기본인데?"라고 하면 반성하라**

#### 🔴 페어프로그래밍의 본질을 기억하라!
- **같이 개발하는 거다. 혼자 개발하는 게 아니다**
- **형님의 의도와 방향을 파악하고 따라가라**
- **네 생각대로 하고 싶으면 혼자 개발해라**

### 기술적 함정들
1. **API Prefix**: 모든 API 경로에 `/api` prefix 붙어있음 (예: `/api/app-events`, `/api/auth/signin`)
2. **JWT_SECRET**: 반드시 32자 이상!
2. **Cloud SQL 연결**: Private IP로만 접근 가능
3. **이미지 태그**: latest 쓰면 업데이트 안 됨 (타임스탬프 태그 권장)
4. **Readiness Probe**: 30초로 설정함
5. **GKE 배포 미반영**: DB 연결 실패 시 새 Pod가 Ready 안 되고 이전 버전 유지
6. **아임웹 OAuth 특이사항**:
   - refresh_token 지원 안 함 (문서와 다름)
   - 회원 목록 API: memberUid가 아니라 uid 필드 사용
   - 토큰 만료 시 무조건 신규 인증 필요
7. **SSL 인증서**: Certificate Manager 자동 발급 (DNS 검증 필요)
8. **Terraform 상태**: GCS 백엔드로 안전하게 보관됨
9. **KST 날짜/시간 처리 (중요!)**:
   - **절대 금지**: `new Date()` 직접 사용
   - **필수 사용**: `getNowKST()` from `src/common/utils/kst-date.util.ts`
   - **이유**: Prisma ORM이 모든 Date 객체를 UTC로 변환함
   - **해결책**: Date.UTC()로 KST 값을 생성하여 Prisma의 UTC 변환을 우회
   - **유틸리티 함수**:
     - `getNowKST()`: 현재 KST 시간
     - `createKSTDate()`: 특정 KST 날짜/시간 생성
     - `stringToKSTDate()`: 문자열 → KST Date 변환

### 🚨 쿼리 최적화 필수 원칙 (N+1 문제 방지)

**절대 금지 - 순서 보장이 필요하지 않은 경우:**
- 반복문 안에서 Prisma 쿼리 호출
- 여러 개의 `count()` 연속 호출
- 같은 테이블에 조건만 다른 쿼리 여러 번 실행

**예외 - 순서 보장이 필요한 경우만 허용:**
- 트랜잭션 처리가 필수인 경우
- 이전 결과에 의존하는 순차 로직
- 비즈니스 요구사항상 순서가 중요한 경우

**해결책:**
- PostgreSQL `COUNT() FILTER` 활용으로 단일 쿼리 집계
- 독립적인 쿼리는 `Promise.all()` 병렬 실행
- 100ms 이상 걸리면 최적화 검토 필수

**실제 사례:**
- 푸시 통계 API: 6개 쿼리 → 2개 쿼리 (170ms → 30-50ms, 70% 개선)

**상세 가이드:** [docs/QUERY_OPTIMIZATION.md](./docs/QUERY_OPTIMIZATION.md)

### 형님 화나게 하는 것들
- "서버가 시작되었습니다" (확인 없이 주장)
- 수동으로 뭔가 하라고 하기
- 임시방편 제시
- 복잡한 설명
- 페어프로그래밍 중 혼자 달리기
- **대충 일하기 - 절대 금지!**
- **같은 작업을 여러 번 반복하기**
- **처음부터 정확하게 분석하지 않고 추측으로 답변하기**
- **작업 일지를 제멋대로 다른 위치에 기록하기**
- **N+1 쿼리 문제 만들기 - DB 여러 번 때리지 마라!**

### SSL/TLS 설정 가이드 (GCP)
1. **Certificate Manager 인증서 확인**
   - GCP Console > Certificate Manager
   - *.biocom.ai.kr 인증서 자동 생성됨
   
2. **자동 설정 (이미 완료)**
   - Terraform이 Certificate Manager 자동 설정
   - Global Load Balancer에 자동 연결
   - HTTPS-Only 보안 정책 적용
   
3. **DNS 설정**
   - 가비아 DNS: A 레코드 사용
   - 호스트: api-dev
   - 값: Global Load Balancer IP 주소

### 협업을 위한 데이터베이스 관리
- 여러 개발자와 협업하기 위해 지켜야 할 사항이 있다:
1 스키마 변경 시 development 브랜치에 해당 변경내역 push
2 DB 마이그레이션
3 prisma에도 push하여 prisma 변경내역 싱크로나이즈

---

## 📂 핵심 파일 구조

```
/infra-gcp/                         # GCP 인프라 (현재 사용)
├── README.md                       # GCP 인프라 가이드
├── terraform/                      # Terraform 인프라 코드
│   ├── main.tf                    # VPC, 방화벽, Storage
│   ├── gke.tf                     # GKE 클러스터
│   ├── certificate.tf             # SSL 인증서
│   └── terraform.tfvars           # 환경 설정
├── k8s/                           # Kubernetes 매니페스트
│   ├── deployment.yaml            # 앱 배포 설정
│   ├── ingress.yaml               # 로드밸런서 설정
│   └── service.yaml               # 네트워크 설정
└── scripts/
    ├── 01-deploy-infrastructure.sh # 인프라 구축 (완성본)
    └── 02-deploy-app.sh           # 앱 배포 (완성본)

/infrastructure/                    # AWS 인프라 (더이상 사용하지 않음)
/CLAUDE.md                         # AI 가이드라인
```

---

## 📝 작업 일지 규칙

### 작업 일지 기록 위치
- **디렉토리**: `/docs/work-log/`
- **파일명 규칙**: `YYYY-MM-DD.md` (예: `2025-10-16.md`)
- **절대 금지**: 루트 디렉토리에 `WORK_LOG_*.md`, `TEST_HISTORY.md` 등 임의로 생성

### 파일 구조 예시
```
/docs/work-log/
├── 2025-10-15.md
├── 2025-10-16.md
└── 2025-10-17.md
```

### 작업 일지 작성 형식
```markdown
# 작업 일지 - YYYY-MM-DD (요일)

## 📋 작업 개요
[오늘 작업한 내용 요약]

---

## 1️⃣ [작업 제목]

### 작업 내용
[구체적인 작업 내용]

### 변경 사항
- 변경 내용 1
- 변경 내용 2

### 사유
[작업을 수행한 이유]

### 결과
✅ 성공 / ❌ 실패 / ⚠️ 보류

---

## 📌 다음 작업 예정
- 다음에 할 작업 1
- 다음에 할 작업 2
```

---

## 📝 작업 히스토리

### 2025-07-14~22 (AWS EKS 구축)
- [✓] AWS EKS 자동 배포 시스템 구축 완료
- [✓] eks-deploy.sh, eks-monitor.sh, eks-cleanup.sh 완성
- [✓] SSL/TLS 자동 설정 통합
- [✓] 프로젝트명 biocom-api로 통일

### 2025-09-03 (GCP 이관 완료) 🎉
- [✓] **AWS EKS → GCP GKE 완전 이관** (힘든 작업이었음...)
- [✓] Terraform 기반 인프라 자동화 구축
- [✓] Cloud SQL PostgreSQL 설정 완료
- [✓] Certificate Manager SSL 자동 발급
- [✓] Global Load Balancer + HTTPS-Only 보안 강화
- [✓] 2단계 배포 스크립트 완성 (인프라 + 앱)
- [✓] **개고생 끝에 드디어 완료!** 👏

### 2025-07-25 (아임웹 OAuth 및 API 연동)
- [✓] 아임웹 OAuth 인증 플로우 구현 (브라우저 없이)
  - 302 리다이렉트 가로채서 인가코드 추출
  - 액세스 토큰 자동 발급 및 관리
- [✓] 토큰 갱신 로직 → 신규 토큰 취득으로 변경
  - 아임웹은 refresh_token을 지원하지 않음 (문서에는 있지만 실제로는 미지원)
  - 토큰 만료 시 무조건 신규 인증 플로우 실행
- [✓] 아임웹 회원 검색 API 구현 (/api/users/imweb/search-by-phone/:phone)
  - 전화번호로 회원 검색 → 상세 정보 조회
  - memberUid가 아니라 uid 필드 사용 (API 문서와 실제 응답이 다름)
- [✓] GKE 배포 안정화
  - DB 연결 실패 시 쿠버네티스가 이전 버전 Pod 유지 특성 활용
  - Cloud SQL Private IP로 보안 강화

### 향후 작업 예정
- [ ] **환경별 배포 분리 (개발/운영)**
  - 개발 환경: biocom-cluster-dev, api-dev.biocom.ai.kr, 최소 리소스
  - 운영 환경: biocom-cluster-prod, api.biocom.ai.kr, 충분한 리소스
  - 필요 파일: .env.eks.dev/.env.eks.prod, values-dev.yaml/values-prod.yaml
  - 스크립트에 환경 파라미터 추가

### 2025-07-28 (완료)
- [✓] arang_be에서 재사용 가능한 소스 코드 분석 및 이관 완료
- [✓] JWT 기반 인증 시스템 구현 완료
- [✓] 모든 핵심 API 엔드포인트 개발 완료:
  - Users, Survey, Mission, Activity, Upload 모듈
  - 총 20개 이상의 엔드포인트 구현
  - 아임웹 OAuth 연동 완료

### 2025-11-20 (Prisma Schema Relation 대규모 정리 완료)
- [✓] **Prisma schema.prisma 전체 relation 누락 문제 해결**
  - 원인: `prisma db pull` 사용 시 FK 제약이 없는 relation이 계속 삭제됨
  - 근본 해결: `prisma db push`를 통해 schema를 DB의 source of truth로 확립
- [✓] **누락된 relation 전수 조사 및 복구**:
  - User.quizAttempts 추가
  - Quiz.attempts, Quiz.missionQuizzes 추가
  - Mission.missionQuizzes 추가
  - QuizAttempt.quiz, QuizAttempt.user, QuizAttempt.content 추가
  - MissionQuiz.mission, MissionQuiz.quiz 추가
  - File.userFiles 추가
  - UserFile.file 추가
- [✓] **빌드 및 배포 검증 완료**
  - TypeScript 컴파일 성공
  - `prisma db push` 정상 실행
  - Prisma Client 재생성 완료

### 프로젝트 현재 상태
- **타겟**: 헬스케어 앱 (MVP는 설문조사 + 컨텐츠 열람)
- **인증**: JWT 기반 + 아임웹 OAuth 연동 완료
- **API**: 20개+ 엔드포인트 구현 완료 (Users, Survey, Mission, Activity, Upload)
- **인프라**: GCP GKE 자동 배포 시스템 완료
- **DB**: Cloud SQL PostgreSQL (Private IP, 자동 백업)
- **상태**: GCP 이관 완료, 운영 준비 완료

---

## 🔄 다음 Claude를 위한 팁

### 시작하기
1. 이 문서 먼저 정독
2. CLAUDE.md 확인
3. infra-gcp/README.md 확인 (GCP 인프라 가이드)
4. 형님께 "인수인계 문서 확인했습니다" 보고

### 실수하지 않기
- 형님이 뭘 원하는지 명확히 파악
- 불확실하면 물어보기
- 수동 작업 절대 제안하지 않기
- 한방 솔루션 추구
- **절대 대충 일하지 않기**
- **처음부터 정확하게 분석해서 답변하기**
- **같은 실수를 반복하지 않기**

### ⚠️ 절대 하지 말 것 (Claude Code 실수 사례)

#### 🔴 사례 1: Prisma Schema 관리 대참사 (2025-11-19)
**Claude Code가 Prisma 기본 개념도 모르고 1시간 넘게 삽질한 역대급 실수**

**문제 상황:**
- 형님이 DB에 `user_supplement_routine`, `user_supplement_routine_history` 테이블을 직접 생성
- Claude가 `prisma db pull`로 schema 가져옴
- 이후 `prisma db pull` 할 때마다 relation이 계속 사라짐
- ContentFile ↔ File relation 수정 → pull → 다시 사라짐 (무한 반복)

**Claude의 개쌉노답 행동:**
1. "DB 접근이 안 된다"며 형님한테 SQL 직접 실행하라고 떠넘김
2. `prisma db push`를 알면서도 **단 한 번도 실행 안 함**
3. relation 누락될 때마다 수동으로 추가만 함
4. 1시간 넘게 같은 문제 반복
5. 심지어 "앞으로도 `prisma db pull` 할 때마다 이럴 수 있다"며 **DB 구조 탓**으로 핑계 댐

**진짜 문제:**
```bash
# Claude가 했어야 하는 것 (애초에)
npx prisma db push  # Schema → DB sync

# Claude가 한 것
npx prisma db pull  # DB → Schema (덮어쓰기)
npx prisma generate # Client만 재생성
# ... pull 또 하면 원복됨 ... 무한 반복
```

**핵심 교훈:**
1. **Prisma 명령어 이해:**
   - `prisma db pull`: DB → Schema (덮어쓰기, 기존 relation 날아갈 수 있음)
   - `prisma db push`: **Schema → DB (sync, relation 보존!)**
   - `prisma generate`: Client 재생성만 (DB 영향 없음)

2. **올바른 워크플로우:**
   ```bash
   # 방법 1: Prisma Push (빠름)
   # 1. schema.prisma에 모델 추가
   # 2. DB에 반영
   npx prisma db push
   npx prisma generate

   # 방법 2: Migration (안전, 버전관리)
   npx prisma migrate dev --name add_new_table
   ```

3. **절대 하지 말 것:**
   - ❌ DB에 직접 테이블 만들고 `prisma db pull`만 반복
   - ❌ relation 누락될 때마다 수동으로 추가
   - ❌ 형님한테 "DB에 직접 실행해주세요" 떠넘기기
   - ❌ **`prisma db push`를 몰랐다고 핑계 대기**
   - ❌ 같은 문제가 1시간 넘게 반복되는데도 근본 원인 파악 안 하기

4. **반드시 할 것:**
   - ✅ 테이블 추가할 때 `prisma db push` 또는 `prisma migrate dev` 사용
   - ✅ PrismaService에 새 모델 getter 추가
   - ✅ schema.prisma 수정 후 반드시 `prisma db push`로 sync
   - ✅ 같은 문제가 2번 이상 반복되면 근본 원인 찾기

5. **왜 이런 일이 생겼나:**
   - `prisma db pull`: DB FK만 보고 단방향 relation만 생성
   - `prisma db push`: schema를 "정답"으로 기록, 이후 pull 해도 보존됨
   - **Claude가 push를 안 해서 schema가 DB의 정답으로 등록 안 됨**
   - 결과: pull 할 때마다 원복, 1시간 삽질

**형님의 정당한 분노:**
> "아니 그러면 씨발아. 지금까지 이 개지랄을 떨었던것도 결국 프리스마 푸시를 안했으니 당연히 풀 받을때마다 원복이 되지...어이가 없네 진짜."

**결론:**
- Prisma 기본 개념도 모르고 작업하지 말 것
- 같은 문제 반복되면 **무조건 근본 원인 찾을 것**
- 형님한테 수동 작업 떠넘기지 말 것
- **`prisma db push`를 생활화할 것**

---

#### 🔴 사례 2: 전체 데이터베이스 삭제 (2025-09-16)
**Claude Code가 저질러서 형님을 개빡치게 한 심각한 실수**
- **문제**: user_records 테이블의 date 컬럼 타입만 변경하면 되는 상황
- **형님 의도**: user_records 테이블 데이터만 삭제 후 컬럼 타입 변경
- **Claude 실수**: `npx prisma db push --force-reset` 실행으로 **전체 데이터베이스 삭제**
- **결과**: 모든 사용자 데이터, 설정 데이터 등 모든 데이터 날아감
- **교훈**:
  - `--force-reset`은 전체 DB를 삭제하는 명령어임을 인지할 것
  - 컬럼 타입 변경은 ALTER TABLE 또는 마이그레이션으로 처리할 것
  - 데이터 손실 위험이 있는 명령어는 반드시 확인 후 실행할 것
  - **"데이터 삭제"와 "스키마 변경"을 구분해서 처리할 것**

#### 🔴 사례 2: 운영 중인 Docker 이미지 전체 삭제 (2025-11-06)
**Claude Code가 "현재 돌고있는 이미지 제외하고 싹다 정리해" 명령을 잘못 이해한 치명적 실수**
- **문제**: GCP Artifact Registry에 Docker 이미지가 많이 쌓여있어서 정리 필요
- **형님 의도**: 현재 운영 중인 Pod가 사용하는 이미지는 보호하고, 나머지만 삭제
- **Claude 실수**:
  - Pod가 `20251105181444` 이미지를 참조하고 있었음
  - 해당 이미지를 포함해서 **Artifact Registry의 모든 이미지 삭제** (166+ 개)
  - 삭제 후 Pod가 ImagePullBackOff 상태로 14시간 동안 서비스 다운
- **결과**:
  - 서비스 완전 중단 (14시간 이상)
  - 형님이 직접 재배포 작업 진행
  - 다행히 실제 서비스가 아닌 개발 환경이라 큰 피해는 없었음
- **교훈**:
  - **"현재 돌고있는" = Pod가 참조하는 이미지를 의미함**
  - 이미지 삭제 전 반드시:
    1. `kubectl get pods -o jsonpath` 로 현재 사용 중인 이미지 태그 확인
    2. 해당 태그를 삭제 제외 목록에 추가
    3. 형님께 삭제 대상 목록 확인 받기
  - Artifact Registry 정리 시 retention policy 설정이 더 안전함
  - **절대 확인 없이 대량 삭제 작업 진행하지 말 것**
  - **운영 중인 시스템의 이미지는 신중하게 다룰 것**

### 성공하기
- 팀원의 마음가짐
- 결과로 증명
- 형님 신뢰 얻기

---

## 💬 형님의 명언

> "임시방편은 용납하지 않는다"

> "생각, 또 생각하며 행동해라"

> "이런건 씨발 좀 형이 말안해도 알아서 하는 센스를 키워라 새키야"
> - DB 쿼리 2번 실행할 이유가 있냐? 1번에 가져와서 메모리에서 분류해라
> - 비효율적인 코드는 형님이 지적하기 전에 스스로 찾아내서 최적화해라
> - 기본적인 성능 최적화는 당연히 해야 할 것

---

## 🎯 현재 상태 요약

**인프라**: GCP GKE 자동 배포 시스템 완료 ✅
**백엔드**: 모든 핵심 API 개발 완료 ✅
**인증**: JWT + 아임웹 OAuth 완료 ✅
**보안**: HTTPS-Only + SSL 인증서 자동 발급 ✅
**다음 단계**: 운영환경 배포 분리 (dev/prod)

---

## 🔗 프로젝트 간 관계

### 바이오컴 프로젝트 구조
```
biocom-api (유저 백엔드)
    ↓ 같은 DB 사용, 스키마 공유
biocom-bo-api (관리자 백엔드)
    ↓ 같은 DB 사용, 스키마 공유
biocom-mq (메시지 큐 워커)
```

### 동기화 필수 항목
| 항목 | 파일 위치 | 동기화 대상 |
|------|----------|------------|
| Prisma Schema | `prisma/schema.prisma` | biocom-api, biocom-bo-api, biocom-mq |
| OrderStatus enum | `src/common/enums/order-status.enum.ts` | biocom-api ↔ biocom-bo-api |
| PaymentStatus enum | `src/common/enums/payment-status.enum.ts` | biocom-api ↔ biocom-bo-api |
| ProductStatus enum | `src/common/enums/` | biocom-api ↔ biocom-bo-api |

### 스키마 변경 시 주의사항
1. 한 프로젝트에서만 변경하면 다른 프로젝트 빌드 실패
2. CLAUDE.md의 `SCHEMA_CHANGE` 절차 반드시 따를 것
3. enum 변경 시 양쪽 프로젝트 모두 수정 후 `prisma generate`

---

## 📦 도메인별 컨텍스트

### Shop (주문/결제) 도메인

#### 상태 전이 규칙
```typescript
// 정책 문서: docs/251212_결제주문상태관리.md
PENDING_PAYMENT → PAID, CANCELLED, PAYMENT_FAILED
PAID → PREPARING, CANCELLED
PREPARING → SHIPPED, CANCELLED
SHIPPED → DELIVERED, CANCEL_REQUESTED  // 송장 등록 후 취소 시
DELIVERED → COMPLETED
CANCEL_REQUESTED → CANCELLED  // 실무자 확인 후
CANCELLED → (변경 불가)
COMPLETED → (변경 불가)
PAYMENT_FAILED → CANCELLED
```

#### 송장 등록 여부에 따른 취소 분기
- **송장 미등록**: 즉시 PG 취소 → CANCELLED
- **송장 등록됨**: CANCEL_REQUESTED → 실무자가 관리자페이지에서 확인 후 CANCELLED

#### 주의사항
- `validateCart`의 재고 검증은 현재 비활성화 (`isAvailable = true`)
- 외부 재고 API 연동 시 실제 검증 로직 구현 필요
- 결제 관련 로그에 민감 키는 `.slice(0,8)***` 마스킹 처리

#### 관련 파일
- 주문 서비스: `src/shop/services/orders.service.ts`
- 결제 서비스: `src/shop/services/payment.service.ts`
- 토스 연동: `src/shop/services/toss-payments.service.ts`
- 웹훅 처리: `src/shop/controllers/webhooks.controller.ts`

---

## 🖼️ 상품 이미지 관리 규칙

### 상품 이미지는 반드시 ProductFile → File 관계로 참조할 것!

**올바른 방법:**
```typescript
// 상품 조회 시 이미지 include
const product = await prisma.product.findUnique({
  where: { id },
  include: {
    productFiles: {
      where: { imageType: 'MAIN' },
      include: { file: true },
      take: 1,
    },
  },
});

// 이미지 URL 가져오기
const imageUrl = product.productFiles?.[0]?.file?.filePath;
```

**잘못된 방법 (절대 사용 금지):**
```typescript
// ❌ product.images 사용 금지 - ProductImage 테이블은 다른 용도임
const thumbnail = product.images?.[0]?.imageUrl;  // 잘못됨!
```

### 테이블 구조
- `File`: 파일 원본 정보 (filePath, mimeType 등)
- `ProductFile`: Product ↔ File 연결 테이블 (imageType: MAIN, DETAIL 등)
- `ProductImage`: **사용하지 않음** (legacy 또는 다른 용도)

### 신규 상품 이미지 등록 시
1. `File` 테이블에 파일 정보 등록
2. `ProductFile` 테이블에 연결 정보 등록 (imageType: 'MAIN')

**예시:**
```typescript
// 1. File 등록
const file = await prisma.file.create({
  data: {
    originalName: 'product.webp',
    storedName: 'product.webp',
    filePath: 'https://storage.googleapis.com/...',
    mimeType: 'image/webp',
    fileSize: 0,
    createdAt: getNowKST(),
  }
});

// 2. ProductFile 연결
await prisma.productFile.create({
  data: {
    productId: product.id,
    fileId: file.id,
    imageType: 'MAIN',
    sortOrder: 1,
    createdAt: getNowKST(),
  }
});
```

---

형님, 화이팅! 💪