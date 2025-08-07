#!/bin/bash

# API 베이스 URL
BASE_URL="http://localhost:3000/api"

# 색상 코드
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}바이오컴 API 시나리오 테스트${NC}"
echo -e "${YELLOW}========================================${NC}"

# 1. 회원가입 테스트
echo -e "\n${GREEN}1. 회원가입 테스트${NC}"
echo "POST $BASE_URL/auth/signup"

SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@biocom.kr",
    "password": "Test1234!",
    "name": "홍길동",
    "mobile": "01012345678"
  }')

echo "Response: $SIGNUP_RESPONSE"

# JWT 토큰 추출
ACCESS_TOKEN=$(echo $SIGNUP_RESPONSE | grep -o '"accessToken":"[^"]*' | grep -o '[^"]*$')

if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}회원가입 실패!${NC}"
  exit 1
fi

echo -e "${GREEN}회원가입 성공! 토큰: ${ACCESS_TOKEN:0:20}...${NC}"

# 2. 로그인 테스트
echo -e "\n${GREEN}2. 로그인 테스트${NC}"
echo "POST $BASE_URL/auth/signin"

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@biocom.kr",
    "password": "Test1234!"
  }')

echo "Response: $LOGIN_RESPONSE"

# 새 토큰으로 업데이트
NEW_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | grep -o '[^"]*$')
if [ ! -z "$NEW_TOKEN" ]; then
  ACCESS_TOKEN=$NEW_TOKEN
  echo -e "${GREEN}로그인 성공!${NC}"
else
  echo -e "${RED}로그인 실패!${NC}"
fi

# 3. 사용자 정보 조회 (암호화된 데이터 확인)
echo -e "\n${GREEN}3. 사용자 정보 조회${NC}"
echo "GET $BASE_URL/users/me"

USER_RESPONSE=$(curl -s -X GET "$BASE_URL/users/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $USER_RESPONSE"

# 4. 미션 조회
echo -e "\n${GREEN}4. 미션 목록 조회${NC}"
echo "GET $BASE_URL/mission"

MISSION_RESPONSE=$(curl -s -X GET "$BASE_URL/mission" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $MISSION_RESPONSE"

# 5. 설문 질문 조회
echo -e "\n${GREEN}5. 설문 질문 조회${NC}"
echo "GET $BASE_URL/survey/questions"

SURVEY_RESPONSE=$(curl -s -X GET "$BASE_URL/survey/questions" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $SURVEY_RESPONSE"

echo -e "\n${YELLOW}========================================${NC}"
echo -e "${YELLOW}테스트 완료${NC}"
echo -e "${YELLOW}========================================${NC}"