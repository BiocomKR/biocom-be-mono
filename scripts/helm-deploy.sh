#!/bin/bash
# Helm 차트 배포 스크립트

# 스크립트 디렉토리 기준으로 경로 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 환경 변수 로드
if [ -f "$PROJECT_ROOT/.env.eks" ]; then
    source "$PROJECT_ROOT/.env.eks"
    echo "✅ 환경 변수 로드 완료: .env.eks"
else
    echo "❌ .env.eks 파일을 찾을 수 없습니다!"
    exit 1
fi

# 기본값 설정
ENVIRONMENT=${1:-dev}
ACTION=${2:-upgrade}
RELEASE_NAME="${HELM_RELEASE_NAME:-temp-backend}"
NAMESPACE="default"
CHART_PATH="$PROJECT_ROOT/infrastructure/helm/be_temp"

# 타임스탬프 태그 읽기 (docker-ecr-push.sh에서 생성)
if [ -f "$PROJECT_ROOT/.last-image-tag" ]; then
    IMAGE_TAG=$(cat "$PROJECT_ROOT/.last-image-tag")
    echo "🏷️  이미지 태그: $IMAGE_TAG"
else
    IMAGE_TAG="${IMAGE_TAG:-latest}"
fi

echo "🚀 Helm 차트 배포를 시작합니다..."
echo "📦 환경: $ENVIRONMENT"
echo "🔧 작업: $ACTION"
echo ""

# values 파일 선택
if [ "$ENVIRONMENT" == "prod" ]; then
    VALUES_FILE="$CHART_PATH/values-prod.yaml"
elif [ "$ENVIRONMENT" == "dev" ]; then
    VALUES_FILE="$CHART_PATH/values-dev.yaml"
else
    VALUES_FILE="$CHART_PATH/values.yaml"
fi

# Helm 작업 실행
case $ACTION in
    install)
        echo "📥 Helm 차트 설치 중..."
        helm install $RELEASE_NAME $CHART_PATH \
            -f $VALUES_FILE \
            --namespace $NAMESPACE \
            --create-namespace \
            --set image.tag="${IMAGE_TAG:-latest}" \
            --set global.aws.accountId="$AWS_ACCOUNT_ID" \
            --set global.aws.region="$AWS_REGION"
        ;;
        
    upgrade)
        echo "🔄 Helm 차트 업그레이드 중..."
        helm upgrade $RELEASE_NAME $CHART_PATH \
            -f $VALUES_FILE \
            --namespace $NAMESPACE \
            --install \
            --set image.tag="${IMAGE_TAG:-latest}" \
            --set global.aws.accountId="$AWS_ACCOUNT_ID" \
            --set global.aws.region="$AWS_REGION"
        ;;
        
    rollback)
        echo "⏪ 이전 버전으로 롤백 중..."
        REVISION=${3:-0}
        helm rollback $RELEASE_NAME $REVISION --namespace $NAMESPACE
        ;;
        
    delete|uninstall)
        echo "🗑️  Helm 릴리즈 삭제 중..."
        helm uninstall $RELEASE_NAME --namespace $NAMESPACE
        ;;
        
    status)
        echo "📊 Helm 릴리즈 상태:"
        helm status $RELEASE_NAME --namespace $NAMESPACE
        ;;
        
    history)
        echo "📜 배포 히스토리:"
        helm history $RELEASE_NAME --namespace $NAMESPACE
        ;;
        
    diff)
        echo "🔍 변경사항 확인 중..."
        # helm-diff 플러그인 필요
        helm diff upgrade $RELEASE_NAME $CHART_PATH \
            -f $VALUES_FILE \
            --namespace $NAMESPACE \
            --set image.tag="${IMAGE_TAG:-latest}"
        ;;
        
    template)
        echo "📝 템플릿 렌더링:"
        helm template $RELEASE_NAME $CHART_PATH \
            -f $VALUES_FILE \
            --namespace $NAMESPACE \
            --set image.tag="${IMAGE_TAG:-latest}" \
            --set global.aws.accountId="$AWS_ACCOUNT_ID" \
            --set global.aws.region="$AWS_REGION"
        ;;
        
    *)
        echo "❌ 알 수 없는 작업: $ACTION"
        echo ""
        echo "사용법: $0 [환경] [작업] [옵션]"
        echo ""
        echo "환경:"
        echo "  dev    - 개발 환경 (기본값)"
        echo "  prod   - 프로덕션 환경"
        echo ""
        echo "작업:"
        echo "  install   - 새로 설치"
        echo "  upgrade   - 업그레이드 (기본값)"
        echo "  rollback  - 롤백 (리비전 번호 지정 가능)"
        echo "  delete    - 삭제"
        echo "  status    - 상태 확인"
        echo "  history   - 히스토리 확인"
        echo "  diff      - 변경사항 미리보기 (helm-diff 플러그인 필요)"
        echo "  template  - 템플릿 렌더링 결과 확인"
        echo ""
        echo "예시:"
        echo "  $0 dev install          # 개발 환경에 설치"
        echo "  $0 prod upgrade         # 프로덕션 업그레이드"
        echo "  $0 prod rollback 3      # 프로덕션을 리비전 3으로 롤백"
        exit 1
        ;;
esac

echo ""
echo "✅ 작업 완료!"