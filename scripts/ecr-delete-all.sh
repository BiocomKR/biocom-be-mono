#!/bin/bash
# ECR 모든 이미지 삭제 스크립트

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 스크립트의 디렉토리 찾기
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 환경 변수 로드
if [ -f "$PROJECT_ROOT/.env.eks" ]; then
    source "$PROJECT_ROOT/.env.eks"
else
    echo -e "${RED}❌ .env.eks 파일을 찾을 수 없습니다!${NC}"
    exit 1
fi

echo -e "${RED}🗑️ ECR 모든 이미지 삭제${NC}"
echo -e "${YELLOW}리포지토리: ${ECR_REPOSITORY}${NC}"
echo ""

# 현재 이미지 상태 확인
TOTAL_IMAGES=$(aws ecr describe-images --repository-name ${ECR_REPOSITORY} --region ${AWS_REGION} --query 'length(imageDetails)' --output text 2>/dev/null || echo "0")

if [ "$TOTAL_IMAGES" == "0" ]; then
    echo -e "${GREEN}✅ 삭제할 이미지가 없습니다${NC}"
    exit 0
fi

echo -e "${BLUE}📊 현재 상태:${NC}"
echo -e "  총 이미지 개수: ${TOTAL_IMAGES}개"

# 전체 용량 계산
TOTAL_SIZE=$(aws ecr describe-images --repository-name ${ECR_REPOSITORY} --region ${AWS_REGION} --query 'sum(imageDetails[*].imageSizeInBytes)' --output text)
TOTAL_SIZE_GB=$(echo "scale=2; $TOTAL_SIZE/1024/1024/1024" | bc)
echo -e "  총 사용 용량: ${TOTAL_SIZE_GB} GB"
echo ""

# 최종 확인
echo -e "${RED}⚠️  정말로 모든 이미지를 삭제하시겠습니까? (yes 입력)${NC}"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}❌ 삭제가 취소되었습니다${NC}"
    exit 0
fi

echo -e "${RED}삭제 진행 중...${NC}"

# 모든 이미지 digest 가져오기
ALL_DIGESTS=$(aws ecr describe-images --repository-name ${ECR_REPOSITORY} --region ${AWS_REGION} \
    --query 'imageDetails[*].imageDigest' \
    --output json | jq -r '.[]')

# 배치로 삭제 (더 효율적)
echo "$ALL_DIGESTS" | xargs -n 100 | while read -r batch; do
    IMAGE_IDS=""
    for digest in $batch; do
        IMAGE_IDS="$IMAGE_IDS imageDigest=$digest"
    done
    
    aws ecr batch-delete-image \
        --repository-name ${ECR_REPOSITORY} \
        --region ${AWS_REGION} \
        --image-ids $IMAGE_IDS \
        --output text > /dev/null
    echo -n "."
done

echo ""
echo -e "${GREEN}✅ 모든 이미지가 삭제되었습니다!${NC}"
echo -e "${GREEN}절약된 용량: ${TOTAL_SIZE_GB} GB${NC}"