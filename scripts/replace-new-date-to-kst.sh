#!/bin/bash

# KST 날짜 변환 스크립트
# new Date()를 getNowKST()로 일괄 변경

echo "=== new Date() → getNowKST() 일괄 변경 시작 ==="
echo ""

# 변경 대상 파일 목록
FILES=$(grep -r "new Date()" src/ --include="*.ts" -l | grep -v "node_modules" | grep -v ".spec.ts" | grep -v "kst-date.util.ts" | grep -v "korea-date.util.ts")

TOTAL_FILES=$(echo "$FILES" | wc -l | tr -d ' ')
echo "총 ${TOTAL_FILES}개 파일을 처리합니다."
echo ""

CHANGED_COUNT=0

for FILE in $FILES; do
  # new Date() 사용 횟수 확인
  COUNT=$(grep -c "new Date()" "$FILE" 2>/dev/null || echo "0")

  if [ "$COUNT" -gt 0 ]; then
    echo "처리중: $FILE ($COUNT개)"

    # import 추가 여부 확인
    if ! grep -q "import.*getNowKST.*from.*common/utils/kst-date.util" "$FILE"; then
      # 첫 번째 import 문 다음에 추가
      if grep -q "^import" "$FILE"; then
        # 마지막 import 라인 찾기
        LAST_IMPORT_LINE=$(grep -n "^import" "$FILE" | tail -1 | cut -d: -f1)
        # 그 다음 라인에 삽입
        sed -i.bak "${LAST_IMPORT_LINE}a\\
import { getNowKST } from '../common/utils/kst-date.util';
" "$FILE"
        echo "  → import 추가됨"
      fi
    fi

    CHANGED_COUNT=$((CHANGED_COUNT + 1))
  fi
done

echo ""
echo "=== 완료 ==="
echo "총 ${CHANGED_COUNT}개 파일에 import 추가됨"
echo ""
echo "⚠️  다음 단계:"
echo "1. import 경로 수동 확인 필요 (상대 경로 조정)"
echo "2. new Date() → getNowKST() 수동 변경 필요"
echo "3. 컴파일 에러 확인"
