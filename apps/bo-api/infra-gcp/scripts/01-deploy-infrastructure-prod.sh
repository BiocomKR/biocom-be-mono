#!/bin/bash

# 🏗️ BIOCOM BO-API 운영 인프라 배포 스크립트
# Terraform으로 GCP 운영 인프라(VPC, GKE, Artifact Registry 등)를 생성합니다.
# dev 스펙의 2배 적용

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

BIOCOM BO-API 운영 인프라 배포 스크립트 - Terraform으로 GCP 운영 인프라 생성

옵션:
  -p, --project-id PROJECT_ID    GCP 프로젝트 ID (기본값: api-prod-biocom)
  -y, --yes                      모든 확인 자동 승인
  -h, --help                     이 도움말 출력

예시:
  $0 --yes                                    # 기본 운영 프로젝트로 배포
  $0 --project-id api-prod-biocom --yes       # 프로젝트 명시

스펙 (dev 대비 2배):
  - 머신 타입: e2-medium (2vCPU, 4GB) - dev: e2-small (2vCPU, 2GB)
  - 노드 수: 2개 (최대 4개) - dev: 1개 (최대 2개)
  - 디스크: 40GB SSD - dev: 20GB Standard
  - Spot 인스턴스: 미사용 - dev: 사용

주의사항:
  - GCP 프로젝트가 미리 생성되어 있어야 합니다
  - gcloud CLI가 설치되어 있어야 합니다
  - Terraform이 설치되어 있어야 합니다
  - 운영 환경이므로 신중하게 실행하세요!
EOF
    exit 0
}

# 기본값 (운영)
PROJECT_ID="api-prod-biocom"
AUTO_APPROVE=false
REGION="asia-northeast3"
ZONE="asia-northeast3-a"

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--project-id)
            PROJECT_ID="$2"
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

log_info "📋 운영 인프라 배포 설정:"
log_info "   프로젝트 ID: $PROJECT_ID"
log_info "   리전: $REGION"
log_info "   존: $ZONE"
log_info "   자동 승인: $AUTO_APPROVE"
echo
log_warning "⚠️  운영 환경 인프라를 배포합니다!"
log_warning "   스펙: e2-medium x 2노드, 40GB SSD, Spot 미사용"
echo

if [[ "$AUTO_APPROVE" != true ]]; then
    read -p "운영 인프라를 배포하시겠습니까? (y/n): " -n 1 -r
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

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "다음 도구가 설치되지 않았습니다: ${missing_tools[*]}"
        exit 1
    fi

    log_success "모든 필수 도구가 설치되어 있습니다."
}

# GCP 인증
setup_auth() {
    log_info "GCP 인증 설정 중..."

    # 서비스 계정 키 파일이 있으면 활성화
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

    if [ -f "$PROJECT_ROOT/google-service-account-key.json" ]; then
        log_info "서비스 계정으로 인증 중..."
        gcloud auth activate-service-account --key-file="$PROJECT_ROOT/google-service-account-key.json" --quiet
    fi

    gcloud config set project "$PROJECT_ID" --quiet
    log_success "✅ GCP 프로젝트 설정 완료: $PROJECT_ID"
}

# GCP API 활성화
enable_apis() {
    log_info "🔧 필요한 GCP API 활성화 중..."

    local apis=(
        "container.googleapis.com"           # GKE
        "artifactregistry.googleapis.com"    # Artifact Registry
        "compute.googleapis.com"             # Compute Engine
        "servicenetworking.googleapis.com"   # Service Networking
        "cloudresourcemanager.googleapis.com" # Resource Manager
    )

    for api in "${apis[@]}"; do
        log_info "  활성화 중: $api"
        gcloud services enable "$api" --project="$PROJECT_ID" --quiet || true
    done

    log_success "✅ GCP API 활성화 완료!"
}

# Terraform 실행 (운영 변수 파일 사용)
run_terraform() {
    log_info "🏗️ Terraform 실행 중 (운영 환경)..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    TERRAFORM_DIR="$SCRIPT_DIR/../terraform"

    cd "$TERRAFORM_DIR"

    # 운영용 tfvars 파일 확인
    if [[ ! -f "variables-prod.tfvars" ]]; then
        log_error "운영 변수 파일이 없습니다: variables-prod.tfvars"
        exit 1
    fi

    # Terraform 초기화
    log_info "Terraform 초기화 중..."
    terraform init -upgrade

    # Terraform Plan (운영 변수 사용)
    log_info "Terraform Plan 실행 중..."
    terraform plan -var-file="variables-prod.tfvars"

    # Terraform Apply
    if [[ "$AUTO_APPROVE" == true ]]; then
        log_info "Terraform Apply 실행 중..."
        terraform apply -var-file="variables-prod.tfvars" -auto-approve
    else
        terraform apply -var-file="variables-prod.tfvars"
    fi

    log_success "✅ Terraform 운영 인프라 생성 완료!"
}

# GKE 노드가 Artifact Registry에서 이미지 pull 할 수 있도록 권한 부여
setup_artifact_registry_permission() {
    log_info "🔐 Artifact Registry 권한 설정 중..."

    PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")

    # Compute Engine 기본 서비스 계정에 Artifact Registry 읽기 권한 부여
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
        --role="roles/artifactregistry.reader" \
        --quiet || true

    log_success "✅ Artifact Registry 읽기 권한 부여 완료!"
}

# kubeconfig 설정
setup_kubeconfig() {
    log_info "☸️ kubeconfig 설정 중..."

    gcloud container clusters get-credentials "biocom-bo-cluster-prod" \
        --zone="$ZONE" \
        --project="$PROJECT_ID"

    log_success "✅ kubeconfig 설정 완료!"
}

# 결과 출력
show_outputs() {
    log_info "📊 운영 인프라 정보:"

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    TERRAFORM_DIR="$SCRIPT_DIR/../terraform"

    cd "$TERRAFORM_DIR"

    echo
    terraform output
    echo

    log_success "🎉 운영 인프라 배포가 완료되었습니다!"
    echo
    log_info "다음 단계:"
    log_info "  1. DNS 설정 (가비아): bo-api.biocom.ai.kr → Static IP"
    log_info "  2. 앱 배포: ./02-deploy-app-prod.sh --yes"
}

# 메인
main() {
    log_info "🚀 BIOCOM BO-API 운영 인프라 배포를 시작합니다!"
    echo

    check_requirements
    setup_auth
    enable_apis
    run_terraform
    setup_artifact_registry_permission
    setup_kubeconfig
    show_outputs
}

main
