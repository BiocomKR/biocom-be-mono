#!/bin/bash

# 🚀 BIOCOM API GCP 원클릭 배포 스크립트
# 형님 철학: 인프라든 앱이든 무조건 한방 딸깍!

set -e  # 에러 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로깅 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 설정 변수
PROJECT_ID=""
CLUSTER_NAME="biocom-cluster"
REGION="asia-northeast3"
ZONE="asia-northeast3-a"
NAMESPACE="biocom-api"
AUTO_APPROVE=false

# 사용법 출력
usage() {
    echo "사용법: $0 [옵션]"
    echo ""
    echo "옵션:"
    echo "  -p, --project-id PROJECT_ID    GCP 프로젝트 ID (필수)"
    echo "  -c, --cluster-name CLUSTER     GKE 클러스터 이름 (기본값: biocom-cluster)"
    echo "  -r, --region REGION            GCP 리전 (기본값: asia-northeast3)"
    echo "  -n, --namespace NAMESPACE      K8s 네임스페이스 (기본값: biocom-api)"
    echo "  -y, --yes                      모든 확인 자동 승인 (한방 딸깍 모드)"
    echo "  -h, --help                     이 도움말 출력"
    echo ""
    echo "예시:"
    echo "  $0 --project-id biocom-api-dev --yes  # 완전 자동 한방 배포"
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
        -y|--yes)
            AUTO_APPROVE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "알 수 없는 옵션: $1"
            usage
            exit 1
            ;;
    esac
done

# 필수 인수 확인
if [[ -z "$PROJECT_ID" ]]; then
    log_error "프로젝트 ID가 필요합니다."
    usage
    exit 1
fi

# 환경에 따른 클러스터 이름 조정
if [[ "$PROJECT_ID" == *"-dev" ]]; then
    CLUSTER_NAME="${CLUSTER_NAME}-dev"
elif [[ "$PROJECT_ID" == *"-prod" ]]; then
    CLUSTER_NAME="${CLUSTER_NAME}-prod"
fi

log_info "🚀 한방 딸깍 배포 설정:"
log_info "  프로젝트 ID: $PROJECT_ID"
log_info "  클러스터 이름: $CLUSTER_NAME"
log_info "  리전: $REGION"
log_info "  존: $ZONE"
log_info "  네임스페이스: $NAMESPACE"
log_info "  자동 승인: $AUTO_APPROVE"
echo ""

# 필수 도구 확인
check_prerequisites() {
    log_info "필수 도구 확인 중..."
    
    local missing_tools=()
    
    # gcloud CLI
    if ! command -v gcloud &> /dev/null; then
        missing_tools+=("gcloud")
    fi
    
    # kubectl
    if ! command -v kubectl &> /dev/null; then
        missing_tools+=("kubectl")
    fi
    
    # terraform
    if ! command -v terraform &> /dev/null; then
        missing_tools+=("terraform")
    fi
    
    # docker
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "다음 도구들이 설치되어 있지 않습니다: ${missing_tools[*]}"
        exit 1
    fi
    
    # gke-gcloud-auth-plugin 확인 및 자동 설치
    if ! gcloud components list --filter="name:gke-gcloud-auth-plugin AND state.name:Installed" --format="value(name)" | grep -q "gke-gcloud-auth-plugin"; then
        log_warning "gke-gcloud-auth-plugin이 설치되어 있지 않습니다. 자동 설치를 시작합니다..."
        gcloud components install gke-gcloud-auth-plugin --quiet
        if [ $? -eq 0 ]; then
            log_success "gke-gcloud-auth-plugin 설치 완료!"
        else
            log_error "gke-gcloud-auth-plugin 설치 실패!"
            exit 1
        fi
    fi
    
    log_success "모든 필수 도구가 설치되어 있습니다."
}

# GCP 인증 확인
check_auth() {
    log_info "GCP 인증 상태 확인 중..."
    
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 &> /dev/null; then
        log_error "GCP에 로그인되어 있지 않습니다."
        log_info "다음 명령어로 로그인하세요: gcloud auth login"
        exit 1
    fi
    
    # 프로젝트 설정
    gcloud config set project "$PROJECT_ID" 2>/dev/null || true
    log_success "GCP 인증 완료. 프로젝트: $PROJECT_ID"
}

# 인프라 상태 확인
check_infrastructure() {
    log_info "기존 인프라 확인 중..."
    
    local infra_exists=true
    
    # GKE 클러스터 확인
    if gcloud container clusters describe "$CLUSTER_NAME" --zone="$ZONE" --project="$PROJECT_ID" &>/dev/null; then
        log_success "✅ GKE 클러스터 존재: $CLUSTER_NAME"
    else
        log_warning "❌ GKE 클러스터 없음"
        infra_exists=false
    fi
    
    # Cloud SQL 확인
    if gcloud sql instances describe "biocom-postgres-dev" --project="$PROJECT_ID" &>/dev/null; then
        log_success "✅ Cloud SQL 존재: biocom-postgres-dev"
    else
        log_warning "❌ Cloud SQL 없음"
        infra_exists=false
    fi
    
    # VPC 네트워크 확인
    if gcloud compute networks describe "${CLUSTER_NAME}-vpc" --project="$PROJECT_ID" &>/dev/null; then
        log_success "✅ VPC 네트워크 존재: ${CLUSTER_NAME}-vpc"
    else
        log_warning "❌ VPC 네트워크 없음"
        infra_exists=false
    fi
    
    # Artifact Registry 확인
    if gcloud artifacts repositories describe biocom-api --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
        log_success "✅ Artifact Registry 존재: biocom-api"
    else
        log_warning "❌ Artifact Registry 없음"
        infra_exists=false
    fi
    
    if $infra_exists; then
        log_success "모든 인프라가 이미 존재합니다. 인프라 생성 단계를 건너뜁니다."
        return 0
    else
        log_warning "일부 인프라가 없습니다. 인프라를 생성해야 합니다."
        return 1
    fi
}

# 테라폼 인프라 배포
deploy_infrastructure() {
    log_info "테라폼 인프라 배포 시작..."
    
    cd terraform
    
    # terraform.tfvars 파일 확인
    if [[ ! -f "terraform.tfvars" ]]; then
        log_warning "terraform.tfvars 파일이 없습니다."
        if [[ -f "terraform.tfvars.example" ]]; then
            log_info "terraform.tfvars.example을 terraform.tfvars로 복사합니다."
            cp terraform.tfvars.example terraform.tfvars
            # 프로젝트 ID 자동 설정
            sed -i '' "s/project_id = .*/project_id = \"$PROJECT_ID\"/" terraform.tfvars
        fi
    fi
    
    # 테라폼 초기화
    log_info "테라폼 초기화 중..."
    terraform init -upgrade
    
    # 테라폼 적용
    if $AUTO_APPROVE; then
        log_info "테라폼 자동 적용 중... (약 10-15분 소요)"
        terraform apply -var="project_id=$PROJECT_ID" -auto-approve
    else
        log_info "테라폼 계획 생성 중..."
        terraform plan -var="project_id=$PROJECT_ID" -out=tfplan
        
        echo ""
        log_warning "위의 계획을 검토하세요."
        read -p "테라폼을 적용하시겠습니까? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "배포가 취소되었습니다."
            exit 1
        fi
        
        terraform apply tfplan
    fi
    
    log_success "인프라 배포 완료!"
    cd ../..
}

# kubectl 설정
setup_kubectl() {
    log_info "kubectl 설정 중..."
    
    # GKE 클러스터 인증 정보 가져오기
    gcloud container clusters get-credentials "$CLUSTER_NAME" --zone "$ZONE" --project "$PROJECT_ID"
    
    # 클러스터 연결 확인
    if kubectl cluster-info &> /dev/null; then
        log_success "kubectl 설정 완료!"
    else
        log_error "kubectl 설정 실패!"
        exit 1
    fi
}

# Docker 이미지 빌드 및 푸시
build_and_push_docker() {
    log_info "Docker 이미지 빌드 및 푸시..."
    
    # Artifact Registry 인증
    gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
    
    # Docker 이미지 태그
    IMAGE_TAG="$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api:latest"
    
    # Docker 이미지 빌드 (프로젝트 루트에서 실행)
    log_info "Docker 이미지 빌드 중..."
    docker build -t "$IMAGE_TAG" .
    
    # Docker 이미지 푸시
    log_info "Docker 이미지 푸시 중..."
    docker push "$IMAGE_TAG"
    
    log_success "Docker 이미지 배포 완료!"
}

# Kubernetes 매니페스트 배포
deploy_kubernetes() {
    log_info "Kubernetes 애플리케이션 배포 시작..."
    
    cd k8s
    
    # 네임스페이스 생성 (이미 있으면 무시)
    log_info "네임스페이스 확인/생성 중..."
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # ConfigMap 배포
    log_info "ConfigMap 배포 중..."
    kubectl apply -f configmap.yaml -n "$NAMESPACE"
    
    # Secret 생성 (없으면 기본값으로 생성)
    if ! kubectl get secret biocom-api-secrets -n "$NAMESPACE" &>/dev/null; then
        log_warning "Secret이 없습니다. 기본 Secret을 생성합니다."
        # 기본 Secret 생성 (실제 운영에서는 실제 값으로 교체 필요)
        kubectl create secret generic biocom-api-secrets \
            --from-literal=database-url="postgresql://postgres:password@localhost:5432/biocom" \
            --from-literal=jwt-secret="default-jwt-secret-change-me" \
            --from-literal=imweb-api-key="default-imweb-key" \
            --from-literal=imweb-api-secret="default-imweb-secret" \
            -n "$NAMESPACE"
    fi
    
    # Service 배포
    log_info "Service 배포 중..."
    kubectl apply -f service.yaml -n "$NAMESPACE"
    
    # Deployment 배포 (PROJECT_ID 치환)
    log_info "Deployment 배포 중..."
    sed "s/PROJECT_ID/$PROJECT_ID/g" deployment.yaml | \
    sed "s|IMAGE_TAG|$REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api:latest|g" | \
    kubectl apply -n "$NAMESPACE" -f -
    
    # Ingress 배포
    log_info "Ingress 배포 중..."
    kubectl apply -f ingress.yaml -n "$NAMESPACE"
    
    log_success "Kubernetes 애플리케이션 배포 완료!"
    cd ../..
}

# 배포 상태 확인
check_deployment_status() {
    log_info "배포 상태 확인 중..."
    
    echo ""
    log_info "=== Pod 상태 ==="
    kubectl get pods -n "$NAMESPACE" -o wide
    
    echo ""
    log_info "=== Service 상태 ==="
    kubectl get services -n "$NAMESPACE"
    
    echo ""
    log_info "=== Ingress 상태 ==="
    kubectl get ingress -n "$NAMESPACE"
    
    # Pod가 Running 상태가 될 때까지 대기
    log_info "Pod가 준비될 때까지 대기 중..."
    kubectl wait --for=condition=ready pod -l app=biocom-api -n "$NAMESPACE" --timeout=300s || true
}

# 최종 정보 출력
show_final_info() {
    log_success "🎉 배포가 완료되었습니다!"
    echo ""
    
    # Ingress IP 가져오기
    INGRESS_IP=$(kubectl get ingress -n "$NAMESPACE" -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "아직 할당되지 않음")
    
    log_info "=== 중요한 정보 ==="
    echo ""
    log_info "🌐 Ingress IP: $INGRESS_IP"
    log_info "🚀 API 접속 주소: http://$INGRESS_IP (IP 할당 후 접속 가능)"
    echo ""
    
    if [[ "$INGRESS_IP" == "아직 할당되지 않음" ]]; then
        log_warning "⚠️ Ingress IP가 아직 할당되지 않았습니다."
        log_info "다음 명령어로 확인하세요:"
        echo "  kubectl get ingress -n $NAMESPACE --watch"
    fi
    
    echo ""
    log_info "📝 유용한 명령어:"
    echo "  # Pod 로그 확인"
    echo "  kubectl logs -f deployment/biocom-api -n $NAMESPACE"
    echo ""
    echo "  # Pod 재시작"
    echo "  kubectl rollout restart deployment/biocom-api -n $NAMESPACE"
    echo ""
    echo "  # Secret 업데이트"
    echo "  kubectl edit secret biocom-api-secrets -n $NAMESPACE"
}

# 메인 실행 함수
main() {
    log_info "🚀 BIOCOM API 한방 딸깍 배포를 시작합니다!"
    echo ""
    
    # 1. 필수 도구 확인
    check_prerequisites
    
    # 2. GCP 인증 확인
    check_auth
    
    # 3. 인프라 확인 및 필요시 생성
    if ! check_infrastructure; then
        deploy_infrastructure
    fi
    
    # 4. kubectl 설정
    setup_kubectl
    
    # 5. Docker 이미지 빌드 및 푸시
    build_and_push_docker
    
    # 6. Kubernetes 배포
    deploy_kubernetes
    
    # 7. 상태 확인
    check_deployment_status
    
    # 8. 최종 정보 출력
    show_final_info
    
    log_success "✅ 한방 딸깍 배포 완료!"
}

# 스크립트 실행
main "$@"