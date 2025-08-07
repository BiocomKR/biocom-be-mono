#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000/api"
ACCESS_TOKEN=$(cat /tmp/biocom_test_token.txt)
TEST_EMAIL=$(cat /tmp/biocom_test_email.txt)
TODAY=$(date +%Y-%m-%d)

echo -e "${BLUE}=== 바이오컴 API 테스트: 미션 완료 및 포인트 적립 ===${NC}"
echo -e "사용자: ${TEST_EMAIL}"
echo -e "날짜: ${TODAY}"
echo ""

# 미션 완료 API가 구현되지 않은 것 같아서 먼저 확인
echo -e "${YELLOW}0. 미션 관련 API 엔드포인트 확인${NC}"
curl -s "$API_URL/docs" | grep -i mission | head -10 || echo "Swagger 문서 접근 불가"
echo ""

# 1. 초기 포인트 확인
echo -e "${YELLOW}1. 초기 포인트 확인${NC}"
PROFILE=$(curl -s -X GET "$API_URL/auth/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

INITIAL_POINTS=$(echo $PROFILE | grep -o '"points":[0-9]*' | cut -d':' -f2)
echo "현재 포인트: $INITIAL_POINTS"
echo ""

# 2. 물 마시기 미션 완료 (파일 업로드 불필요)
echo -e "${YELLOW}2. 물 마시기 미션 완료 시도${NC}"

# 미션 완료 API 추측 1: POST /mission/complete
COMPLETE_RESPONSE1=$(curl -s -X POST "$API_URL/mission/complete" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"missionCode\": \"TEST_WATER\",
    \"date\": \"$TODAY\"
  }")

echo "시도 1 응답: $COMPLETE_RESPONSE1"

# 미션 완료 API 추측 2: POST /mission/daily/complete
COMPLETE_RESPONSE2=$(curl -s -X POST "$API_URL/mission/daily/complete" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"missionCode\": \"TEST_WATER\",
    \"date\": \"$TODAY\"
  }")

echo "시도 2 응답: $COMPLETE_RESPONSE2"

# 미션 완료 API 추측 3: PUT /mission/TEST_WATER/complete
COMPLETE_RESPONSE3=$(curl -s -X PUT "$API_URL/mission/TEST_WATER/complete?date=$TODAY" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "시도 3 응답: $COMPLETE_RESPONSE3"

echo ""

# 3. 포인트 변화 확인
echo -e "${YELLOW}3. 미션 완료 후 포인트 확인${NC}"
PROFILE_AFTER=$(curl -s -X GET "$API_URL/auth/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

AFTER_POINTS=$(echo $PROFILE_AFTER | grep -o '"points":[0-9]*' | cut -d':' -f2)
echo "완료 후 포인트: $AFTER_POINTS"

if [ "$AFTER_POINTS" -gt "$INITIAL_POINTS" ]; then
  echo -e "${GREEN}✓ 포인트가 증가했습니다! ($INITIAL_POINTS → $AFTER_POINTS)${NC}"
else
  echo -e "${RED}✗ 포인트가 증가하지 않았습니다${NC}"
fi

echo ""

# 4. 미션 진행 상황 재확인 (완료 여부 확인)
echo -e "${YELLOW}4. 미션 완료 여부 확인${NC}"
MISSION_DETAIL=$(curl -s -X GET "$API_URL/mission/detail/TEST_WATER?date=$TODAY" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "미션 상세: $MISSION_DETAIL"

if [[ $MISSION_DETAIL == *'"isCompleted":true'* ]]; then
  echo -e "${GREEN}✓ 미션이 완료 상태로 변경되었습니다!${NC}"
else
  echo -e "${RED}✗ 미션이 아직 미완료 상태입니다${NC}"
fi

echo ""

# 5. 인증 사진 업로드가 필요한 미션 테스트 준비
echo -e "${YELLOW}5. 운동 인증 미션 (파일 업로드 필요)${NC}"
echo "운동 인증 미션은 파일 업로드가 필요합니다."
echo "다음 테스트에서 파일 업로드와 함께 진행합니다."

echo ""
echo -e "${BLUE}=== 미션 완료 테스트 종료 ===${NC}"
echo ""
echo -e "${YELLOW}💡 미션 완료 API가 구현되지 않은 경우:${NC}"
echo "미션 완료 기능은 보통 다음 중 하나의 형태로 구현됩니다:"
echo "- POST /api/mission/complete"
echo "- POST /api/mission/{missionCode}/complete"
echo "- POST /api/activity/complete (구버전)"
echo ""
echo "현재 구현된 엔드포인트를 확인하려면 Swagger 문서를 참조하세요:"
echo "http://localhost:3000/api/docs"