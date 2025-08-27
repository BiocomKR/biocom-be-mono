#!/bin/bash

# 🚀 BIOCOM API GCP 배포 스크립트
# 테라폼으로 인프라 구축 후 쿠버네티스 애플리케이션 배포

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
NAMESPACE="biocom-api"

# 사용법 출력
usage() {
    echo "사용법: $0 [옵션]"
    echo ""
    echo "옵션:"
    echo "  -p, --project-id PROJECT_ID    GCP 프로젝트 ID (필수)"
    echo "  -c, --cluster-name CLUSTER     GKE 클러스터 이름 (기본값: biocom-cluster)"
    echo "  -r, --region REGION            GCP 리전 (기본값: asia-northeast3)"
    echo "  -n, --namespace NAMESPACE      K8s 네임스페이스 (기본값: biocom-api)"
    echo "  -h, --help                     이 도움말 출력"
    echo ""
    echo "예시:"
    echo "  $0 --project-id biocom-api-123456"
    echo "  $0 -p biocom-api-123456 -c my-cluster -r asia-northeast1"
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

log_info "배포 설정:"
log_info "  프로젝트 ID: $PROJECT_ID"
log_info "  클러스터 이름: $CLUSTER_NAME"
log_info "  리전: $REGION"
log_info "  네임스페이스: $NAMESPACE"
echo ""

# 필수 도구 확인
check_prerequisites() {
    log_info "필수 도구 확인 중..."
    
    # gcloud CLI
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI가 설치되어 있지 않습니다."
        log_info "설치 방법: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    # kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl이 설치되어 있지 않습니다."
        log_info "설치 방법: https://kubernetes.io/docs/tasks/tools/"
        exit 1
    fi
    
    # terraform
    if ! command -v terraform &> /dev/null; then
        log_error "terraform이 설치되어 있지 않습니다."
        log_info "설치 방법: https://learn.hashicorp.com/terraform/getting-started/install.html"
        exit 1
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
    gcloud config set project "$PROJECT_ID"
    log_success "GCP 인증 완료. 프로젝트: $PROJECT_ID"
}

# 테라폼 인프라 배포
deploy_infrastructure() {
    log_info "테라폼 인프라 배포 시작..."
    
    cd terraform
    
    # terraform.tfvars 파일 확인
    if [[ ! -f "terraform.tfvars" ]]; then
        log_warning "terraform.tfvars 파일이 없습니다."
        log_info "terraform.tfvars.example을 복사해서 terraform.tfvars로 만들고 실제 값으로 수정하세요."
        log_info "최소한 다음 값들을 설정해야 합니다:"
        log_info "  - project_id = \"$PROJECT_ID\""
        log_info "  - domain_name = \"실제_도메인\""
        read -p "계속하시겠습니까? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # 테라폼 초기화
    log_info "테라폼 초기화 중..."
    terraform init
    
    # 테라폼 계획 확인
    log_info "테라폼 계획 생성 중..."
    terraform plan -var="project_id=$PROJECT_ID" -out=tfplan
    
    # 사용자 확인
    echo ""
    log_warning "위의 계획을 검토하세요."
    read -p "테라폼을 적용하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "배포가 취소되었습니다."
        exit 1
    fi
    
    # 테라폼 적용
    log_info "테라폼 적용 중... (약 10-15분 소요)"
    terraform apply tfplan
    
    log_success "인프라 배포 완료!"
    cd ..
}

# kubectl 설정
setup_kubectl() {
    log_info "kubectl 설정 중..."
    
    # GKE 클러스터 인증 정보 가져오기
    gcloud container clusters get-credentials "$CLUSTER_NAME" --region "$REGION" --project "$PROJECT_ID"
    
    # 클러스터 연결 확인
    if kubectl cluster-info &> /dev/null; then
        log_success "kubectl 설정 완료!"
    else
        log_error "kubectl 설정 실패!"
        exit 1
    fi
}

# Kubernetes 매니페스트 배포
deploy_kubernetes() {
    log_info "Kubernetes 애플리케이션 배포 시작..."
    
    cd k8s
    
    # 네임스페이스 생성
    log_info "네임스페이스 생성 중..."
    kubectl apply -f namespace.yaml
    
    # ConfigMap 배포
    log_info "ConfigMap 배포 중..."
    kubectl apply -f configmap.yaml
    
    # Secret 확인 및 경고
    log_warning "Secret 파일을 확인하세요!"
    log_warning "실제 운영 환경에서는 다음과 같이 Secret을 생성해야 합니다:"
    log_warning "1. Secret Manager에서 실제 값 가져오기"
    log_warning "2. 서비스 계정 키 생성"
    log_warning "3. Cloud SQL Proxy 설정"
    echo ""
    
    read -p "Secret 파일을 수정했고 배포를 계속하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kubectl apply -f secret.yaml
        log_success "Secret 배포 완료 (실제 값으로 수정 확인 필요)"
    else
        log_info "Secret 배포를 건너뛰었습니다. 나중에 수동으로 배포하세요."
    fi
    
    # Service 배포
    log_info "Service 배포 중..."
    kubectl apply -f service.yaml
    
    # Deployment 배포
    log_info "Deployment 배포 중..."
    # PROJECT_ID 치환
    sed "s/PROJECT_ID/$PROJECT_ID/g" deployment.yaml | kubectl apply -f -
    
    # Ingress 배포
    log_info "Ingress 배포 중..."
    kubectl apply -f ingress.yaml
    
    log_success "Kubernetes 애플리케이션 배포 완료!"
    cd ..
}

# 배포 상태 확인
check_deployment_status() {
    log_info "배포 상태 확인 중..."
    
    echo ""
    log_info "=== 네임스페이스 ==="
    kubectl get namespaces | grep "$NAMESPACE" || log_warning "네임스페이스를 찾을 수 없습니다."
    
    echo ""
    log_info "=== Pod 상태 ==="
    kubectl get pods -n "$NAMESPACE" -o wide
    
    echo ""
    log_info "=== Service 상태 ==="
    kubectl get services -n "$NAMESPACE"
    
    echo ""
    log_info "=== Ingress 상태 ==="
    kubectl get ingress -n "$NAMESPACE"
    
    echo ""
    log_info "=== ManagedCertificate 상태 ==="
    kubectl get managedcertificate -n "$NAMESPACE" 2>/dev/null || log_warning "ManagedCertificate를 찾을 수 없습니다."
    
    echo ""
    log_info "=== HPA 상태 ==="
    kubectl get hpa -n "$NAMESPACE" 2>/dev/null || log_warning "HPA를 찾을 수 없습니다."
}

# 최종 정보 출력
show_final_info() {
    log_success "🎉 배포가 완료되었습니다!"
    echo ""
    
    # Terraform 출력값 표시
    log_info "=== 중요한 정보 ==="
    cd terraform
    
    # 외부 IP 가져오기
    EXTERNAL_IP=$(terraform output -raw load_balancer_ip 2>/dev/null || echo "확인 불가")
    API_URL=$(terraform output -raw api_endpoint 2>/dev/null || echo "확인 불가")
    
    echo ""
    log_info "🌐 외부 IP 주소: $EXTERNAL_IP"
    log_info "🚀 API 접속 주소: $API_URL"
    echo ""
    
    log_warning "⚠️ 다음 작업들을 완료해야 합니다:"
    echo ""
    echo "1. 가비아 DNS 설정:"
    echo "   - A 레코드: api-gcp → $EXTERNAL_IP"
    echo "   - SSL 인증서 검증용 TXT 레코드 (terraform output dns_verification_record 참조)"
    echo ""
    echo "2. SSL 인증서 상태 확인 (최대 24시간 소요):"
    echo "   gcloud certificate-manager certificates list --global"
    echo ""
    echo "3. Docker 이미지 빌드 및 푸시:"
    echo "   docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api:latest ."
    echo "   docker push $REGION-docker.pkg.dev/$PROJECT_ID/biocom-api/biocom-api:latest"
    echo ""
    echo "4. Secret 값 업데이트 (실제 패스워드 등):"
    echo "   kubectl edit secret biocom-api-secrets -n $NAMESPACE"
    echo ""
    echo "5. 애플리케이션 상태 모니터링:"
    echo "   kubectl logs -f deployment/biocom-api -n $NAMESPACE"
    echo ""
    
    cd ..
}

# 메인 실행 함수
main() {
    log_info "🚀 BIOCOM API GCP 배포를 시작합니다!"
    echo ""
    
    check_prerequisites
    check_auth
    deploy_infrastructure
    setup_kubectl
    deploy_kubernetes
    check_deployment_status
    show_final_info
    
    log_success "✅ 모든 배포 작업이 완료되었습니다!"
}

# 스크립트 실행
main "$@"