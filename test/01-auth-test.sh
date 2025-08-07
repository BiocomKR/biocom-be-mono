#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000/api"
TEST_EMAIL="test_$(date +%s)@example.com"
TEST_PASSWORD="Test1234!"

echo -e "${BLUE}=== 바이오컴 API 테스트: 회원가입/로그인 ===${NC}"
echo -e "테스트 이메일: ${TEST_EMAIL}"
echo ""

# 1. 회원가입 테스트
echo -e "${YELLOW}1. 회원가입 테스트${NC}"
SIGNUP_RESPONSE=$(curl -s -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"name\": \"테스트유저\",
    \"mobile\": \"01012345678\"
  }")

echo "응답: $SIGNUP_RESPONSE"

# 토큰 추출 (accessToken 필드)
ACCESS_TOKEN=$(echo $SIGNUP_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -n "$ACCESS_TOKEN" ]; then
  echo -e "${GREEN}✓ 회원가입 성공!${NC}"
  echo "Access Token: ${ACCESS_TOKEN:0:20}..."
else
  echo -e "${RED}✗ 회원가입 실패!${NC}"
  exit 1
fi

echo ""

# 2. 프로필 조회 테스트
echo -e "${YELLOW}2. 프로필 조회 테스트${NC}"
PROFILE_RESPONSE=$(curl -s -X GET "$API_URL/auth/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "응답: $PROFILE_RESPONSE"

if [[ $PROFILE_RESPONSE == *"$TEST_EMAIL"* ]]; then
  echo -e "${GREEN}✓ 프로필 조회 성공!${NC}"
else
  echo -e "${RED}✗ 프로필 조회 실패!${NC}"
fi

echo ""

# 3. 로그인 테스트
echo -e "${YELLOW}3. 로그인 테스트${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/signin" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "응답: $LOGIN_RESPONSE"

LOGIN_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -n "$LOGIN_TOKEN" ]; then
  echo -e "${GREEN}✓ 로그인 성공!${NC}"
else
  echo -e "${RED}✗ 로그인 실패!${NC}"
fi

echo ""

# 4. 잘못된 비밀번호로 로그인 시도
echo -e "${YELLOW}4. 잘못된 비밀번호 테스트${NC}"
FAIL_RESPONSE=$(curl -s -X POST "$API_URL/auth/signin" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"WrongPassword123!\"
  }")

echo "응답: $FAIL_RESPONSE"

if [[ $FAIL_RESPONSE == *"Unauthorized"* ]] || [[ $FAIL_RESPONSE == *"401"* ]]; then
  echo -e "${GREEN}✓ 잘못된 비밀번호 처리 정상!${NC}"
else
  echo -e "${RED}✗ 잘못된 비밀번호 처리 실패!${NC}"
fi

echo ""
echo -e "${BLUE}=== 회원가입/로그인 테스트 완료 ===${NC}"
echo "다음 테스트에서 사용할 토큰: $ACCESS_TOKEN"

# 토큰을 파일로 저장 (다음 테스트에서 사용)
echo "$ACCESS_TOKEN" > /tmp/biocom_test_token.txt
echo "$TEST_EMAIL" > /tmp/biocom_test_email.txt