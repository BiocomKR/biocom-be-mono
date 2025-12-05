#!/bin/bash

# 🚀 BIOCOM-MQ Worker 배포 스크립트
# Docker 이미지 빌드 및 GKE 배포

set -e

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 사용법
usage() {
    cat << EOF
사용법: $0 [옵션]

옵션:
  -p, --project-id PROJECT_ID    GCP 프로젝트 ID (필수)
  -c, --cluster-name CLUSTER      GKE 클러스터 이름 (기본값: biocom-cluster-dev)
  -z, --zone ZONE                 GCP 존 (기본값: asia-northeast3-a)
  -s, --skip-build                Docker 빌드 건너뛰기
  -y, --yes                       자동 승인
  -h, --help                      도움말

예시:
  $0 --project-id api-dev-biocom --yes
EOF
    exit 0
}

# 기본값
PROJECT_ID=""
CLUSTER_NAME="biocom-cluster-dev"
ZONE="asia-northeast3-a"
NAMESPACE="biocom-api"
REGION="asia-northeast3"
SKIP_BUILD=false
AUTO_APPROVE=false

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--project-id) PROJECT_ID="$2"; shift 2 ;;
        -c|--cluster-name) CLUSTER_NAME="$2"; shift 2 ;;
        -z|--zone) ZONE="$2"; shift 2 ;;
        -s|--skip-build) SKIP_BUILD=true; shift ;;
        -y|--yes) AUTO_APPROVE=true; shift ;;
        -h|--help) usage ;;
        *) log_error "알 수 없는 옵션: $1"; usage ;;
    esac
done

# 필수 파라미터 확인
if [[ -z "$PROJECT_ID" ]]; then
    log_error "프로젝트 ID가 필요합니다."
    usage
fi

log_info "📋 biocom-mq Worker 배포 설정:"
log_info "   프로젝트 ID: $PROJECT_ID"
log_info "   클러스터: $CLUSTER_NAME"
log_info "   존: $ZONE"
log_info "   네임스페이스: $NAMESPACE"

# 사용자 확인
if [[ "$AUTO_APPROVE" != true ]]; then
    read -p "biocom-mq Worker를 배포하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "취소되었습니다."
        exit 0
    fi
fi

# GCP 인증
log_info "🔐 GCP 인증 중..."
gcloud config set project "$PROJECT_ID" --quiet
gcloud container clusters get-credentials "$CLUSTER_NAME" \
    --zone="$ZONE" \
    --project="$PROJECT_ID"
log_success "✅ 인증 완료!"

# Docker 이미지 빌드
if [[ "$SKIP_BUILD" != true ]]; then
    log_info "🔨 Docker 이미지 빌드 시작..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR/../.."

    gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

    IMAGE_TAG=$(date +%Y%m%d%H%M%S)
    IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-mq:$IMAGE_TAG"
    LATEST_URL="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-mq:latest"

    log_info "Docker 빌드 중... (약 2-3분)"
    docker buildx build \
        --platform linux/amd64 \
        -t "$IMAGE_URL" \
        -t "$LATEST_URL" \
        --push \
        .

    log_success "✅ Docker 이미지 빌드 완료!"
    log_info "   이미지: $IMAGE_URL"
else
    log_info "Docker 빌드를 건너뜁니다."
    IMAGE_TAG="latest"
    IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-mq:latest"
fi

# 민감정보 로드
log_info "🔐 민감정보 로드 중..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS_FILE="$SCRIPT_DIR/../.env.secrets"

if [[ ! -f "$SECRETS_FILE" ]]; then
    log_error "민감정보 파일을 찾을 수 없습니다: $SECRETS_FILE"
    exit 1
fi

set -a
source "$SECRETS_FILE"
set +a
log_success "✅ 민감정보 로드 완료!"

# Kubernetes 리소스 배포
log_info "☸️ Kubernetes 리소스 배포 시작..."

K8S_DIR="$SCRIPT_DIR/../k8s"
if [[ ! -d "$K8S_DIR" ]]; then
    log_error "k8s 디렉토리를 찾을 수 없습니다: $K8S_DIR"
    exit 1
fi

cd "$K8S_DIR"

# 네임스페이스 확인 (biocom-api 공유)
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - || true

# ConfigMap 배포
log_info "ConfigMap 배포 중..."
kubectl apply -f configmap.yaml

# Secret 생성
log_info "Secret 생성 중..."
kubectl delete secret biocom-mq-secrets -n "$NAMESPACE" --ignore-not-found
kubectl create secret generic biocom-mq-secrets \
    --namespace="$NAMESPACE" \
    --from-literal=NEO4J_URI="$NEO4J_URI" \
    --from-literal=NEO4J_USERNAME="$NEO4J_USERNAME" \
    --from-literal=NEO4J_PASSWORD="$NEO4J_PASSWORD" \
    --from-literal=REDIS_PASSWORD=""

log_success "✅ Secret 생성 완료!"

# Service 배포
log_info "Service 배포 중..."
kubectl apply -f service.yaml

# Deployment 배포
log_info "Deployment 배포 중..."
sed -i.bak "s|image: .*biocom-mq:.*|image: $IMAGE_URL|" deployment.yaml
kubectl apply -f deployment.yaml

# 배포 상태 확인
log_info "배포 상태 확인 중..."
kubectl rollout status deployment/biocom-mq -n "$NAMESPACE" --timeout=300s

log_success "✅ Kubernetes 리소스 배포 완료!"

# 최종 상태 확인
echo
log_info "📊 배포 상태:"
kubectl get pods -n "$NAMESPACE" -l app=biocom-mq
echo
kubectl get svc -n "$NAMESPACE" -l app=biocom-mq

echo
log_success "🎉 biocom-mq Worker 배포 완료!"
log_info ""
log_info "Bull Board 접속 (Port Forward):"
log_info "  kubectl port-forward -n $NAMESPACE svc/biocom-mq-service 20804:20804"
log_info "  http://localhost:20804/admin/queues"
