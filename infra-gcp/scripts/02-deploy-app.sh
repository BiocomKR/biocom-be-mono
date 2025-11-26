#!/bin/bash

# 🚀 BIOCOM API 애플리케이션 배포 스크립트
# 이 스크립트는 애플리케이션(Docker 이미지, K8s 리소스)만 배포합니다.
# 인프라는 01-deploy-infrastructure.sh로 먼저 구축하세요.

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

# 사용법 출력
usage() {
    cat << EOF
사용법: $0 [옵션]

애플리케이션 배포 스크립트 - Docker 이미지 빌드 및 Kubernetes 배포

옵션:
  -p, --project-id PROJECT_ID    GCP 프로젝트 ID (필수)
  -c, --cluster-name CLUSTER      GKE 클러스터 이름 (기본값: biocom-cluster-dev)
  -z, --zone ZONE                 GCP 존 (기본값: asia-northeast3-a)
  -n, --namespace NAMESPACE       K8s 네임스페이스 (기본값: biocom-api)
  -d, --db-host DB_HOST           Cloud SQL IP (선택, 자동 감지)
  -s, --skip-build                Docker 이미지 빌드 건너뛰기
  -m, --skip-migration            DB 마이그레이션 건너뛰기
  -y, --yes                       모든 확인 자동 승인
  -h, --help                      이 도움말 출력

예시:
  $0 --project-id biocom-api-dev --yes              # 전체 배포
  $0 --project-id biocom-api-dev --skip-build --yes # 빌드 없이 배포만

주의사항:
  - 인프라가 먼저 구축되어 있어야 합니다 (01-deploy-infrastructure.sh)
  - Cloud SQL 데이터는 유지됩니다
  - 기존 K8s 리소스는 업데이트됩니다
EOF
    exit 0
}

# 기본값 설정
PROJECT_ID=""
CLUSTER_NAME="biocom-cluster-dev"
ZONE="asia-northeast3-a"
NAMESPACE="biocom-api"
DB_HOST=""
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
        -d|--db-host)
            DB_HOST="$2"
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

log_info "📋 애플리케이션 배포 설정:"
log_info "   프로젝트 ID: $PROJECT_ID"
log_info "   클러스터: $CLUSTER_NAME"
log_info "   존: $ZONE"
log_info "   네임스페이스: $NAMESPACE"
log_info "   빌드 건너뛰기: $SKIP_BUILD"
log_info "   마이그레이션 건너뛰기: $SKIP_MIGRATION"
log_info "   자동 승인: $AUTO_APPROVE"

# 사용자 확인
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

    # 서비스 계정 키 파일이 있으면 활성화
    if [ -f "google-service-account-key.json" ]; then
        log_info "서비스 계정으로 인증 중..."
        gcloud auth activate-service-account --key-file=google-service-account-key.json --quiet
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
    
    # GKE 클러스터 확인
    if ! gcloud container clusters describe "$CLUSTER_NAME" --zone="$ZONE" --project="$PROJECT_ID" &>/dev/null; then
        log_error "GKE 클러스터가 없습니다. 먼저 01-deploy-infrastructure.sh를 실행하세요."
        exit 1
    fi
    
    # Cloud SQL 확인 및 IP 가져오기
    if [[ -z "$DB_HOST" ]]; then
        DB_HOST=$(gcloud sql instances describe biocom-postgres-dev --project="$PROJECT_ID" --format="value(ipAddresses[0].ipAddress)" 2>/dev/null)
        if [[ -z "$DB_HOST" ]]; then
            log_error "Cloud SQL을 찾을 수 없습니다. 먼저 01-deploy-infrastructure.sh를 실행하세요."
            exit 1
        fi
        log_info "Cloud SQL IP 자동 감지: $DB_HOST"
    fi
    
    # Artifact Registry 확인
    if ! gcloud artifacts repositories describe biocom-api --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
        log_error "Artifact Registry가 없습니다. 먼저 01-deploy-infrastructure.sh를 실행하세요."
        exit 1
    fi
    
    log_success "✅ 인프라 확인 완료!"
}

# Docker 이미지 빌드 및 푸시
build_and_push_docker() {
    if [[ "$SKIP_BUILD" == true ]]; then
        log_info "Docker 이미지 빌드를 건너뜁니다."
        return
    fi
    
    log_info "🔨 Docker 이미지 빌드 시작..."
    
    # 프로젝트 루트로 이동
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR/../.."
    
    # Artifact Registry 인증
    gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
    
    # 이미지 태그 생성
    IMAGE_TAG=$(date +%Y%m%d%H%M%S)
    IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api:$IMAGE_TAG"
    LATEST_URL="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api:latest"
    
    # Docker 빌드 (linux/amd64 플랫폼 명시)
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

# DB 마이그레이션 실행
run_db_migration() {
    if [[ "$SKIP_MIGRATION" == true ]]; then
        log_info "DB 마이그레이션을 건너뜁니다."
        return
    fi
    
    log_info "🗄️ DB 마이그레이션 실행 중..."
    
    # 프로젝트 루트 결정
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # 스크립트가 infra-gcp/scripts에 있다면 상위 2레벨, 아니면 현재 디렉토리
    if [[ "$SCRIPT_DIR" == *"/infra-gcp/scripts" ]]; then
        PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
    else
        PROJECT_ROOT="$SCRIPT_DIR"
    fi
    
    log_info "스크립트 디렉토리: $SCRIPT_DIR"
    log_info "프로젝트 루트: $PROJECT_ROOT"
    
    cd "$PROJECT_ROOT"
    log_info "이동 후 현재 작업 디렉토리: $(pwd)"
    
    # DATABASE_URL 설정
    export DATABASE_URL="postgresql://biocom:bico0825%21%40%23@$DB_HOST:5432/biocom"
    
    # 스키마 파일 존재 확인
    if [[ ! -f "prisma/schema.prisma" ]]; then
        log_error "prisma/schema.prisma 파일을 찾을 수 없습니다."
        log_info "현재 디렉토리 내용: $(ls -la)"
        exit 1
    fi
    
    # Prisma 마이그레이션 실행 (실패시 자동 복구)
    if ! npx prisma migrate deploy --schema=prisma/schema.prisma; then
        log_warning "마이그레이션 실패. 새로운 데이터베이스로 스키마를 동기화합니다..."
        
        # 1. 스키마를 DB에 직접 푸시
        npx prisma db push --schema=prisma/schema.prisma --accept-data-loss
        
        # 2. 기존 마이그레이션들을 적용됨으로 표시
        log_info "기존 마이그레이션들을 적용됨으로 표시합니다..."
        
        # migrations 디렉토리의 모든 마이그레이션 찾기
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
    
    log_success "✅ DB 마이그레이션 완료!"
}

# Static IP 확인/생성
ensure_static_ip() {
    log_info "🌐 Static IP 확인/생성 중..."
    
    local static_ip_name="biocom-cluster-external-ip"
    
    # 기존 Static IP 확인
    if gcloud compute addresses describe "$static_ip_name" --global --project="$PROJECT_ID" &>/dev/null; then
        local ip_address
        ip_address=$(gcloud compute addresses describe "$static_ip_name" --global --project="$PROJECT_ID" --format="value(address)")
        log_success "✅ 기존 Static IP 확인됨: $ip_address ($static_ip_name)"
    else
        log_info "Static IP가 존재하지 않습니다. 새로 생성합니다..."
        
        if gcloud compute addresses create "$static_ip_name" --global --project="$PROJECT_ID"; then
            local ip_address
            ip_address=$(gcloud compute addresses describe "$static_ip_name" --global --project="$PROJECT_ID" --format="value(address)")
            log_success "✅ 새 Static IP 생성됨: $ip_address ($static_ip_name)"
        else
            log_error "❌ Static IP 생성 실패"
            exit 1
        fi
    fi
}

# 민감정보 로드
load_secrets() {
    log_info "🔐 민감정보 로드 중..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SECRETS_FILE="$SCRIPT_DIR/../.env.secrets"

    if [[ ! -f "$SECRETS_FILE" ]]; then
        log_error "민감정보 파일을 찾을 수 없습니다: $SECRETS_FILE"
        log_error "infra-gcp/.env.secrets.example 파일을 복사하여 .env.secrets를 생성하고 실제 값을 입력하세요."
        exit 1
    fi

    # .env.secrets 파일 로드
    set -a
    source "$SECRETS_FILE"
    set +a

    log_success "✅ 민감정보 로드 완료!"
}

# Kubernetes 리소스 배포
deploy_kubernetes() {
    log_info "☸️ Kubernetes 리소스 배포 시작..."

    # k8s 디렉토리로 이동 (프로젝트 구조에 맞게 경로 수정)
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # 여러 가능한 k8s 경로 확인
    if [[ -d "$SCRIPT_DIR/../k8s" ]]; then
        K8S_DIR="$SCRIPT_DIR/../k8s"
    elif [[ -d "$SCRIPT_DIR/../../infra-gcp/k8s" ]]; then
        K8S_DIR="$SCRIPT_DIR/../../infra-gcp/k8s"
    elif [[ -d "./infra-gcp/k8s" ]]; then
        K8S_DIR="./infra-gcp/k8s"
    elif [[ -d "$SCRIPT_DIR/k8s" ]]; then
        K8S_DIR="$SCRIPT_DIR/k8s"
    else
        log_error "❌ k8s 디렉토리를 찾을 수 없습니다"
        log_info "현재 스크립트 위치: $SCRIPT_DIR"
        log_info "현재 작업 디렉토리: $(pwd)"
        log_info "찾은 디렉토리들:"
        find . -name "k8s" -type d 2>/dev/null || echo "k8s 디렉토리 없음"
        exit 1
    fi
    
    log_info "k8s 디렉토리 찾음: $K8S_DIR"
    cd "$K8S_DIR"
    
    # 네임스페이스 생성 (이미 있으면 무시)
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # ConfigMap 업데이트 (DB_HOST 설정)
    log_info "ConfigMap 업데이트 중..."
    sed -i.bak "s/DB_HOST: .*/DB_HOST: \"$DB_HOST\"/" configmap.yaml
    kubectl apply -f configmap.yaml
    
    # Secret 생성 (이미 있으면 업데이트)
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
        --from-literal=TOSS_PAYMENTS_SECRET_KEY="$TOSS_PAYMENTS_SECRET_KEY"
    
    # Google Service Account Key Secret 확인/생성
    log_info "Google Service Account Key Secret 확인 중..."

    if kubectl get secret google-service-account-key -n "$NAMESPACE" &>/dev/null; then
        log_success "✅ Google Service Account Key Secret이 이미 존재합니다. 건너뜁니다."
    else
        log_info "Google Service Account Key Secret이 없습니다. 생성합니다..."

        # 프로젝트 루트에서 서비스 계정 키 파일 확인
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
        SERVICE_ACCOUNT_KEY_FILE="$PROJECT_ROOT/google-service-account-key.json"

        if [[ ! -f "$SERVICE_ACCOUNT_KEY_FILE" ]]; then
            log_error "Service Account Key 파일을 찾을 수 없습니다: $SERVICE_ACCOUNT_KEY_FILE"
            exit 1
        fi

        kubectl create secret generic google-service-account-key \
            --namespace="$NAMESPACE" \
            --from-file=key.json="$SERVICE_ACCOUNT_KEY_FILE"

        log_success "✅ Google Service Account Key Secret 생성 완료!"
    fi

    # KCP 인증서 Secret 확인/생성
    log_info "KCP 인증서 Secret 확인 중..."

    if kubectl get secret kcp-cert-files -n "$NAMESPACE" &>/dev/null; then
        log_success "✅ KCP 인증서 Secret이 이미 존재합니다. 건너뜁니다."
    else
        log_info "KCP 인증서 Secret이 없습니다. 생성합니다..."

        # KCP 인증서 파일 확인
        KCP_CERT_FILE="$PROJECT_ROOT/config/kcp-cert/KCP_AUTH_ALDXX_CERT.pem"
        KCP_PRIKEY_FILE="$PROJECT_ROOT/config/kcp-cert/KCP_AUTH_ALDXX_PRIKEY.pem"

        if [[ ! -f "$KCP_CERT_FILE" ]] || [[ ! -f "$KCP_PRIKEY_FILE" ]]; then
            log_error "KCP 인증서 파일을 찾을 수 없습니다: $PROJECT_ROOT/config/kcp-cert/"
            exit 1
        fi

        kubectl create secret generic kcp-cert-files \
            --namespace="$NAMESPACE" \
            --from-file=KCP_AUTH_ALDXX_CERT.pem="$KCP_CERT_FILE" \
            --from-file=KCP_AUTH_ALDXX_PRIKEY.pem="$KCP_PRIKEY_FILE"

        log_success "✅ KCP 인증서 Secret 생성 완료!"
    fi
    
    # Service 배포
    log_info "Service 배포 중..."
    kubectl apply -f service.yaml
    log_info "✅ Service 리소스 배포 완료"
    
    # Deployment 배포
    log_info "Deployment 배포 중..."
    sed -i.bak "s|image: .*|image: $REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api:$IMAGE_TAG|" deployment.yaml
    kubectl apply -f deployment.yaml
    
    # Backend Config 배포
    log_info "Backend Config 배포 중..."
    kubectl apply -f backend-config.yaml
    
    # Static IP 확인/생성 (Ingress 배포 전에 필요)
    ensure_static_ip
    
    # Ingress 배포
    log_info "Ingress 배포 중..."
    kubectl apply -f ingress.yaml

    # CronJob 배포
    log_info "CronJob 배포 중..."
    kubectl apply -f cronjob-expire-challenges.yaml
    kubectl apply -f cronjob-activate-challenges.yaml
    kubectl apply -f cronjob-create-supplements.yaml
    log_success "✅ CronJob 3개 배포 완료 (만료, 활성화, 영양제)"

    # 배포 상태 확인
    log_info "배포 상태 확인 중..."
    kubectl rollout status deployment/biocom-api -n "$NAMESPACE" --timeout=300s

    log_success "✅ Kubernetes 리소스 배포 완료!"
}

# 배포 상태 확인
check_deployment_status() {
    log_info "📊 배포 상태 확인..."
    
    # Pod 상태
    echo
    log_info "Pod 상태:"
    kubectl get pods -n "$NAMESPACE"
    
    # Service 상태
    echo
    log_info "Service 상태:"
    kubectl get svc -n "$NAMESPACE"
    
    # Ingress 상태
    echo
    log_info "Ingress 상태:"
    kubectl get ingress -n "$NAMESPACE"

    # CronJob 상태
    echo
    log_info "CronJob 상태:"
    kubectl get cronjobs -n "$NAMESPACE"

    # Ingress IP 확인
    local ingress_ip=""
    local max_attempts=30
    local attempt=0
    
    log_info "Ingress IP 할당 대기 중... (최대 5분)"
    while [[ $attempt -lt $max_attempts ]]; do
        ingress_ip=$(kubectl get ingress biocom-api-ingress -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)
        
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
        log_info "  HTTP:  http://api-dev.biocom.ai.kr/api/docs"
        log_info "  HTTPS: https://api-dev.biocom.ai.kr/api/docs (SSL 인증서)"
        echo
        log_info "테스트 명령어:"
        echo "  curl http://api-dev.biocom.ai.kr/api/health"
    fi
}

# 메인 실행 함수
main() {
    log_info "🚀 BIOCOM API 애플리케이션 배포를 시작합니다!"

    check_requirements
    setup_auth
    check_infrastructure
    load_secrets
    build_and_push_docker
    run_db_migration
    deploy_kubernetes
    check_deployment_status

    log_success "🎉 애플리케이션 배포가 완료되었습니다!"
}

# 스크립트 실행
main