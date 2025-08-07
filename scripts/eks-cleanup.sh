#!/bin/bash
# 🗑️ 개발 환경 전체 삭제 (비용 절약용) - 최종 개선 버전
# ⚠️  주의: 개발 환경 전용! 운영 환경에서는 절대 실행 금지!

set -e  # 에러 발생시 즉시 중단

# jq 설치 확인
if ! command -v jq &> /dev/null; then
    echo "jq가 설치되어 있지 않습니다. 설치 중..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install jq
    else
        sudo apt-get update && sudo apt-get install -y jq
    fi
fi

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${RED}⚠️  개발 환경 전체를 삭제합니다!${NC}"
echo -e "${YELLOW}📍 삭제 대상:${NC}"
echo "   - Kubernetes 애플리케이션 (Helm 차트)"
echo "   - AWS Load Balancer Controller"
echo "   - EKS 클러스터 및 노드 그룹"
echo "   - VPC, NAT Gateway, 탄력적 IP"
echo "   - ServiceAccount 및 관련 IAM 역할"
echo ""
echo -e "${GREEN}💰 이 작업은 AWS 비용을 절약하기 위한 것입니다.${NC}"
echo ""
read -p "정말로 모든 것을 삭제하시겠습니까? (yes/no): " answer

if [ "$answer" != "yes" ]; then
    echo "취소되었습니다."
    exit 0
fi

# 스크립트의 디렉토리 찾기
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 환경 파라미터 확인
ENVIRONMENT=${1:-}

if [ -z "$ENVIRONMENT" ]; then
    echo -e "${RED}❌ 환경을 지정해주세요!${NC}"
    echo -e "사용법: $0 dev"
    echo -e "${YELLOW}⚠️  이 스크립트는 개발 환경 전용입니다${NC}"
    exit 1
fi

if [ "$ENVIRONMENT" != "dev" ]; then
    echo -e "${RED}🚨 오류: 개발 환경만 삭제 가능합니다!${NC}"
    echo -e "${RED}운영 환경 삭제는 허용되지 않습니다.${NC}"
    exit 1
fi

# 개발 환경 설정 파일 로드
ENV_FILE="$PROJECT_ROOT/.env.eks.dev"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ 개발 환경 설정 파일을 찾을 수 없습니다: $ENV_FILE${NC}"
    exit 1
fi

source "$ENV_FILE"

# AWS_ACCOUNT_ID 확인 및 설정
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "AWS_ACCOUNT_ID가 설정되지 않았습니다. 자동으로 가져오는 중..."
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    if [ -z "$AWS_ACCOUNT_ID" ]; then
        echo -e "${RED}❌ AWS 계정 ID를 가져올 수 없습니다!${NC}"
        exit 1
    fi
    echo "AWS_ACCOUNT_ID: $AWS_ACCOUNT_ID"
fi

echo -e "${BLUE}🔍 개발 환경 정보:${NC}"
echo -e "  클러스터: ${YELLOW}$CLUSTER_NAME${NC}"
echo -e "  리전: ${YELLOW}$AWS_REGION${NC}"
echo ""

# 🚨 운영 환경 보호
if [[ "$CLUSTER_NAME" == "biocom-cluster" ]] || [[ "$CLUSTER_NAME" == *"prod"* ]] || [[ "$ENV" == "production" ]]; then
    echo -e "${RED}🚨 운영 환경 삭제 시도 감지!${NC}"
    echo -e "${RED}운영 환경은 삭제할 수 없습니다.${NC}"
    echo -e "${YELLOW}현재 클러스터: $CLUSTER_NAME${NC}"
    echo -e "${YELLOW}이 스크립트는 개발 환경 전용입니다.${NC}"
    exit 1
fi

# 개발 환경인지 재확인
if [[ "$CLUSTER_NAME" != *"dev"* ]]; then
    echo -e "${YELLOW}⚠️  경고: 클러스터 이름에 'dev'가 포함되지 않았습니다.${NC}"
    echo -e "${YELLOW}클러스터 이름: $CLUSTER_NAME${NC}"
    echo -e "${RED}정말로 이 클러스터를 삭제하시겠습니까? (DELETE 입력)${NC}"
    read -r CONFIRM
    if [ "$CONFIRM" != "DELETE" ]; then
        echo "삭제가 취소되었습니다."
        exit 0
    fi
fi

# 환경변수에서 릴리즈 이름 가져오기
RELEASE_NAME="${HELM_RELEASE_NAME:-biocom-api}"

echo ""
echo -e "${BLUE}🗑️ 삭제를 시작합니다...${NC}"
echo ""

# 클러스터 존재 확인
if ! eksctl get cluster --name ${CLUSTER_NAME} --region ${AWS_REGION} 2>/dev/null; then
    echo -e "${YELLOW}⚠️  클러스터 ${CLUSTER_NAME}이(가) 존재하지 않습니다.${NC}"
    echo "삭제할 것이 없습니다."
    exit 0
fi

# kubeconfig 업데이트
echo "🔧 kubeconfig 업데이트 중..."
aws eks update-kubeconfig --name ${CLUSTER_NAME} --region ${AWS_REGION} 2>/dev/null || true

# 1. Helm 릴리즈 삭제
echo -e "${GREEN}1️⃣ Helm 애플리케이션 삭제 중...${NC}"
if helm list | grep -q $RELEASE_NAME; then
    helm uninstall $RELEASE_NAME --wait --timeout 60s || true
    echo "✅ Helm 릴리즈 삭제 완료 (또는 타임아웃)"
else
    echo "Helm 릴리즈가 없습니다."
fi

# 2. AWS Load Balancer Controller 삭제
echo ""
echo -e "${GREEN}2️⃣ AWS Load Balancer Controller 삭제 중...${NC}"
if helm list -n kube-system | grep -q aws-load-balancer-controller; then
    helm uninstall aws-load-balancer-controller -n kube-system --wait
    echo "✅ AWS Load Balancer Controller 삭제 완료"
else
    echo "AWS Load Balancer Controller가 없습니다."
fi

# 3. 남은 Kubernetes 리소스 정리
echo ""
echo -e "${GREEN}3️⃣ 남은 Kubernetes 리소스 정리 중...${NC}"

# Ingress 삭제 (ALB 정리를 위해 중요)
echo "- Ingress 삭제 중..."

# 모든 Ingress에서 finalizer 강제 제거 (한방 삭제를 위해)
echo "  Ingress finalizer 제거 중..."
kubectl get ingress -A -o json | jq -r '.items[] | select(.metadata.finalizers != null) | "\(.metadata.namespace) \(.metadata.name)"' 2>/dev/null | while read ns name; do
    echo "  - $ns/$name finalizer 제거"
    kubectl patch ingress $name -n $ns -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
done

# Ingress 삭제
kubectl delete ingress --all --all-namespaces 2>/dev/null || true

# 모든 리소스의 finalizer 강제 제거 (한방 삭제를 위해)
echo "- 모든 리소스 finalizer 제거 중..."

# PVC finalizer 제거
kubectl get pvc -A -o json | jq -r '.items[] | select(.metadata.finalizers != null) | "\(.metadata.namespace) \(.metadata.name)"' 2>/dev/null | while read ns name; do
    echo "  - PVC $ns/$name finalizer 제거"
    kubectl patch pvc $name -n $ns -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
done

# Service finalizer 제거
kubectl get svc -A -o json | jq -r '.items[] | select(.metadata.finalizers != null) | "\(.metadata.namespace) \(.metadata.name)"' 2>/dev/null | while read ns name; do
    echo "  - Service $ns/$name finalizer 제거"
    kubectl patch svc $name -n $ns -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
done

# 다른 리소스들 삭제
kubectl delete svc -l app.kubernetes.io/instance=$RELEASE_NAME --force --grace-period=0 2>/dev/null || true
kubectl delete deployment -l app.kubernetes.io/instance=$RELEASE_NAME --force --grace-period=0 2>/dev/null || true
kubectl delete pvc -l app.kubernetes.io/instance=$RELEASE_NAME --force --grace-period=0 2>/dev/null || true
kubectl delete pvc uploads-pvc --force --grace-period=0 2>/dev/null || true
kubectl delete secret backend-secrets --force --grace-period=0 2>/dev/null || true

# ServiceAccount 삭제
kubectl delete sa aws-load-balancer-controller -n kube-system 2>/dev/null || true

echo "✅ Kubernetes 리소스 정리 완료"

# 4. ALB 수동 삭제 (한방 삭제를 위해)
echo ""
echo -e "${GREEN}4️⃣ ALB 수동 삭제 중...${NC}"

# 클러스터와 관련된 모든 ALB 찾기
echo "- 클러스터 관련 ALB 검색 중..."
ALB_ARNS=$(aws elbv2 describe-load-balancers --region ${AWS_REGION} --query "LoadBalancers[?contains(LoadBalancerName, 'k8s-') && (contains(LoadBalancerName, '${CLUSTER_NAME}') || contains(LoadBalancerName, 'tempback') || contains(LoadBalancerName, 'biocom'))].LoadBalancerArn" --output text)

if [ ! -z "$ALB_ARNS" ]; then
    echo "- 발견된 ALB:"
    for ALB_ARN in $ALB_ARNS; do
        ALB_NAME=$(aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN --region ${AWS_REGION} --query 'LoadBalancers[0].LoadBalancerName' --output text)
        echo "  - $ALB_NAME"
        
        # ALB 삭제
        echo "    삭제 중..."
        aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN --region ${AWS_REGION} 2>/dev/null || true
    done
    echo "✅ ALB 삭제 요청 완료"
    
    # ALB 삭제 대기
    echo "⏳ ALB가 완전히 삭제될 때까지 대기 중..."
    for i in {1..30}; do
        REMAINING=$(aws elbv2 describe-load-balancers --region ${AWS_REGION} --query "LoadBalancers[?contains(LoadBalancerName, 'k8s-')].LoadBalancerName" --output text)
        if [ -z "$REMAINING" ]; then
            echo "✅ 모든 ALB가 삭제되었습니다!"
            break
        fi
        echo -n "."
        sleep 10
    done
else
    echo "- 삭제할 ALB가 없습니다."
fi

# 5. K8s가 생성한 보안 그룹 수동 삭제
echo ""
echo -e "${GREEN}5️⃣ Kubernetes가 생성한 보안 그룹 정리 중...${NC}"

# VPC ID 가져오기
VPC_ID=$(aws eks describe-cluster --name ${CLUSTER_NAME} --region ${AWS_REGION} --query 'cluster.resourcesVpcConfig.vpcId' --output text 2>/dev/null || true)

if [ ! -z "$VPC_ID" ]; then
    # k8s-로 시작하는 보안 그룹 찾기
    K8S_SGS=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" --region ${AWS_REGION} --query "SecurityGroups[?starts_with(GroupName, 'k8s-')].[GroupId]" --output text)
    
    if [ ! -z "$K8S_SGS" ]; then
        echo "- Kubernetes가 생성한 보안 그룹 발견:"
        for sg in $K8S_SGS; do
            echo "  - 삭제 중: $sg"
            aws ec2 delete-security-group --group-id $sg --region ${AWS_REGION} 2>/dev/null || true
        done
        echo "✅ K8s 보안 그룹 정리 완료"
    fi
fi

# 6. EKS 클러스터 삭제
echo ""
echo -e "${GREEN}6️⃣ EKS 클러스터 삭제 중...${NC}"
echo -e "${YELLOW}⏱️  약 10-15분 소요됩니다...${NC}"

# 클러스터 삭제 (--wait 옵션으로 완전 삭제 대기)
eksctl delete cluster --name ${CLUSTER_NAME} --region ${AWS_REGION} --wait

# 클러스터 삭제 실패 시 VPC 종속성 강제 정리
if [ $? -ne 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  클러스터 삭제 실패. VPC 종속성 강제 정리 중...${NC}"
    
    # CloudFormation 스택에서 VPC ID 가져오기
    VPC_ID=$(aws cloudformation describe-stack-resources --stack-name eksctl-${CLUSTER_NAME}-cluster --region ${AWS_REGION} --query "StackResources[?LogicalResourceId=='VPC'].PhysicalResourceId" --output text 2>/dev/null || true)
    
    if [ ! -z "$VPC_ID" ]; then
        echo "- VPC ID: $VPC_ID"
        
        # 1. 네트워크 인터페이스 삭제
        echo "- 네트워크 인터페이스 삭제 중..."
        aws ec2 describe-network-interfaces --region ${AWS_REGION} --filters "Name=vpc-id,Values=$VPC_ID" --query "NetworkInterfaces[*].NetworkInterfaceId" --output text | tr '\t' '\n' | while read eni_id; do
            if [ ! -z "$eni_id" ]; then
                echo "  - ENI 삭제: $eni_id"
                aws ec2 delete-network-interface --network-interface-id $eni_id --region ${AWS_REGION} 2>/dev/null || true
            fi
        done
        
        # 2. 보안 그룹 삭제 (default 제외)
        echo "- 보안 그룹 삭제 중..."
        aws ec2 describe-security-groups --region ${AWS_REGION} --filters "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[*].[GroupId,GroupName]" --output text | while read sg_id sg_name; do
            if [ "$sg_name" != "default" ] && [ ! -z "$sg_id" ]; then
                echo "  - 보안 그룹 삭제: $sg_id ($sg_name)"
                aws ec2 delete-security-group --group-id $sg_id --region ${AWS_REGION} 2>/dev/null || true
            fi
        done
        
        # 3. 서브넷 삭제
        echo "- 서브넷 삭제 중..."
        aws ec2 describe-subnets --region ${AWS_REGION} --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[*].SubnetId" --output text | tr '\t' '\n' | while read subnet_id; do
            if [ ! -z "$subnet_id" ]; then
                echo "  - 서브넷 삭제: $subnet_id"
                aws ec2 delete-subnet --subnet-id $subnet_id --region ${AWS_REGION} 2>/dev/null || true
            fi
        done
        
        # 4. 인터넷 게이트웨이 분리 및 삭제
        echo "- 인터넷 게이트웨이 삭제 중..."
        aws ec2 describe-internet-gateways --region ${AWS_REGION} --filters "Name=attachment.vpc-id,Values=$VPC_ID" --query "InternetGateways[*].InternetGatewayId" --output text | tr '\t' '\n' | while read igw_id; do
            if [ ! -z "$igw_id" ]; then
                echo "  - IGW 분리: $igw_id"
                aws ec2 detach-internet-gateway --internet-gateway-id $igw_id --vpc-id $VPC_ID --region ${AWS_REGION} 2>/dev/null || true
                echo "  - IGW 삭제: $igw_id"
                aws ec2 delete-internet-gateway --internet-gateway-id $igw_id --region ${AWS_REGION} 2>/dev/null || true
            fi
        done
        
        # 5. NAT 게이트웨이 삭제
        echo "- NAT 게이트웨이 삭제 중..."
        aws ec2 describe-nat-gateways --region ${AWS_REGION} --filter "Name=vpc-id,Values=$VPC_ID" "Name=state,Values=available,pending,deleting" --query "NatGateways[*].NatGatewayId" --output text | tr '\t' '\n' | while read nat_id; do
            if [ ! -z "$nat_id" ]; then
                echo "  - NAT 게이트웨이 삭제: $nat_id"
                aws ec2 delete-nat-gateway --nat-gateway-id $nat_id --region ${AWS_REGION} 2>/dev/null || true
            fi
        done
        
        # NAT 게이트웨이 삭제 대기
        echo "  - NAT 게이트웨이 삭제 대기 중..."
        sleep 30
        
        # 6. 라우트 테이블 삭제 (메인 라우트 테이블 제외)
        echo "- 라우트 테이블 삭제 중..."
        aws ec2 describe-route-tables --region ${AWS_REGION} --filters "Name=vpc-id,Values=$VPC_ID" --query "RouteTables[?Associations[0].Main!=\`true\`].RouteTableId" --output text | tr '\t' '\n' | while read rtb_id; do
            if [ ! -z "$rtb_id" ]; then
                echo "  - 라우트 테이블 삭제: $rtb_id"
                aws ec2 delete-route-table --route-table-id $rtb_id --region ${AWS_REGION} 2>/dev/null || true
            fi
        done
        
        # 7. CloudFormation 스택 재삭제 시도
        echo ""
        echo -e "${YELLOW}CloudFormation 스택 재삭제 시도 중...${NC}"
        aws cloudformation delete-stack --stack-name eksctl-${CLUSTER_NAME}-cluster --region ${AWS_REGION} 2>/dev/null || true
        
        # 삭제 완료 대기
        echo "스택 삭제 대기 중..."
        aws cloudformation wait stack-delete-complete --stack-name eksctl-${CLUSTER_NAME}-cluster --region ${AWS_REGION} 2>/dev/null || true
    fi
fi

# IAM 정책 삭제 섹션
echo ""
echo -e "${GREEN}6️⃣ IAM 정책 및 역할 정리 중...${NC}"

# IAM 정책 삭제
POLICY_NAMES=(
    "AWSLoadBalancerControllerIAMPolicy-${CLUSTER_NAME}"
    "AmazonEKS_EBS_CSI_Driver_Policy-${CLUSTER_NAME}"
)

for policy_name in "${POLICY_NAMES[@]}"; do
    POLICY_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${policy_name}"
    if aws iam get-policy --policy-arn $POLICY_ARN &>/dev/null; then
        echo "- IAM 정책 삭제: $policy_name"
        # 정책에 연결된 모든 엔티티 분리
        ATTACHED_ROLES=$(aws iam list-entities-for-policy --policy-arn $POLICY_ARN --entity-filter Role --query 'PolicyRoles[].RoleName' --output text 2>/dev/null || true)
        for role in $ATTACHED_ROLES; do
            echo "  - 역할에서 정책 분리: $role"
            aws iam detach-role-policy --role-name $role --policy-arn $POLICY_ARN 2>/dev/null || true
        done
        # 정책 삭제
        aws iam delete-policy --policy-arn $POLICY_ARN 2>/dev/null || true
    fi
done

echo "✅ IAM 정책 정리 완료"

echo ""
echo -e "${GREEN}💡 참고: eksctl이 생성한 IAM 역할은 클러스터 삭제 시 자동으로 제거됩니다.${NC}"

# ECR 이미지 정리 옵션
echo ""
echo -e "${YELLOW}🐳 ECR 이미지를 삭제하시겠습니까? (yes/no)${NC}"
read -p "ECR 이미지 삭제: " delete_ecr

if [ "$delete_ecr" == "yes" ]; then
    echo -e "${GREEN}7️⃣ ECR 이미지 정리 중...${NC}"
    
    # 환경 파일에서 ECR_REPOSITORY 가져오기
    if [ ! -z "$ECR_REPOSITORY" ]; then
        # 모든 이미지 태그 가져오기
        IMAGE_TAGS=$(aws ecr list-images --repository-name $ECR_REPOSITORY --region $AWS_REGION --query 'imageIds[*].imageTag' --output text 2>/dev/null || true)
        
        if [ ! -z "$IMAGE_TAGS" ]; then
            echo "- 발견된 이미지 태그: $(echo $IMAGE_TAGS | wc -w)개"
            
            # 배치로 이미지 삭제 (최대 100개씩)
            echo $IMAGE_TAGS | tr ' ' '\n' | while IFS= read -r tag; do
                if [ ! -z "$tag" ]; then
                    echo "  - 이미지 삭제: $tag"
                    aws ecr batch-delete-image --repository-name $ECR_REPOSITORY --region $AWS_REGION --image-ids imageTag=$tag &>/dev/null || true
                fi
            done
            
            echo "✅ ECR 이미지 정리 완료"
        else
            echo "- 삭제할 이미지가 없습니다."
        fi
    else
        echo "- ECR_REPOSITORY가 설정되지 않았습니다."
    fi
fi

echo ""
echo -e "${GREEN}✅ 모든 리소스가 삭제되었습니다!${NC}"
echo ""
echo -e "${BLUE}💰 비용 절약 완료:${NC}"
echo "   - NAT Gateway 요금 중지"
echo "   - EC2 인스턴스 요금 중지"
echo "   - 탄력적 IP 요금 중지"
echo "   - Application Load Balancer 요금 중지"
echo ""
echo -e "${YELLOW}🔄 다시 시작하려면:${NC}"
echo "   ./scripts/eks-deploy.sh $ENVIRONMENT"
echo ""
echo -e "${GREEN}🎉 수고하셨습니다!${NC}"