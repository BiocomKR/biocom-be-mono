#!/bin/bash

# 🏗️ BIOCOM BO-API 인프라 배포 스크립트
# Terraform으로 GCP 인프라(VPC, GKE, Artifact Registry 등)를 생성합니다.

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

BIOCOM BO-API 인프라 배포 스크립트 - Terraform으로 GCP 인프라 생성

옵션:
  -p, --project-id PROJECT_ID    GCP 프로젝트 ID (필수)
  -y, --yes                      모든 확인 자동 승인
  -h, --help                     이 도움말 출력

예시:
  $0 --project-id biocom-bo-api --yes

주의사항:
  - GCP 프로젝트가 미리 생성되어 있어야 합니다
  - gcloud CLI가 설치되어 있어야 합니다
  - Terraform이 설치되어 있어야 합니다
EOF
    exit 0
}

# 기본값
PROJECT_ID=""
AUTO_APPROVE=false

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

if [[ -z "$PROJECT_ID" ]]; then
    log_error "프로젝트 ID가 필요합니다. -p 또는 --project-id 옵션을 사용하세요."
    usage
fi

log_info "📋 인프라 배포 설정:"
log_info "   프로젝트 ID: $PROJECT_ID"
log_info "   자동 승인: $AUTO_APPROVE"

if [[ "$AUTO_APPROVE" != true ]]; then
    read -p "인프라를 배포하시겠습니까? (y/n): " -n 1 -r
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
    gcloud config set project "$PROJECT_ID" --quiet
    log_success "✅ GCP 프로젝트 설정 완료!"
}

# Terraform 실행
run_terraform() {
    log_info "🏗️ Terraform 실행 중..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    TERRAFORM_DIR="$SCRIPT_DIR/../terraform"

    cd "$TERRAFORM_DIR"

    # Terraform 초기화
    log_info "Terraform 초기화 중..."
    terraform init

    # Terraform Plan
    log_info "Terraform Plan 실행 중..."
    terraform plan -var="project_id=$PROJECT_ID"

    # Terraform Apply
    if [[ "$AUTO_APPROVE" == true ]]; then
        log_info "Terraform Apply 실행 중..."
        terraform apply -var="project_id=$PROJECT_ID" -auto-approve
    else
        terraform apply -var="project_id=$PROJECT_ID"
    fi

    log_success "✅ Terraform 인프라 생성 완료!"
}

# 결과 출력
show_outputs() {
    log_info "📊 인프라 정보:"

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    TERRAFORM_DIR="$SCRIPT_DIR/../terraform"

    cd "$TERRAFORM_DIR"

    echo
    terraform output
    echo

    log_success "🎉 인프라 배포가 완료되었습니다!"
    log_info "다음 단계: ./02-deploy-app.sh --project-id $PROJECT_ID --yes"
}

# 메인
main() {
    log_info "🚀 BIOCOM BO-API 인프라 배포를 시작합니다!"

    check_requirements
    setup_auth
    run_terraform
    show_outputs
}

main
