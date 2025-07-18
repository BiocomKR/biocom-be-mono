#!/bin/bash
# 🚀 처음부터 끝까지 한 번에 배포 (클러스터 생성 포함) - 최종 개선 버전
# 
# 목표: 아무것도 모르는 사람도 이 스크립트 하나만 실행하면 모든게 자동으로 처리됨
# 수동 개입 절대 불필요 - 권한 문제 시 명확히 안내

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

# 로그 디렉토리 생성
LOG_DIR="$PROJECT_ROOT/.deployment-logs"
mkdir -p "$LOG_DIR"

# 로그 파일 경로 설정
LOG_FILE="$LOG_DIR/deployment-$(date +%Y%m%d-%H%M%S).log"

# 로깅 함수
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

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

# IAM 권한 검증 함수
check_iam_permissions() {
    local missing_permissions=()
    
    log "🔍 IAM 권한 확인 중..."
    
    # 필수 권한 목록
    local required_permissions=(
        "iam:ListOpenIDConnectProviders"
        "iam:ListPolicies"
        "iam:ListPolicyVersions"
        "iam:CreatePolicyVersion"
        "iam:DeletePolicyVersion"
        "iam:GetPolicy"
        "iam:CreatePolicy"
    )
    
    # 간단한 권한 테스트
    if ! aws iam list-policies --max-items 1 &>/dev/null; then
        missing_permissions+=("iam:ListPolicies")
    fi
    
    if ! aws iam list-open-id-connect-providers &>/dev/null; then
        missing_permissions+=("iam:ListOpenIDConnectProviders")
    fi
    
    # 누락된 권한이 있으면 안내
    if [ ${#missing_permissions[@]} -gt 0 ]; then
        log "${RED}❌ IAM 권한이 부족합니다!${NC}"
        log "${YELLOW}다음 권한들이 필요합니다:${NC}"
        for perm in "${missing_permissions[@]}"; do
            log "  - $perm"
        done
        log ""
        log "${YELLOW}해결 방법:${NC}"
        log "1. AWS 콘솔에서 IAM 정책에 위 권한들을 추가하세요"
        log "2. 또는 AdministratorAccess 권한을 임시로 부여하세요"
        log ""
        log "${RED}권한 추가 후 다시 실행해주세요.${NC}"
        exit 1
    fi
    
    log "${GREEN}✅ IAM 권한 확인 완료${NC}"
}

# 시작 시간 기록
START_TIME=$(date +%s)
TOTAL_STEPS=8
CURRENT_STEP=0

echo ""
log "${BLUE}🚀 ALL-IN-ONE 배포를 시작합니다...${NC}"
log "${YELLOW}📝 로그 저장 위치: .deployment-logs/${NC}"
echo ""

# ========================================
# STEP 0: 필수 도구 확인 및 자동 설치
# ========================================
log "${GREEN}[0/8] 🔧 필수 도구 확인 및 설치${NC}"

# 도구 설치 함수
install_tool() {
    local tool=$1
    local install_cmd=$2
    
    if ! command -v $tool &> /dev/null; then
        log "${YELLOW}⚠️  $tool이(가) 설치되어 있지 않습니다. 자동으로 설치합니다...${NC}"
        eval $install_cmd
        if [ $? -eq 0 ]; then
            log "${GREEN}✅ $tool 설치 완료!${NC}"
        else
            log "${RED}❌ $tool 설치 실패! 수동으로 설치해주세요.${NC}"
            exit 1
        fi
    else
        log "✅ $tool 확인됨"
    fi
}

# OS 감지
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if ! command -v brew &> /dev/null; then
        log "${YELLOW}⚠️  Homebrew가 없습니다. 설치합니다...${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    install_tool "aws" "brew install awscli"
    install_tool "docker" "brew install --cask docker && open -a Docker && sleep 30"
    install_tool "kubectl" "brew install kubectl"
    install_tool "eksctl" "brew tap weaveworks/tap && brew install weaveworks/tap/eksctl"
    install_tool "helm" "brew install helm"
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    install_tool "aws" "curl \"https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip\" -o \"awscliv2.zip\" && unzip awscliv2.zip && sudo ./aws/install"
    install_tool "docker" "curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh"
    install_tool "kubectl" "curl -LO \"https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl\" && sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl"
    install_tool "eksctl" "curl --silent --location \"https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz\" | tar xz -C /tmp && sudo mv /tmp/eksctl /usr/local/bin"
    install_tool "helm" "curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash"
fi

# Docker 실행 확인
if ! docker info &>/dev/null; then
    log "${RED}❌ Docker가 실행되고 있지 않습니다!${NC}"
    log "Docker Desktop을 실행하고 다시 시도해주세요."
    exit 1
fi

echo ""

# ========================================
# STEP 0.5: IAM 권한 확인
# ========================================
check_iam_permissions

# ========================================
# STEP 1: 환경 설정 확인
# ========================================
log "${GREEN}[1/8] 🔍 환경 설정 확인${NC}"

# .env.eks 파일 확인
if [ ! -f "$PROJECT_ROOT/.env.eks" ]; then
    log "${RED}❌ .env.eks 파일이 없습니다!${NC}"
    log "📝 .env.eks 파일을 생성하고 필요한 값을 입력해주세요:"
    cat << EOF
# AWS 설정
AWS_ACCOUNT_ID=your-account-id
AWS_REGION=ap-northeast-2

# 클러스터 설정
CLUSTER_NAME=biocom-cluster
INSTANCE_TYPE=t3.medium
NODE_COUNT=2
NODE_GROUP_NAME=backend-nodes

# ECR 설정
ECR_REPOSITORY=backend-v2

# Helm 설정
HELM_RELEASE_NAME=temp-backend

# 데이터베이스 URL
DATABASE_URL=postgresql://username:password@host:5432/dbname

# 보안 키 (프로덕션에서는 반드시 변경)
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret
EOF
    exit 1
fi

# 환경 변수 로드
source "$PROJECT_ROOT/.env.eks"

# 필수 환경 변수 확인
REQUIRED_VARS=("AWS_ACCOUNT_ID" "AWS_REGION" "CLUSTER_NAME" "ECR_REPOSITORY" "DATABASE_URL")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        log "${RED}❌ 환경 변수 $var가 설정되지 않았습니다!${NC}"
        exit 1
    fi
done

log "✅ 모든 환경 변수가 설정되었습니다."

# AWS 자격 증명 확인
if ! aws sts get-caller-identity &>/dev/null; then
    log "${RED}❌ AWS 자격 증명이 설정되지 않았습니다!${NC}"
    log "aws configure를 실행하여 설정해주세요."
    exit 1
fi

ACTUAL_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ "$ACTUAL_ACCOUNT_ID" != "$AWS_ACCOUNT_ID" ]; then
    log "${RED}❌ AWS 계정 ID가 일치하지 않습니다!${NC}"
    log "설정된 ID: $AWS_ACCOUNT_ID"
    log "실제 ID: $ACTUAL_ACCOUNT_ID"
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
if ! aws ecr describe-repositories --repository-names ${ECR_REPOSITORY} --region ${AWS_REGION} 2>/dev/null; then
    log "📦 ECR 리포지토리 생성 중..."
    aws ecr create-repository \
        --repository-name ${ECR_REPOSITORY} \
        --region ${AWS_REGION} \
        --image-scanning-configuration scanOnPush=true
    
    if [ $? -ne 0 ]; then
        log "${RED}❌ ECR 리포지토리 생성 실패!${NC}"
        exit 1
    fi
    log "${GREEN}✅ ECR 리포지토리 생성 완료!${NC}"
else
    log "✅ ECR 리포지토리가 이미 존재합니다."
fi

# Docker 로그인
log "🔐 ECR 로그인 중..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

if [ $? -ne 0 ]; then
    log "${RED}❌ ECR 로그인 실패!${NC}"
    exit 1
fi

((CURRENT_STEP++))
show_progress $CURRENT_STEP $TOTAL_STEPS
show_timer $START_TIME
echo ""

# ========================================
# STEP 3: EKS 클러스터 확인 및 생성
# ========================================
log "${GREEN}[3/8] ☸️ EKS 클러스터 확인${NC}"

# 클러스터 존재 확인
CLUSTER_EXISTS=false
if eksctl get cluster --name ${CLUSTER_NAME} --region ${AWS_REGION} 2>/dev/null; then
    CLUSTER_EXISTS=true
    log "✅ 기존 클러스터를 사용합니다: ${CLUSTER_NAME}"
    
    # kubeconfig 업데이트
    aws eks update-kubeconfig --name ${CLUSTER_NAME} --region ${AWS_REGION}
    
    # 노드 상태 확인
    log "📊 노드 상태 확인 중..."
    kubectl get nodes
else
    log "🚀 새 클러스터를 생성합니다: ${CLUSTER_NAME}"
    log "${YELLOW}⏱️  약 15-20분 소요됩니다...${NC}"
    
    # eksctl로 클러스터 생성
    eksctl create cluster \
      --name ${CLUSTER_NAME} \
      --region ${AWS_REGION} \
      --nodegroup-name ${NODE_GROUP_NAME:-backend-nodes} \
      --node-type ${NODE_INSTANCE_TYPE:-t3.medium} \
      --nodes ${NODE_DESIRED_SIZE:-2} \
      --nodes-min ${NODE_MIN_SIZE:-1} \
      --nodes-max ${NODE_MAX_SIZE:-4} \
      --managed \
      --with-oidc \
      --version 1.30
    
    if [ $? -ne 0 ]; then
        log "${RED}❌ 클러스터 생성 실패!${NC}"
        exit 1
    fi
    
    log "${GREEN}✅ 클러스터 생성 완료!${NC}"
    
    # kubeconfig 업데이트
    aws eks update-kubeconfig --name ${CLUSTER_NAME} --region ${AWS_REGION}
fi

((CURRENT_STEP++))
show_progress $CURRENT_STEP $TOTAL_STEPS
show_timer $START_TIME
echo ""

# ========================================
# STEP 3.3: EBS CSI Driver 설치 (PVC를 위해 필수)
# ========================================
log "${GREEN}[3.3/8] 💾 EBS CSI Driver 설치${NC}"

# EBS CSI Driver addon 확인
log "🔍 EBS CSI Driver 확인 중..."
if ! eksctl get addon --name aws-ebs-csi-driver --cluster ${CLUSTER_NAME} --region ${AWS_REGION} 2>/dev/null | grep -q "ACTIVE"; then
    log "📦 EBS CSI Driver 설치 중..."
    
    # EBS CSI Driver를 위한 IAM 역할 생성
    eksctl create iamserviceaccount \
        --name ebs-csi-controller-sa \
        --namespace kube-system \
        --cluster ${CLUSTER_NAME} \
        --region ${AWS_REGION} \
        --role-name AmazonEKS_EBS_CSI_DriverRole-${CLUSTER_NAME} \
        --role-only \
        --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
        --approve
    
    # EBS CSI Driver addon 설치
    eksctl create addon \
        --name aws-ebs-csi-driver \
        --cluster ${CLUSTER_NAME} \
        --region ${AWS_REGION} \
        --service-account-role-arn arn:aws:iam::${AWS_ACCOUNT_ID}:role/AmazonEKS_EBS_CSI_DriverRole-${CLUSTER_NAME} \
        --force
    
    if [ $? -ne 0 ]; then
        log "${RED}❌ EBS CSI Driver 설치 실패!${NC}"
        exit 1
    fi
    
    log "${GREEN}✅ EBS CSI Driver 설치 완료!${NC}"
    
    # Driver가 준비될 때까지 대기
    log "⏳ EBS CSI Driver 시작 대기 중..."
    sleep 30
else
    log "✅ EBS CSI Driver가 이미 설치되어 있습니다."
fi

# ========================================
# STEP 3.5: AWS Load Balancer Controller 설치
# ========================================
log "${GREEN}[3.5/8] 🎮 AWS Load Balancer Controller 설정${NC}"

# OIDC 프로바이더 확인
log "🔐 OIDC 프로바이더 확인 중..."
OIDC_ID=$(aws eks describe-cluster --name ${CLUSTER_NAME} --region ${AWS_REGION} --query "cluster.identity.oidc.issuer" --output text | cut -d '/' -f 5)

if [ -z "$OIDC_ID" ]; then
    log "${RED}❌ OIDC ID를 가져올 수 없습니다!${NC}"
    exit 1
fi

if ! aws iam list-open-id-connect-providers | grep -q $OIDC_ID; then
    log "🔐 OIDC 프로바이더 생성 중..."
    eksctl utils associate-iam-oidc-provider --cluster ${CLUSTER_NAME} --region ${AWS_REGION} --approve
    if [ $? -ne 0 ]; then
        log "${RED}❌ OIDC 프로바이더 생성 실패!${NC}"
        exit 1
    fi
    log "${GREEN}✅ OIDC 프로바이더 생성 완료!${NC}"
    sleep 5  # AWS 반영 대기
else
    log "✅ OIDC 프로바이더가 이미 존재합니다."
fi

# IAM 정책 확인 및 업데이트
log "📋 IAM 정책 확인 중..."
POLICY_EXISTS=$(aws iam list-policies --query "Policies[?PolicyName=='AWSLoadBalancerControllerIAMPolicy'].Arn" --output text)

# 최신 정책 다운로드
log "📥 최신 IAM 정책 다운로드 중..."
curl -sSL -o /tmp/iam_policy_latest.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.9.0/docs/install/iam_policy.json

if [ -z "$POLICY_EXISTS" ]; then
    log "📦 IAM 정책 생성 중..."
    aws iam create-policy \
        --policy-name AWSLoadBalancerControllerIAMPolicy \
        --policy-document file:///tmp/iam_policy_latest.json \
        --region ${AWS_REGION}
        
    if [ $? -ne 0 ]; then
        log "${RED}❌ IAM 정책 생성 실패!${NC}"
        exit 1
    fi
    log "${GREEN}✅ IAM 정책 생성 완료!${NC}"
    POLICY_EXISTS=$(aws iam list-policies --query "Policies[?PolicyName=='AWSLoadBalancerControllerIAMPolicy'].Arn" --output text)
else
    log "✅ IAM 정책이 이미 존재합니다."
    
    # 정책 업데이트 시도
    log "🔄 IAM 정책 업데이트 확인 중..."
    
    # 정책 버전 확인
    POLICY_VERSIONS=$(aws iam list-policy-versions --policy-arn $POLICY_EXISTS --query 'Versions[*].VersionId' --output text 2>&1)
    
    if [[ "$POLICY_VERSIONS" == *"AccessDenied"* ]]; then
        log "${YELLOW}⚠️  IAM 정책 버전 확인 권한이 없습니다.${NC}"
        log "${YELLOW}필요한 권한: iam:ListPolicyVersions, iam:CreatePolicyVersion, iam:DeletePolicyVersion${NC}"
        log "${YELLOW}권한이 없어도 기존 정책으로 진행합니다.${NC}"
    else
        VERSION_COUNT=$(echo $POLICY_VERSIONS | wc -w)
        
        # 버전이 5개면 가장 오래된 것 삭제
        if [ $VERSION_COUNT -ge 5 ]; then
            log "🗑️  정책 버전 한도에 도달했습니다. 오래된 버전 삭제 중..."
            
            # 기본 버전이 아닌 가장 오래된 버전 찾기
            OLD_VERSION=$(aws iam list-policy-versions --policy-arn $POLICY_EXISTS \
                --query 'Versions[?!IsDefaultVersion] | [0].VersionId' --output text)
            
            if [ "$OLD_VERSION" != "None" ] && [ ! -z "$OLD_VERSION" ]; then
                aws iam delete-policy-version --policy-arn $POLICY_EXISTS --version-id $OLD_VERSION
                if [ $? -eq 0 ]; then
                    log "✅ 오래된 버전 $OLD_VERSION 삭제 완료"
                fi
            fi
        fi
        
        # 새 버전 생성 시도
        log "📝 IAM 정책 새 버전 생성 중..."
        UPDATE_RESULT=$(aws iam create-policy-version \
            --policy-arn $POLICY_EXISTS \
            --policy-document file:///tmp/iam_policy_latest.json \
            --set-as-default 2>&1)
        
        if [[ "$UPDATE_RESULT" == *"AccessDenied"* ]]; then
            log "${YELLOW}⚠️  IAM 정책 업데이트 권한이 없습니다.${NC}"
            log "${YELLOW}기존 정책으로 진행합니다.${NC}"
        elif [[ "$UPDATE_RESULT" == *"already exists"* ]]; then
            log "✅ IAM 정책이 이미 최신 버전입니다."
        else
            log "${GREEN}✅ IAM 정책 업데이트 완료!${NC}"
            POLICY_UPDATED=true
        fi
    fi
fi

# ServiceAccount 확인 및 생성
log "👤 ServiceAccount 확인 중..."
if ! kubectl get sa aws-load-balancer-controller -n kube-system &>/dev/null; then
    log "📦 ServiceAccount 생성 중..."
    
    # eksctl로 ServiceAccount 생성 (재시도 로직 포함)
    for attempt in {1..3}; do
        eksctl create iamserviceaccount \
          --cluster=${CLUSTER_NAME} \
          --namespace=kube-system \
          --name=aws-load-balancer-controller \
          --role-name AmazonEKSLoadBalancerControllerRole-${CLUSTER_NAME} \
          --attach-policy-arn=arn:aws:iam::${AWS_ACCOUNT_ID}:policy/AWSLoadBalancerControllerIAMPolicy \
          --approve \
          --region ${AWS_REGION} \
          --override-existing-serviceaccounts
          
        if [ $? -eq 0 ]; then
            log "${GREEN}✅ ServiceAccount 생성 완료!${NC}"
            break
        else
            log "${YELLOW}⚠️  ServiceAccount 생성 실패 (시도 $attempt/3)${NC}"
            if [ $attempt -eq 3 ]; then
                log "${RED}❌ ServiceAccount 생성 최종 실패!${NC}"
                exit 1
            fi
            sleep 10
        fi
    done
else
    log "✅ ServiceAccount가 이미 존재합니다."
    
    # 기존 ServiceAccount의 annotation 확인
    SA_ANNOTATION=$(kubectl get sa aws-load-balancer-controller -n kube-system -o jsonpath='{.metadata.annotations.eks\.amazonaws\.com/role-arn}')
    if [ -z "$SA_ANNOTATION" ]; then
        log "${YELLOW}⚠️  ServiceAccount에 IAM 역할이 연결되지 않았습니다. 재생성합니다...${NC}"
        kubectl delete sa aws-load-balancer-controller -n kube-system
        
        eksctl create iamserviceaccount \
          --cluster=${CLUSTER_NAME} \
          --namespace=kube-system \
          --name=aws-load-balancer-controller \
          --role-name AmazonEKSLoadBalancerControllerRole-${CLUSTER_NAME} \
          --attach-policy-arn=arn:aws:iam::${AWS_ACCOUNT_ID}:policy/AWSLoadBalancerControllerIAMPolicy \
          --approve \
          --region ${AWS_REGION} \
          --override-existing-serviceaccounts
    fi
fi

# AWS Load Balancer Controller 설치/업데이트
log "🚀 AWS Load Balancer Controller 설치/업데이트 중..."

# Helm repo 추가 및 업데이트
helm repo add eks https://aws.github.io/eks-charts &>/dev/null || true
helm repo update &>/dev/null

# VPC ID 가져오기
VPC_ID=$(aws eks describe-cluster --name ${CLUSTER_NAME} --region ${AWS_REGION} --query 'cluster.resourcesVpcConfig.vpcId' --output text)

if [ -z "$VPC_ID" ]; then
    log "${RED}❌ VPC ID를 가져올 수 없습니다!${NC}"
    exit 1
fi

# Controller 설치 또는 업그레이드
if helm list -n kube-system | grep -q aws-load-balancer-controller; then
    log "🔄 기존 AWS Load Balancer Controller 업그레이드 중..."
    helm upgrade aws-load-balancer-controller eks/aws-load-balancer-controller \
      -n kube-system \
      --set clusterName=${CLUSTER_NAME} \
      --set serviceAccount.create=false \
      --set serviceAccount.name=aws-load-balancer-controller \
      --set region=${AWS_REGION} \
      --set vpcId=${VPC_ID} \
      --set enableServiceMutatorWebhook=false \
      --wait
else
    log "📦 AWS Load Balancer Controller 신규 설치 중..."
    helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
      -n kube-system \
      --set clusterName=${CLUSTER_NAME} \
      --set serviceAccount.create=false \
      --set serviceAccount.name=aws-load-balancer-controller \
      --set region=${AWS_REGION} \
      --set vpcId=${VPC_ID} \
      --set enableServiceMutatorWebhook=false \
      --wait
fi

if [ $? -ne 0 ]; then
    log "${RED}❌ AWS Load Balancer Controller 설치/업그레이드 실패!${NC}"
    log "디버깅 정보:"
    kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller --tail=20
    exit 1
fi

# Controller 실행 확인
log "⏳ AWS Load Balancer Controller 시작 대기 중..."
for i in {1..30}; do
    if kubectl get deployment -n kube-system aws-load-balancer-controller &>/dev/null; then
        READY=$(kubectl get deployment -n kube-system aws-load-balancer-controller -o jsonpath='{.status.readyReplicas}')
        if [ "$READY" -ge "1" ]; then
            log "${GREEN}✅ AWS Load Balancer Controller가 정상 작동 중입니다!${NC}"
            break
        fi
    fi
    echo -n "."
    sleep 5
done

# 최종 상태 확인
kubectl get deployment -n kube-system aws-load-balancer-controller
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller

# 정책이 업데이트된 경우 Controller 재시작
if [ "$POLICY_UPDATED" == "true" ]; then
    log "🔄 정책이 업데이트되어 Controller를 재시작합니다..."
    kubectl rollout restart deployment/aws-load-balancer-controller -n kube-system
    kubectl rollout status deployment/aws-load-balancer-controller -n kube-system
fi

# IngressClass 확인 및 설정
log "🔍 IngressClass 확인 중..."
if ! kubectl get ingressclass alb &>/dev/null; then
    log "${YELLOW}⚠️  ALB IngressClass가 없습니다. 기다리는 중...${NC}"
    # Controller가 자동으로 생성하므로 잠시 대기
    sleep 10
fi

# IngressClass 다시 확인
if kubectl get ingressclass alb &>/dev/null; then
    log "${GREEN}✅ ALB IngressClass가 준비되었습니다!${NC}"
    kubectl get ingressclass
else
    log "${YELLOW}⚠️  IngressClass가 아직 생성되지 않았습니다. 배포 후 확인이 필요합니다.${NC}"
fi

((CURRENT_STEP++))
show_progress $CURRENT_STEP $TOTAL_STEPS
show_timer $START_TIME
echo ""

# ========================================
# STEP 4: Secret 확인 및 생성
# ========================================
log "${GREEN}[4/8] 🔐 Kubernetes Secret 확인${NC}"

if ! kubectl get secret backend-secrets 2>/dev/null; then
    log "📦 Secret 생성 중..."
    kubectl create secret generic backend-secrets \
      --from-literal=database-url="${DATABASE_URL}" \
      --from-literal=jwt-secret="${JWT_SECRET:-dev-jwt-secret-change-in-production}" \
      --from-literal=session-secret="${SESSION_SECRET:-dev-session-secret-change-in-production}"
    log "${GREEN}✅ Secret 생성 완료!${NC}"
else
    log "✅ Secret이 이미 존재합니다."
fi

((CURRENT_STEP++))
show_progress $CURRENT_STEP $TOTAL_STEPS
show_timer $START_TIME
echo ""

# ========================================
# STEP 5: Docker 빌드 및 ECR 푸시
# ========================================
log "${GREEN}[5/8] 🐳 Docker 이미지 빌드 및 ECR 푸시${NC}"

# 기존 배포 정보 저장 (롤백용)
PREVIOUS_IMAGE=""
if helm list | grep -q "$RELEASE_NAME"; then
    PREVIOUS_IMAGE=$(kubectl get deployment ${RELEASE_NAME} -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "")
    if [ ! -z "$PREVIOUS_IMAGE" ]; then
        log "📷 현재 이미지 백업: $PREVIOUS_IMAGE"
    fi
fi

# Docker 빌드 및 푸시
"$SCRIPT_DIR/docker-ecr-push.sh"
if [ $? -ne 0 ]; then
    log "${RED}❌ Docker 이미지 빌드/푸시 실패!${NC}"
    exit 1
fi

((CURRENT_STEP++))
show_progress $CURRENT_STEP $TOTAL_STEPS
show_timer $START_TIME
echo ""

# ========================================
# STEP 6: Helm 배포
# ========================================
log "${GREEN}[6/8] 📦 Kubernetes에 배포${NC}"

# 배포 전 상태 저장
DEPLOYMENT_FAILED=false

if helm list | grep -q "$RELEASE_NAME"; then
    log "기존 배포 업그레이드..."
    "$SCRIPT_DIR/helm-deploy.sh" dev upgrade
    HELM_RESULT=$?
else
    log "신규 배포 설치..."
    "$SCRIPT_DIR/helm-deploy.sh" dev install
    HELM_RESULT=$?
fi

if [ $HELM_RESULT -ne 0 ]; then
    DEPLOYMENT_FAILED=true
    log "${RED}❌ Helm 배포 실패!${NC}"
    
    # 롤백 시도
    if [ ! -z "$PREVIOUS_IMAGE" ]; then
        log "${YELLOW}⏪ 이전 버전으로 롤백 시도 중...${NC}"
        helm rollback $RELEASE_NAME 0
        if [ $? -eq 0 ]; then
            log "${GREEN}✅ 롤백 성공!${NC}"
        else
            log "${RED}❌ 롤백도 실패했습니다. 수동 확인이 필요합니다.${NC}"
        fi
    fi
    exit 1
fi

((CURRENT_STEP++))
show_progress $CURRENT_STEP $TOTAL_STEPS
show_timer $START_TIME
echo ""

# ========================================
# STEP 7: 배포 확인
# ========================================
log "${GREEN}[7/8] 🔍 배포 상태 확인${NC}"

# Pod가 Running 상태가 될 때까지 대기
log "⏳ Pod가 준비될 때까지 대기 중..."
for i in {1..60}; do
    POD_STATUS=$(kubectl get pods -l app.kubernetes.io/instance=$RELEASE_NAME -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "Pending")
    if [ "$POD_STATUS" == "Running" ]; then
        log "${GREEN}✅ Pod가 Running 상태입니다!${NC}"
        break
    elif [ "$POD_STATUS" == "Error" ] || [ "$POD_STATUS" == "CrashLoopBackOff" ]; then
        log "${RED}❌ Pod가 에러 상태입니다!${NC}"
        kubectl describe pod -l app.kubernetes.io/instance=$RELEASE_NAME
        DEPLOYMENT_FAILED=true
        break
    fi
    echo -n "."
    sleep 5
done

if [ "$DEPLOYMENT_FAILED" == "true" ]; then
    log "${RED}❌ 배포 확인 실패! 로그를 확인해주세요.${NC}"
    kubectl logs -l app.kubernetes.io/instance=$RELEASE_NAME --tail=50
    exit 1
fi

((CURRENT_STEP++))
show_progress $CURRENT_STEP $TOTAL_STEPS
show_timer $START_TIME
echo ""

# ========================================
# STEP 8: 결과 출력
# ========================================
log "${GREEN}[8/8] 📊 배포 결과${NC}"

echo ""
log "${GREEN}✅ 배포가 성공적으로 완료되었습니다!${NC}"
echo ""

# 최종 상태 표시
log "${BLUE}=== 현재 상태 ===${NC}"
echo ""
log "${YELLOW}📦 Pods:${NC}"
kubectl get pods -l app.kubernetes.io/instance=$RELEASE_NAME
echo ""
log "${YELLOW}🌐 Services:${NC}"
kubectl get svc -l app.kubernetes.io/instance=$RELEASE_NAME
echo ""
log "${YELLOW}🔗 Ingress:${NC}"
kubectl get ingress

# ALB 주소 확인 (여러 Ingress 이름 시도)
log "${YELLOW}🔍 ALB 주소 확인 중...${NC}"
ALB_ADDRESS=""

# 가능한 Ingress 이름들 확인
for ingress_name in "${RELEASE_NAME}-ingress" "${RELEASE_NAME}-backend-api" "backend-api-ingress"; do
    ALB_ADDRESS=$(kubectl get ingress ${ingress_name} -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
    if [ ! -z "$ALB_ADDRESS" ]; then
        break
    fi
done

# 모든 Ingress 확인
if [ -z "$ALB_ADDRESS" ]; then
    INGRESS_NAME=$(kubectl get ingress -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ ! -z "$INGRESS_NAME" ]; then
        ALB_ADDRESS=$(kubectl get ingress ${INGRESS_NAME} -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
    fi
fi

if [ ! -z "$ALB_ADDRESS" ]; then
    echo ""
    log "${GREEN}🎉 애플리케이션 접속 주소:${NC}"
    log "${BLUE}   http://${ALB_ADDRESS}${NC}"
    log "${BLUE}   http://${ALB_ADDRESS}/api/docs (Swagger)${NC}"
else
    echo ""
    log "${YELLOW}💡 ALB가 프로비저닝 중입니다...${NC}"
    
    # AWS Load Balancer Controller 로그 확인
    CONTROLLER_POD=$(kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ ! -z "$CONTROLLER_POD" ]; then
        log "🔍 Controller 상태 확인:"
        kubectl logs -n kube-system $CONTROLLER_POD --tail=10 | grep -E "(error|warn|ingress)" || true
    fi
    
    log ""
    log "${YELLOW}ALB 생성에는 2-5분이 소요됩니다. 다음 명령어로 확인하세요:${NC}"
    log "   kubectl get ingress -w  # 실시간 모니터링"
    log "   kubectl describe ingress  # 상세 정보 확인"
    
    # IngressClass 확인
    log ""
    log "${YELLOW}IngressClass 목록:${NC}"
    kubectl get ingressclass
fi

# 전체 소요 시간
TOTAL_TIME=$(($(date +%s) - START_TIME))
TOTAL_MINUTES=$((TOTAL_TIME / 60))
TOTAL_SECONDS=$((TOTAL_TIME % 60))

echo ""
log "${GREEN}⏱️  전체 소요 시간: ${TOTAL_MINUTES}분 ${TOTAL_SECONDS}초${NC}"
echo ""

# 다음 단계 안내
log "${BLUE}=== 다음 단계 ===${NC}"
log "1. 모니터링: ./scripts/2-monitor.sh"
log "2. 삭제: ./scripts/3-delete-improved.sh"
log "3. 재배포: 이 스크립트를 다시 실행하면 됩니다!"
echo ""
log "${GREEN}🎉 성공적으로 완료되었습니다!${NC}"