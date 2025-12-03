#!/bin/bash

# 🚀 BIOCOM BO-API 애플리케이션 배포 스크립트
# Docker 이미지 빌드 및 Kubernetes 배포
# .env.secrets 파일을 읽어 K8s Secret 자동 동기화

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    cat << EOF
사용법: $0 [옵션]

BIOCOM BO-API 애플리케이션 배포 스크립트 - Docker 이미지 빌드 및 Kubernetes 배포

옵션:
  -p, --project-id PROJECT_ID    GCP 프로젝트 ID (필수)
  -c, --cluster-name CLUSTER     GKE 클러스터 이름 (기본값: biocom-bo-cluster)
  -z, --zone ZONE                GCP 존 (기본값: asia-northeast3-a)
  -n, --namespace NAMESPACE      K8s 네임스페이스 (기본값: biocom-bo-api)
  -s, --skip-build               Docker 이미지 빌드 건너뛰기
  -y, --yes                      모든 확인 자동 승인
  -h, --help                     이 도움말 출력

예시:
  $0 --project-id biocom-backoffice --yes              # 전체 배포
  $0 --project-id biocom-backoffice --skip-build --yes # 빌드 없이 배포만

주의사항:
  - 인프라가 먼저 구축되어 있어야 합니다 (01-deploy-infrastructure.sh)
  - .env.secrets 파일이 프로젝트 루트에 있어야 합니다
EOF
    exit 0
}

# 기본값 설정
PROJECT_ID=""
CLUSTER_NAME="biocom-bo-cluster"
ZONE="asia-northeast3-a"
NAMESPACE="biocom-bo-api"
SKIP_BUILD=false
AUTO_APPROVE=false
REGION="asia-northeast3"
IMAGE_TAG=""

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--project-id)
            PROJECT_ID="$2"
            shift 2
            ;;
        -c|--cluster-name)
            CLUSTER_NAME="$2"
            shift 2
            ;;
        -z|--zone)
            ZONE="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -s|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -y|--yes)
            AUTO_APPROVE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            log_error "알 수 없는 옵션: $1"
            usage
            ;;
    esac
done

if [[ -z "$PROJECT_ID" ]]; then
    log_error "프로젝트 ID가 필요합니다. -p 또는 --project-id 옵션을 사용하세요."
    usage
fi

log_info "📋 애플리케이션 배포 설정:"
log_info "   프로젝트 ID: $PROJECT_ID"
log_info "   클러스터: $CLUSTER_NAME"
log_info "   존: $ZONE"
log_info "   네임스페이스: $NAMESPACE"
log_info "   빌드 건너뛰기: $SKIP_BUILD"
log_info "   자동 승인: $AUTO_APPROVE"

if [[ "$AUTO_APPROVE" != true ]]; then
    read -p "애플리케이션을 배포하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "취소되었습니다."
        exit 0
    fi
fi

# 필수 도구 확인
check_requirements() {
    log_info "필수 도구 확인 중..."

    local missing_tools=()

    command -v gcloud >/dev/null 2>&1 || missing_tools+=("gcloud")
    command -v kubectl >/dev/null 2>&1 || missing_tools+=("kubectl")
    command -v docker >/dev/null 2>&1 || missing_tools+=("docker")

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "다음 도구가 설치되지 않았습니다: ${missing_tools[*]}"
        exit 1
    fi

    log_success "모든 필수 도구가 설치되어 있습니다."
}

# GCP 인증 및 kubeconfig 설정
setup_auth() {
    log_info "인증 설정 중..."

    gcloud config set project "$PROJECT_ID" --quiet

    gcloud container clusters get-credentials "$CLUSTER_NAME" \
        --zone="$ZONE" \
        --project="$PROJECT_ID"

    log_success "✅ 인증 설정 완료!"
}

# 인프라 확인
check_infrastructure() {
    log_info "인프라 상태 확인 중..."

    if ! gcloud container clusters describe "$CLUSTER_NAME" --zone="$ZONE" --project="$PROJECT_ID" &>/dev/null; then
        log_error "GKE 클러스터가 없습니다. 먼저 01-deploy-infrastructure.sh를 실행하세요."
        exit 1
    fi

    if ! gcloud artifacts repositories describe biocom-bo-api --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
        log_error "Artifact Registry가 없습니다. 먼저 01-deploy-infrastructure.sh를 실행하세요."
        exit 1
    fi

    log_success "✅ 인프라 확인 완료!"
}

# 민감정보 로드 (.env.secrets)
load_secrets() {
    log_info "🔐 민감정보 로드 중..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
    SECRETS_FILE="$PROJECT_ROOT/.env.secrets"

    if [[ ! -f "$SECRETS_FILE" ]]; then
        log_error "민감정보 파일을 찾을 수 없습니다: $SECRETS_FILE"
        log_error ".env.secrets.example 파일을 복사하여 .env.secrets를 생성하고 실제 값을 입력하세요."
        exit 1
    fi

    # .env.secrets 파일 로드
    set -a
    source "$SECRETS_FILE"
    set +a

    log_success "✅ 민감정보 로드 완료!"
}

# Docker 이미지 빌드 및 푸시
build_and_push_docker() {
    if [[ "$SKIP_BUILD" == true ]]; then
        log_info "Docker 이미지 빌드를 건너뜁니다."
        # 최신 이미지 태그 가져오기
        IMAGE_TAG=$(gcloud artifacts docker images list "$REGION-docker.pkg.dev/$PROJECT_ID/biocom-bo-api/biocom-bo-api" \
            --sort-by="~UPDATE_TIME" --limit=1 --format="value(version)" 2>/dev/null | head -1)
        if [[ -z "$IMAGE_TAG" ]]; then
            IMAGE_TAG="latest"
        fi
        return
    fi

    log_info "🔨 Docker 이미지 빌드 시작..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
    cd "$PROJECT_ROOT"

    # Artifact Registry 인증
    gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

    # 이미지 태그 생성
    IMAGE_TAG=$(date +%Y%m%d%H%M%S)
    IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-bo-api/biocom-bo-api:$IMAGE_TAG"
    LATEST_URL="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-bo-api/biocom-bo-api:latest"

    # Docker 빌드
    log_info "Docker 이미지 빌드 중... (약 2-3분 소요)"
    docker buildx build \
        --platform linux/amd64 \
        -t "$IMAGE_URL" \
        -t "$LATEST_URL" \
        --push \
        .

    log_success "✅ Docker 이미지 빌드 및 푸시 완료!"
    log_info "   이미지: $IMAGE_URL"
}

# Static IP 확인/생성
ensure_static_ip() {
    log_info "🌐 Static IP 확인/생성 중..."

    local static_ip_name="biocom-bo-cluster-external-ip"

    if gcloud compute addresses describe "$static_ip_name" --global --project="$PROJECT_ID" &>/dev/null; then
        local ip_address
        ip_address=$(gcloud compute addresses describe "$static_ip_name" --global --project="$PROJECT_ID" --format="value(address)")
        log_success "✅ 기존 Static IP 확인됨: $ip_address"
    else
        log_info "Static IP 생성 중..."
        gcloud compute addresses create "$static_ip_name" --global --project="$PROJECT_ID"
        local ip_address
        ip_address=$(gcloud compute addresses describe "$static_ip_name" --global --project="$PROJECT_ID" --format="value(address)")
        log_success "✅ 새 Static IP 생성됨: $ip_address"
    fi
}

# Kubernetes 리소스 배포
deploy_kubernetes() {
    log_info "☸️ Kubernetes 리소스 배포 시작..."

    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
    K8S_DIR="$PROJECT_ROOT/infra-gcp/k8s"

    if [[ ! -d "$K8S_DIR" ]]; then
        log_error "K8s 디렉토리를 찾을 수 없습니다: $K8S_DIR"
        exit 1
    fi
    cd "$K8S_DIR"

    # 네임스페이스 생성
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    # ConfigMap 배포
    log_info "ConfigMap 배포 중..."
    kubectl apply -f configmap.yaml

    # Secret 동기화 (.env.secrets → K8s Secret)
    log_info "🔐 Secret 동기화 중..."
    kubectl delete secret biocom-bo-api-secrets -n "$NAMESPACE" --ignore-not-found

    kubectl create secret generic biocom-bo-api-secrets \
        --namespace="$NAMESPACE" \
        --from-literal=DB_PASSWORD="${DB_PASSWORD:-}" \
        --from-literal=JWT_SECRET="${JWT_SECRET:-}" \
        --from-literal=JWT_REFRESH_TOKEN_SECRET="${JWT_REFRESH_TOKEN_SECRET:-}" \
        --from-literal=SESSION_SECRET="${SESSION_SECRET:-}" \
        --from-literal=ENCRYPTION_KEY="${ENCRYPTION_KEY:-}" \
        --from-literal=OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
        --from-literal=GOOGLE_API_KEY="${GOOGLE_API_KEY:-}" \
        --from-literal=TOSS_PAYMENTS_SECRET_KEY="${TOSS_PAYMENTS_SECRET_KEY:-}" \
        --from-literal=SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

    log_success "✅ Secret 동기화 완료!"

    # Google Service Account Key Secret
    log_info "Google Service Account Key Secret 확인 중..."
    if kubectl get secret google-service-account-key -n "$NAMESPACE" &>/dev/null; then
        log_success "✅ Google Service Account Key Secret 존재함"
    else
        SERVICE_ACCOUNT_KEY_FILE="$PROJECT_ROOT/google-service-account-key.json"
        if [[ -f "$SERVICE_ACCOUNT_KEY_FILE" ]]; then
            kubectl create secret generic google-service-account-key \
                --namespace="$NAMESPACE" \
                --from-file=key.json="$SERVICE_ACCOUNT_KEY_FILE"
            log_success "✅ Google Service Account Key Secret 생성 완료!"
        else
            log_warning "⚠️  google-service-account-key.json 파일이 없습니다. 수동으로 생성하세요."
        fi
    fi

    # Firebase Service Account Key Secret
    log_info "Firebase Service Account Key Secret 확인 중..."
    if kubectl get secret firebase-service-account-key -n "$NAMESPACE" &>/dev/null; then
        log_success "✅ Firebase Service Account Key Secret 존재함"
    else
        FIREBASE_KEY_FILE=$(find "$PROJECT_ROOT" -maxdepth 1 -name "*firebase*adminsdk*.json" -type f | head -1)
        if [[ -n "$FIREBASE_KEY_FILE" ]] && [[ -f "$FIREBASE_KEY_FILE" ]]; then
            kubectl create secret generic firebase-service-account-key \
                --namespace="$NAMESPACE" \
                --from-file=firebase-key.json="$FIREBASE_KEY_FILE"
            log_success "✅ Firebase Service Account Key Secret 생성 완료!"
        else
            log_warning "⚠️  Firebase 키 파일이 없습니다. 수동으로 생성하세요."
        fi
    fi

    # Service 배포
    log_info "Service 배포 중..."
    kubectl apply -f service.yaml

    # Deployment 배포 (이미지 태그 업데이트)
    log_info "Deployment 배포 중..."
    sed -i.bak "s|image: .*|image: $REGION-docker.pkg.dev/$PROJECT_ID/biocom-bo-api/biocom-bo-api:$IMAGE_TAG|" deployment.yaml
    kubectl apply -f deployment.yaml

    # Static IP 확인/생성
    ensure_static_ip

    # Ingress 배포
    log_info "Ingress 배포 중..."
    kubectl apply -f ingress.yaml

    # 배포 상태 확인
    log_info "배포 상태 확인 중..."
    kubectl rollout status deployment/biocom-bo-api -n "$NAMESPACE" --timeout=300s

    log_success "✅ Kubernetes 리소스 배포 완료!"
}

# 배포 상태 확인
check_deployment_status() {
    log_info "📊 배포 상태 확인..."

    echo
    log_info "Pod 상태:"
    kubectl get pods -n "$NAMESPACE"

    echo
    log_info "Service 상태:"
    kubectl get svc -n "$NAMESPACE"

    echo
    log_info "Ingress 상태:"
    kubectl get ingress -n "$NAMESPACE"

    # Ingress IP 확인
    local ingress_ip=""
    local max_attempts=30
    local attempt=0

    log_info "Ingress IP 할당 대기 중... (최대 5분)"
    while [[ $attempt -lt $max_attempts ]]; do
        ingress_ip=$(kubectl get ingress biocom-bo-api-ingress -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)

        if [[ -n "$ingress_ip" ]]; then
            log_success "✅ Ingress IP 할당됨: $ingress_ip"
            break
        fi

        echo -n "."
        sleep 10
        ((attempt++))
    done
    echo

    if [[ -z "$ingress_ip" ]]; then
        log_warning "⚠️  Ingress IP가 아직 할당되지 않았습니다. 몇 분 후 다시 확인하세요."
    else
        echo
        log_success "🎉 배포가 완료되었습니다!"
        log_info "접속 URL:"
        log_info "  HTTP:  http://bo-api-dev.biocom.ai.kr/api/docs"
        log_info "  HTTPS: https://bo-api-dev.biocom.ai.kr/api/docs (SSL 인증서 발급 후)"
        echo
        log_info "DNS 설정이 필요합니다 (가비아):"
        log_info "  타입: A"
        log_info "  호스트: bo-api-dev"
        log_info "  값: $ingress_ip"
    fi
}

# 메인 실행 함수
main() {
    log_info "🚀 BIOCOM BO-API 애플리케이션 배포를 시작합니다!"

    check_requirements
    setup_auth
    check_infrastructure
    load_secrets
    build_and_push_docker
    deploy_kubernetes
    check_deployment_status

    log_success "🎉 애플리케이션 배포가 완료되었습니다!"
}

main
