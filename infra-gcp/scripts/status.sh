#!/bin/bash

# 🔍 BIOCOM API GCP 상태 확인 스크립트
# 인프라와 애플리케이션 상태를 한눈에 확인

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 설정 변수
PROJECT_ID=""
CLUSTER_NAME="biocom-cluster"
REGION="asia-northeast3"
NAMESPACE="biocom-api"

# 사용법
usage() {
    echo "사용법: $0 [옵션]"
    echo ""
    echo "옵션:"
    echo "  -p, --project-id PROJECT_ID    GCP 프로젝트 ID (필수)"
    echo "  -c, --cluster-name CLUSTER     GKE 클러스터 이름"
    echo "  -r, --region REGION            GCP 리전"
    echo "  -n, --namespace NAMESPACE      K8s 네임스페이스"
    echo "  -h, --help                     도움말"
}

# 명령행 인수 파싱
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
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "알 수 없는 옵션: $1"
            usage
            exit 1
            ;;
    esac
done

if [[ -z "$PROJECT_ID" ]]; then
    echo "프로젝트 ID가 필요합니다."
    usage
    exit 1
fi

log_info "🔍 BIOCOM API GCP 상태 확인 시작..."
echo ""

# GCP 프로젝트 설정
gcloud config set project "$PROJECT_ID" &>/dev/null

# 1. 인프라 상태 확인
log_info "=== 🏗️ 인프라 상태 ==="

# GKE 클러스터
log_info "GKE 클러스터:"
if gcloud container clusters describe "$CLUSTER_NAME" --region="$REGION" &>/dev/null; then
    STATUS=$(gcloud container clusters describe "$CLUSTER_NAME" --region="$REGION" --format="value(status)")
    if [[ "$STATUS" == "RUNNING" ]]; then
        log_success "✅ 클러스터 상태: $STATUS"
    else
        log_warning "⚠️ 클러스터 상태: $STATUS"
    fi
    
    NODE_COUNT=$(gcloud container clusters describe "$CLUSTER_NAME" --region="$REGION" --format="value(currentNodeCount)")
    log_info "   노드 수: $NODE_COUNT"
else
    log_warning "❌ 클러스터를 찾을 수 없습니다"
fi

# Cloud SQL
log_info "Cloud SQL:"
if gcloud sql instances list --filter="name:biocom-postgres" --format="value(name)" | grep -q "biocom-postgres"; then
    SQL_STATUS=$(gcloud sql instances describe biocom-postgres --format="value(state)")
    if [[ "$SQL_STATUS" == "RUNNABLE" ]]; then
        log_success "✅ Cloud SQL 상태: $SQL_STATUS"
    else
        log_warning "⚠️ Cloud SQL 상태: $SQL_STATUS"
    fi
else
    log_warning "❌ Cloud SQL 인스턴스를 찾을 수 없습니다"
fi

# Load Balancer
log_info "Load Balancer:"
LB_COUNT=$(gcloud compute forwarding-rules list --global --filter="name:*biocom*" --format="value(name)" | wc -l)
if [[ $LB_COUNT -gt 0 ]]; then
    log_success "✅ 로드 밸런서: ${LB_COUNT}개 실행 중"
    
    # 외부 IP 확인
    EXTERNAL_IP=$(gcloud compute addresses list --global --filter="name:*external-ip" --format="value(address)" | head -1)
    if [[ -n "$EXTERNAL_IP" ]]; then
        log_info "   외부 IP: $EXTERNAL_IP"
    fi
else
    log_warning "❌ 로드 밸런서를 찾을 수 없습니다"
fi

echo ""

# 2. 애플리케이션 상태 확인
log_info "=== 🚢 애플리케이션 상태 ==="

# kubectl 설정 확인
if ! kubectl cluster-info &>/dev/null; then
    log_warning "kubectl이 설정되지 않았습니다. 설정 중..."
    gcloud container clusters get-credentials "$CLUSTER_NAME" --region="$REGION" --project="$PROJECT_ID"
fi

# Pod 상태
log_info "Pod 상태:"
if kubectl get namespace "$NAMESPACE" &>/dev/null; then
    POD_STATUS=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null)
    if [[ -n "$POD_STATUS" ]]; then
        RUNNING_PODS=$(echo "$POD_STATUS" | grep "Running" | wc -l)
        TOTAL_PODS=$(echo "$POD_STATUS" | wc -l)
        
        if [[ $RUNNING_PODS -eq $TOTAL_PODS ]]; then
            log_success "✅ 모든 Pod 실행 중 ($RUNNING_PODS/$TOTAL_PODS)"
        else
            log_warning "⚠️ 일부 Pod 문제 있음 ($RUNNING_PODS/$TOTAL_PODS)"
            echo "$POD_STATUS" | grep -v "Running" || true
        fi
    else
        log_warning "❌ Pod를 찾을 수 없습니다"
    fi
else
    log_warning "❌ 네임스페이스 '$NAMESPACE'를 찾을 수 없습니다"
fi

# Service 상태
log_info "Service 상태:"
if kubectl get svc -n "$NAMESPACE" &>/dev/null; then
    SVC_COUNT=$(kubectl get svc -n "$NAMESPACE" --no-headers | wc -l)
    log_success "✅ Service: ${SVC_COUNT}개"
else
    log_warning "❌ Service를 찾을 수 없습니다"
fi

# Ingress 상태
log_info "Ingress 상태:"
if kubectl get ingress -n "$NAMESPACE" &>/dev/null; then
    INGRESS_IP=$(kubectl get ingress -n "$NAMESPACE" -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    if [[ -n "$INGRESS_IP" ]]; then
        log_success "✅ Ingress IP: $INGRESS_IP"
    else
        log_warning "⚠️ Ingress IP가 할당되지 않았습니다"
    fi
else
    log_warning "❌ Ingress를 찾을 수 없습니다"
fi

echo ""

# 3. SSL 인증서 상태
log_info "=== 🔐 SSL 인증서 상태 ==="
CERT_STATUS=$(gcloud certificate-manager certificates list --global --format="value(state)" 2>/dev/null | head -1)
if [[ -n "$CERT_STATUS" ]]; then
    if [[ "$CERT_STATUS" == "ACTIVE" ]]; then
        log_success "✅ SSL 인증서: $CERT_STATUS"
    else
        log_warning "⚠️ SSL 인증서: $CERT_STATUS (발급 진행 중일 수 있음)"
    fi
else
    log_warning "❌ SSL 인증서를 찾을 수 없습니다"
fi

echo ""

# 4. 유용한 링크 출력
log_info "=== 🔗 유용한 링크 ==="
echo "📊 GCP Console: https://console.cloud.google.com/home/dashboard?project=$PROJECT_ID"
echo "🚢 GKE Workloads: https://console.cloud.google.com/kubernetes/workload?project=$PROJECT_ID"
echo "🗄️ Cloud SQL: https://console.cloud.google.com/sql/instances?project=$PROJECT_ID"
echo "🔐 Certificate Manager: https://console.cloud.google.com/security/ccm/certificates?project=$PROJECT_ID"
echo "📈 Monitoring: https://console.cloud.google.com/monitoring?project=$PROJECT_ID"

if [[ -n "$EXTERNAL_IP" ]]; then
    echo ""
    log_info "🚀 API 접속 주소: https://api-gcp.biocom.ai.kr"
    log_info "📚 API 문서: https://api-gcp.biocom.ai.kr/docs"
fi

echo ""
log_success "✅ 상태 확인 완료!"