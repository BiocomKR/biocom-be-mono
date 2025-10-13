#!/bin/bash

# 색상 설정
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_BASE="http://localhost:10804/api"

echo -e "${YELLOW}=== 바이오컴 API 테스트 시작 ===${NC}"
echo ""

# 1. 회원가입
echo -e "${GREEN}1. 회원가입 테스트${NC}"
SIGNUP_RESPONSE=$(curl -s -X POST "$API_BASE/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234!",
    "name": "테스트유저",
    "mobile": "010-1234-5678"
  }')

echo "$SIGNUP_RESPONSE" | jq '.'
echo ""

# 2. 로그인
echo -e "${GREEN}2. 로그인${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234!"
  }')

JWT_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken')

if [ "$JWT_TOKEN" = "null" ]; then
    echo -e "${RED}로그인 실패. 응답:${NC}"
    echo "$LOGIN_RESPONSE" | jq '.'
    exit 1
fi

echo -e "${GREEN}로그인 성공! JWT 토큰 획득${NC}"
echo ""

# 3. 간소화된 상품 목록 조회
echo -e "${GREEN}3. 간소화된 상품 목록 조회${NC}"
curl -s -X GET "$API_BASE/shop/products/simple" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
echo ""

# 4. 카테고리별 그룹핑된 상품 목록 조회
echo -e "${GREEN}4. 카테고리별 그룹핑된 상품 목록 조회${NC}"
curl -s -X GET "$API_BASE/shop/products/grouped" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
echo ""

# 5. 특정 카테고리 상품 조회 - 챌린지
echo -e "${GREEN}5. 챌린지 카테고리 상품 조회${NC}"
curl -s -X GET "$API_BASE/shop/products/simple?categoryCode=CHALLENGE" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
echo ""

# 6. 특정 카테고리 상품 조회 - 해외직구영양제
echo -e "${GREEN}6. 해외직구영양제 카테고리 상품 조회${NC}"
curl -s -X GET "$API_BASE/shop/products/simple?categoryCode=OVERSEASUPPLEMENT" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
echo ""

# 7. 특정 카테고리 상품 조회 - 건강검진
echo -e "${GREEN}7. 건강검진 카테고리 상품 조회${NC}"
curl -s -X GET "$API_BASE/shop/products/simple?categoryCode=HEALTH_CHECK" \
  -H "Authorization: Bearer $JWT_TOKEN" | jq '.'
echo ""

echo -e "${YELLOW}=== 테스트 완료 ===${NC}"