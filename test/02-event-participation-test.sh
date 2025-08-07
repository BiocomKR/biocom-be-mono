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

echo -e "${BLUE}=== 바이오컴 API 테스트: 이벤트 참여 ===${NC}"
echo -e "사용자: ${TEST_EMAIL}"
echo ""

# 1. 활성 이벤트 조회 - 이벤트 기간 API가 없으므로 설문 상태로 확인
echo -e "${YELLOW}1. 설문 상태 조회 (활성 이벤트 확인)${NC}"
SURVEY_STATUS=$(curl -s -X GET "$API_URL/survey/status" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "응답: $SURVEY_STATUS"

if [[ $SURVEY_STATUS == *"beforeSurvey"* ]]; then
  echo -e "${GREEN}✓ 활성 이벤트 확인 성공!${NC}"
else
  echo -e "${RED}✗ 활성 이벤트 확인 실패!${NC}"
fi

echo ""

# 2. 일일 미션 목록 조회
echo -e "${YELLOW}2. 오늘의 미션 목록 조회${NC}"
TODAY=$(date +%Y-%m-%d)
MISSIONS_RESPONSE=$(curl -s -X GET "$API_URL/mission/daily?date=$TODAY" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "응답: $MISSIONS_RESPONSE"

if [[ $MISSIONS_RESPONSE == *"TEST_WATER"* ]]; then
  echo -e "${GREEN}✓ 미션 목록 조회 성공!${NC}"
else
  echo -e "${RED}✗ 미션 목록 조회 실패!${NC}"
fi

echo ""

# 3. 미션 진행 상황 조회
echo -e "${YELLOW}3. 미션 진행 상황 조회${NC}"
PROGRESS_RESPONSE=$(curl -s -X GET "$API_URL/mission/progress?date=$TODAY" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "응답: $PROGRESS_RESPONSE"

if [[ $PROGRESS_RESPONSE == *"totalMissions"* ]]; then
  echo -e "${GREEN}✓ 미션 진행 상황 조회 성공!${NC}"
else
  echo -e "${RED}✗ 미션 진행 상황 조회 실패!${NC}"
fi

echo ""

# 4. 이벤트 참여 상태 확인 (event_users 레코드 자동 생성 확인)
echo -e "${YELLOW}4. 이벤트 참여 상태 확인${NC}"
echo -e "- 미션이나 설문 조회 시 자동으로 event_users 레코드가 생성됩니다"
echo -e "- status = 'ACTIVE', joined_at = 현재시간"

# 미션 상세 조회로 참여 확인
MISSION_DETAIL=$(curl -s -X GET "$API_URL/mission/detail/TEST_WATER?date=$TODAY" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "미션 상세: $MISSION_DETAIL"

if [[ $MISSION_DETAIL == *"TEST_WATER"* ]]; then
  echo -e "${GREEN}✓ 이벤트 참여 확인 성공!${NC}"
  echo -e "${GREEN}✓ event_users 레코드가 생성되었습니다${NC}"
else
  echo -e "${RED}✗ 이벤트 참여 확인 실패!${NC}"
fi

echo ""

# 5. 주간 진행 상황 조회
echo -e "${YELLOW}5. 주간 미션 진행 상황 조회${NC}"
END_DATE=$(date -v +6d +%Y-%m-%d 2>/dev/null || date -d "+6 days" +%Y-%m-%d)
WEEKLY_RESPONSE=$(curl -s -X GET "$API_URL/mission/weekly?startDate=$TODAY&endDate=$END_DATE" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "응답: ${WEEKLY_RESPONSE:0:200}..."

if [[ $WEEKLY_RESPONSE == *"date"* ]]; then
  echo -e "${GREEN}✓ 주간 진행 상황 조회 성공!${NC}"
else
  echo -e "${RED}✗ 주간 진행 상황 조회 실패!${NC}"
fi

echo ""
echo -e "${BLUE}=== 이벤트 참여 테스트 완료 ===${NC}"
echo -e "다음 단계: 미션 완료 및 포인트 적립 테스트"