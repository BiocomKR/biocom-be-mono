#!/bin/bash

# 🚀 BIOCOM API 애플리케이션 배포 스크립트 v2.0
# Kustomize 기반 환경별 배포

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 로깅 함수
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 스크립트 경로
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
K8S_DIR="$SCRIPT_DIR/../k8s"

# 사용법 출력
usage() {
    cat << EOF
사용법: $0 [옵션]

Kustomize 기반 환경별 배포 스크립트

옵션:
  -p, --project-id PROJECT_ID    GCP 프로젝트 ID (필수)
  -e, --env ENV                   배포 환경: dev 또는 prod (필수)
  -c, --cluster-name CLUSTER      GKE 클러스터 이름 (환경별 자동 설정)
  -z, --zone ZONE                 GCP 존 (기본값: asia-northeast3-a)
  -n, --namespace NAMESPACE       K8s 네임스페이스 (기본값: biocom-api)
  -s, --skip-build                Docker 이미지 빌드 건너뛰기
  -m, --skip-migration            DB 마이그레이션 건너뛰기
  -y, --yes                       모든 확인 자동 승인
  -h, --help                      이 도움말 출력

예시:
  $0 -p api-dev-biocom -e dev -y     # 개발 환경 배포
  $0 -p api-prod-biocom -e prod -y   # 운영 환경 배포

환경별 설정:
  dev:  api-dev-biocom / biocom-cluster-dev / biocom-postgres-dev
  prod: api-prod-biocom / biocom-cluster-prod / biocom-postgres-prod
EOF
    exit 0
}

# 기본값 설정
PROJECT_ID=""
DEPLOY_ENV=""
CLUSTER_NAME=""
ZONE="asia-northeast3-a"
NAMESPACE="biocom-api"
SKIP_BUILD=false
SKIP_MIGRATION=false
AUTO_APPROVE=false
REGION="asia-northeast3"

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
        -m|--skip-migration)
            SKIP_MIGRATION=true
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

# ==========================================
# 환경별 설정 자동 적용
# ==========================================
set_environment_config() {
    log_info "🔧 환경별 설정 적용 중... (환경: $DEPLOY_ENV)"

    if [[ "$DEPLOY_ENV" == "prod" ]]; then
        # 운영 환경
        [[ -z "$CLUSTER_NAME" ]] && CLUSTER_NAME="biocom-cluster-prod"
        DB_INSTANCE_NAME="biocom-postgres-prod"
        EXPECTED_PROJECT="api-prod-biocom"
    else
        # 개발 환경
        [[ -z "$CLUSTER_NAME" ]] && CLUSTER_NAME="biocom-cluster-dev"
        DB_INSTANCE_NAME="biocom-postgres-dev"
        EXPECTED_PROJECT="api-dev-biocom"
    fi

    # 프로젝트 ID 검증
    if [[ "$PROJECT_ID" != "$EXPECTED_PROJECT" ]]; then
        log_warning "⚠️  프로젝트 ID 불일치 감지!"
        log_warning "   환경: $DEPLOY_ENV"
        log_warning "   입력된 프로젝트: $PROJECT_ID"
        log_warning "   예상 프로젝트: $EXPECTED_PROJECT"
        if [[ "$AUTO_APPROVE" != true ]]; then
            read -p "계속 진행하시겠습니까? (y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_error "취소되었습니다."
                exit 1
            fi
        fi
    fi

    log_success "✅ 환경 설정 완료"
    log_info "   프로젝트: $PROJECT_ID"
    log_info "   클러스터: $CLUSTER_NAME"
    log_info "   DB 인스턴스: $DB_INSTANCE_NAME"
}

# 배포 정보 출력
log_info "📋 애플리케이션 배포 설정:"
log_info "   프로젝트 ID: $PROJECT_ID"
log_info "   배포 환경: $DEPLOY_ENV"
log_info "   존: $ZONE"
log_info "   네임스페이스: $NAMESPACE"
log_info "   빌드 건너뛰기: $SKIP_BUILD"
log_info "   마이그레이션 건너뛰기: $SKIP_MIGRATION"

# 환경 설정 적용
set_environment_config

# 사용자 확인
if [[ "$AUTO_APPROVE" != true ]]; then
    echo
    log_warning "⚠️  $DEPLOY_ENV 환경에 배포합니다!"
    read -p "계속 진행하시겠습니까? (y/n): " -n 1 -r
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

    # kustomize 체크 (standalone 또는 kubectl 내장)
    if command -v kustomize >/dev/null 2>&1; then
        KUSTOMIZE_CMD="kustomize"
    else
        KUSTOMIZE_CMD="kubectl kustomize"
    fi
    log_info "Kustomize 사용: $KUSTOMIZE_CMD"

    log_success "✅ 모든 필수 도구가 설치되어 있습니다."
}

# GCP 인증 및 kubeconfig 설정
setup_auth() {
    log_info "인증 설정 중..."

    # 환경별 서비스 계정 키 파일 선택
    local key_file="$PROJECT_ROOT/google-service-account-key-${DEPLOY_ENV}.json"

    if [[ -f "$key_file" ]]; then
        log_info "서비스 계정으로 인증 중... ($DEPLOY_ENV 환경)"
        gcloud auth activate-service-account --key-file="$key_file" --quiet
    else
        log_warning "서비스 계정 키 파일이 없습니다: $key_file"
        log_info "현재 gcloud 인증 정보를 사용합니다."
    fi

    # GCP 프로젝트 설정
    gcloud config set project "$PROJECT_ID" --quiet

    # kubeconfig 설정
    gcloud container clusters get-credentials "$CLUSTER_NAME" \
        --zone="$ZONE" \
        --project="$PROJECT_ID"

    log_success "✅ 인증 설정 완료!"
}

# 인프라 확인 및 DB IP 가져오기
check_infrastructure() {
    log_info "인프라 상태 확인 중..."

    # GKE 클러스터 확인
    if ! gcloud container clusters describe "$CLUSTER_NAME" --zone="$ZONE" --project="$PROJECT_ID" &>/dev/null; then
        log_error "GKE 클러스터가 없습니다: $CLUSTER_NAME"
        log_error "먼저 01-deploy-infrastructure.sh를 실행하세요."
        exit 1
    fi

    # Cloud SQL IP 가져오기 (환경별 DB 인스턴스)
    DB_HOST=$(gcloud sql instances describe "$DB_INSTANCE_NAME" --project="$PROJECT_ID" --format="value(ipAddresses[0].ipAddress)" 2>/dev/null)
    if [[ -z "$DB_HOST" ]]; then
        log_error "Cloud SQL을 찾을 수 없습니다: $DB_INSTANCE_NAME"
        exit 1
    fi
    log_info "Cloud SQL IP: $DB_HOST ($DB_INSTANCE_NAME)"

    # Artifact Registry 확인
    if ! gcloud artifacts repositories describe biocom-api --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
        log_error "Artifact Registry가 없습니다."
        exit 1
    fi

    log_success "✅ 인프라 확인 완료!"
}

# Docker 이미지 빌드 및 푸시
build_and_push_docker() {
    if [[ "$SKIP_BUILD" == true ]]; then
        log_info "Docker 이미지 빌드를 건너뜁니다."
        # 최신 이미지 태그 가져오기
        IMAGE_TAG=$(gcloud artifacts docker images list \
            "$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api" \
            --format="value(tags)" --limit=1 2>/dev/null | head -1)
        if [[ -z "$IMAGE_TAG" ]]; then
            IMAGE_TAG="latest"
        fi
        log_info "기존 이미지 태그 사용: $IMAGE_TAG"
        return
    fi

    log_info "🔨 Docker 이미지 빌드 시작..."

    cd "$PROJECT_ROOT"
    gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

    IMAGE_TAG=$(date +%Y%m%d%H%M%S)
    IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api:$IMAGE_TAG"
    LATEST_URL="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api:latest"

    log_info "Docker 이미지 빌드 중... (약 2-3분 소요)"
    docker buildx build \
        --platform linux/amd64 \
        -t "$IMAGE_URL" \
        -t "$LATEST_URL" \
        --push \
        .

    log_success "✅ Docker 이미지 빌드 완료: $IMAGE_TAG"
}

# DB 마이그레이션 실행
run_db_migration() {
    if [[ "$SKIP_MIGRATION" == true ]]; then
        log_info "DB 마이그레이션을 건너뜁니다."
        return
    fi

    log_info "🗄️ DB 마이그레이션 실행 중... ($DB_INSTANCE_NAME)"

    cd "$PROJECT_ROOT"

    # .env.secrets에서 로드된 DB_PASSWORD 사용 (URL 인코딩 필요)
    local encoded_password
    encoded_password=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$DB_PASSWORD', safe=''))")
    export DATABASE_URL="postgresql://biocom:${encoded_password}@$DB_HOST:5432/biocom"

    if [[ ! -f "prisma/schema.prisma" ]]; then
        log_error "prisma/schema.prisma 파일을 찾을 수 없습니다."
        exit 1
    fi

    if ! npx prisma migrate deploy --schema=prisma/schema.prisma; then
        log_warning "마이그레이션 실패. 스키마 동기화 시도 중..."
        npx prisma db push --schema=prisma/schema.prisma --accept-data-loss

        if [[ -d "prisma/migrations" ]]; then
            for migration_dir in prisma/migrations/*/; do
                if [[ -d "$migration_dir" ]]; then
                    migration_name=$(basename "$migration_dir")
                    npx prisma migrate resolve --applied "$migration_name" --schema=prisma/schema.prisma || true
                fi
            done
        fi
    fi

    log_success "✅ DB 마이그레이션 완료!"
}

# 민감정보 로드
load_secrets() {
    log_info "🔐 민감정보 로드 중... ($DEPLOY_ENV 환경)"

    # 환경별 secrets 파일 우선, 없으면 공통 파일 사용
    local env_secrets_file="$SCRIPT_DIR/../.env.secrets.${DEPLOY_ENV}"
    local common_secrets_file="$SCRIPT_DIR/../.env.secrets"

    if [[ -f "$env_secrets_file" ]]; then
        SECRETS_FILE="$env_secrets_file"
        log_info "환경별 secrets 파일 사용: .env.secrets.${DEPLOY_ENV}"
    elif [[ -f "$common_secrets_file" ]]; then
        SECRETS_FILE="$common_secrets_file"
        log_warning "공통 secrets 파일 사용: .env.secrets (환경별 파일 권장)"
    else
        log_error "민감정보 파일을 찾을 수 없습니다."
        log_error "필요한 파일: $env_secrets_file 또는 $common_secrets_file"
        exit 1
    fi

    set -a
    source "$SECRETS_FILE"
    set +a

    local required_vars=("DB_PASSWORD" "JWT_SECRET" "OPENAI_API_KEY" "AI_AGENT_API_KEY")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            log_error "필수 환경변수가 비어있습니다: $var"
            exit 1
        fi
    done

    log_success "✅ 민감정보 로드 완료!"
}

# Static IP 확인/생성
ensure_static_ip() {
    log_info "🌐 Static IP 확인 중..."

    local static_ip_name="biocom-cluster-external-ip"
    if [[ "$DEPLOY_ENV" == "prod" ]]; then
        static_ip_name="biocom-api-prod-external-ip"
    fi

    if gcloud compute addresses describe "$static_ip_name" --global --project="$PROJECT_ID" &>/dev/null; then
        local ip_address
        ip_address=$(gcloud compute addresses describe "$static_ip_name" --global --project="$PROJECT_ID" --format="value(address)")
        log_success "✅ Static IP: $ip_address ($static_ip_name)"
    else
        log_info "Static IP 생성 중..."
        gcloud compute addresses create "$static_ip_name" --global --project="$PROJECT_ID"
        log_success "✅ Static IP 생성 완료!"
    fi
}

# ConfigMap에 DB_HOST 업데이트
update_configmap_db_host() {
    log_info "📝 ConfigMap DB_HOST 업데이트 중..."

    local configmap_file="$K8S_DIR/overlays/$DEPLOY_ENV/configmap.yaml"

    # DB_HOST만 업데이트 (DATABASE_URL은 Deployment에서 Secret과 조합하여 생성)
    sed -i.bak "s|DB_HOST: .*|DB_HOST: \"$DB_HOST\"|" "$configmap_file"
    rm -f "${configmap_file}.bak"

    log_success "✅ ConfigMap 업데이트 완료!"
}

# Kubernetes 리소스 배포 (Kustomize 사용)
deploy_kubernetes() {
    log_info "☸️ Kubernetes 리소스 배포 시작... (Kustomize)"

    # 네임스페이스 생성
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    # ConfigMap DB_HOST 업데이트
    update_configmap_db_host

    # Kustomize 이미지 태그 설정 (kustomization.yaml 직접 수정)
    cd "$K8S_DIR/overlays/$DEPLOY_ENV"
    local new_image="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api"
    sed -i.bak "s|newName: .*biocom-api.*|newName: $new_image|" kustomization.yaml
    sed -i.bak "s|newTag: .*|newTag: \"$IMAGE_TAG\"|" kustomization.yaml
    rm -f kustomization.yaml.bak
    log_info "이미지 설정: $new_image:$IMAGE_TAG"

    # Secret 생성
    log_info "Secret 업데이트 중..."
    kubectl delete secret biocom-api-secrets -n "$NAMESPACE" --ignore-not-found
    kubectl create secret generic biocom-api-secrets \
        --namespace="$NAMESPACE" \
        --from-literal=DB_PASSWORD="$DB_PASSWORD" \
        --from-literal=JWT_SECRET="$JWT_SECRET" \
        --from-literal=JWT_REFRESH_TOKEN_SECRET="$JWT_REFRESH_TOKEN_SECRET" \
        --from-literal=SESSION_SECRET="$SESSION_SECRET" \
        --from-literal=ENCRYPTION_KEY="$ENCRYPTION_KEY" \
        --from-literal=OPENAI_API_KEY="$OPENAI_API_KEY" \
        --from-literal=GOOGLE_API_KEY="$GOOGLE_API_KEY" \
        --from-literal=KCP_PRIVATE_KEY_PASSWORD="$KCP_PRIVATE_KEY_PASSWORD" \
        --from-literal=TOSS_PAYMENTS_SECRET_KEY="$TOSS_PAYMENTS_SECRET_KEY" \
        --from-literal=SLACK_WEBHOOK_URL="$SLACK_WEBHOOK_URL" \
        --from-literal=PLAYAUTO_API_KEY="$PLAYAUTO_API_KEY" \
        --from-literal=PLAYAUTO_EMAIL="$PLAYAUTO_EMAIL" \
        --from-literal=PLAYAUTO_PASSWORD="$PLAYAUTO_PASSWORD" \
        --from-literal=AI_AGENT_API_KEY="$AI_AGENT_API_KEY"

    # Google Service Account Key Secret
    if ! kubectl get secret google-service-account-key -n "$NAMESPACE" &>/dev/null; then
        log_info "Google Service Account Key Secret 생성 중..."
        SERVICE_ACCOUNT_KEY_FILE="$PROJECT_ROOT/google-service-account-key.json"
        if [[ ! -f "$SERVICE_ACCOUNT_KEY_FILE" ]]; then
            log_error "Service Account Key 파일을 찾을 수 없습니다: $SERVICE_ACCOUNT_KEY_FILE"
            exit 1
        fi
        kubectl create secret generic google-service-account-key \
            --namespace="$NAMESPACE" \
            --from-file=key.json="$SERVICE_ACCOUNT_KEY_FILE"
    fi

    # KCP 인증서 Secret
    if ! kubectl get secret kcp-cert-files -n "$NAMESPACE" &>/dev/null; then
        log_info "KCP 인증서 Secret 생성 중..."
        kubectl create secret generic kcp-cert-files \
            --namespace="$NAMESPACE" \
            --from-file=KCP_AUTH_ALDXX_CERT.pem="$PROJECT_ROOT/config/kcp-cert/KCP_AUTH_ALDXX_CERT.pem" \
            --from-file=KCP_AUTH_ALDXX_PRIKEY.pem="$PROJECT_ROOT/config/kcp-cert/KCP_AUTH_ALDXX_PRIKEY.pem"
    fi

    # Firebase Service Account Key Secret
    if ! kubectl get secret firebase-service-account-key -n "$NAMESPACE" &>/dev/null; then
        log_info "Firebase Service Account Key Secret 생성 중..."
        if [[ "$DEPLOY_ENV" == "prod" ]]; then
            FIREBASE_KEY_FILE=$(find "$PROJECT_ROOT" -maxdepth 1 -name "biocomchallenge-firebase-adminsdk*.json" -type f | head -1)
        else
            FIREBASE_KEY_FILE=$(find "$PROJECT_ROOT" -maxdepth 1 -name "biocomchallengedev-firebase-adminsdk*.json" -type f | head -1)
        fi
        if [[ -z "$FIREBASE_KEY_FILE" ]]; then
            log_error "Firebase 키 파일을 찾을 수 없습니다."
            exit 1
        fi
        kubectl create secret generic firebase-service-account-key \
            --namespace="$NAMESPACE" \
            --from-file=firebase-key.json="$FIREBASE_KEY_FILE"
    fi

    # Static IP 확인
    ensure_static_ip

    # Kustomize로 배포
    log_info "Kustomize 배포 중..."
    kubectl apply -k "$K8S_DIR/overlays/$DEPLOY_ENV"

    # 배포 상태 확인
    log_info "배포 상태 확인 중..."
    kubectl rollout status deployment/biocom-api -n "$NAMESPACE" --timeout=300s

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

    echo
    log_info "CronJob 상태:"
    kubectl get cronjobs -n "$NAMESPACE"

    # 도메인 정보
    echo
    if [[ "$DEPLOY_ENV" == "prod" ]]; then
        log_success "🎉 운영 환경 배포 완료!"
        log_info "접속 URL: https://api.biocom.ai.kr/api/docs"
    else
        log_success "🎉 개발 환경 배포 완료!"
        log_info "접속 URL: https://api-dev.biocom.ai.kr/api/docs"
    fi
}

# 메인 실행
main() {
    log_info "🚀 BIOCOM API 배포 시작! (환경: $DEPLOY_ENV)"

    check_requirements
    setup_auth
    check_infrastructure
    load_secrets
    build_and_push_docker
    run_db_migration
    deploy_kubernetes
    check_deployment_status

    log_success "🎉 배포 완료!"
}

main
