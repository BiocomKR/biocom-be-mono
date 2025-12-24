#!/bin/bash

# 🚀 BIOCOM BO-API 애플리케이션 배포 스크립트
# Docker 이미지 빌드 및 Kubernetes 배포
# -e dev/prod 옵션으로 환경 선택

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

# 스크립트 경로
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

usage() {
    cat << EOF
사용법: $0 [옵션]

BIOCOM BO-API 애플리케이션 배포 스크립트 - Docker 이미지 빌드 및 Kubernetes 배포

옵션:
  -p, --project-id PROJECT_ID    GCP 프로젝트 ID (필수)
  -e, --env ENV                   배포 환경: dev 또는 prod (필수)
  -c, --cluster-name CLUSTER      GKE 클러스터 이름 (기본값: 환경에 따라 자동 설정)
  -z, --zone ZONE                 GCP 존 (기본값: asia-northeast3-a)
  -n, --namespace NAMESPACE       K8s 네임스페이스 (기본값: biocom-bo-api)
  -s, --skip-build                Docker 이미지 빌드 건너뛰기
  -y, --yes                       모든 확인 자동 승인
  -h, --help                      이 도움말 출력

예시:
  $0 --project-id api-dev-biocom --env dev --yes     # 개발 환경 배포
  $0 --project-id api-prod-biocom --env prod --yes   # 운영 환경 배포
  $0 --project-id api-dev-biocom --env dev --skip-build --yes  # 빌드 없이 배포만

주의사항:
  - 인프라가 먼저 구축되어 있어야 합니다
  - .env.secrets 파일이 infra-gcp/ 디렉토리에 있어야 합니다
EOF
    exit 0
}

# 기본값 설정
PROJECT_ID=""
DEPLOY_ENV=""
CLUSTER_NAME=""
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
        -e|--env)
            DEPLOY_ENV="$2"
            if [[ "$DEPLOY_ENV" != "dev" && "$DEPLOY_ENV" != "prod" ]]; then
                log_error "환경은 'dev' 또는 'prod'만 가능합니다: $DEPLOY_ENV"
                exit 1
            fi
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

# 필수 파라미터 확인
if [[ -z "$PROJECT_ID" ]]; then
    log_error "프로젝트 ID가 필요합니다. -p 또는 --project-id 옵션을 사용하세요."
    usage
fi

if [[ -z "$DEPLOY_ENV" ]]; then
    log_error "배포 환경이 필요합니다. -e 또는 --env 옵션을 사용하세요. (dev 또는 prod)"
    usage
fi

# 환경별 기본값 설정
if [[ -z "$CLUSTER_NAME" ]]; then
    if [[ "$DEPLOY_ENV" == "prod" ]]; then
        CLUSTER_NAME="biocom-cluster-prod"
    else
        CLUSTER_NAME="biocom-cluster-dev"
    fi
fi

log_info "📋 애플리케이션 배포 설정:"
log_info "   프로젝트 ID: $PROJECT_ID"
log_info "   배포 환경: $DEPLOY_ENV"
log_info "   클러스터: $CLUSTER_NAME"
log_info "   존: $ZONE"
log_info "   네임스페이스: $NAMESPACE"
log_info "   빌드 건너뛰기: $SKIP_BUILD"
log_info "   자동 승인: $AUTO_APPROVE"

if [[ "$DEPLOY_ENV" == "prod" ]]; then
    echo
    log_warning "⚠️  운영 환경에 배포합니다!"
    echo
fi

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

    # 프로젝트 ID에 따라 적절한 계정으로 자동 전환
    if [[ "$PROJECT_ID" == "api-dev-biocom" ]]; then
        log_info "개발 환경 계정으로 전환 중 (ai@biocom.kr)..."
        gcloud config set account ai@biocom.kr --quiet 2>/dev/null || true
    elif [[ "$PROJECT_ID" == "api-prod-biocom" ]]; then
        # 운영 환경: 서비스 계정 키 파일 사용
        if [ -f "$PROJECT_ROOT/google-service-account-key.json" ]; then
            log_info "운영 환경 서비스 계정으로 인증 중..."
            gcloud auth activate-service-account --key-file="$PROJECT_ROOT/google-service-account-key.json" --quiet
        else
            log_warning "서비스 계정 키 파일이 없습니다. 기존 인증 사용."
        fi
    fi

    # GCP 프로젝트 설정
    gcloud config set project "$PROJECT_ID" --quiet

    # kubeconfig 설정
    gcloud container clusters get-credentials "$CLUSTER_NAME" \
        --zone="$ZONE" \
        --project="$PROJECT_ID"

    log_success "✅ 인증 설정 완료!"
}

# 인프라 확인
check_infrastructure() {
    log_info "인프라 상태 확인 중..."

    if ! gcloud container clusters describe "$CLUSTER_NAME" --zone="$ZONE" --project="$PROJECT_ID" &>/dev/null; then
        log_error "GKE 클러스터가 없습니다: $CLUSTER_NAME"
        exit 1
    fi

    if ! gcloud artifacts repositories describe biocom-api --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
        log_error "Artifact Registry가 없습니다."
        exit 1
    fi

    log_success "✅ 인프라 확인 완료!"
}

# 민감정보 로드
load_secrets() {
    log_info "🔐 민감정보 로드 중..."

    SECRETS_FILE="$PROJECT_ROOT/.env.secrets"

    if [[ ! -f "$SECRETS_FILE" ]]; then
        log_error "민감정보 파일을 찾을 수 없습니다: $SECRETS_FILE"
        exit 1
    fi

    set -a
    source "$SECRETS_FILE"
    set +a

    log_success "✅ 민감정보 로드 완료!"
}

# Docker 이미지 빌드 및 푸시
build_and_push_docker() {
    if [[ "$SKIP_BUILD" == true ]]; then
        log_info "Docker 이미지 빌드를 건너뜁니다."
        IMAGE_TAG=$(gcloud artifacts docker images list "$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-bo-api" \
            --sort-by="~UPDATE_TIME" --limit=1 --format="value(version)" 2>/dev/null | head -1)
        if [[ -z "$IMAGE_TAG" ]]; then
            IMAGE_TAG="latest"
        fi
        log_info "최신 이미지 태그: $IMAGE_TAG"
        return
    fi

    log_info "🔨 Docker 이미지 빌드 시작..."

    cd "$PROJECT_ROOT"

    gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

    # 환경별 이미지 태그
    if [[ "$DEPLOY_ENV" == "prod" ]]; then
        IMAGE_TAG="prod-$(date +%Y%m%d%H%M%S)"
    else
        IMAGE_TAG="dev-$(date +%Y%m%d%H%M%S)"
    fi

    IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-bo-api:$IMAGE_TAG"
    LATEST_URL="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-bo-api:latest"

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

    if [[ "$DEPLOY_ENV" == "prod" ]]; then
        local static_ip_name="biocom-bo-api-prod-external-ip"
    else
        local static_ip_name="biocom-bo-api-external-ip"
    fi

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

    K8S_DIR="$PROJECT_ROOT/infra-gcp/k8s"

    if [[ ! -d "$K8S_DIR" ]]; then
        log_error "K8s 디렉토리를 찾을 수 없습니다: $K8S_DIR"
        exit 1
    fi
    cd "$K8S_DIR"

    # 네임스페이스 생성
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    # 환경별 ConfigMap 선택
    log_info "ConfigMap 배포 중... (환경: $DEPLOY_ENV)"
    if [[ "$DEPLOY_ENV" == "prod" ]] && [[ -f "configmap-prod.yaml" ]]; then
        kubectl apply -f configmap-prod.yaml -n "$NAMESPACE"
    else
        kubectl apply -f configmap.yaml -n "$NAMESPACE"
    fi

    # Secret 동기화
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
        --from-literal=SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}" \
        --from-literal=PUBLIC_DATA_PORTAL_API_KEY="${PUBLIC_DATA_PORTAL_API_KEY:-}"

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
            log_warning "⚠️  google-service-account-key.json 파일이 없습니다."
        fi
    fi

    # Firebase Service Account Key Secret
    log_info "Firebase Service Account Key Secret 확인 중..."
    if kubectl get secret firebase-service-account-key -n "$NAMESPACE" &>/dev/null; then
        log_success "✅ Firebase Service Account Key Secret 존재함"
    else
        if [[ "$DEPLOY_ENV" == "prod" ]]; then
            FIREBASE_KEY_FILE=$(find "$PROJECT_ROOT" -maxdepth 1 -name "biocomchallenge-firebase-adminsdk*.json" -type f | grep -v "dev" | head -1)
        else
            FIREBASE_KEY_FILE=$(find "$PROJECT_ROOT" -maxdepth 1 -name "biocomchallengedev-firebase-adminsdk*.json" -type f | head -1)
        fi

        if [[ -n "$FIREBASE_KEY_FILE" ]] && [[ -f "$FIREBASE_KEY_FILE" ]]; then
            kubectl create secret generic firebase-service-account-key \
                --namespace="$NAMESPACE" \
                --from-file=firebase-key.json="$FIREBASE_KEY_FILE"
            log_success "✅ Firebase Service Account Key Secret 생성 완료!"
        else
            log_warning "⚠️  Firebase 키 파일이 없습니다."
        fi
    fi

    # Service 배포
    log_info "Service 배포 중..."
    kubectl apply -f service.yaml -n "$NAMESPACE"

    # Deployment 배포
    log_info "Deployment 배포 중..."
    local image_url="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-bo-api:$IMAGE_TAG"
    sed -i.bak "s|image: .*biocom-bo-api.*|image: $image_url|" deployment.yaml
    kubectl apply -f deployment.yaml -n "$NAMESPACE"
    rm -f deployment.yaml.bak

    # Static IP 확인/생성
    ensure_static_ip

    # Ingress 배포 (환경별)
    log_info "Ingress 배포 중..."
    if [[ "$DEPLOY_ENV" == "prod" ]] && [[ -f "ingress-prod.yaml" ]]; then
        kubectl apply -f ingress-prod.yaml -n "$NAMESPACE"
    else
        kubectl apply -f ingress.yaml -n "$NAMESPACE"
    fi

    # 배포 상태 확인
    log_info "배포 상태 확인 중... (최대 5분)"
    if kubectl rollout status deployment/biocom-bo-api -n "$NAMESPACE" --timeout=300s; then
        log_success "✅ Deployment 롤아웃 완료!"
    else
        log_error "❌ Deployment 롤아웃 실패"
        kubectl get pods -n "$NAMESPACE"
        exit 1
    fi

    log_success "✅ Kubernetes 리소스 배포 완료!"
}

# 배포 상태 확인
check_deployment_status() {
    log_info "📊 배포 상태 확인..."

    echo
    log_info "Pod 상태:"
    kubectl get pods -n "$NAMESPACE" -l app=biocom-bo-api

    echo
    log_info "Service 상태:"
    kubectl get svc -n "$NAMESPACE"

    echo
    log_info "Ingress 상태:"
    kubectl get ingress -n "$NAMESPACE"

    local ingress_ip=""
    ingress_ip=$(kubectl get ingress -n "$NAMESPACE" -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)

    echo
    if [[ -n "$ingress_ip" ]]; then
        log_success "🎉 배포가 완료되었습니다!"
        echo
        if [[ "$DEPLOY_ENV" == "prod" ]]; then
            log_info "접속 URL: https://bo-api.biocom.ai.kr/api/docs"
        else
            log_info "접속 URL: https://bo-api-dev.biocom.ai.kr/api/docs"
        fi
    else
        log_warning "⚠️  Ingress IP가 아직 할당되지 않았습니다."
        log_info "확인 명령어: kubectl get ingress -n $NAMESPACE"
    fi
}

# 메인 실행 함수
main() {
    log_info "🚀 BIOCOM BO-API 배포를 시작합니다! (환경: $DEPLOY_ENV)"
    echo

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
