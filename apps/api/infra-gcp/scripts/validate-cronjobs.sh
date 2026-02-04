#!/bin/bash

# 🔍 CronJob 설정 검증 스크립트
# Deployment와 CronJob의 설정 일치 여부 확인

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 환경 파라미터 (dev 또는 prod)
DEPLOY_ENV="${1:-dev}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$SCRIPT_DIR/../k8s"

echo -e "${GREEN}[검증]${NC} CronJob 설정 검증 시작... (환경: $DEPLOY_ENV)"

cd "$K8S_DIR"

# 1. Deployment 이미지 확인
DEPLOYMENT_IMAGE=$(grep -A 5 "containers:" deployment.yaml | grep "image:" | head -1 | awk '{print $2}')
echo -e "${GREEN}[INFO]${NC} Deployment 이미지: $DEPLOYMENT_IMAGE"

# 2. 필수 볼륨 목록
REQUIRED_VOLUMES=("logs" "kcp-cert-files" "firebase-service-account-key")
REQUIRED_SECRETS=("biocom-api-secrets" "biocom-api-config")

# 3. 각 CronJob 검증
VALIDATION_PASSED=true

for cronjob_file in cronjob-*.yaml; do
    if [[ ! -f "$cronjob_file" ]]; then
        continue
    fi

    echo ""
    echo -e "${GREEN}[검증]${NC} $cronjob_file 확인 중..."

    # 이미지 태그 확인 (환경별 검증)
    CRONJOB_IMAGE=$(grep "image:" "$cronjob_file" | head -1 | awk '{print $2}')
    if [[ "$DEPLOY_ENV" == "dev" ]]; then
        # 개발: dev-{timestamp} 또는 latest 허용
        if [[ "$CRONJOB_IMAGE" == *":dev-"* ]] || [[ "$CRONJOB_IMAGE" == *":latest"* ]]; then
            echo -e "${GREEN}  ✓${NC} 이미지: 개발 태그 사용 ($CRONJOB_IMAGE)"
        else
            echo -e "${YELLOW}[WARN]${NC} $cronjob_file: 개발 이미지 태그 권장 (dev-* 또는 latest): $CRONJOB_IMAGE"
            # 개발에서는 경고만, 실패 처리 안함
        fi
    elif [[ "$DEPLOY_ENV" == "prod" ]]; then
        # 운영: prod-{timestamp} 필수 (latest 금지)
        if [[ "$CRONJOB_IMAGE" == *":prod-"* ]]; then
            echo -e "${GREEN}  ✓${NC} 이미지: 운영 태그 사용 ($CRONJOB_IMAGE)"
        elif [[ "$CRONJOB_IMAGE" == *":latest"* ]]; then
            echo -e "${RED}[ERROR]${NC} $cronjob_file: 운영에서 latest 태그 사용 금지: $CRONJOB_IMAGE"
            VALIDATION_PASSED=false
        else
            echo -e "${YELLOW}[WARN]${NC} $cronjob_file: 운영 이미지 태그 권장 (prod-*): $CRONJOB_IMAGE"
        fi
    fi

    # 실행 경로 확인
    if grep -q "dist/src/main.js" "$cronjob_file"; then
        echo -e "${GREEN}  ✓${NC} 실행 경로: dist/src/main.js (올바름)"
    else
        echo -e "${RED}[ERROR]${NC} $cronjob_file: 실행 경로가 dist/src/main.js가 아님"
        VALIDATION_PASSED=false
    fi

    # 필수 볼륨 확인
    for volume in "${REQUIRED_VOLUMES[@]}"; do
        if grep -q "name: $volume" "$cronjob_file"; then
            echo -e "${GREEN}  ✓${NC} 볼륨: $volume 존재"
        else
            echo -e "${RED}[ERROR]${NC} $cronjob_file: 필수 볼륨 누락: $volume"
            VALIDATION_PASSED=false
        fi
    done

    # 필수 환경변수 Secret 확인
    for secret in "${REQUIRED_SECRETS[@]}"; do
        if grep -q "name: $secret" "$cronjob_file"; then
            echo -e "${GREEN}  ✓${NC} Secret: $secret 존재"
        else
            echo -e "${RED}[ERROR]${NC} $cronjob_file: 필수 Secret 누락: $secret"
            VALIDATION_PASSED=false
        fi
    done
done

echo ""
echo "================================"

if [[ "$VALIDATION_PASSED" == true ]]; then
    echo -e "${GREEN}✅ 모든 CronJob 검증 통과!${NC}"
    exit 0
else
    echo -e "${RED}❌ CronJob 검증 실패! 위 오류를 수정하세요.${NC}"
    exit 1
fi
