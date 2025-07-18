#!/bin/bash
# 🐳 Docker 이미지 빌드 및 ECR 푸시 스크립트

set -e

# 스크립트의 디렉토리 찾기
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 환경 변수 로드
if [ ! -f "$PROJECT_ROOT/.env.eks" ]; then
    echo "❌ .env.eks 파일이 없습니다!"
    exit 1
fi
source "$PROJECT_ROOT/.env.eks"

echo "🐳 Docker 이미지 빌드 및 ECR 푸시를 시작합니다..."
echo "📦 리포지토리: $ECR_REPOSITORY"
echo "🏷️  태그: ${IMAGE_TAG:-latest}"

# 1. ECR 로그인
echo "🔐 ECR 로그인 중..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# 2. Docker 이미지 빌드 (멀티 플랫폼)
echo "🔨 Docker 이미지 빌드 중..."
cd "$PROJECT_ROOT"
docker buildx build --platform linux/amd64 -t $ECR_REPOSITORY . --load

# 3. 태그 생성
TIMESTAMP=$(date +%Y%m%d%H%M%S)
docker tag $ECR_REPOSITORY:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$TIMESTAMP
docker tag $ECR_REPOSITORY:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest

# 4. ECR에 푸시
echo "📤 ECR에 푸시 중..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$TIMESTAMP
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:latest

echo ""
echo "✅ 이미지 푸시 완료!"
echo "🏷️  태그: $TIMESTAMP, latest"

# 타임스탬프를 파일로 저장 (helm-deploy.sh에서 사용)
echo $TIMESTAMP > "$PROJECT_ROOT/.last-image-tag"