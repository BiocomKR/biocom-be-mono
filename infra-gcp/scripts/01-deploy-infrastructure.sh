#!/bin/bash

# 🏗️ BIOCOM API 인프라 구축 스크립트
# 이 스크립트는 GCP 인프라(VPC, GKE, Cloud SQL, Storage)만 생성합니다.
# 애플리케이션 배포는 02-deploy-app.sh를 사용하세요.

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

인프라 배포 스크립트 - GCP 리소스(VPC, GKE, Cloud SQL, Storage)를 생성합니다.

옵션:
  -p, --project-id PROJECT_ID    GCP 프로젝트 ID (필수)
  -r, --region REGION             GCP 리전 (기본값: asia-northeast3)
  -z, --zone ZONE                 GCP 존 (기본값: asia-northeast3-a)
  -c, --cluster-name CLUSTER      GKE 클러스터 이름 (기본값: biocom-cluster-dev)
  -d, --db-name DB_NAME           Cloud SQL 인스턴스 이름 (기본값: biocom-postgres-dev)
  -y, --yes                       모든 확인 자동 승인
  -h, --help                      이 도움말 출력

예시:
  $0 --project-id biocom-api-dev --yes  # 한방 인프라 구축

주의사항:
  - 이 스크립트는 인프라만 생성합니다
  - 애플리케이션 배포는 02-deploy-app.sh를 실행하세요
  - Cloud SQL 데이터는 보존됩니다 (--destroy 옵션 시 제외)
EOF
    exit 0
}

# 기본값 설정
PROJECT_ID=""
REGION="asia-northeast3"
ZONE="asia-northeast3-a"
CLUSTER_NAME="biocom-cluster-dev"
DB_NAME="biocom-postgres-dev"
AUTO_APPROVE=false

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--project-id)
            PROJECT_ID="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -z|--zone)
            ZONE="$2"
            shift 2
            ;;
        -c|--cluster-name)
            CLUSTER_NAME="$2"
            shift 2
            ;;
        -d|--db-name)
            DB_NAME="$2"
            shift 2
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

log_info "📋 인프라 구축 설정:"
log_info "   프로젝트 ID: $PROJECT_ID"
log_info "   리전: $REGION"
log_info "   존: $ZONE"
log_info "   클러스터 이름: $CLUSTER_NAME"
log_info "   DB 인스턴스: $DB_NAME"
log_info "   자동 승인: $AUTO_APPROVE"

# 사용자 확인
if [[ "$AUTO_APPROVE" != true ]]; then
    read -p "인프라를 구축하시겠습니까? (y/n): " -n 1 -r
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
    command -v terraform >/dev/null 2>&1 || missing_tools+=("terraform")
    command -v kubectl >/dev/null 2>&1 || missing_tools+=("kubectl")
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "다음 도구가 설치되지 않았습니다: ${missing_tools[*]}"
        exit 1
    fi
    
    log_success "모든 필수 도구가 설치되어 있습니다."
}

# GCP 인증 확인
check_gcp_auth() {
    log_info "GCP 인증 상태 확인 중..."
    
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        log_error "GCP 인증이 필요합니다. 'gcloud auth login'을 실행하세요."
        exit 1
    fi
    
    # 프로젝트 설정
    gcloud config set project "$PROJECT_ID" --quiet
    
    log_success "GCP 인증 완료. 프로젝트: $PROJECT_ID"
}

# 기존 인프라 확인
check_existing_infrastructure() {
    log_info "기존 인프라 확인 중..."
    
    local has_changes=false
    
    # GKE 클러스터 확인
    if gcloud container clusters describe "$CLUSTER_NAME" --zone="$ZONE" --project="$PROJECT_ID" &>/dev/null; then
        log_success "✅ GKE 클러스터 존재: $CLUSTER_NAME"
    else
        log_warning "❌ GKE 클러스터 없음"
        has_changes=true
    fi
    
    # Cloud SQL 확인
    if gcloud sql instances describe "$DB_NAME" --project="$PROJECT_ID" &>/dev/null; then
        log_success "✅ Cloud SQL 존재: $DB_NAME"
        log_warning "⚠️  기존 Cloud SQL은 유지됩니다 (데이터 보존)"
    else
        log_warning "❌ Cloud SQL 없음"
        has_changes=true
    fi
    
    # VPC 확인
    if gcloud compute networks describe "${CLUSTER_NAME}-vpc" --project="$PROJECT_ID" &>/dev/null; then
        log_success "✅ VPC 네트워크 존재: ${CLUSTER_NAME}-vpc"
    else
        log_warning "❌ VPC 네트워크 없음"
        has_changes=true
    fi
    
    # Artifact Registry 확인
    if gcloud artifacts repositories describe biocom-api --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
        log_success "✅ Artifact Registry 존재: biocom-api"
    else
        log_warning "❌ Artifact Registry 없음"
        has_changes=true
    fi
    
    if [[ "$has_changes" == false ]]; then
        log_success "모든 인프라가 이미 존재합니다."
        if [[ "$AUTO_APPROVE" != true ]]; then
            read -p "계속 진행하시겠습니까? (y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_warning "취소되었습니다."
                exit 0
            fi
        fi
    fi
}

# Terraform으로 인프라 배포
deploy_infrastructure() {
    log_info "🏗️ Terraform 인프라 배포 시작..."
    
    # terraform 디렉토리로 이동
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR/../terraform"
    
    # terraform.tfvars 생성
    cat > terraform.tfvars << EOF
project_id = "$PROJECT_ID"
region = "$REGION"
zone = "$ZONE"
cluster_name = "$CLUSTER_NAME"
network_name = "${CLUSTER_NAME}-vpc"
subnet_name = "${CLUSTER_NAME}-subnet"
db_instance_name = "$DB_NAME"
db_name = "biocom"
db_user = "biocom"
db_password = "bico0825!@#"
EOF
    
    log_info "Terraform 초기화 중..."
    terraform init -upgrade
    
    log_info "Terraform 계획 생성 중..."
    terraform plan -out=tfplan
    
    if [[ "$AUTO_APPROVE" == true ]]; then
        log_info "Terraform 자동 적용 중... (약 10-15분 소요)"
        terraform apply tfplan
    else
        log_info "Terraform 적용 중..."
        terraform apply
    fi
    
    log_success "✅ Terraform 인프라 배포 완료!"
}

# kubeconfig 설정
setup_kubeconfig() {
    log_info "Kubeconfig 설정 중..."
    
    gcloud container clusters get-credentials "$CLUSTER_NAME" \
        --zone="$ZONE" \
        --project="$PROJECT_ID"
    
    log_success "✅ Kubeconfig 설정 완료!"
}

# Cloud SQL 설정
setup_cloud_sql() {
    log_info "Cloud SQL 설정 중..."
    
    # Cloud SQL이 준비될 때까지 대기
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        local status=$(gcloud sql instances describe "$DB_NAME" --project="$PROJECT_ID" --format="value(state)" 2>/dev/null || echo "NOT_FOUND")
        
        if [[ "$status" == "RUNNABLE" ]]; then
            log_success "Cloud SQL이 준비되었습니다."
            break
        elif [[ "$status" == "NOT_FOUND" ]]; then
            log_warning "Cloud SQL 인스턴스가 없습니다. Terraform을 먼저 실행하세요."
            return 1
        fi
        
        log_info "Cloud SQL 준비 중... (상태: $status)"
        sleep 10
        ((attempt++))
    done
    
    # SSL 비활성화 (개발 환경)
    gcloud sql instances patch "$DB_NAME" --no-require-ssl --project="$PROJECT_ID" --quiet
    
    # 데이터베이스 생성 (이미 있으면 무시)
    gcloud sql databases create biocom --instance="$DB_NAME" --project="$PROJECT_ID" 2>/dev/null || true
    
    # 사용자 생성 (이미 있으면 무시)
    gcloud sql users create biocom \
        --instance="$DB_NAME" \
        --password='bico0825!@#' \
        --project="$PROJECT_ID" 2>/dev/null || true
    
    # IP 주소 가져오기
    local db_ip=$(gcloud sql instances describe "$DB_NAME" --project="$PROJECT_ID" --format="value(ipAddresses[0].ipAddress)")
    
    log_success "✅ Cloud SQL 설정 완료!"
    log_info "   Database: biocom"
    log_info "   User: biocom"
    log_info "   Password: bico0825!@#"
    log_info "   Host: $db_ip"
    
    # 연결 문자열 출력
    echo
    log_info "📝 DATABASE_URL:"
    echo "postgresql://biocom:bico0825%21%40%23@$db_ip:5432/biocom"
}

# 메인 실행 함수
main() {
    log_info "🚀 BIOCOM API 인프라 구축을 시작합니다!"
    
    check_requirements
    check_gcp_auth
    check_existing_infrastructure
    deploy_infrastructure
    setup_kubeconfig
    setup_cloud_sql
    
    log_success "🎉 인프라 구축이 완료되었습니다!"
    echo
    log_info "다음 단계:"
    log_info "  1. 애플리케이션 배포: ./scripts/02-deploy-app.sh --project-id $PROJECT_ID"
    log_info "  2. 접속 확인: https://api-dev.biocom.ai.kr/api/docs"
}

# 스크립트 실행
main