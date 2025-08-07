#!/bin/bash

# API 베이스 URL
BASE_URL="http://localhost:3000/api"

# 색상 코드
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 오늘 날짜 (YYYY-MM-DD)
TODAY=$(date +%Y-%m-%d)

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}바이오컴 API 전체 시나리오 테스트${NC}"
echo -e "${YELLOW}테스트 날짜: $TODAY${NC}"
echo -e "${YELLOW}========================================${NC}"

# 1. 회원가입 테스트
echo -e "\n${GREEN}1. 회원가입 테스트${NC}"
echo "POST $BASE_URL/auth/signup"

# 랜덤 이메일 생성 (중복 방지)
RANDOM_NUM=$((RANDOM % 10000))
TEST_EMAIL="test${RANDOM_NUM}@biocom.kr"

SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"Test1234!\",
    \"name\": \"테스트유저\",
    \"mobile\": \"01098765432\"
  }")

echo "Response: $SIGNUP_RESPONSE"

# JWT 토큰 추출
ACCESS_TOKEN=$(echo $SIGNUP_RESPONSE | grep -o '"accessToken":"[^"]*' | grep -o '[^"]*$')

if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}회원가입 실패!${NC}"
  exit 1
fi

echo -e "${GREEN}회원가입 성공! 토큰: ${ACCESS_TOKEN:0:20}...${NC}"

# 2. 사용자 정보 조회 (암호화된 데이터 확인)
echo -e "\n${GREEN}2. 사용자 정보 조회 (암호화 확인)${NC}"
echo "GET $BASE_URL/users/me"

USER_RESPONSE=$(curl -s -X GET "$BASE_URL/users/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $USER_RESPONSE"

# 사용자 ID 추출
USER_ID=$(echo $USER_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
echo -e "${BLUE}사용자 ID: $USER_ID${NC}"

# 3. 설문조사 상태 확인
echo -e "\n${GREEN}3. 설문조사 상태 확인${NC}"
echo "GET $BASE_URL/survey/status"

SURVEY_STATUS=$(curl -s -X GET "$BASE_URL/survey/status" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $SURVEY_STATUS"

# 4. 설문 질문 조회
echo -e "\n${GREEN}4. 설문 질문 조회${NC}"
echo "GET $BASE_URL/survey/questions"

SURVEY_QUESTIONS=$(curl -s -X GET "$BASE_URL/survey/questions" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response (첫 100자): ${SURVEY_QUESTIONS:0:100}..."

# 5. 설문조사 답변 등록 (사전 설문)
echo -e "\n${GREEN}5. 설문조사 답변 등록 (사전 설문)${NC}"
echo "POST $BASE_URL/survey/complete"

# 모든 질문에 대해 답변 생성 (5개 선택지 중 랜덤)
SURVEY_COMPLETE=$(curl -s -X POST "$BASE_URL/survey/complete" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "before",
    "answers": [
      {"questionId": 1, "optionId": 3},
      {"questionId": 2, "optionId": 2},
      {"questionId": 3, "optionId": 4},
      {"questionId": 4, "optionId": 1},
      {"questionId": 5, "optionId": 3},
      {"questionId": 6, "optionId": 2},
      {"questionId": 7, "optionId": 4},
      {"questionId": 8, "optionId": 3},
      {"questionId": 9, "optionId": 2},
      {"questionId": 10, "optionId": 1},
      {"questionId": 11, "optionId": 3},
      {"questionId": 12, "optionId": 4},
      {"questionId": 13, "optionId": 2},
      {"questionId": 14, "optionId": 3},
      {"questionId": 15, "optionId": 1},
      {"questionId": 16, "optionId": 4},
      {"questionId": 17, "optionId": 2},
      {"questionId": 18, "optionId": 3},
      {"questionId": 19, "optionId": 1},
      {"questionId": 20, "optionId": 5}
    ]
  }')

echo "Response: $SURVEY_COMPLETE"

# 6. 설문 결과 조회
echo -e "\n${GREEN}6. 설문 결과 조회${NC}"
echo "GET $BASE_URL/survey/results/me"

SURVEY_RESULTS=$(curl -s -X GET "$BASE_URL/survey/results/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $SURVEY_RESULTS"

# 7. 오늘의 미션 조회
echo -e "\n${GREEN}7. 오늘의 미션 조회${NC}"
echo "GET $BASE_URL/mission/daily?date=$TODAY"

DAILY_MISSIONS=$(curl -s -X GET "$BASE_URL/mission/daily?date=$TODAY" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $DAILY_MISSIONS"

# 8. 미션 활동 등록 - 식단 기록 (아침)
echo -e "\n${GREEN}8. 미션 활동 등록 - 식단 기록 (아침)${NC}"
echo "POST $BASE_URL/activity"

DIET_ACTIVITY=$(curl -s -X POST "$BASE_URL/activity" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"DIET\",
    \"date\": \"${TODAY}T00:00:00.000Z\",
    \"data\": {
      \"mealType\": \"breakfast\",
      \"menu\": [\"현미밥\", \"된장찌개\", \"김치\"],
      \"isFasting\": false,
      \"memo\": \"건강한 아침 식사\"
    }
  }")

echo "Response: $DIET_ACTIVITY"

# 9. 미션 활동 등록 - 공복 시간
echo -e "\n${GREEN}9. 미션 활동 등록 - 공복 시간${NC}"
echo "POST $BASE_URL/activity"

FASTING_ACTIVITY=$(curl -s -X POST "$BASE_URL/activity" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"FASTING\",
    \"date\": \"${TODAY}T00:00:00.000Z\",
    \"data\": {
      \"startTime\": \"2025-07-29T20:00:00.000Z\",
      \"endTime\": \"2025-07-30T08:00:00.000Z\"
    }
  }")

echo "Response: $FASTING_ACTIVITY"

# 10. 미션 활동 등록 - 수면 기록
echo -e "\n${GREEN}10. 미션 활동 등록 - 수면 기록${NC}"
echo "POST $BASE_URL/activity"

SLEEP_ACTIVITY=$(curl -s -X POST "$BASE_URL/activity" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"SLEEP\",
    \"date\": \"${TODAY}T00:00:00.000Z\",
    \"data\": {
      \"bedTime\": \"2025-07-29T23:00:00.000Z\",
      \"wakeTime\": \"2025-07-30T07:00:00.000Z\"
    }
  }")

echo "Response: $SLEEP_ACTIVITY"

# 11. 미션 활동 등록 - 퀴즈
echo -e "\n${GREEN}11. 미션 활동 등록 - 퀴즈${NC}"
echo "POST $BASE_URL/activity"

QUIZ_ACTIVITY=$(curl -s -X POST "$BASE_URL/activity" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"QUIZ\",
    \"date\": \"${TODAY}T00:00:00.000Z\",
    \"data\": {
      \"answer\": 2
    }
  }")

echo "Response: $QUIZ_ACTIVITY"

# 12. 일일 활동 요약 조회
echo -e "\n${GREEN}12. 일일 활동 요약 조회${NC}"
echo "GET $BASE_URL/activity/summary?date=$TODAY"

DAILY_SUMMARY=$(curl -s -X GET "$BASE_URL/activity/summary?date=$TODAY" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $DAILY_SUMMARY"

# 13. 미션 진행 상황 조회
echo -e "\n${GREEN}13. 미션 진행 상황 조회${NC}"
echo "GET $BASE_URL/mission/progress?date=$TODAY"

MISSION_PROGRESS=$(curl -s -X GET "$BASE_URL/mission/progress?date=$TODAY" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $MISSION_PROGRESS"

echo -e "\n${YELLOW}========================================${NC}"
echo -e "${YELLOW}전체 시나리오 테스트 완료${NC}"
echo -e "${YELLOW}테스트 사용자: $TEST_EMAIL${NC}"
echo -e "${YELLOW}========================================${NC}"