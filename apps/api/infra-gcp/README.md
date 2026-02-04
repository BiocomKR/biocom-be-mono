# 🚀 BIOCOM API - GCP 이관 프로젝트

AWS EKS에서 GCP GKE로의 완전한 인프라 마이그레이션 프로젝트입니다.

## 📁 디렉토리 구조

```
infra-gcp/
├── README.md                    # 이 파일 - 프로젝트 개요 및 사용법
├── terraform/                   # 🏗️ 테라폼 인프라 코드
│   ├── main.tf                 # 네트워크, 방화벽, Artifact Registry, GCS
│   ├── gke.tf                  # GKE 클러스터 및 노드 풀 설정
│   ├── cloudsql.tf             # Cloud SQL PostgreSQL 설정
│   ├── certificate.tf          # Certificate Manager SSL 인증서
│   ├── load-balancer.tf        # Global Load Balancer 설정
│   ├── variables.tf            # 환경별 변수 정의
│   ├── outputs.tf              # 중요한 출력값 (IP, URL 등)
│   ├── providers.tf            # GCP 프로바이더 설정
│   ├── backend.tf              # GCS 백엔드 설정
│   └── terraform.tfvars.example # 환경 설정 예시 파일
├── k8s/                        # 🚢 Kubernetes 매니페스트
│   ├── namespace.yaml          # 네임스페이스 정의
│   ├── configmap.yaml          # 애플리케이션 설정
│   ├── secret.yaml             # 민감한 정보 (패스워드 등)
│   ├── deployment.yaml         # 애플리케이션 배포 설정
│   ├── service.yaml            # 네트워크 서비스 설정
│   └── ingress.yaml            # 외부 트래픽 라우팅
└── scripts/                    # 🔧 배포 및 관리 스크립트
    └── deploy.sh               # 통합 배포 스크립트
```

## 🎯 이관 목표

AWS EKS 환경을 GCP GKE로 완전 이관:
- ✅ EKS → GKE Standard 클러스터
- ✅ RDS PostgreSQL → Cloud SQL PostgreSQL  
- ✅ AWS ECR → GCP Artifact Registry
- ✅ AWS ACM → GCP Certificate Manager
- ✅ 헬름 차트 → 테라폼 관리

## 📚 테라폼 기본 개념

### 테라폼이란?
- **Infrastructure as Code (IaC)**: 인프라를 코드로 관리
- **선언적 언어**: "이렇게 되어야 한다"를 선언하면 테라폼이 알아서 실행
- **상태 관리**: 현재 인프라 상태를 추적하여 변경사항만 적용
- **계획 → 적용**: 실행 전에 무엇이 바뀔지 미리 확인 가능

### 테라폼 명령어
```bash
terraform init      # 초기화 (프로바이더 다운로드, 백엔드 설정)
terraform plan      # 실행 계획 확인 (실제 적용 전 미리보기)
terraform apply     # 실제 인프라 생성/변경
terraform destroy   # 모든 리소스 삭제
terraform show      # 현재 상태 확인
```

## 🚀 빠른 시작

### 1️⃣ 사전 준비

```bash
# 필수 도구 설치 확인
gcloud --version    # Google Cloud CLI
kubectl version     # Kubernetes CLI  
terraform --version # Terraform CLI

# GCP 인증
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 2️⃣ 환경 설정

```bash
# 설정 파일 복사 및 수정
cd terraform/
cp terraform.tfvars.example terraform.tfvars

# terraform.tfvars 파일에서 다음 값들 수정:
# - project_id = "실제_GCP_프로젝트_ID"  
# - domain_name = "실제_도메인_이름"
# - 기타 환경에 맞는 설정들
```

### 3️⃣ 자동 배포 (권장)

```bash
# 통합 배포 스크립트 실행
./scripts/deploy.sh --project-id YOUR_PROJECT_ID

# 이 스크립트가 다음을 순서대로 실행:
# 1. 테라폼으로 인프라 구축
# 2. kubectl 설정  
# 3. Kubernetes 애플리케이션 배포
# 4. 상태 확인 및 최종 정보 출력
```

### 4️⃣ 수동 배포 (고급 사용자)

```bash
# 1. 테라폼 인프라 배포
cd terraform/
terraform init
terraform plan -var="project_id=YOUR_PROJECT_ID"
terraform apply

# 2. kubectl 설정
gcloud container clusters get-credentials biocom-cluster --region asia-northeast3

# 3. Kubernetes 배포
cd ../k8s/
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml      # ⚠️ 실제 값으로 수정 필요
kubectl apply -f service.yaml
kubectl apply -f deployment.yaml
kubectl apply -f ingress.yaml
```

## 🔧 배포 후 작업

### 필수 DNS 설정

```bash
# 1. 외부 IP 확인
terraform output load_balancer_ip

# 2. 가비아 DNS에 다음 레코드 추가:
# - 타입: A
# - 이름: api-gcp  
# - 값: [위에서 확인한 IP]

# 3. SSL 인증서 검증용 TXT 레코드 추가:
terraform output dns_verification_record
# 위 명령어 결과로 나오는 TXT 레코드를 가비아에 추가
```

### Docker 이미지 배포

```bash
# 1. 애플리케이션 이미지 빌드
docker build -t biocom-api .

# 2. GCP Artifact Registry에 태그
docker tag biocom-api asia-northeast3-docker.pkg.dev/PROJECT_ID/biocom-api/biocom-api:latest

# 3. 이미지 푸시
docker push asia-northeast3-docker.pkg.dev/PROJECT_ID/biocom-api/biocom-api:latest

# 4. Deployment 업데이트 (새 이미지 적용)
kubectl rollout restart deployment/biocom-api -n biocom-api
```

## 📊 모니터링 및 문제해결

### 상태 확인 명령어

```bash
# Pod 상태 확인
kubectl get pods -n biocom-api -o wide

# Service 및 Ingress 확인  
kubectl get svc,ingress -n biocom-api

# SSL 인증서 상태 확인
gcloud certificate-manager certificates list --global

# 로드 밸런서 상태 확인
gcloud compute backend-services list
gcloud compute forwarding-rules list --global

# 애플리케이션 로그 확인
kubectl logs -f deployment/biocom-api -n biocom-api
```

### 일반적인 문제들

| 문제 | 증상 | 해결 방법 |
|------|------|-----------|
| SSL 인증서 Pending | HTTPS 접속 안됨 | DNS 설정 확인, 최대 24시간 대기 |
| Pod CrashLoopBackOff | 앱이 계속 재시작 | `kubectl logs` 로 에러 확인 |
| Ingress IP Pending | 외부 IP 할당 안됨 | 5-10분 대기, 방화벽 규칙 확인 |
| DB 연결 실패 | 500 에러 발생 | Secret의 DB 패스워드 확인 |

## 💰 비용 최적화

### 개발환경 (월 약 $100)
- 스팟 인스턴스 사용: `use_spot_instances = true`
- 작은 노드: `node_machine_type = "e2-standard-2"`  
- 최소 노드 수: `node_min_count = 1`
- 작은 DB: `db_tier = "db-g1-small"`

### 운영환경 권장사항
- 정기 인스턴스: `use_spot_instances = false`
- 적절한 노드: `node_machine_type = "e2-standard-4"`
- 고가용성: `node_min_count = 3`  
- 성능 DB: `db_tier = "db-standard-2"`

## 🔒 보안 고려사항

- ✅ Private GKE 클러스터 (노드에 외부 IP 없음)
- ✅ Cloud SQL Private IP (VPC 내부에서만 접근)
- ✅ Workload Identity (Pod → GCP 서비스 안전한 접근)
- ✅ Secret Manager (민감한 정보 암호화 저장)  
- ✅ 방화벽 규칙 (필요한 포트만 허용)
- ⚠️ Secret 파일의 실제 값 관리 (운영환경에서 별도 관리 필요)

## 📞 문의 및 지원

- **인프라 관련**: DevOps 팀 
- **애플리케이션 관련**: 백엔드 개발팀
- **DNS/도메인 관련**: 인프라 운영팀
- **비용 관련**: 클라우드 운영팀