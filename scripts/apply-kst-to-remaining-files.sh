#!/bin/bash

# 남은 파일들에 KST 적용
FILES=(
  "src/auth/auth.controller.ts"
  "src/shop/services/products.service.ts"
  "src/shop/services/qna.service.ts"
  "src/shop/services/reviews.service.ts"
  "src/shop/services/banners.service.ts"
  "src/management/controllers/management-users.controller.ts"
  "src/management/controllers/management-quiz-master.controller.ts"
  "src/management/controllers/management-mission.controller.ts"
  "src/management/controllers/management-survey.controller.ts"
  "src/management/controllers/management-point.controller.ts"
  "src/management/controllers/management-api-key.controller.ts"
  "src/management/controllers/management-content.controller.ts"
  "src/tracking/services/statistics.service.ts"
  "src/upload/upload.service.gcs.ts"
  "src/upload/upload.controller.ts"
  "src/users/users.controller.ts"
  "src/coupons/services/coupon.service.ts"
  "src/balance-game/services/balance-game.service.ts"
  "src/imweb/imweb-auth.service.ts"
  "src/common/services/google-storage.service.ts"
  "src/content/content.controller.ts"
  "src/point/point.controller.ts"
  "src/health/health.controller.ts"
)

for file in "${FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "SKIP: $file (파일 없음)"
    continue
  fi

  # 이미 getNowKST import가 있는지 확인
  if grep -q "getNowKST" "$file"; then
    echo "SKIP: $file (이미 처리됨)"
    continue
  fi

  echo "PROCESS: $file"

  # 1단계: import 추가
  # 마지막 import 라인 찾기
  last_import=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)

  if [ -n "$last_import" ]; then
    # 경로 깊이 계산
    depth=$(echo "$file" | tr -cd '/' | wc -c | xargs)
    depth=$((depth - 1))  # src/ 제외

    relative_path=""
    for ((i=0; i<depth; i++)); do
      relative_path="../$relative_path"
    done
    relative_path="${relative_path}common/utils/kst-date.util"

    # macOS sed 사용
    sed -i.bak "${last_import}a\\
import { getNowKST } from '$relative_path';
" "$file"
    rm "$file.bak" 2>/dev/null

    echo "  ✓ Import 추가: $relative_path"
  fi

  # 2단계: new Date() -> getNowKST() 변경
  sed -i.bak 's/new Date()/getNowKST()/g' "$file"
  rm "$file.bak" 2>/dev/null

  echo "  ✓ new Date() -> getNowKST() 변경 완료"
done

echo ""
echo "=== 완료 ==="
echo "처리된 파일 수: $(echo "${FILES[@]}" | wc -w)"
