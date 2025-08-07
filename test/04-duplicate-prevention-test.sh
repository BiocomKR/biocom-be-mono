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

echo -e "${BLUE}=== 바이오컴 API 테스트: 중복 방지 로직 ===${NC}"
echo -e "사용자: ${TEST_EMAIL}"
echo -e "날짜: ${TODAY}"
echo ""

# 1. 이미 완료한 미션 재완료 시도
echo -e "${YELLOW}1. 이미 완료한 미션 재완료 시도 (물 마시기)${NC}"

DUPLICATE_RESPONSE=$(curl -s -X POST "$API_URL/mission/complete" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"missionCode\": \"TEST_WATER\",
    \"date\": \"$TODAY\"
  }")

echo "응답: $DUPLICATE_RESPONSE"

if [[ $DUPLICATE_RESPONSE == *"error"* ]] || [[ $DUPLICATE_RESPONSE == *"이미"* ]] || [[ $DUPLICATE_RESPONSE == *"already"* ]]; then
  echo -e "${GREEN}✓ 중복 완료가 차단되었습니다!${NC}"
else
  echo -e "${RED}✗ 중복 완료가 차단되지 않았습니다${NC}"
fi

echo ""

# 2. 일일 제한 초과 테스트 (운동 인증 미션을 2번 완료 시도)
echo -e "${YELLOW}2. 일일 제한 초과 테스트 (운동 인증)${NC}"

# 첫 번째 완료
FIRST_EXERCISE=$(curl -s -X POST "$API_URL/mission/complete" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"missionCode\": \"TEST_EXERCISE\",
    \"date\": \"$TODAY\"
  }")

echo "첫 번째 시도: $FIRST_EXERCISE"

# 두 번째 완료 시도
SECOND_EXERCISE=$(curl -s -X POST "$API_URL/mission/complete" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"missionCode\": \"TEST_EXERCISE\",
    \"date\": \"$TODAY\"
  }")

echo "두 번째 시도: $SECOND_EXERCISE"

if [[ $SECOND_EXERCISE == *"error"* ]] || [[ $SECOND_EXERCISE == *"limit"* ]] || [[ $SECOND_EXERCISE == *"제한"* ]]; then
  echo -e "${GREEN}✓ 일일 제한이 적용되었습니다!${NC}"
else
  echo -e "${RED}✗ 일일 제한이 적용되지 않았습니다${NC}"
fi

echo ""

# 3. 이벤트 참여 중복 방지 테스트
echo -e "${YELLOW}3. 이벤트 참여 중복 방지 테스트${NC}"

DUPLICATE_JOIN=$(curl -s -X POST "$API_URL/event/participate" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{}")

echo "중복 참여 시도: $DUPLICATE_JOIN"

if [[ $DUPLICATE_JOIN == *"error"* ]] || [[ $DUPLICATE_JOIN == *"이미"* ]] || [[ $DUPLICATE_JOIN == *"already"* ]]; then
  echo -e "${GREEN}✓ 중복 참여가 차단되었습니다!${NC}"
else
  echo -e "${RED}✗ 중복 참여가 차단되지 않았습니다${NC}"
fi

echo ""

# 4. 설문 답변 중복 방지 테스트
echo -e "${YELLOW}4. 설문 답변 중복 방지 테스트${NC}"

# 먼저 설문 질문 조회
QUESTIONS=$(curl -s -X GET "$API_URL/survey/questions?categoryCode=SKIN_HEALTH" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

# 첫 번째 질문 ID 추출
FIRST_QUESTION_ID=$(echo $QUESTIONS | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$FIRST_QUESTION_ID" ]; then
  # 첫 번째 답변
  FIRST_ANSWER=$(curl -s -X POST "$API_URL/survey/answers" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": $USER_ID,
      \"surveyQuestionId\": $FIRST_QUESTION_ID,
      \"surveyOptionId\": 1,
      \"type\": \"before\"
    }")
  
  echo "첫 번째 답변: $FIRST_ANSWER"
  
  # 중복 답변 시도
  DUPLICATE_ANSWER=$(curl -s -X POST "$API_URL/survey/answers" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": $USER_ID,
      \"surveyQuestionId\": $FIRST_QUESTION_ID,
      \"surveyOptionId\": 2,
      \"type\": \"before\"
    }")
  
  echo "중복 답변 시도: $DUPLICATE_ANSWER"
  
  if [[ $DUPLICATE_ANSWER == *"error"* ]] || [[ $DUPLICATE_ANSWER == *"이미"* ]] || [[ $DUPLICATE_ANSWER == *"already"* ]]; then
    echo -e "${GREEN}✓ 중복 답변이 차단되었습니다!${NC}"
  else
    echo -e "${RED}✗ 중복 답변이 차단되지 않았습니다${NC}"
  fi
else
  echo -e "${YELLOW}설문 질문을 찾을 수 없어 테스트를 건너뜁니다${NC}"
fi

echo ""
echo -e "${BLUE}=== 중복 방지 로직 테스트 종료 ===${NC}"