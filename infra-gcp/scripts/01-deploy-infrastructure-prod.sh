#!/bin/bash

# 🏗️ BIOCOM API 운영 인프라 구축 스크립트
# 이 스크립트는 GCP 운영 인프라(VPC, GKE, Cloud SQL, Storage)를 생성합니다.
# 운영 환경은 개발 환경의 2배 스펙으로 구성됩니다.

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

운영 인프라 배포 스크립트 - GCP 리소스(VPC, GKE, Cloud SQL, Storage)를 생성합니다.

옵션:
  -p, --project-id PROJECT_ID    GCP 프로젝트 ID (필수)
  -r, --region REGION             GCP 리전 (기본값: asia-northeast3)
  -z, --zone ZONE                 GCP 존 (기본값: asia-northeast3-a)
  -c, --cluster-name CLUSTER      GKE 클러스터 이름 (기본값: biocom-cluster-prod)
  -d, --db-name DB_NAME           Cloud SQL 인스턴스 이름 (기본값: biocom-postgres-prod)
  -y, --yes                       모든 확인 자동 승인
  -h, --help                      이 도움말 출력

예시:
  $0 --project-id api-prod-biocom --yes  # 한방 인프라 구축

주의사항:
  - 이 스크립트는 운영 인프라를 생성합니다
  - 운영 환경은 개발 환경의 2배 스펙으로 구성됩니다
  - Cloud SQL 데이터는 보존됩니다
EOF
    exit 0
}

# 기본값 설정 (운영 환경)
PROJECT_ID=""
REGION="asia-northeast3"
ZONE="asia-northeast3-a"
CLUSTER_NAME="biocom-cluster-prod"
DB_NAME="biocom-postgres-prod"
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

log_info "📋 운영 인프라 구축 설정:"
log_info "   프로젝트 ID: $PROJECT_ID"
log_info "   리전: $REGION"
log_info "   존: $ZONE"
log_info "   클러스터 이름: $CLUSTER_NAME"
log_info "   DB 인스턴스: $DB_NAME"
log_info "   자동 승인: $AUTO_APPROVE"
log_warning "   ⚠️  운영 환경: 개발 환경 대비 2배 스펙"

# 사용자 확인
if [[ "$AUTO_APPROVE" != true ]]; then
    read -p "운영 인프라를 구축하시겠습니까? (y/n): " -n 1 -r
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

# 권한 확인 및 추가
check_and_add_permissions() {
    log_info "현재 계정 권한 확인 중..."

    local current_account=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
    log_info "현재 계정: $current_account"

    # 현재 권한 확인
    local roles=""
    if roles=$(gcloud projects get-iam-policy "$PROJECT_ID" --flatten="bindings[].members" --format="value(bindings.role)" --filter="bindings.members:user:$current_account" 2>/dev/null); then
        log_info "현재 권한: $(echo "$roles" | tr '\n' ', ' | sed 's/,$//')"
    else
        log_warning "권한 조회 실패. 권한을 추가합니다."
        roles=""
    fi

    local required_roles=(
        "roles/owner"
        "roles/editor"
        "roles/serviceusage.serviceUsageAdmin"
    )

    local has_required_role=false

    # 필수 권한 중 하나라도 있는지 확인
    for required_role in "${required_roles[@]}"; do
        if echo "$roles" | grep -q "$required_role"; then
            log_success "✅ 필요한 권한 보유: $required_role"
            has_required_role=true
            break
        fi
    done

    if [[ "$has_required_role" == false ]]; then
        log_warning "⚠️  충분한 권한이 없습니다. 권한을 추가합니다..."

        # Owner 권한 시도
        log_info "Owner 권한 추가 시도 중..."
        if gcloud projects add-iam-policy-binding "$PROJECT_ID" \
            --member="user:$current_account" \
            --role="roles/owner" \
            --quiet 2>/dev/null; then
            log_success "✅ Owner 권한 추가 완료"
            sleep 30  # 권한 전파 대기
        else
            log_error "❌ 권한 추가 실패. 수동으로 권한을 부여하세요:"
            log_error "gcloud projects add-iam-policy-binding $PROJECT_ID --member=\"user:$current_account\" --role=\"roles/owner\""
            exit 1
        fi
    fi

    log_success "✅ 권한 확인 및 설정 완료!"
}

# 필수 GCP API 활성화
enable_gcp_apis() {
    log_info "필수 GCP API 활성화 중..."

    local apis=(
        "compute.googleapis.com"
        "container.googleapis.com"
        "sqladmin.googleapis.com"
        "sql-component.googleapis.com"
        "storage.googleapis.com"
        "certificatemanager.googleapis.com"
        "dns.googleapis.com"
        "artifactregistry.googleapis.com"
        "cloudresourcemanager.googleapis.com"
        "iam.googleapis.com"
    )

    for api in "${apis[@]}"; do
        log_info "   활성화 중: $api"
        if gcloud services enable "$api" --project="$PROJECT_ID" --quiet; then
            log_success "   ✅ $api 활성화 완료"
        else
            log_warning "   ⚠️  $api 활성화 실패"
        fi
    done

    log_success "✅ GCP API 활성화 완료!"

    # API 활성화 대기
    log_info "API 활성화 전파 대기 중... (10초)"
    sleep 10
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

# Terraform으로 인프라 배포 (운영 스펙)
deploy_infrastructure() {
    log_info "🏗️ Terraform 운영 인프라 배포 시작..."
    log_warning "⚠️  운영 환경: 개발 대비 2배 스펙으로 구성됩니다."

    # terraform 디렉토리로 이동
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR/../terraform"

    # terraform.tfvars 생성 (운영 스펙 - 실제 생성된 인프라 기준)
    cat > terraform.tfvars.prod << EOF
# ===========================================
# 🔒 운영 환경 설정 (api-prod-biocom)
# ===========================================
# 이 설정은 실제 생성된 운영 인프라 스펙과 일치합니다.
# 수정 시 실제 인프라와 동기화 필요!

project_id = "$PROJECT_ID"
region = "$REGION"
zone = "$ZONE"
environment = "prod"

# ===========================================
# 🚢 GKE 클러스터 설정 (개발 대비 2배)
# ===========================================
cluster_name = "$CLUSTER_NAME"

# 노드 설정
node_machine_type = "e2-standard-4"  # 개발: e2-standard-2 → 운영: e2-standard-4 (4 vCPU, 16GB RAM)
node_disk_size = 60                  # 개발: 30GB → 운영: 60GB
node_disk_type = "pd-standard"       # 비용 효율성 (필요시 pd-ssd로 변경)
node_initial_count = 3               # 초기 노드 수
node_min_count = 2                   # 오토스케일링 최소
node_max_count = 6                   # 오토스케일링 최대
use_spot_instances = false           # 운영: 스팟 인스턴스 사용 안함 (안정성)

# ===========================================
# 🗄️ Cloud SQL 설정 (개발 대비 2배)
# ===========================================
db_instance_name = "$DB_NAME"
db_name = "biocom"
db_username = "postgres"             # 운영: postgres 사용자
# db_password는 Secret Manager 또는 환경변수로 관리
db_version = "POSTGRES_15"
db_tier = "db-custom-4-16384"        # 개발: db-custom-2-8192 → 운영: 4 vCPU, 16GB RAM
db_disk_size = 20                    # 자동 증가 활성화 (storage-auto-increase)

# Cloud SQL 고가용성 및 백업
db_high_availability = true          # 운영: REGIONAL (고가용성)
db_backup_enabled = true
db_backup_start_time = "03:00"       # UTC 03:00 = KST 12:00

# ===========================================
# 📦 Storage 설정
# ===========================================
# 주의: 개발/운영 버킷 공유 사용!
# 버킷명: api-dev-biocom-uploads (개발 프로젝트에 위치)
gcs_uploads_bucket_name = "api-dev-biocom-uploads"

# ===========================================
# 🔐 SSL/도메인 설정
# ===========================================
domain_name = "biocom.ai.kr"
api_subdomain = "api"                # api.biocom.ai.kr

# ===========================================
# 🏷️ 공통 라벨
# ===========================================
common_labels = {
  project     = "biocom-api"
  environment = "production"
  owner       = "biocom-team"
  managed-by  = "terraform"
}
EOF

    log_info "Terraform 초기화 중..."
    terraform init -upgrade

    # 운영용 workspace 생성 또는 선택
    terraform workspace select prod 2>/dev/null || terraform workspace new prod

    log_info "Terraform 계획 생성 중..."
    terraform plan -var-file=terraform.tfvars.prod -out=tfplan.prod

    if [[ "$AUTO_APPROVE" == true ]]; then
        log_info "Terraform 자동 적용 중... (약 15-20분 소요)"
        terraform apply tfplan.prod
    else
        log_info "Terraform 적용 중..."
        terraform apply -var-file=terraform.tfvars.prod
    fi

    log_success "✅ Terraform 운영 인프라 배포 완료!"
}

# kubeconfig 설정
setup_kubeconfig() {
    log_info "Kubeconfig 설정 중..."

    gcloud container clusters get-credentials "$CLUSTER_NAME" \
        --zone="$ZONE" \
        --project="$PROJECT_ID"

    log_success "✅ Kubeconfig 설정 완료!"
}

# SSL Policy 생성 (운영 환경 강화)
create_ssl_policy() {
    log_info "🔒 SSL Policy 생성 중... (운영 환경 보안 강화)"

    # SSL Policy가 이미 존재하는지 확인
    if gcloud compute ssl-policies describe biocom-ssl-policy-prod --project="$PROJECT_ID" &>/dev/null; then
        log_success "✅ SSL Policy가 이미 존재합니다: biocom-ssl-policy-prod"
        return 0
    fi

    # SSL Policy 생성 (운영 환경용 강화)
    if gcloud compute ssl-policies create biocom-ssl-policy-prod \
        --profile RESTRICTED \
        --min-tls-version 1.2 \
        --project="$PROJECT_ID" \
        --description="BIOCOM API 운영 SSL 보안 정책 - 최고 수준 암호화"; then
        log_success "✅ SSL Policy 생성 완료!"
        log_info "   이름: biocom-ssl-policy-prod"
        log_info "   프로필: RESTRICTED (최고 보안)"
        log_info "   최소 TLS 버전: 1.2"
    else
        log_error "❌ SSL Policy 생성 실패"
        return 1
    fi
}

# Cloud SQL 설정 (운영 환경)
setup_cloud_sql() {
    log_info "Cloud SQL 운영 환경 설정 중..."

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

    # SSL 비활성화 (애플리케이션 레벨에서 처리)
    gcloud sql instances patch "$DB_NAME" --no-require-ssl --project="$PROJECT_ID" --quiet

    # 데이터베이스 생성
    gcloud sql databases create biocom --instance="$DB_NAME" --project="$PROJECT_ID" 2>/dev/null || true

    # biocom 사용자 생성 및 비밀번호 설정 (운영 환경)
    gcloud sql users create biocom \
        --instance="$DB_NAME" \
        --password='qkdldhzjaProdelql0519' \
        --project="$PROJECT_ID" 2>/dev/null || true

    # postgres 사용자 비밀번호도 동일하게 설정
    gcloud sql users set-password postgres \
        --instance="$DB_NAME" \
        --password='qkdldhzjaProdelql0519' \
        --project="$PROJECT_ID" 2>/dev/null || true

    # IP 주소 가져오기
    local db_ip=$(gcloud sql instances describe "$DB_NAME" --project="$PROJECT_ID" --format="value(ipAddresses[0].ipAddress)")

    # 백업 설정 확인
    log_info "백업 설정 확인 중..."
    gcloud sql instances describe "$DB_NAME" --project="$PROJECT_ID" --format="table(backupConfiguration.enabled, backupConfiguration.startTime)"

    log_success "✅ Cloud SQL 운영 환경 설정 완료!"
    log_info "   Database: biocom"
    log_info "   User: biocom"
    log_info "   Password: qkdldhzjaProdelql0519"
    log_info "   Host: $db_ip"
    log_info "   Tier: db-custom-4-16384 (4 vCPU, 16GB RAM)"
    log_info "   고가용성: REGIONAL (활성화)"
    log_info "   백업: 매일 03:00 UTC (12:00 KST)"

    # 연결 문자열 출력
    echo
    log_info "📝 DATABASE_URL (운영):"
    echo "postgresql://postgres:bico0519%21%40%23@$db_ip:5432/biocom"
}

# 운영 환경 최종 확인
verify_production_setup() {
    log_info "🔍 운영 환경 설정 검증 중..."

    # 클러스터 노드 확인
    log_info "GKE 클러스터 노드 확인:"
    kubectl get nodes

    # Cloud SQL 상태 확인
    log_info "Cloud SQL 상태 확인:"
    gcloud sql instances describe "$DB_NAME" --project="$PROJECT_ID" --format="table(state, backendType, settings.tier, settings.dataDiskSizeGb)"

    log_success "✅ 운영 환경 검증 완료!"
}

# 메인 실행 함수
main() {
    log_info "🚀 BIOCOM API 운영 인프라 구축을 시작합니다!"
    log_warning "⚠️  운영 환경 구축입니다. 신중하게 진행하세요."

    check_requirements
    check_gcp_auth
    check_and_add_permissions
    enable_gcp_apis
    check_existing_infrastructure
    deploy_infrastructure
    setup_kubeconfig
    create_ssl_policy
    setup_cloud_sql
    verify_production_setup

    log_success "🎉 운영 인프라 구축이 완료되었습니다!"
    echo
    log_info "다음 단계:"
    log_info "  1. 애플리케이션 배포: ./scripts/02-deploy-app-prod.sh --project-id $PROJECT_ID"
    log_info "  2. 도메인 연결 후 접속 확인: https://api.biocom.kr/api/docs"
    log_info "  3. 모니터링 설정 확인"
}

# 스크립트 실행
main