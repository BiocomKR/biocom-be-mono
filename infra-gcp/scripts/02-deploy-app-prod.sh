#!/bin/bash

# 🚀 BIOCOM API 운영 환경 애플리케이션 배포 스크립트
# 이 스크립트는 운영 환경(api-prod-biocom)에만 배포합니다.
# 개발 환경은 02-deploy-app.sh를 사용하세요.

set -e  # 에러 발생 시 즉시 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로깅 함수
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 스크립트 경로 (스크립트 시작 시 한 번만 계산)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# 🔒 운영 환경 고정값 (절대 변경 금지)
PROJECT_ID="api-prod-biocom"
CLUSTER_NAME="biocom-cluster-prod"
ZONE="asia-northeast3-a"
REGION="asia-northeast3"
NAMESPACE="biocom-api"
DB_INSTANCE_NAME="biocom-postgres-prod"
DEPLOY_ENV="production"

# 사용법 출력
usage() {
    cat << EOF
사용법: $0 [옵션]

🔒 BIOCOM API 운영 환경 배포 스크립트

이 스크립트는 운영 환경(api-prod-biocom)에만 배포합니다.
개발 환경 배포는 02-deploy-app.sh --env development 를 사용하세요.

옵션:
  -s, --skip-build                Docker 이미지 빌드 건너뛰기
  -m, --skip-migration            DB 마이그레이션 건너뛰기
  -y, --yes                       모든 확인 자동 승인
  -h, --help                      이 도움말 출력

예시:
  $0 --yes                        # 운영 환경 전체 배포
  $0 --skip-build --yes           # 빌드 없이 배포만
  $0 --skip-migration --yes       # 마이그레이션 없이 배포

고정 설정값:
  프로젝트 ID:  $PROJECT_ID
  클러스터:     $CLUSTER_NAME
  존:           $ZONE
  네임스페이스: $NAMESPACE

⚠️  주의사항:
  - 이 스크립트는 운영 환경에만 배포합니다
  - 배포 전 반드시 개발 환경에서 테스트를 완료하세요
  - 롤백이 필요할 경우 kubectl rollout undo 사용
EOF
    exit 0
}

# 기본값 설정
DB_HOST=""
SKIP_BUILD=false
SKIP_MIGRATION=false
AUTO_APPROVE=false
IMAGE_TAG=""

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
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

echo
log_warning "🔒 =============================================="
log_warning "   BIOCOM API 운영 환경 배포"
log_warning "   ⚠️  이 스크립트는 운영 환경에 배포합니다!"
log_warning "=============================================="
echo

log_info "📋 운영 배포 설정:"
log_info "   프로젝트 ID: $PROJECT_ID"
log_info "   클러스터: $CLUSTER_NAME"
log_info "   존: $ZONE"
log_info "   네임스페이스: $NAMESPACE"
log_info "   빌드 건너뛰기: $SKIP_BUILD"
log_info "   마이그레이션 건너뛰기: $SKIP_MIGRATION"
log_info "   자동 승인: $AUTO_APPROVE"
echo

# 사용자 확인 (운영 환경이므로 더 엄격하게)
if [[ "$AUTO_APPROVE" != true ]]; then
    log_warning "⚠️  운영 환경에 배포합니다. 정말 계속하시겠습니까?"
    read -p "계속하려면 'PRODUCTION'을 입력하세요: " confirm
    if [[ "$confirm" != "PRODUCTION" ]]; then
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
    log_info "🔐 운영 환경 인증 설정 중..."

    # GCP 프로젝트 설정
    gcloud config set project "$PROJECT_ID" --quiet

    # kubeconfig 설정 (운영 클러스터)
    gcloud container clusters get-credentials "$CLUSTER_NAME" \
        --zone="$ZONE" \
        --project="$PROJECT_ID"

    # 현재 context 확인
    local current_context=$(kubectl config current-context)
    if [[ "$current_context" != *"$CLUSTER_NAME"* ]]; then
        log_error "kubectl context가 운영 클러스터가 아닙니다: $current_context"
        exit 1
    fi

    log_success "✅ 운영 환경 인증 설정 완료!"
    log_info "   현재 context: $current_context"
}

# 인프라 확인
check_infrastructure() {
    log_info "🔍 운영 인프라 상태 확인 중..."

    # GKE 클러스터 확인
    if ! gcloud container clusters describe "$CLUSTER_NAME" --zone="$ZONE" --project="$PROJECT_ID" &>/dev/null; then
        log_error "GKE 클러스터가 없습니다: $CLUSTER_NAME"
        log_error "먼저 운영 인프라를 구축하세요."
        exit 1
    fi
    log_success "✅ GKE 클러스터 확인됨: $CLUSTER_NAME"

    # Cloud SQL 확인 및 IP 가져오기
    DB_HOST=$(gcloud sql instances describe "$DB_INSTANCE_NAME" --project="$PROJECT_ID" --format="value(ipAddresses[0].ipAddress)" 2>/dev/null)
    if [[ -z "$DB_HOST" ]]; then
        log_error "Cloud SQL을 찾을 수 없습니다: $DB_INSTANCE_NAME"
        exit 1
    fi
    log_success "✅ Cloud SQL 확인됨: $DB_HOST"

    # Artifact Registry 확인
    if ! gcloud artifacts repositories describe biocom-api --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
        log_warning "Artifact Registry가 없습니다. 생성합니다..."
        gcloud artifacts repositories create biocom-api \
            --repository-format=docker \
            --location="$REGION" \
            --project="$PROJECT_ID" \
            --description="BIOCOM API Docker Registry (Production)"
        log_success "✅ Artifact Registry 생성 완료!"
    else
        log_success "✅ Artifact Registry 확인됨"
    fi

    log_success "✅ 운영 인프라 확인 완료!"
}

# Docker 이미지 빌드 및 푸시
build_and_push_docker() {
    if [[ "$SKIP_BUILD" == true ]]; then
        log_info "Docker 이미지 빌드를 건너뜁니다."
        # 최신 이미지 태그 가져오기
        IMAGE_TAG=$(gcloud artifacts docker images list "$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api" \
            --format="value(version)" --sort-by="~createTime" --limit=1 2>/dev/null || echo "latest")
        log_info "기존 이미지 사용: $IMAGE_TAG"
        return
    fi

    log_info "🔨 운영용 Docker 이미지 빌드 시작..."

    # 프로젝트 루트로 이동
    cd "$PROJECT_ROOT"

    # Artifact Registry 인증
    gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

    # 이미지 태그 생성 (운영용: prod- 접두사)
    IMAGE_TAG="prod-$(date +%Y%m%d%H%M%S)"
    IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api:$IMAGE_TAG"
    LATEST_URL="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api:latest"

    # Docker 빌드 (linux/amd64 플랫폼 명시)
    log_info "Docker 이미지 빌드 중... (약 2-3분 소요)"
    log_info "   이미지 태그: $IMAGE_TAG"

    docker buildx build \
        --platform linux/amd64 \
        -t "$IMAGE_URL" \
        -t "$LATEST_URL" \
        --push \
        .

    log_success "✅ Docker 이미지 빌드 및 푸시 완료!"
    log_info "   이미지: $IMAGE_URL"
}

# DB 마이그레이션 실행
run_db_migration() {
    if [[ "$SKIP_MIGRATION" == true ]]; then
        log_info "DB 마이그레이션을 건너뜁니다."
        return
    fi

    log_info "🗄️ 운영 DB 마이그레이션 실행 중..."

    cd "$PROJECT_ROOT"

    # 운영 DB URL 환경변수 설정 (환경변수가 .env 파일보다 우선)
    export DATABASE_URL="postgresql://biocom:qkdldhzjaProdelql0519@$DB_HOST:5432/biocom"
    log_info "운영 DB 연결: $DB_HOST"

    # 스키마 파일 존재 확인
    if [[ ! -f "prisma/schema.prisma" ]]; then
        log_error "prisma/schema.prisma 파일을 찾을 수 없습니다."
        exit 1
    fi

    # Prisma 마이그레이션 실행
    if ! npx prisma migrate deploy --schema=prisma/schema.prisma; then
        log_warning "마이그레이션 실패. 스키마를 DB에 동기화합니다..."

        # 스키마를 DB에 직접 푸시 (운영 환경이므로 data-loss 확인)
        if [[ "$AUTO_APPROVE" == true ]]; then
            npx prisma db push --schema=prisma/schema.prisma --accept-data-loss
        else
            npx prisma db push --schema=prisma/schema.prisma
        fi

        # 기존 마이그레이션들을 적용됨으로 표시
        log_info "기존 마이그레이션들을 적용됨으로 표시합니다..."

        if [[ -d "prisma/migrations" ]]; then
            for migration_dir in prisma/migrations/*/; do
                if [[ -d "$migration_dir" ]]; then
                    migration_name=$(basename "$migration_dir")
                    log_info "마이그레이션 표시 중: $migration_name"
                    npx prisma migrate resolve --applied "$migration_name" --schema=prisma/schema.prisma || true
                fi
            done
        fi

        log_success "데이터베이스 스키마 동기화 완료!"
    fi

    log_success "✅ 운영 DB 마이그레이션 완료!"
}

# Static IP 확인/생성
ensure_static_ip() {
    log_info "🌐 운영 Static IP 확인/생성 중..."

    local static_ip_name="biocom-api-prod-external-ip"

    # 기존 Static IP 확인
    if gcloud compute addresses describe "$static_ip_name" --global --project="$PROJECT_ID" &>/dev/null; then
        local ip_address
        ip_address=$(gcloud compute addresses describe "$static_ip_name" --global --project="$PROJECT_ID" --format="value(address)")
        log_success "✅ 기존 Static IP 확인됨: $ip_address"
    else
        log_info "Static IP가 존재하지 않습니다. 새로 생성합니다..."

        if gcloud compute addresses create "$static_ip_name" --global --project="$PROJECT_ID"; then
            local ip_address
            ip_address=$(gcloud compute addresses describe "$static_ip_name" --global --project="$PROJECT_ID" --format="value(address)")
            log_success "✅ 새 Static IP 생성됨: $ip_address"
            log_warning "⚠️  DNS에 이 IP를 등록하세요: api.biocom.ai.kr -> $ip_address"
        else
            log_error "❌ Static IP 생성 실패"
            exit 1
        fi
    fi
}

# Kubernetes 리소스 배포
deploy_kubernetes() {
    log_info "☸️ 운영 Kubernetes 리소스 배포 시작..."

    # K8S 디렉토리 확인
    K8S_DIR="$SCRIPT_DIR/../k8s"
    if [[ ! -d "$K8S_DIR" ]]; then
        log_error "❌ k8s 디렉토리를 찾을 수 없습니다: $K8S_DIR"
        exit 1
    fi

    cd "$K8S_DIR"

    # 네임스페이스 확인
    if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
        log_error "네임스페이스가 없습니다: $NAMESPACE"
        log_error "먼저 운영 인프라 설정을 완료하세요."
        exit 1
    fi

    # ConfigMap/Secret 존재 확인
    if ! kubectl get configmap biocom-api-config -n "$NAMESPACE" &>/dev/null; then
        log_error "ConfigMap이 없습니다. 먼저 설정을 완료하세요."
        exit 1
    fi

    if ! kubectl get secret biocom-api-secrets -n "$NAMESPACE" &>/dev/null; then
        log_error "Secret이 없습니다. 먼저 설정을 완료하세요."
        exit 1
    fi

    log_success "✅ ConfigMap/Secret 확인됨"

    # 운영용 Deployment 파일 확인/생성
    if [[ ! -f "deployment-prod.yaml" ]]; then
        log_info "운영용 Deployment 파일이 없습니다. 개발 파일을 기반으로 생성합니다..."
        cp deployment.yaml deployment-prod.yaml

        # 운영용 설정으로 수정
        sed -i.bak 's/replicas: .*/replicas: 2/' deployment-prod.yaml
        sed -i.bak 's/memory: "256Mi"/memory: "512Mi"/' deployment-prod.yaml
        sed -i.bak 's/memory: "512Mi"/memory: "1Gi"/' deployment-prod.yaml
        rm -f deployment-prod.yaml.bak
    fi

    # 이미지 태그 업데이트
    log_info "Deployment 이미지 업데이트 중..."
    local image_url="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api:$IMAGE_TAG"
    sed -i.bak "s|image: .*biocom-api.*|image: $image_url|" deployment-prod.yaml
    rm -f deployment-prod.yaml.bak

    # Service 배포
    log_info "Service 배포 중..."
    kubectl apply -f service.yaml -n "$NAMESPACE"

    # Deployment 배포
    log_info "Deployment 배포 중..."
    kubectl apply -f deployment-prod.yaml -n "$NAMESPACE"

    # Backend Config 배포
    if [[ -f "backend-config.yaml" ]]; then
        log_info "Backend Config 배포 중..."
        kubectl apply -f backend-config.yaml -n "$NAMESPACE"
    fi

    # Static IP 확인/생성
    ensure_static_ip

    # 운영용 Ingress 파일 확인/생성
    if [[ ! -f "ingress-prod.yaml" ]]; then
        log_info "운영용 Ingress 파일이 없습니다. 개발 파일을 기반으로 생성합니다..."
        cp ingress.yaml ingress-prod.yaml

        # 운영 도메인 및 IP로 수정
        sed -i.bak 's/api-dev.biocom.ai.kr/api.biocom.ai.kr/g' ingress-prod.yaml
        sed -i.bak 's/biocom-cluster-external-ip/biocom-api-prod-external-ip/g' ingress-prod.yaml
        rm -f ingress-prod.yaml.bak
    fi

    # Ingress 배포
    log_info "Ingress 배포 중..."
    kubectl apply -f ingress-prod.yaml -n "$NAMESPACE"

    # CronJob 배포
    log_info "CronJob 배포 중..."
    for cronjob_file in cronjob-*.yaml; do
        if [[ -f "$cronjob_file" ]]; then
            # 운영용 이미지로 업데이트
            sed -i.bak "s|image: .*biocom-api.*|image: $image_url|" "$cronjob_file"
            kubectl apply -f "$cronjob_file" -n "$NAMESPACE"
            log_info "  ✓ $cronjob_file 배포 완료"
            rm -f "${cronjob_file}.bak"
        fi
    done

    # 배포 상태 확인
    log_info "배포 상태 확인 중... (최대 5분)"
    if kubectl rollout status deployment/biocom-api -n "$NAMESPACE" --timeout=300s; then
        log_success "✅ Deployment 롤아웃 완료!"
    else
        log_error "❌ Deployment 롤아웃 실패"
        log_info "Pod 상태 확인:"
        kubectl get pods -n "$NAMESPACE"
        kubectl describe pods -l app=biocom-api -n "$NAMESPACE" | tail -50
        exit 1
    fi

    log_success "✅ Kubernetes 리소스 배포 완료!"
}

# 배포 상태 확인
check_deployment_status() {
    log_info "📊 운영 배포 상태 확인..."

    echo
    log_info "Pod 상태:"
    kubectl get pods -n "$NAMESPACE" -l app=biocom-api

    echo
    log_info "Service 상태:"
    kubectl get svc -n "$NAMESPACE"

    echo
    log_info "Ingress 상태:"
    kubectl get ingress -n "$NAMESPACE"

    echo
    log_info "CronJob 상태:"
    kubectl get cronjobs -n "$NAMESPACE"

    # Ingress IP 확인
    local ingress_ip=""
    ingress_ip=$(kubectl get ingress -n "$NAMESPACE" -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)

    echo
    if [[ -n "$ingress_ip" ]]; then
        log_success "🎉 운영 배포가 완료되었습니다!"
        echo
        log_info "운영 접속 정보:"
        log_info "  Ingress IP: $ingress_ip"
        log_info "  URL: https://api.biocom.ai.kr/api/docs"
        echo
        log_info "테스트 명령어:"
        echo "  curl https://api.biocom.ai.kr/api/health"
        echo
        log_warning "⚠️  DNS 설정 확인:"
        log_warning "  api.biocom.ai.kr -> $ingress_ip"
    else
        log_warning "⚠️  Ingress IP가 아직 할당되지 않았습니다."
        log_info "몇 분 후 다시 확인하세요:"
        echo "  kubectl get ingress -n $NAMESPACE"
    fi
}

# 메인 실행 함수
main() {
    log_info "🚀 BIOCOM API 운영 환경 배포를 시작합니다!"
    echo

    check_requirements
    setup_auth
    check_infrastructure
    build_and_push_docker
    run_db_migration
    deploy_kubernetes
    check_deployment_status

    echo
    log_success "🎉 운영 환경 배포가 완료되었습니다!"
    log_info "롤백이 필요한 경우:"
    echo "  kubectl rollout undo deployment/biocom-api -n $NAMESPACE"
}

# 스크립트 실행
main
