# 🚀 Biocom API - GCP 배포 가이드

> 최종 업데이트: 2025-08-27  
> 작성자: Biocom Development Team

## 📋 목차

- [개요](#-개요)
- [사전 준비사항](#-사전-준비사항)
- [Quick Start](#-quick-start)
- [상세 가이드](#-상세-가이드)
- [운영 가이드](#-운영-가이드)
- [문제 해결](#-문제-해결)

---

## 🎯 개요

이 가이드는 Biocom API를 Google Cloud Platform(GCP)에 배포하는 방법을 설명합니다.

### 인프라 구성
- **GKE (Google Kubernetes Engine)**: 컨테이너 오케스트레이션
- **Cloud SQL (PostgreSQL)**: 데이터베이스
- **Cloud Load Balancer**: 부하 분산
- **Cloud Storage (GCS)**: 파일 저장소 (AWS S3 대체)
- **Artifact Registry**: 도커 이미지 저장소

### 프로젝트 구조
```
biocom-api/
├── infra-gcp/              # GCP 인프라 관련
│   ├── terraform/          # 인프라 코드 (IaC)
│   ├── k8s/               # Kubernetes 매니페스트
│   └── scripts/           # 배포 자동화 스크립트
├── src/                   # 애플리케이션 소스
└── ...
```

---

## 🛠️ 사전 준비사항

### 1. 필수 도구 설치

#### macOS
```bash
# Homebrew가 없다면 먼저 설치
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Google Cloud SDK
brew install --cask google-cloud-sdk

# Terraform
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# kubectl
brew install kubectl

# Docker
brew install --cask docker
```

#### Linux (Ubuntu/Debian)
```bash
# Google Cloud SDK
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -
sudo apt-get update && sudo apt-get install google-cloud-cli

# Terraform
wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### 2. GCP 프로젝트 설정

```bash
# GCP 로그인
gcloud auth login

# 프로젝트 생성 (이미 있다면 스킵)
gcloud projects create biocom-api-dev --name="Biocom API Development"

# 프로젝트 설정
gcloud config set project biocom-api-dev

# 필요한 API 활성화
gcloud services enable \
    compute.googleapis.com \
    container.googleapis.com \
    sqladmin.googleapis.com \
    storage.googleapis.com \
    artifactregistry.googleapis.com \
    cloudresourcemanager.googleapis.com \
    iam.googleapis.com \
    certificatemanager.googleapis.com
```

### 3. 서비스 계정 및 권한 설정

```bash
# 서비스 계정 생성
gcloud iam service-accounts create terraform-sa \
    --display-name="Terraform Service Account"

# 권한 부여
export PROJECT_ID=biocom-api-dev
export SA_EMAIL=terraform-sa@${PROJECT_ID}.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/editor"

# 키 파일 생성 (안전한 곳에 보관!)
gcloud iam service-accounts keys create ~/biocom-gcp-key.json \
    --iam-account=${SA_EMAIL}
```

---

## 🚀 Quick Start

### 최초 배포 (인프라 + 애플리케이션)

```bash
# 프로젝트 클론
git clone https://github.com/BiocomKR/biocom-api.git
cd biocom-api/infra-gcp

# 환경 변수 설정
export GOOGLE_APPLICATION_CREDENTIALS=~/biocom-gcp-key.json
export GOOGLE_CLOUD_PROJECT=biocom-api-dev

# 🎯 Step 1: 인프라 구축 (최초 1회만)
./scripts/01-deploy-infrastructure.sh

# ☕ 인프라 구축 완료 대기 (약 15-20분)

# 🎯 Step 2: 애플리케이션 배포
./scripts/02-deploy-app.sh
```

> ⏱️ 예상 소요 시간: 
> - 인프라 구축: 약 15-20분 (최초 실행 시)
> - 앱 배포: 약 5-10분

---

## 📖 상세 가이드

### Step 1: Terraform 변수 설정

```bash
cd infra-gcp/terraform

# terraform.tfvars 파일 생성
cp terraform.tfvars.example terraform.tfvars

# 편집기로 열어서 수정
vim terraform.tfvars
```

#### terraform.tfvars 설정 예시
```hcl
# GCP 프로젝트 설정
project_id = "biocom-api-dev"
region     = "asia-northeast3"  # 서울 리전
zone       = "asia-northeast3-a"

# 환경 설정
environment = "dev"  # dev, staging, prod

# 데이터베이스 설정
db_instance_name = "biocom-db"
db_name          = "biocom"
db_user          = "biocom"
db_password      = "changeme123!"  # 🚨 강력한 비밀번호로 변경!

# GKE 클러스터 설정
cluster_name     = "biocom-cluster"
node_pool_name   = "default-pool"
node_count       = 2  # 시작 노드 수
min_node_count   = 1  # 최소 노드
max_node_count   = 5  # 최대 노드
machine_type     = "e2-standard-2"  # 2 vCPU, 8GB RAM

# 도메인 설정 (선택사항)
domain_name = "api.biocom.kr"
```

### Step 2: 인프라 구축

```bash
# Terraform 초기화
terraform init

# 실행 계획 확인
terraform plan

# 인프라 생성
terraform apply -auto-approve

# 출력 값 확인 (중요!)
terraform output
```

### Step 3: 애플리케이션 배포

```bash
cd ../..  # 프로젝트 루트로 이동

# Docker 이미지 빌드
docker build -t biocom-api:latest .

# GCP Artifact Registry에 푸시
export REGION=asia-northeast3
export PROJECT_ID=biocom-api-dev

# Artifact Registry 생성 (최초 1회)
gcloud artifacts repositories create biocom-repo \
    --repository-format=docker \
    --location=${REGION}

# Docker 인증 설정
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# 이미지 태그 및 푸시
docker tag biocom-api:latest ${REGION}-docker.pkg.dev/${PROJECT_ID}/biocom-repo/biocom-api:latest
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/biocom-repo/biocom-api:latest

# Kubernetes 클러스터 연결
gcloud container clusters get-credentials biocom-cluster --zone=asia-northeast3-a

# 애플리케이션 배포
kubectl apply -f infra-gcp/k8s/
```

### Step 4: 데이터베이스 마이그레이션

```bash
# Cloud SQL 프록시 설치 (최초 1회)
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy

# 프록시 실행 (별도 터미널)
./cloud-sql-proxy --port 5432 ${PROJECT_ID}:${REGION}:biocom-db

# 마이그레이션 실행 (새 터미널)
export DATABASE_URL="postgresql://biocom:changeme123!@localhost:5432/biocom"
npm run prisma:migrate:deploy
```

---

## 🔧 운영 가이드

### 애플리케이션 업데이트

```bash
# 코드 수정 후
cd infra-gcp

# 앱만 재배포 (인프라는 그대로)
./scripts/02-deploy-app.sh
```

### 상태 확인

```bash
# 전체 상태 확인
./scripts/status.sh

# Pod 상태 확인
kubectl get pods -n default

# 로그 확인
kubectl logs -f deployment/biocom-api -n default

# 서비스 확인
kubectl get svc -n default
```

### 스케일링

```bash
# 수동 스케일링
kubectl scale deployment biocom-api --replicas=5

# 자동 스케일링 설정
kubectl autoscale deployment biocom-api --min=2 --max=10 --cpu-percent=70
```

### 모니터링

```bash
# Cloud Console에서 모니터링
open https://console.cloud.google.com/kubernetes/workload?project=${PROJECT_ID}

# 메트릭 확인
kubectl top nodes
kubectl top pods
```

---

## 🔥 문제 해결

### 1. Terraform 오류

```bash
# 상태 확인
terraform state list

# 특정 리소스 재생성
terraform taint <resource_name>
terraform apply

# 완전 초기화 (주의!)
terraform destroy -auto-approve
terraform apply -auto-approve
```

### 2. Pod가 시작되지 않음

```bash
# Pod 상태 상세 확인
kubectl describe pod <pod_name>

# 이벤트 확인
kubectl get events --sort-by=.metadata.creationTimestamp

# 컨테이너 로그
kubectl logs <pod_name> --previous
```

### 3. 데이터베이스 연결 실패

```bash
# Cloud SQL 인스턴스 확인
gcloud sql instances list

# 연결 테스트
gcloud sql connect biocom-db --user=biocom

# Private IP 확인
gcloud sql instances describe biocom-db | grep ipAddress
```

### 4. 로드밸런서 문제

```bash
# Ingress 상태 확인
kubectl describe ingress biocom-api-ingress

# 백엔드 서비스 확인
gcloud compute backend-services list

# 헬스체크 확인
gcloud compute health-checks list
```

---

## 📱 접속 정보

### 개발 환경
- API 엔드포인트: `http://<LOAD_BALANCER_IP>/api`
- Swagger 문서: `http://<LOAD_BALANCER_IP>/api/docs`
- 헬스체크: `http://<LOAD_BALANCER_IP>/api/health`

### 로드밸런서 IP 확인
```bash
kubectl get ingress biocom-api-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

---

## 📦 Cloud Storage (GCS) 사용 가이드

### 생성되는 버킷
인프라 구축 시 자동으로 생성되는 GCS 버킷:

| 버킷 이름 | 용도 | 설명 |
|----------|------|------|
| `PROJECT_ID-biocom-uploads` | 메인 파일 저장소 | 이미지, 문서 등 영구 파일 |
| `PROJECT_ID-biocom-temp` | 임시 파일 | 24시간 후 자동 삭제 |

### 버킷 구조
```
biocom-api-dev-biocom-uploads/
├── images/      # 미션 인증샷, 이벤트 이미지
├── documents/   # PDF, 문서 파일
├── profiles/    # 사용자 프로필 이미지
└── temp/        # 임시 파일
```

### 버킷 확인
```bash
# 버킷 목록 확인
gcloud storage buckets list --project=biocom-api-dev

# 버킷 내용 확인
gsutil ls gs://biocom-api-dev-biocom-uploads/

# 버킷 상세 정보
gsutil ls -L -b gs://biocom-api-dev-biocom-uploads
```

### Node.js에서 사용하기

#### 1. 패키지 설치
```bash
npm install @google-cloud/storage
```

#### 2. 환경 변수 설정 (.env)
```env
GCS_BUCKET_NAME=biocom-api-dev-biocom-uploads
GCS_PROJECT_ID=biocom-api-dev
```

#### 3. 업로드 코드 예시
```javascript
const { Storage } = require('@google-cloud/storage');
const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID
});

// 파일 업로드
async function uploadFile(localFilePath, destinationPath) {
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  await bucket.upload(localFilePath, {
    destination: destinationPath, // 예: 'images/photo.jpg'
  });
  console.log(`파일 업로드 완료: gs://${process.env.GCS_BUCKET_NAME}/${destinationPath}`);
}

// Buffer 업로드
async function uploadBuffer(buffer, destinationPath, mimeType) {
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  const file = bucket.file(destinationPath);
  
  await file.save(buffer, {
    metadata: { contentType: mimeType }
  });
  
  // 공개 URL 생성 (선택사항)
  const publicUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME}/${destinationPath}`;
  return publicUrl;
}
```

#### 4. 다운로드 코드 예시
```javascript
// 파일 다운로드
async function downloadFile(fileName, localDestPath) {
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  await bucket.file(fileName).download({
    destination: localDestPath
  });
}

// 서명된 URL 생성 (임시 접근 링크)
async function generateSignedUrl(fileName) {
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  const [url] = await bucket.file(fileName).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, // 15분
  });
  return url;
}
```

### GCS vs AWS S3 비교

| 기능 | GCS | AWS S3 |
|------|-----|--------|
| 버킷 생성 | `google_storage_bucket` | `aws_s3_bucket` |
| 권한 관리 | IAM + 버킷 정책 | IAM + 버킷 정책 |
| 라이프사이클 | `lifecycle_rule` | `lifecycle_configuration` |
| 비용 | S3보다 약간 저렴 | 표준 요금 |
| 리전 | asia-northeast3 (서울) | ap-northeast-2 (서울) |

### 기존 로컬 파일 마이그레이션

```bash
# 로컬 uploads 폴더를 GCS로 복사
gsutil -m cp -r ./uploads/* gs://biocom-api-dev-biocom-uploads/

# 특정 확장자만 업로드
gsutil -m cp ./uploads/**/*.jpg gs://biocom-api-dev-biocom-uploads/images/
gsutil -m cp ./uploads/**/*.pdf gs://biocom-api-dev-biocom-uploads/documents/
```

### 보안 설정
- **버킷 레벨**: 공개 액세스 차단 (기본값)
- **IAM**: 애플리케이션 서비스 계정만 접근 가능
- **서명된 URL**: 임시 공유 시 사용

---

## 💰 비용 관리

### 예상 월 비용 (개발 환경)
- GKE 클러스터 (e2-standard-2 x 2): ~$100
- Cloud SQL (db-f1-micro): ~$30
- Cloud Storage (GCS): ~$5-10
- Load Balancer: ~$25
- Network & 기타: ~$5-10
- **총합**: 약 $165-175/월

### 비용 절감 팁
```bash
# 개발 환경 야간/주말 중지
gcloud container clusters resize biocom-cluster --size=0 --zone=asia-northeast3-a

# 월요일 아침에 다시 시작
gcloud container clusters resize biocom-cluster --size=2 --zone=asia-northeast3-a
```

---

## 🆘 도움말

### 유용한 명령어 모음
```bash
# 모든 리소스 확인
kubectl get all -n default

# 시크릿 확인
kubectl get secrets

# ConfigMap 확인
kubectl get configmaps

# PVC 확인
kubectl get pvc

# 네트워크 정책 확인
kubectl get networkpolicies
```

### 로컬 개발 환경 설정
```bash
# .env 파일 설정
cp .env.example .env

# DATABASE_URL 수정 (Cloud SQL 프록시 사용)
DATABASE_URL="postgresql://biocom:password@localhost:5432/biocom"

# 로컬 실행
npm run start:dev
```

---

## 📝 참고 자료

- [GCP 공식 문서](https://cloud.google.com/docs)
- [GKE 베스트 프랙티스](https://cloud.google.com/kubernetes-engine/docs/best-practices)
- [Terraform GCP Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [kubectl 치트시트](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)

---

> 💡 **Pro Tip**: 처음이시라면 `01-deploy-infrastructure.sh` → `02-deploy-app.sh` 순서로 실행하세요. 모든 과정이 자동화되어 있습니다!