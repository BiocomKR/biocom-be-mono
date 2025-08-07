#!/bin/bash
# ECR 이미지 정리 스크립트
# 오래된 이미지를 삭제하여 스토리지 비용 절감

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

# 기본값 설정
KEEP_COUNT=${1:-10}  # 기본적으로 최신 10개 이미지만 유지
DRY_RUN=${2:-false}  # 실제 삭제 여부 (true면 시뮬레이션만)

echo -e "${BLUE}🧹 ECR 이미지 정리를 시작합니다...${NC}"
echo -e "${YELLOW}리포지토리: ${ECR_REPOSITORY}${NC}"
echo -e "${YELLOW}유지할 이미지 개수: ${KEEP_COUNT}개${NC}"
echo ""

# 현재 이미지 상태 확인
TOTAL_IMAGES=$(aws ecr describe-images --repository-name ${ECR_REPOSITORY} --region ${AWS_REGION} --query 'length(imageDetails)' --output text)
echo -e "${BLUE}📊 현재 상태:${NC}"
echo -e "  총 이미지 개수: ${TOTAL_IMAGES}개"

# 전체 용량 계산
TOTAL_SIZE=$(aws ecr describe-images --repository-name ${ECR_REPOSITORY} --region ${AWS_REGION} --query 'sum(imageDetails[*].imageSizeInBytes)' --output text)
TOTAL_SIZE_GB=$(echo "scale=2; $TOTAL_SIZE/1024/1024/1024" | bc)
echo -e "  총 사용 용량: ${TOTAL_SIZE_GB} GB"
echo ""

# 삭제할 이미지가 없으면 종료
if [ $TOTAL_IMAGES -le $KEEP_COUNT ]; then
    echo -e "${GREEN}✅ 정리할 이미지가 없습니다. (현재 ${TOTAL_IMAGES}개 <= 유지 기준 ${KEEP_COUNT}개)${NC}"
    exit 0
fi

# 삭제 대상 이미지 확인
DELETE_COUNT=$((TOTAL_IMAGES - KEEP_COUNT))
echo -e "${YELLOW}🗑️  삭제 예정: ${DELETE_COUNT}개의 이미지${NC}"

# 태그가 없는 이미지 먼저 삭제
echo -e "\n${BLUE}1️⃣ 태그가 없는 이미지 확인 중...${NC}"
UNTAGGED_IMAGES=$(aws ecr describe-images --repository-name ${ECR_REPOSITORY} --region ${AWS_REGION} \
    --filter tagStatus=UNTAGGED \
    --query 'imageDetails[*].imageDigest' \
    --output json | jq -r '.[]' 2>/dev/null || echo "")

if [ ! -z "$UNTAGGED_IMAGES" ]; then
    UNTAGGED_COUNT=$(echo "$UNTAGGED_IMAGES" | wc -l)
    echo -e "  발견: ${UNTAGGED_COUNT}개"
    
    if [ "$DRY_RUN" == "false" ]; then
        echo -e "  ${RED}삭제 중...${NC}"
        for digest in $UNTAGGED_IMAGES; do
            aws ecr batch-delete-image \
                --repository-name ${ECR_REPOSITORY} \
                --region ${AWS_REGION} \
                --image-ids imageDigest=$digest \
                --output text > /dev/null
            echo -n "."
        done
        echo -e "\n  ${GREEN}✅ 태그 없는 이미지 삭제 완료${NC}"
    else
        echo -e "  ${YELLOW}[DRY RUN] 실제로는 삭제되지 않습니다${NC}"
    fi
else
    echo -e "  태그 없는 이미지가 없습니다"
fi

# 오래된 태그된 이미지 삭제
echo -e "\n${BLUE}2️⃣ 오래된 이미지 정리 중...${NC}"

# 최신 순으로 정렬하여 삭제할 이미지 목록 생성
DELETE_IMAGES=$(aws ecr describe-images --repository-name ${ECR_REPOSITORY} --region ${AWS_REGION} \
    --query "reverse(sort_by(imageDetails[?imageTags!=null], &imagePushedAt))[${KEEP_COUNT}:].[imageDigest,imageTags[0],imagePushedAt,imageSizeInBytes]" \
    --output json)

if [ "$DELETE_IMAGES" != "[]" ] && [ ! -z "$DELETE_IMAGES" ]; then
    # 삭제 예정 이미지 목록 표시
    echo -e "\n${YELLOW}삭제 예정 이미지:${NC}"
    echo "$DELETE_IMAGES" | jq -r '.[] | "  - 태그: \(.[1]) | 날짜: \(.[2] | split("T")[0]) | 크기: \((.[3]/1024/1024) | floor)MB"'
    
    # 삭제될 용량 계산
    DELETE_SIZE=$(echo "$DELETE_IMAGES" | jq '[.[][3]] | add')
    DELETE_SIZE_GB=$(echo "scale=2; $DELETE_SIZE/1024/1024/1024" | bc)
    echo -e "\n${YELLOW}📊 절약 예상 용량: ${DELETE_SIZE_GB} GB${NC}"
    
    if [ "$DRY_RUN" == "false" ]; then
        echo -e "\n${RED}⚠️  정말로 삭제하시겠습니까? (y/N)${NC}"
        read -r CONFIRM
        
        if [ "$CONFIRM" == "y" ] || [ "$CONFIRM" == "Y" ]; then
            echo -e "${RED}삭제 진행 중...${NC}"
            
            # 이미지 삭제
            echo "$DELETE_IMAGES" | jq -r '.[][][0]' | while read digest; do
                aws ecr batch-delete-image \
                    --repository-name ${ECR_REPOSITORY} \
                    --region ${AWS_REGION} \
                    --image-ids imageDigest=$digest \
                    --output text > /dev/null
                echo -n "."
            done
            
            echo -e "\n${GREEN}✅ 이미지 정리 완료!${NC}"
            
            # 최종 상태 확인
            FINAL_IMAGES=$(aws ecr describe-images --repository-name ${ECR_REPOSITORY} --region ${AWS_REGION} --query 'length(imageDetails)' --output text)
            FINAL_SIZE=$(aws ecr describe-images --repository-name ${ECR_REPOSITORY} --region ${AWS_REGION} --query 'sum(imageDetails[*].imageSizeInBytes)' --output text)
            FINAL_SIZE_GB=$(echo "scale=2; $FINAL_SIZE/1024/1024/1024" | bc)
            
            echo -e "\n${BLUE}📊 최종 상태:${NC}"
            echo -e "  남은 이미지 개수: ${FINAL_IMAGES}개"
            echo -e "  남은 용량: ${FINAL_SIZE_GB} GB"
            echo -e "  ${GREEN}절약된 용량: ${DELETE_SIZE_GB} GB${NC}"
        else
            echo -e "${YELLOW}❌ 삭제가 취소되었습니다${NC}"
        fi
    else
        echo -e "\n${YELLOW}[DRY RUN] 실제로는 삭제되지 않습니다${NC}"
        echo -e "실제 삭제를 원하시면 다음 명령어를 실행하세요:"
        echo -e "${BLUE}./scripts/ecr-cleanup.sh ${KEEP_COUNT} false${NC}"
    fi
else
    echo -e "${GREEN}✅ 유지 기준에 따라 삭제할 이미지가 없습니다${NC}"
fi

echo -e "\n${GREEN}🎉 ECR 정리 작업이 완료되었습니다!${NC}"

# 정기 정리 안내
echo -e "\n${BLUE}💡 팁:${NC}"
echo -e "- 정기적으로 이 스크립트를 실행하여 ECR 비용을 절감하세요"
echo -e "- ECR 수명 주기 정책을 설정하면 자동으로 관리됩니다:"
echo -e "  ${YELLOW}aws ecr put-lifecycle-policy --repository-name ${ECR_REPOSITORY} --lifecycle-policy-text file://ecr-lifecycle-policy.json${NC}"