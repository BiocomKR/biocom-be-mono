#!/bin/bash
# 🚀 진짜 한방 배포 스크립트 - 모든 기능 통합
# 
# 사용법: ./eks-deploy.sh [dev|prod]
# 
# 이 스크립트 하나로 모든 배포 프로세스를 처리합니다:
# - 환경별 설정 (dev/prod)
# - EKS 클러스터 생성/확인
# - Docker 이미지 빌드 및 ECR 푸시
# - Helm 배포
# - 모든 것이 이 파일 하나에 통합되어 있습니다

set -e  # 에러 발생시 즉시 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 스크립트의 디렉토리 찾기
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ========================================
# 환경 설정
# ========================================
ENVIRONMENT=${1:-dev}

if [ "$ENVIRONMENT" != "dev" ] && [ "$ENVIRONMENT" != "prod" ]; then
    echo -e "${RED}❌ 잘못된 환경입니다. 'dev' 또는 'prod'를 선택하세요${NC}"
    echo -e "사용법: $0 [dev|prod]"
    exit 1
fi

echo -e "${BLUE}🚀 ALL-IN-ONE 배포를 시작합니다...${NC}"
echo -e "${YELLOW}📦 환경: ${ENVIRONMENT}${NC}"
echo ""

# 운영 환경 경고
if [ "$ENVIRONMENT" == "prod" ]; then
    echo -e "${RED}⚠️  운영 환경 배포 경고!${NC}"
    echo -e "${YELLOW}정말로 운영 환경에 배포하시겠습니까? (yes 입력)${NC}"
    read -r CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo -e "${YELLOW}배포가 취소되었습니다${NC}"
        exit 0
    fi
fi

# 환경별 설정 파일 로드
ENV_FILE="$PROJECT_ROOT/.env.eks.$ENVIRONMENT"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ 환경 설정 파일을 찾을 수 없습니다: $ENV_FILE${NC}"
    exit 1
fi

# 환경 변수 로드
source "$ENV_FILE"

# AWS_ACCOUNT_ID 자동 설정 (없을 경우)
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "AWS_ACCOUNT_ID가 설정되지 않았습니다. 자동으로 가져오는 중..."
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    if [ -z "$AWS_ACCOUNT_ID" ]; then
        echo -e "${RED}❌ AWS 계정 ID를 가져올 수 없습니다!${NC}"
        exit 1
    fi
    echo "AWS_ACCOUNT_ID: $AWS_ACCOUNT_ID"
fi

echo -e "${GREEN}✅ 환경 설정 로드 완료${NC}"
echo -e "  클러스터: ${YELLOW}${CLUSTER_NAME}${NC}"
echo -e "  노드 타입: ${YELLOW}${NODE_INSTANCE_TYPE}${NC}"
echo -e "  노드 개수: ${YELLOW}${NODE_DESIRED_SIZE}${NC}"
echo ""

# 로그 디렉토리 생성
LOG_DIR="$PROJECT_ROOT/.deployment-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/deployment-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).log"

# 로깅 함수 (반드시 먼저 정의)
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# 30일 이상 된 로그 파일 자동 삭제
find "$LOG_DIR" -name "deployment-*.log" -type f -mtime +30 -delete 2>/dev/null || true
log "🧹 30일 이상 된 로그 파일 정리 완료"

# 시작 시간 기록
START_TIME=$(date +%s)
TOTAL_STEPS=9  # EBS CSI 드라이버 단계 포함
CURRENT_STEP=0

# 진행률 표시 함수
show_progress() {
    local current=$1
    local total=$2
    local percent=$((current * 100 / total))
    local bar_length=50
    local filled_length=$((percent * bar_length / 100))
    
    # 진행률 바 생성
    local bar=""
    for ((i=0; i<filled_length; i++)); do bar+="█"; done
    for ((i=filled_length; i<bar_length; i++)); do bar+="░"; done
    
    printf "\r진행률: [${bar}] ${percent}%% (${current}/${total})"
}

# 타이머 함수
show_timer() {
    local start_time=$1
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))
    local minutes=$((elapsed / 60))
    local seconds=$((elapsed % 60))
    printf " - 경과 시간: %02d:%02d" $minutes $seconds
}

# ========================================
# STEP 0: 필수 도구 확인
# ========================================
log "${GREEN}[0/8] 🔧 필수 도구 확인 및 설치${NC}"

# 도구 확인 함수
check_and_install_tool() {
    local tool=$1
    local install_cmd=$2
    
    if ! command -v $tool &> /dev/null; then
        log "${YELLOW}$tool 설치 중...${NC}"
        eval $install_cmd
        if [ $? -ne 0 ]; then
            log "${RED}❌ $tool 설치 실패!${NC}"
            exit 1
        fi
    else
        log "✅ $tool 확인됨"
    fi
}

# macOS 확인
if [[ "$OSTYPE" == "darwin"* ]]; then
    # Homebrew 확인
    if ! command -v brew &> /dev/null; then
        log "${YELLOW}Homebrew 설치 중...${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    check_and_install_tool "aws" "brew install awscli"
    check_and_install_tool "docker" "brew install --cask docker && open -a Docker && sleep 30"
    # kubectl은 brew로 설치하면 최신 버전 자동 설치
    check_and_install_tool "kubectl" "brew install kubectl"
    check_and_install_tool "eksctl" "brew install eksctl"
    check_and_install_tool "helm" "brew install helm"
    check_and_install_tool "jq" "brew install jq"
else
    # Linux
    check_and_install_tool "aws" "curl https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o awscliv2.zip && unzip awscliv2.zip && sudo ./aws/install"
    check_and_install_tool "docker" "curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh"
    # kubectl은 나중에 EKS 버전에 맞춰 설치
    if ! command -v kubectl &> /dev/null; then
        KUBECTL_VERSION=$(curl -L -s https://dl.k8s.io/release/stable.txt)
        log "${YELLOW}kubectl ${KUBECTL_VERSION} 설치 중...${NC}"
        curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
        chmod +x kubectl
        sudo mv kubectl /usr/local/bin/
    else
        log "✅ kubectl 확인됨"
    fi
    check_and_install_tool "eksctl" "curl --location https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_Linux_amd64.tar.gz | tar xz -C /tmp && sudo mv /tmp/eksctl /usr/local/bin"
    check_and_install_tool "helm" "curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash"
    check_and_install_tool "jq" "sudo apt-get update && sudo apt-get install -y jq"
fi

# Docker 실행 확인
if ! docker info &>/dev/null; then
    log "${RED}❌ Docker가 실행되고 있지 않습니다!${NC}"
    log "${YELLOW}Docker Desktop을 시작한 후 다시 실행하세요.${NC}"
    exit 1
fi

# IAM 권한 확인
log "🔍 IAM 권한 확인 중..."
if ! aws iam list-policies --max-items 1 &>/dev/null; then
    log "${RED}❌ IAM 권한이 부족합니다!${NC}"
    log "${YELLOW}필요한 권한: IAM, EKS, EC2, ECR 관련 권한${NC}"
    exit 1
fi

((CURRENT_STEP++))
show_progress $CURRENT_STEP $TOTAL_STEPS
show_timer $START_TIME
echo ""

# ========================================
# STEP 1: 환경 설정 확인
# ========================================
log "${GREEN}[1/8] 🔍 환경 설정 확인${NC}"

# 필수 환경 변수 확인
required_vars=(
    "AWS_ACCOUNT_ID"
    "AWS_REGION"
    "CLUSTER_NAME"
    "NODE_GROUP_NAME"
    "NODE_INSTANCE_TYPE"
    "NODE_MIN_SIZE"
    "NODE_MAX_SIZE"
    "NODE_DESIRED_SIZE"
    "ECR_REPOSITORY"
    "HELM_RELEASE_NAME"
    "DATABASE_URL"
    "JWT_SECRET"
    "SESSION_SECRET"
    "ACM_CERTIFICATE_ARN"
    "INGRESS_HOST"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    log "${RED}❌ 다음 환경 변수가 설정되지 않았습니다:${NC}"
    for var in "${missing_vars[@]}"; do
        log "  - $var"
    done
    exit 1
fi

log "✅ 모든 환경 변수가 설정되었습니다."

# AWS 자격 증명 확인
if ! aws sts get-caller-identity &>/dev/null; then
    log "${RED}❌ AWS 자격 증명이 유효하지 않습니다!${NC}"
    exit 1
fi
log "✅ AWS 자격 증명 확인 완료"

((CURRENT_STEP++))
show_progress $CURRENT_STEP $TOTAL_STEPS
show_timer $START_TIME
echo ""

# ========================================
# STEP 2: ECR 리포지토리 확인
# ========================================
log "${GREEN}[2/8] 📦 ECR 리포지토리 확인${NC}"

# ECR 리포지토리 존재 확인
if ! aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION &>/dev/null; then
    log "📦 ECR 리포지토리를 생성합니다..."
    aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION
    if [ $? -ne 0 ]; then
        log "${RED}❌ ECR 리포지토리 생성 실패!${NC}"
        exit 1
    fi
    log "✅ ECR 리포지토리 생성 완료"
else
    log "✅ ECR 리포지토리가 이미 존재합니다."
fi

# ECR 로그인
log "🔐 ECR 로그인 중..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
if [ $? -ne 0 ]; then
    log "${RED}❌ ECR 로그인 실패!${NC}"
    exit 1
fi
log "✅ ECR 로그인 성공"

((CURRENT_STEP++))
show_progress $CURRENT_STEP $TOTAL_STEPS
show_timer $START_TIME
echo ""

# ========================================
# STEP 3: EKS 클러스터 확인
# ========================================
log "${GREEN}[3/8] ☸️ EKS 클러스터 확인${NC}"

# 클러스터 존재 확인
if ! aws eks describe-cluster --name $CLUSTER_NAME --region $AWS_REGION &>/dev/null; then
    log "🚀 새 클러스터를 생성합니다: $CLUSTER_NAME"
    log "${YELLOW}⏱️  약 15-20분 소요됩니다...${NC}"
    
    # eksctl로 클러스터 생성 (최신 지원 버전 사용)
    EKSCTL_CREATE_CMD="eksctl create cluster --name $CLUSTER_NAME"
    
    # EKS_VERSION이 설정되어 있으면 추가
    if [ ! -z "$EKS_VERSION" ]; then
        EKSCTL_CREATE_CMD="$EKSCTL_CREATE_CMD --version $EKS_VERSION"
    fi
    
    $EKSCTL_CREATE_CMD \
        --region $AWS_REGION \
        --nodegroup-name $NODE_GROUP_NAME \
        --nodes $NODE_DESIRED_SIZE \
        --nodes-min $NODE_MIN_SIZE \
        --nodes-max $NODE_MAX_SIZE \
        --node-type $NODE_INSTANCE_TYPE \
        --managed \
        --asg-access \
        --alb-ingress-access \
        --with-oidc
    
    if [ $? -ne 0 ]; then
        log "${RED}❌ 클러스터 생성 실패!${NC}"
        exit 1
    fi
    log "✅ 클러스터 생성 완료"
else
    log "✅ 기존 클러스터 사용: $CLUSTER_NAME"
    
    # kubeconfig 업데이트
    aws eks update-kubeconfig --name $CLUSTER_NAME --region $AWS_REGION
fi

# 클러스터 연결 확인
if ! kubectl get nodes &>/dev/null; then
    log "${RED}❌ 클러스터 연결 실패!${NC}"
    exit 1
fi
log "✅ 클러스터 연결 확인"

((CURRENT_STEP++))
show_progress $CURRENT_STEP $TOTAL_STEPS
show_timer $START_TIME
echo ""

# ========================================
# STEP 4: AWS Load Balancer Controller 설치
# ========================================
log "${GREEN}[4/8] 🔌 AWS Load Balancer Controller 설치${NC}"

# AWS Load Balancer Controller가 이미 설치되어 있는지 확인
if ! kubectl get deployment -n kube-system aws-load-balancer-controller &>/dev/null; then
    log "📦 AWS Load Balancer Controller 설치 중..."
    
    # IAM Policy 생성 (로컬 파일 사용)
    # curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.0/docs/install/iam_policy.json
    
    # 프로젝트에 있는 IAM 정책 파일 사용
    IAM_POLICY_FILE="$PROJECT_ROOT/infrastructure/eks/configs/iam-policy.json"
    if [ ! -f "$IAM_POLICY_FILE" ]; then
        log "${RED}❌ IAM 정책 파일을 찾을 수 없습니다: $IAM_POLICY_FILE${NC}"
        exit 1
    fi
    
    aws iam create-policy \
        --policy-name AWSLoadBalancerControllerIAMPolicy-${CLUSTER_NAME} \
        --policy-document file://$IAM_POLICY_FILE 2>/dev/null || true
    
    # ServiceAccount 생성
    eksctl create iamserviceaccount \
        --cluster=$CLUSTER_NAME \
        --namespace=kube-system \
        --name=aws-load-balancer-controller \
        --attach-policy-arn=arn:aws:iam::${AWS_ACCOUNT_ID}:policy/AWSLoadBalancerControllerIAMPolicy-${CLUSTER_NAME} \
        --override-existing-serviceaccounts \
        --approve
    
    # Helm으로 설치
    helm repo add eks https://aws.github.io/eks-charts
    helm repo update
    
    helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
        -n kube-system \
        --set clusterName=$CLUSTER_NAME \
        --set serviceAccount.create=false \
        --set serviceAccount.name=aws-load-balancer-controller
    
    # 정리 (로컬 파일은 삭제하지 않음)
    # rm -f iam_policy.json
    
    log "✅ AWS Load Balancer Controller 설치 완료"
else
    log "✅ AWS Load Balancer Controller가 이미 설치되어 있습니다."
fi

((CURRENT_STEP++))
show_progress $CURRENT_STEP $TOTAL_STEPS
show_timer $START_TIME
echo ""

# ========================================
# STEP 4.5: EBS CSI 드라이버 설치 (EKS 1.23+ 필수)
# ========================================
log "${GREEN}[4.5/8] 💾 EBS CSI 드라이버 확인 및 설치${NC}"

# EBS CSI 드라이버가 설치되어 있는지 확인
if ! eksctl get addon --cluster=$CLUSTER_NAME --name=aws-ebs-csi-driver --region=$AWS_REGION &>/dev/null; then
    log "💾 EBS CSI 드라이버 설치 중..."
    
    # IAM Policy 생성 (EBS CSI 전용 정책 파일 사용)
    EBS_CSI_POLICY_FILE="$PROJECT_ROOT/infrastructure/eks/configs/ebs-csi-policy.json"
    if [ ! -f "$EBS_CSI_POLICY_FILE" ]; then
        log "${RED}❌ EBS CSI IAM 정책 파일을 찾을 수 없습니다: $EBS_CSI_POLICY_FILE${NC}"
        exit 1
    fi
    
    aws iam create-policy \
        --policy-name AmazonEKS_EBS_CSI_Driver_Policy-${CLUSTER_NAME} \
        --policy-document file://$EBS_CSI_POLICY_FILE 2>/dev/null || true
    
    # IAM 서비스 계정 생성
    eksctl create iamserviceaccount \
        --cluster=$CLUSTER_NAME \
        --namespace=kube-system \
        --name=ebs-csi-controller-sa \
        --role-name=AmazonEKS_EBS_CSI_DriverRole-${CLUSTER_NAME} \
        --attach-policy-arn=arn:aws:iam::${AWS_ACCOUNT_ID}:policy/AmazonEKS_EBS_CSI_Driver_Policy-${CLUSTER_NAME} \
        --approve \
        --override-existing-serviceaccounts
    
    # EBS CSI 드라이버 addon 설치
    eksctl create addon \
        --cluster=$CLUSTER_NAME \
        --name=aws-ebs-csi-driver \
        --version=latest \
        --service-account-role-arn=arn:aws:iam::${AWS_ACCOUNT_ID}:role/AmazonEKS_EBS_CSI_DriverRole-${CLUSTER_NAME} \
        --force
    
    # 설치 완료 대기
    log "⏳ EBS CSI 드라이버 설치 완료 대기 중 (30초)..."
    sleep 30
    
    # 정리 (로컬 파일은 삭제하지 않음)
    # rm -f ebs_csi_policy.json
    
    log "✅ EBS CSI 드라이버 설치 완료"
else
    log "✅ EBS CSI 드라이버가 이미 설치되어 있습니다."
fi

# StorageClass 확인 및 생성
if ! kubectl get storageclass gp3 &>/dev/null; then
    log "💾 gp3 StorageClass 생성 중..."
    cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  fsType: ext4
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Delete
EOF
    
    # 기존 gp2를 기본에서 제거
    kubectl patch storageclass gp2 -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}' 2>/dev/null || true
    
    log "✅ gp3 StorageClass 생성 완료"
fi

# ========================================
# STEP 5: Docker 이미지 빌드 및 ECR 푸시
# ========================================
log "${GREEN}[5/8] 🐳 Docker 이미지 빌드 및 ECR 푸시${NC}"

# 프로젝트 루트로 이동
cd "$PROJECT_ROOT"

# TypeScript 컴파일 (로컬에서 먼저 빌드)
log "🔨 TypeScript 컴파일 중..."
npm run build
if [ $? -ne 0 ]; then
    log "${RED}❌ TypeScript 컴파일 실패!${NC}"
    exit 1
fi

# Docker 이미지 빌드
log "🐳 Docker 이미지 빌드 중..."
docker buildx build --platform linux/amd64 -t $ECR_REPOSITORY . --load --no-cache
if [ $? -ne 0 ]; then
    log "${RED}❌ Docker 이미지 빌드 실패!${NC}"
    exit 1
fi

# 태그 생성
TIMESTAMP=$(date +%Y%m%d%H%M%S)
docker tag $ECR_REPOSITORY:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$TIMESTAMP
docker tag $ECR_REPOSITORY:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest

# ECR에 푸시
log "📤 ECR에 푸시 중..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$TIMESTAMP
if [ $? -ne 0 ]; then
    log "${RED}❌ Docker 이미지 푸시 실패 (timestamp)!${NC}"
    exit 1
fi

docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest
if [ $? -ne 0 ]; then
    log "${RED}❌ Docker 이미지 푸시 실패 (latest)!${NC}"
    exit 1
fi

log "✅ 이미지 푸시 완료!"
log "🏷️  태그: $TIMESTAMP, latest"

# 타임스탬프를 파일로 저장 (Helm에서 사용)
echo $TIMESTAMP > "$PROJECT_ROOT/.last-image-tag"

((CURRENT_STEP++))
show_progress $CURRENT_STEP $TOTAL_STEPS
show_timer $START_TIME
echo ""

# ========================================
# STEP 6: 네임스페이스 및 시크릿 생성
# ========================================
log "${GREEN}[6/8] 🔐 네임스페이스 및 시크릿 설정${NC}"

# 네임스페이스 생성 (기본값 사용)
NAMESPACE="default"
kubectl create namespace $NAMESPACE 2>/dev/null || true

# ConfigMap 생성 (환경 변수)
kubectl create configmap ${HELM_RELEASE_NAME}-config \
    --from-env-file="$ENV_FILE" \
    --namespace=$NAMESPACE \
    --dry-run=client -o yaml | kubectl apply -f -

log "✅ ConfigMap 생성 완료"

# Secret 생성 (민감한 데이터)
log "🔐 Backend Secrets 생성 중..."
kubectl create secret generic backend-secrets \
    --from-literal=database-url="${DATABASE_URL}" \
    --from-literal=jwt-secret="${JWT_SECRET}" \
    --from-literal=session-secret="${SESSION_SECRET}" \
    --namespace=$NAMESPACE \
    --dry-run=client -o yaml | kubectl apply -f -

log "✅ Backend Secrets 생성 완료"

# imagePullSecrets 설정 (ECR 인증용)
kubectl create secret docker-registry ecr-secret \
    --docker-server=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com \
    --docker-username=AWS \
    --docker-password=$(aws ecr get-login-password --region ${AWS_REGION}) \
    --namespace=$NAMESPACE \
    --dry-run=client -o yaml | kubectl apply -f -

log "✅ ECR 인증 시크릿 생성 완료"

((CURRENT_STEP++))
show_progress $CURRENT_STEP $TOTAL_STEPS
show_timer $START_TIME
echo ""

# ========================================
# STEP 7: Helm 차트 배포
# ========================================
log "${GREEN}[7/8] 📦 Helm 차트 배포${NC}"

# Helm values 파일 경로
HELM_VALUES_FILE="$PROJECT_ROOT/infrastructure/helm/biocom-api/values-${ENVIRONMENT}.yaml"

if [ ! -f "$HELM_VALUES_FILE" ]; then
    log "${RED}❌ Helm values 파일을 찾을 수 없습니다: $HELM_VALUES_FILE${NC}"
    exit 1
fi

# 이미지 태그 읽기
if [ -f "$PROJECT_ROOT/.last-image-tag" ]; then
    IMAGE_TAG=$(cat "$PROJECT_ROOT/.last-image-tag")
else
    IMAGE_TAG="latest"
fi

# Helm 배포/업그레이드
log "📦 Helm 차트 배포 중..."
helm upgrade --install $HELM_RELEASE_NAME \
    "$PROJECT_ROOT/infrastructure/helm/biocom-api" \
    --namespace $NAMESPACE \
    --values "$HELM_VALUES_FILE" \
    --set image.repository="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}" \
    --set image.tag="${IMAGE_TAG}" \
    --set ingress.acmCertificateArn="${ACM_CERTIFICATE_ARN}" \
    --set ingress.host="${INGRESS_HOST}" \
    --wait \
    --timeout 10m

if [ $? -ne 0 ]; then
    log "${RED}❌ Helm 배포 실패!${NC}"
    
    # 디버깅 정보 출력
    log "${YELLOW}Pod 상태 확인:${NC}"
    kubectl get pods -n $NAMESPACE -l app=${HELM_RELEASE_NAME}
    
    log "${YELLOW}최근 이벤트:${NC}"
    kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -20
    
    exit 1
fi

log "✅ Helm 배포 완료!"

((CURRENT_STEP++))
show_progress $CURRENT_STEP $TOTAL_STEPS
show_timer $START_TIME
echo ""

# ========================================
# STEP 8: 배포 확인
# ========================================
log "${GREEN}[8/8] ✅ 배포 확인${NC}"

# Pod 상태 확인
log "🔍 Pod 상태 확인 중..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=${HELM_RELEASE_NAME} -n $NAMESPACE --timeout=300s

# Service 확인
log "🔍 Service 상태:"
kubectl get svc -n $NAMESPACE

# Ingress 확인
log "🔍 Ingress 상태:"
kubectl get ingress -n $NAMESPACE

# ALB DNS 가져오기
ALB_DNS=$(kubectl get ingress ${HELM_RELEASE_NAME} -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)

# 완료 시간 계산
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
TOTAL_MINUTES=$((TOTAL_TIME / 60))
TOTAL_SECONDS=$((TOTAL_TIME % 60))

# 최종 결과 출력
echo ""
echo ""
log "${GREEN}🎉 배포가 완료되었습니다! 🎉${NC}"
log ""
log "📊 배포 정보:"
log "  환경: ${YELLOW}${ENVIRONMENT}${NC}"
log "  클러스터: ${YELLOW}${CLUSTER_NAME}${NC}"
log "  이미지 태그: ${YELLOW}${IMAGE_TAG}${NC}"
log "  소요 시간: ${YELLOW}${TOTAL_MINUTES}분 ${TOTAL_SECONDS}초${NC}"
log ""

if [ ! -z "$ALB_DNS" ]; then
    log "🌐 ALB 엔드포인트: ${YELLOW}https://${ALB_DNS}${NC}"
    log ""
    log "🔍 헬스체크 (약 2-3분 후):"
    log "  curl https://${ALB_DNS}/api/health"
    log ""
fi

if [ ! -z "$INGRESS_HOST" ]; then
    log "🌐 도메인 설정:"
    log "  ${YELLOW}${INGRESS_HOST}${NC} → ${YELLOW}${ALB_DNS}${NC}"
    log "  DNS에 CNAME 레코드를 추가하세요."
    log ""
fi

log "📝 로그 파일: ${LOG_FILE}"
log ""
log "${GREEN}✨ 배포 완료! ✨${NC}"