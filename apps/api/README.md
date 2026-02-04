# biocom-api

바이오컴 유저 백엔드 API (NestJS)

## 프로젝트 구조

```
biocom-api/
├── src/                    # 소스 코드
├── prisma/
│   └── schema.prisma       # Prisma 스키마
├── docs/                   # 문서
├── infra-gcp/              # GCP 인프라 (Terraform, K8s)
├── test/                   # 테스트
├── dist/                   # 빌드 결과물
├── logs/                   # 로그 파일
└── node_modules/           # 의존성
```

## 루트 파일

| 파일 | 용도 |
|-----|------|
| `package.json` | npm 의존성 및 스크립트 |
| `tsconfig.json` | TypeScript 설정 |
| `nest-cli.json` | NestJS CLI 설정 |
| `jest.config.js` | Jest 테스트 설정 |
| `Dockerfile` | Docker 빌드 설정 |
| `.env.*` | 환경 변수 (local, dev, prod) |
| `HANDOVER.md` | 인수인계 문서 |
| `CLAUDE.md` | Claude AI 가이드라인 |
| `*-firebase-*.json` | Firebase 푸시 알림용 서비스 계정 |
| `google-service-account-*.json` | GCS 접근용 서비스 계정 |

## 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run start:dev

# 빌드
npm run build

# 프로덕션 실행
npm run start:prod
```

## 배포

GitHub Actions로 자동 배포됨
- `development` push → 개발서버 자동 배포
- `main` push → 운영서버 자동 배포

---

# GCP 이관 기록

> 💡 AWS EKS → GCP GKE 이관 (2025.09.02 ~ 2025.09.03)

---

## 🏗️ 1단계: GCP 프로젝트 생성 및 환경 설정

### 1.1 프로젝트 생성

```bash
# GCP 로그인
gcloud auth login --account=*[서비스 계정]

# GCP 프로젝트 생성
gcloud projects create [프로젝트ID] --name="[프로젝트명]"

# cli가 오류발생시 gcloud beta billing 으로 실행
gcloud billing projects link [프로젝트ID] --billing-account=[결제계정ID]

# 기본 프로젝트 설정
gcloud config set project [프로젝트ID]
```

### 1.2 파라미터 설명

- **서비스 계정**: `ai@biocom.kr`
- **역할**: Project Owner, Editor
- **활성화된 API**: 10개 핵심 API 자동 활성화
- 결제계정ID : *01786D-B8BF25-BE8767*

---

## 🔧 2단계: 인프라 배포 (Terraform)

### 2.1 인프라 스크립트 실행

```bash
./infra-gcp/scripts/01-deploy-infrastructure.sh --project-id api-dev-biocom --yes
```

### 2.2 주요 인프라 구성

| **리소스** | **GCP** |
| --- | --- |
| 컨테이너 오케스트레이션 | GKE |
| 데이터베이스 | Cloud SQL PostgreSQL |
| 로드밸런서 | Google Cloud Load Balancer |
| SSL 인증서 | Certificate Manager |
| 네트워크 | VPC |
| 스토리지 | Cloud Storage |

---

## 📦 3단계: 애플리케이션 배포

### 3.1 앱 배포 스크립트 실행

```bash
./infra-gcp/scripts/02-deploy-app.sh --project-id api-dev-biocom --yes
```

### 3.2 배포 구성요소

- **Docker 이미지**: Google Container Registry에 푸시
- **Kubernetes 리소스**: Namespace, ConfigMap, Secret, Deployment, Service, Ingress

---

## 🧪 4단계: 테스트 및 검증

### 4.1 HTTP 테스트 ✅

```bash
curl -I http://api-dev.biocom.ai.kr/api/health
# HTTP/1.1 200 OK ✅
```

### 4.2 HTTPS 테스트 ✅

```bash
curl -I https://api-dev.biocom.ai.kr/api/health  
# HTTP/2 200 ✅ (HTTP/2 지원!)
```

### 4.3 API 문서 접근 ✅

- **HTTP**: `http://api-dev.biocom.ai.kr/api/docs`
- **HTTPS**: `https://api-dev.biocom.ai.kr/api/docs`

---

## 🎯 최종 결과

### ✅ 성공 지표

| **항목** | **상태** | **성능** |
| --- | --- | --- |
| HTTP 접속 | ✅ 완료 | 1초 이내 응답 |
| HTTPS 접속 | ✅ 완료 | HTTP/2 지원 |
| API문서 | ✅ 접근 가능 | Swagger UI 정상 |
| SSL 인증서 | ✅ Active | 자동 갱신 |
| DNS 해상도 | ✅ 34.111.10.100 | A 레코드 정상 |

## 🏆 한방배포 달성

- **인프라 + 앱 배포** : 완전 자동화 (딸깍) ✅
- 오류 자동 복구 : 스크립트 내장 ✅
- 수동 처리 : 0 ✅
- 배포 시간 : 30~2시간 (SSL활성화 대기시간 포함) ✅

---

## 🔒 추가: HTTPS-Only 보안 강화

### ETC.1 보안 취약점 발견

> ⚠️ 문제점 분석
> 
> - HTTP와 HTTPS 모두 접근 가능한 상태
> - TLS를 사용하는 의미가 없어짐
> - 보안상 HTTP 접근을 완전 차단해야 함

### ETC.2 HTTPS-Only 구현

```yaml
# FrontendConfig 설정으로 HTTP→HTTPS 강제 리다이렉트
spec:
  # SSL 정책 (Terraform에서 생성)  
  sslPolicy: "biocom-ssl-policy"
  
  # HTTPS 강제 리다이렉트 설정
  redirectToHttps:
    enabled: true
    responseCodeName: "MOVED_PERMANENTLY_DEFAULT"
```

### ETC.3 SSL Policy 자동화

- [ ]  **Terraform 설정**: certificate.tf에 SSL Policy 리소스 추가
- [ ]  **배포 스크립트**: 01-deploy-infrastructure.sh에 SSL Policy 생성 단계 추가
- [ ]  **설정값**: TLS 1.2 + MODERN 프로필로 보안 강화

### ETC.4 테스트 결과

```bash
# HTTP 요청 테스트
curl -v http://api-dev.biocom.ai.kr/api/health
# 결과: HTTP/1.1 301 Moved Permanently → HTTPS로 자동 리다이렉트# HTTPS 연결 확인# SSL connection using TLSv1.3 / AEAD-CHACHA20-POLY1305-SHA256# using HTTP/2 → 최신 프로토콜 지원 확인
```

---

## 🔗 최종 접속 정보

### 🌐 서비스 주소

> 🔒 모든 서비스 HTTPS-Only
> 
> - **API 문서**: `https://api-dev.biocom.ai.kr/api/docs` ✅
> - **헬스체크**: `https://api-dev.biocom.ai.kr/api/health` ✅
> - **모든 API**: `https://api-dev.biocom.ai.kr/api/*` ✅

---

## 🏁 결론

> 🎯 프로젝트 성과
> 
> 
> **2일간의 대장정을 통해 AWS에서 GCP로 완전 이관을 성공적으로 완료했습니다.**
> 
> **그리고 추가로 HTTPS-Only 보안 강화까지 완료했습니다.**
> 

가장 중요한 성과는 **"한방배포 + 보안 강화"** 시스템을 구축한 것입니다. 이제 누구든지 두 개의 명령어만으로 전체 인프라와 애플리케이션을 배포할 수 있고, 자동으로 HTTPS-Only 보안까지 적용됩니다:

```bash
./01-deploy-infrastructure.sh --project-id PROJECT_ID --yes  # SSL Policy 자동 생성
./02-deploy-app.sh --project-id PROJECT_ID --yes             # HTTPS-Only 적용
```

### 🔒 보안 강화 달성사항

- HTTP 접근 완전 차단 ✅
- HTTPS-Only 강제 리다이렉트 ✅
- TLS 1.2+ MODERN 암호화 ✅
- 한방배포 시스템에 보안 자동화 통합 ✅
