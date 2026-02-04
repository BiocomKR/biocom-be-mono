#!/bin/bash

# 🚀 biocom-mq Redis Memorystore 배포 스크립트
# BullMQ Queue용 Redis 인스턴스만 생성합니다.

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
    cat << 'USAGE'
사용법: $0 [옵션]

biocom-mq용 Redis Memorystore 생성 스크립트

옵션:
  -p, --project-id PROJECT_ID    GCP 프로젝트 ID (필수)
  -r, --region REGION             GCP 리전 (기본값: asia-northeast3)
  -n, --redis-name NAME           Redis 인스턴스 이름 (기본값: biocom-redis-dev)
  -s, --size SIZE                 Redis 메모리 크기 GB (기본값: 1)
  -t, --tier TIER                 Redis 티어 BASIC|STANDARD (기본값: BASIC)
  -y, --yes                       자동 승인
  -h, --help                      도움말

예시:
  $0 --project-id api-dev-biocom --yes
  $0 --project-id api-dev-biocom --size 2 --tier STANDARD

주의사항:
  - GKE 클러스터의 VPC와 동일한 네트워크에 생성됩니다
  - BASIC 티어: 단일 존 (개발용)
  - STANDARD 티어: 고가용성 (프로덕션용)
USAGE
    exit 0
}

# 기본값
PROJECT_ID=""
REGION="asia-northeast3"
REDIS_NAME="biocom-redis-dev"
REDIS_SIZE=1
REDIS_TIER="BASIC"
AUTO_APPROVE=false
VPC_NETWORK="biocom-cluster-dev-vpc"

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--project-id) PROJECT_ID="$2"; shift 2 ;;
        -r|--region) REGION="$2"; shift 2 ;;
        -n|--redis-name) REDIS_NAME="$2"; shift 2 ;;
        -s|--size) REDIS_SIZE="$2"; shift 2 ;;
        -t|--tier) REDIS_TIER="$2"; shift 2 ;;
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

log_info "📋 Redis Memorystore 설정:"
log_info "   프로젝트 ID: $PROJECT_ID"
log_info "   리전: $REGION"
log_info "   인스턴스 이름: $REDIS_NAME"
log_info "   메모리 크기: ${REDIS_SIZE}GB"
log_info "   티어: $REDIS_TIER"
log_info "   VPC 네트워크: $VPC_NETWORK"

# 사용자 확인
if [[ "$AUTO_APPROVE" != true ]]; then
    read -p "Redis Memorystore를 생성하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "취소되었습니다."
        exit 0
    fi
fi

# GCP 설정
log_info "🔐 GCP 인증 중..."
gcloud config set project "$PROJECT_ID" --quiet
log_success "✅ 인증 완료!"

# Redis API 활성화
log_info "🔌 Redis API 활성화 중..."
gcloud services enable redis.googleapis.com --project="$PROJECT_ID"
log_success "✅ Redis API 활성화 완료!"

# 기존 Redis 확인
log_info "🔍 기존 Redis 인스턴스 확인 중..."
if gcloud redis instances describe "$REDIS_NAME" --region="$REGION" --project="$PROJECT_ID" &>/dev/null; then
    REDIS_HOST=$(gcloud redis instances describe "$REDIS_NAME" \
        --region="$REGION" \
        --project="$PROJECT_ID" \
        --format="value(host)")

    log_warning "⚠️  Redis 인스턴스가 이미 존재합니다!"
    log_info "   이름: $REDIS_NAME"
    log_info "   Host: $REDIS_HOST"
    log_info "   Port: 6379"

    read -p "기존 Redis를 사용하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_success "✅ 기존 Redis 사용!"
        exit 0
    else
        log_error "Redis 이름을 변경하거나 기존 인스턴스를 삭제하세요."
        exit 1
    fi
fi

# VPC 네트워크 확인
log_info "🌐 VPC 네트워크 확인 중..."
if ! gcloud compute networks describe "$VPC_NETWORK" --project="$PROJECT_ID" &>/dev/null; then
    log_error "VPC 네트워크를 찾을 수 없습니다: $VPC_NETWORK"
    log_error "GKE 클러스터가 먼저 생성되어 있어야 합니다."
    exit 1
fi
log_success "✅ VPC 네트워크 확인 완료!"

# Redis 인스턴스 생성
log_info "🚀 Redis Memorystore 생성 중... (약 5-10분 소요)"
gcloud redis instances create "$REDIS_NAME" \
    --region="$REGION" \
    --tier="$REDIS_TIER" \
    --size="$REDIS_SIZE" \
    --redis-version=redis_7_0 \
    --network="projects/$PROJECT_ID/global/networks/$VPC_NETWORK" \
    --project="$PROJECT_ID"

# Redis Host 확인
REDIS_HOST=$(gcloud redis instances describe "$REDIS_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format="value(host)")

log_success "✅ Redis Memorystore 생성 완료!"
echo
log_info "📊 Redis 정보:"
log_info "   이름: $REDIS_NAME"
log_info "   Host: $REDIS_HOST"
log_info "   Port: 6379"
log_info "   메모리: ${REDIS_SIZE}GB"
log_info "   티어: $REDIS_TIER"
echo
log_success "🎉 Redis 배포 완료!"
log_info ""
log_info "다음 단계:"
log_info "1. infra-gcp/k8s/configmap.yaml에서 REDIS_HOST를 $REDIS_HOST로 업데이트"
log_info "2. ./infra-gcp/scripts/02-deploy-app.sh --project-id $PROJECT_ID --yes 실행"
