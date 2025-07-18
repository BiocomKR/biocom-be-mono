#!/bin/bash
# 🗑️ 개발 환경 전체 삭제 (비용 절약용) - 최종 개선 버전

set -e  # 에러 발생시 즉시 중단

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

# 환경 변수 로드
if [ ! -f "$PROJECT_ROOT/.env.eks" ]; then
    echo -e "${RED}❌ .env.eks 파일이 없습니다!${NC}"
    echo "클러스터 이름을 직접 입력해주세요:"
    read -p "클러스터 이름: " CLUSTER_NAME
    read -p "AWS 리전 (기본: ap-northeast-2): " AWS_REGION
    AWS_REGION=${AWS_REGION:-ap-northeast-2}
else
    source "$PROJECT_ROOT/.env.eks"
fi

# 환경변수에서 릴리즈 이름 가져오기
RELEASE_NAME="${HELM_RELEASE_NAME:-temp-backend}"

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
    helm uninstall $RELEASE_NAME --wait
    echo "✅ Helm 릴리즈 삭제 완료"
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
kubectl delete ingress --all 2>/dev/null || true

# 다른 리소스들 삭제
kubectl delete svc -l app.kubernetes.io/instance=$RELEASE_NAME 2>/dev/null || true
kubectl delete deployment -l app.kubernetes.io/instance=$RELEASE_NAME 2>/dev/null || true
kubectl delete pvc -l app.kubernetes.io/instance=$RELEASE_NAME 2>/dev/null || true
kubectl delete secret backend-secrets 2>/dev/null || true

# ServiceAccount 삭제
kubectl delete sa aws-load-balancer-controller -n kube-system 2>/dev/null || true

echo "✅ Kubernetes 리소스 정리 완료"

# 4. ALB가 완전히 삭제될 때까지 대기
echo ""
echo -e "${GREEN}4️⃣ ALB 삭제 대기 중...${NC}"
echo "⏳ ALB가 완전히 삭제될 때까지 60초 대기..."
sleep 60

# 5. EKS 클러스터 삭제
echo ""
echo -e "${GREEN}5️⃣ EKS 클러스터 삭제 중...${NC}"
echo -e "${YELLOW}⏱️  약 10-15분 소요됩니다...${NC}"

# 클러스터 삭제 (--wait 옵션으로 완전 삭제 대기)
eksctl delete cluster --name ${CLUSTER_NAME} --region ${AWS_REGION} --wait

echo ""
echo -e "${GREEN}💡 참고: IAM 정책은 다음 설치 시 재사용을 위해 보존됩니다.${NC}"

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
echo "   ./scripts/1-all-in-one-final.sh"
echo ""
echo -e "${GREEN}🎉 수고하셨습니다!${NC}"