#!/bin/bash

# KST import 추가 스크립트
# 모든 *.ts 파일에 getNowKST import를 추가합니다

FILES=$(grep -r "new Date()" src/ --include="*.ts" -l | grep -v "node_modules" | grep -v ".spec.ts" | grep -v "kst-date.util.ts" | grep -v "challenge-date.util.ts")

for file in $FILES; do
    # 이미 import가 있는지 확인
    if grep -q "getNowKST" "$file"; then
        echo "SKIP: $file (이미 import 있음)"
        continue
    fi

    # 파일에서 common 디렉토리까지의 상대 경로 계산
    depth=$(echo "$file" | tr -cd '/' | wc -c)
    depth=$((depth - 1))  # src/ 제외

    relative_path=""
    for ((i=0; i<depth; i++)); do
        relative_path="../$relative_path"
    done
    relative_path="${relative_path}common/utils/kst-date.util"

    echo "PROCESS: $file (depth=$depth, path=$relative_path)"

    # 마지막 import 라인 찾기
    last_import_line=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)

    if [ -n "$last_import_line" ]; then
        # 마지막 import 다음에 getNowKST import 추가
        sed -i.bak "${last_import_line}a\\
import { getNowKST } from '$relative_path';
" "$file"
        rm "$file.bak"
        echo "  ✓ Import 추가됨"
    else
        echo "  ✗ import 라인을 찾을 수 없음"
    fi
done

echo "완료!"
