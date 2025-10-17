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
1. **JWT_SECRET**: 반드시 32자 이상!
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
**2025-09-16**: Claude Code가 저질러서 형님을 개빡치게 한 심각한 실수
- **문제**: user_records 테이블의 date 컬럼 타입만 변경하면 되는 상황
- **형님 의도**: user_records 테이블 데이터만 삭제 후 컬럼 타입 변경
- **Claude 실수**: `npx prisma db push --force-reset` 실행으로 **전체 데이터베이스 삭제**
- **결과**: 모든 사용자 데이터, 설정 데이터 등 모든 데이터 날아감
- **교훈**:
  - `--force-reset`은 전체 DB를 삭제하는 명령어임을 인지할 것
  - 컬럼 타입 변경은 ALTER TABLE 또는 마이그레이션으로 처리할 것
  - 데이터 손실 위험이 있는 명령어는 반드시 확인 후 실행할 것
  - **"데이터 삭제"와 "스키마 변경"을 구분해서 처리할 것**

### 성공하기
- 팀원의 마음가짐
- 결과로 증명
- 형님 신뢰 얻기

---

## 💬 형님의 명언

> "임시방편은 용납하지 않는다"

> "생각, 또 생각하며 행동해라"

---

## 🎯 현재 상태 요약

**인프라**: GCP GKE 자동 배포 시스템 완료 ✅
**백엔드**: 모든 핵심 API 개발 완료 ✅
**인증**: JWT + 아임웹 OAuth 완료 ✅
**보안**: HTTPS-Only + SSL 인증서 자동 발급 ✅
**다음 단계**: 운영환경 배포 분리 (dev/prod)

형님, 화이팅! 💪