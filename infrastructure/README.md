# 🏗️ Infrastructure

이 디렉토리는 애플리케이션의 인프라 구성을 포함합니다.

## 📂 디렉토리 구조

```
infrastructure/
├── helm/               # Helm 차트
│   └── be_temp/       # 애플리케이션 Helm 차트
│       ├── Chart.yaml
│       ├── values.yaml
│       ├── values-dev.yaml
│       ├── values-prod.yaml
│       └── templates/
├── eks/                # AWS EKS 클러스터 관련
│   └── configs/       # 클러스터 설정 파일
│       ├── cluster.yaml    # EKS 클러스터 설정
│       └── iam-policy.json # IAM 정책
├── env/               # 환경 설정
│   └── load-env.sh    # 환경 변수 로드 스크립트
└── docs/              # 문서
    ├── QUICKSTART.md  # 빠른 시작 가이드
    └── k8s-commands.md # kubectl 명령어 모음
```

## 🚀 빠른 시작

### 1. 환경 설정
```bash
# 프로젝트 루트에서 실행
cp .env.eks.example .env.eks
# .env.eks 파일을 편집하여 실제 값 입력
```

### 2. 처음 배포 (전체 프로세스)
```bash
./scripts/1-all-in-one.sh
```

### 3. 코드 수정 후 재배포
```bash
./scripts/2-deploy.sh
```

### 4. 모니터링
```bash
./scripts/3-monitor.sh
```

## 📝 주요 스크립트

### 배포 관리 (`scripts/`)
- `1-all-in-one.sh` - 처음 배포 (Docker 빌드 → ECR 푸시 → Helm 설치)
- `2-deploy.sh` - 재배포 (Docker 빌드 → ECR 푸시 → Helm 업그레이드)
- `3-monitor.sh` - 대화형 모니터링 도구
- `4-delete.sh` - 모든 리소스 삭제
- `docker-ecr-push.sh` - Docker 이미지 빌드 및 ECR 푸시
- `helm-deploy.sh` - Helm 차트 배포 관리

## 🎯 Helm 차트

### 차트 구조 (`infrastructure/helm/be_temp/`)
- `Chart.yaml` - 차트 메타데이터
- `values.yaml` - 기본 설정값
- `values-dev.yaml` - 개발 환경 오버라이드
- `values-prod.yaml` - 프로덕션 환경 오버라이드
- `templates/` - Kubernetes 리소스 템플릿
  - `deployment.yaml` - Pod 배포 설정
  - `service.yaml` - 서비스 노출
  - `ingress.yaml` - ALB 설정
  - `hpa.yaml` - 오토스케일링
  - `configmap.yaml` - 설정 관리
  - `secret.yaml` - 비밀 정보
  - `pvc.yaml` - 스토리지

### Helm 사용법
```bash
# 개발 환경 배포
./scripts/helm-deploy.sh dev install

# 프로덕션 환경 배포
./scripts/helm-deploy.sh prod install

# 업그레이드
./scripts/helm-deploy.sh dev upgrade

# 상태 확인
./scripts/helm-deploy.sh dev status

# 롤백
./scripts/helm-deploy.sh dev rollback 1
```

## 🔧 환경 변수 설정

### 필수 환경 변수 (`.env.eks`)
```bash
# AWS 설정
AWS_ACCOUNT_ID=123456789012
AWS_REGION=ap-northeast-2
CLUSTER_NAME=biocom-cluster

# ECR 설정
ECR_REPOSITORY=backend-v2

# 애플리케이션 설정
APP_NAME=backend-api
HELM_RELEASE_NAME=temp-backend

# 데이터베이스 및 보안
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret
```

## 🔐 보안 주의사항

- `.env.eks` 파일은 절대 Git에 커밋하지 마세요
- 데이터베이스 비밀번호, JWT 시크릿 등은 AWS Secrets Manager 사용 권장
- IAM 권한은 최소 권한 원칙 적용
- Helm values 파일에 민감한 정보 포함 금지

## 📊 모니터링

`3-monitor.sh`를 실행하면 다음 기능을 사용할 수 있습니다:
- Pod 상태 실시간 모니터링
- 로그 스트리밍
- 리소스 사용량 확인
- 문제 진단
- HPA 상태 확인
- ALB 주소 확인
- 부하 테스트 (Artillery)