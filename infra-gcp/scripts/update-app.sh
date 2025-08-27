#!/bin/bash

# 🚀 BIOCOM API 애플리케이션 업데이트 스크립트
# 인프라는 그대로 두고 애플리케이션만 업데이트

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
IMAGE_TAG=""

# 사용법
usage() {
    echo "사용법: $0 [옵션]"
    echo ""
    echo "옵션:"
    echo "  -p, --project-id PROJECT_ID    GCP 프로젝트 ID (필수)"
    echo "  -t, --tag IMAGE_TAG            Docker 이미지 태그 (기본값: latest)"
    echo "  -c, --cluster-name CLUSTER     GKE 클러스터 이름"
    echo "  -r, --region REGION            GCP 리전"
    echo "  -n, --namespace NAMESPACE      K8s 네임스페이스"
    echo "  -h, --help                     도움말"
    echo ""
    echo "예시:"
    echo "  $0 --project-id biocom-api-123 --tag v1.2.3"
    echo "  $0 -p biocom-api-123 -t latest"
}

# 명령행 인수 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--project-id)
            PROJECT_ID="$2"
            shift 2
            ;;
        -t|--tag)
            IMAGE_TAG="$2"
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

# 기본값 설정
if [[ -z "$IMAGE_TAG" ]]; then
    IMAGE_TAG="latest"
fi

log_info "🚀 BIOCOM API 애플리케이션 업데이트 시작..."
log_info "  프로젝트: $PROJECT_ID"
log_info "  이미지 태그: $IMAGE_TAG"
echo ""

# GCP 설정
gcloud config set project "$PROJECT_ID"

# kubectl 설정
log_info "kubectl 설정 중..."
gcloud container clusters get-credentials "$CLUSTER_NAME" --region="$REGION" --project="$PROJECT_ID"

# 현재 상태 확인
log_info "현재 배포 상태 확인 중..."
if ! kubectl get deployment biocom-api -n "$NAMESPACE" &>/dev/null; then
    echo "❌ biocom-api 배포를 찾을 수 없습니다."
    echo "   먼저 초기 배포를 실행하세요: ./scripts/deploy.sh"
    exit 1
fi

CURRENT_IMAGE=$(kubectl get deployment biocom-api -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')
log_info "현재 이미지: $CURRENT_IMAGE"

# 새 이미지 경로
NEW_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api:$IMAGE_TAG"
log_info "새 이미지: $NEW_IMAGE"

# 이미지 존재 확인
log_info "새 이미지 존재 확인 중..."
if ! gcloud artifacts docker images describe "$NEW_IMAGE" &>/dev/null; then
    log_warning "⚠️ 이미지 '$NEW_IMAGE'를 찾을 수 없습니다."
    echo ""
    echo "이미지를 먼저 빌드하고 푸시하세요:"
    echo ""
    echo "# 1. 이미지 빌드"
    echo "docker build -t biocom-api ."
    echo ""
    echo "# 2. 태그 지정"
    echo "docker tag biocom-api $NEW_IMAGE"
    echo ""
    echo "# 3. 이미지 푸시"
    echo "docker push $NEW_IMAGE"
    echo ""
    read -p "이미지를 푸시했다면 y를 입력하고 계속하세요 (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "업데이트가 취소되었습니다."
        exit 1
    fi
fi

# 배포 업데이트
log_info "배포 이미지 업데이트 중..."
kubectl set image deployment/biocom-api biocom-api="$NEW_IMAGE" -n "$NAMESPACE"

# 롤아웃 상태 확인
log_info "롤아웃 진행 상황 확인 중..."
if kubectl rollout status deployment/biocom-api -n "$NAMESPACE" --timeout=300s; then
    log_success "✅ 애플리케이션 업데이트 완료!"
else
    echo "❌ 롤아웃이 실패했습니다. 롤백을 시도합니다..."
    kubectl rollout undo deployment/biocom-api -n "$NAMESPACE"
    kubectl rollout status deployment/biocom-api -n "$NAMESPACE" --timeout=180s
    echo "❌ 이전 버전으로 롤백되었습니다. 로그를 확인해주세요:"
    echo "   kubectl logs deployment/biocom-api -n $NAMESPACE"
    exit 1
fi

# 최종 상태 확인
echo ""
log_info "=== 최종 상태 ==="
kubectl get pods -n "$NAMESPACE" -l app=biocom-api
echo ""

NEW_CURRENT_IMAGE=$(kubectl get deployment biocom-api -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')
log_success "업데이트된 이미지: $NEW_CURRENT_IMAGE"

# 헬스체크
log_info "헬스체크 진행 중..."
sleep 10

READY_PODS=$(kubectl get pods -n "$NAMESPACE" -l app=biocom-api --field-selector=status.phase=Running -o jsonpath='{.items[*].status.containerStatuses[0].ready}' | grep -o "true" | wc -l)
TOTAL_PODS=$(kubectl get pods -n "$NAMESPACE" -l app=biocom-api --field-selector=status.phase=Running | wc -l)

if [[ $READY_PODS -gt 0 ]]; then
    log_success "✅ $READY_PODS/$TOTAL_PODS Pod가 Ready 상태입니다"
else
    log_warning "⚠️ Ready 상태인 Pod가 없습니다. 로그를 확인해주세요."
fi

echo ""
log_info "🔗 유용한 명령어:"
echo "# 로그 확인"
echo "kubectl logs deployment/biocom-api -n $NAMESPACE -f"
echo ""
echo "# Pod 상태 확인"
echo "kubectl get pods -n $NAMESPACE -l app=biocom-api"
echo ""
echo "# 이전 버전으로 롤백"
echo "kubectl rollout undo deployment/biocom-api -n $NAMESPACE"

log_success "✅ 애플리케이션 업데이트 완료!"