#!/bin/bash

# Biocom API 통합 테스트 스크립트
# 실제 시나리오대로 백오피스와 사용자 플로우를 테스트

API_URL="http://localhost:3000/api"
API_KEY="58d0e4d2-f473-4739-ae6c-5392caff05f1"  # 실제 API KEY

# 색상 코드
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 테스트 결과 출력 함수
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
        echo "Response: $3"
    fi
}

echo "🚀 Biocom API 통합 테스트 시작"
echo "================================"

# 1. 백오피스 - 설문 생성
echo -e "\n${YELLOW}1. 백오피스 - 설문 생성${NC}"

SURVEY_RESPONSE=$(curl -s -X POST "$API_URL/management/survey" \
  -H "X-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "21일 챌린지 사전 설문",
    "description": "챌린지 시작 전 건강 상태를 파악하는 설문입니다",
    "type": "health",
    "category": "before",
    "isActive": true
  }')

SURVEY_ID=$(echo $SURVEY_RESPONSE | jq -r '.data.id')
print_result $? "사전 설문 생성 완료 (ID: $SURVEY_ID)" "$SURVEY_RESPONSE"

# 설문 질문 추가
curl -s -X POST "$API_URL/management/survey/$SURVEY_ID/questions" \
  -H "X-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryCode": "HEALTH",
    "categoryName": "건강 상태",
    "questionText": "현재 건강 상태는 어떠신가요?",
    "questionType": "SINGLE_CHOICE",
    "options": ["매우 좋음", "좋음", "보통", "나쁨", "매우 나쁨"],
    "sortOrder": 1,
    "isRequired": true
  }' > /dev/null

print_result $? "설문 질문 추가 완료"

# 2. 백오피스 - 미션 생성
echo -e "\n${YELLOW}2. 백오피스 - 미션 생성${NC}"

# 활동 미션 생성
ACTIVITY_RESPONSE=$(curl -s -X POST "$API_URL/management/mission" \
  -H "X-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "데일리 운동",
    "code": "DAILY_EXERCISE",
    "description": "매일 30분 이상 운동하기",
    "type": "ACTIVITY",
    "category": "health",
    "points": 100,
    "sortOrder": 1,
    "isActive": true
  }')

ACTIVITY_ID=$(echo $ACTIVITY_RESPONSE | jq -r '.data.id')
print_result $? "활동 미션 생성 완료 (ID: $ACTIVITY_ID)" "$ACTIVITY_RESPONSE"

# 퀴즈 미션 생성 (이미 QUIZ 코드가 있으므로 기존 미션 사용)
QUIZ_RESPONSE=$(curl -s -X GET "$API_URL/management/mission" \
  -H "X-API-KEY: $API_KEY" | jq '.data[] | select(.code == "QUIZ")')

QUIZ_MISSION_ID=$(echo $QUIZ_RESPONSE | jq -r '.id')
print_result $? "퀴즈 미션 조회 완료 (ID: $QUIZ_MISSION_ID)" "$QUIZ_RESPONSE"

# 3. 백오피스 - 이벤트 생성 (퀴즈 포함)
echo -e "\n${YELLOW}3. 백오피스 - 이벤트 생성${NC}"

# 오늘 날짜 구하기
TODAY=$(date +%Y-%m-%d)

EVENT_RESPONSE=$(curl -s -X POST "$API_URL/management/event/periods" \
  -H "X-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"2025년 1월 건강 챌린지\",
    \"startDate\": \"$TODAY\",
    \"totalDays\": 21,
    \"description\": \"21일간 건강한 습관 만들기\",
    \"type\": \"CHALLENGE\"
  }")

EVENT_ID=$(echo $EVENT_RESPONSE | jq -r '.data.id')
print_result $? "이벤트 생성 완료 (ID: $EVENT_ID)" "$EVENT_RESPONSE"

# 이벤트에 퀴즈 추가 (1일차, 7일차, 14일차)
echo -e "\n${YELLOW}이벤트에 퀴즈 추가${NC}"

# 1일차 퀴즈
curl -s -X POST "$API_URL/management/event/periods/$EVENT_ID/quizzes" \
  -H "X-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "day": 1,
    "question": "하루 권장 물 섭취량은?",
    "options": ["1L", "1.5L", "2L", "2.5L"],
    "correctAnswer": 2,
    "points": 50
  }' > /dev/null

print_result $? "1일차 퀴즈 추가 완료"

# 7일차 퀴즈
curl -s -X POST "$API_URL/management/event/periods/$EVENT_ID/quizzes" \
  -H "X-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "day": 7,
    "question": "성인 하루 권장 걸음 수는?",
    "options": ["5000보", "7500보", "10000보", "15000보"],
    "correctAnswer": 2,
    "points": 50
  }' > /dev/null

print_result $? "7일차 퀴즈 추가 완료"

# 14일차 퀴즈
curl -s -X POST "$API_URL/management/event/periods/$EVENT_ID/quizzes" \
  -H "X-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "day": 14,
    "question": "건강한 수면 시간은?",
    "options": ["5-6시간", "7-8시간", "9-10시간", "11시간 이상"],
    "correctAnswer": 1,
    "points": 50
  }' > /dev/null

print_result $? "14일차 퀴즈 추가 완료"

# 4. 백오피스 - 이벤트와 설문/미션 연결
echo -e "\n${YELLOW}4. 백오피스 - 이벤트와 설문/미션 연결${NC}"

# 설문 연결
curl -s -X POST "$API_URL/management/event/periods/$EVENT_ID/surveys" \
  -H "X-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"surveyId\": $SURVEY_ID,
    \"type\": \"before\",
    \"fromDay\": 1
  }" > /dev/null

print_result $? "사전 설문 연결 완료"

# 미션 연결
curl -s -X POST "$API_URL/management/event/periods/$EVENT_ID/missions" \
  -H "X-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"missionId\": $ACTIVITY_ID,
    \"points\": 100,
    \"activeFromDay\": 1,
    \"activeToDay\": 21,
    \"sortOrder\": 1
  }" > /dev/null

print_result $? "활동 미션 연결 완료"

curl -s -X POST "$API_URL/management/event/periods/$EVENT_ID/missions" \
  -H "X-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"missionId\": $QUIZ_MISSION_ID,
    \"points\": 50,
    \"activeFromDay\": 1,
    \"activeToDay\": 21,
    \"sortOrder\": 2
  }" > /dev/null

print_result $? "퀴즈 미션 연결 완료"

# 5. 사용자 - 회원가입/로그인
echo -e "\n${YELLOW}5. 사용자 - 회원가입/로그인${NC}"

# 회원가입
SIGNUP_RESPONSE=$(curl -s -X POST "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234!",
    "name": "테스트 사용자",
    "mobile": "010-1234-5678",
    "birthDate": "1990-01-01",
    "gender": "M"
  }')

print_result $? "회원가입 완료" "$SIGNUP_RESPONSE"

# 로그인
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234!"
  }')

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.accessToken')
print_result $? "로그인 완료" "$LOGIN_RESPONSE"

# 6. 사용자 - 이벤트 참여
echo -e "\n${YELLOW}6. 사용자 - 이벤트 참여${NC}"

# 현재 이벤트 상태 확인
STATUS_RESPONSE=$(curl -s -X GET "$API_URL/challenge/status?date=$TODAY" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

print_result $? "이벤트 상태 확인" "$STATUS_RESPONSE"

# 사전 설문 응답
echo -e "\n${YELLOW}사전 설문 응답${NC}"

SURVEY_CHECK=$(curl -s -X GET "$API_URL/survey/check-before" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if [ $(echo $SURVEY_CHECK | jq -r '.data.needsSurvey') = "true" ]; then
    # 설문 질문 조회
    QUESTIONS=$(curl -s -X GET "$API_URL/survey/before/current" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    QUESTION_ID=$(echo $QUESTIONS | jq -r '.data.surveyQuestions[0].id')
    
    # 설문 응답 제출
    curl -s -X POST "$API_URL/survey/answer" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"surveyQuestionId\": $QUESTION_ID,
        \"answerValue\": \"보통\"
      }" > /dev/null
    
    print_result $? "사전 설문 응답 완료"
fi

# 오늘의 미션 조회
echo -e "\n${YELLOW}오늘의 미션 조회${NC}"

MISSIONS_RESPONSE=$(curl -s -X GET "$API_URL/missions/today" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

print_result $? "오늘의 미션 조회 완료" "$MISSIONS_RESPONSE"

# 활동 미션 완료
echo -e "\n${YELLOW}미션 수행${NC}"

ACTIVITY_COMPLETE=$(curl -s -X POST "$API_URL/missions/activity/$TODAY/complete" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "note": "30분 조깅 완료!"
  }')

print_result $? "활동 미션 완료" "$ACTIVITY_COMPLETE"

# 퀴즈 답변
QUIZ_RESPONSE=$(curl -s -X GET "$API_URL/missions/quiz/$TODAY" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if [ $? -eq 0 ]; then
    QUIZ_ANSWER=$(curl -s -X POST "$API_URL/missions/quiz/$TODAY/answer" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "selectedAnswer": 2
      }')
    
    print_result $? "퀴즈 답변 제출" "$QUIZ_ANSWER"
fi

# 이벤트 통계 확인
echo -e "\n${YELLOW}백오피스 - 이벤트 통계 확인${NC}"

STATS_RESPONSE=$(curl -s -X GET "$API_URL/management/event/periods/$EVENT_ID/statistics" \
  -H "X-API-KEY: $API_KEY")

print_result $? "이벤트 통계 조회" "$STATS_RESPONSE"

echo -e "\n================================"
echo "✅ 통합 테스트 완료!"
echo "================================"

# 생성된 데이터 정보 출력
echo -e "\n📊 생성된 테스트 데이터:"
echo "- 설문 ID: $SURVEY_ID"
echo "- 활동 미션 ID: $ACTIVITY_ID"
echo "- 퀴즈 미션 ID: $QUIZ_MISSION_ID"
echo "- 이벤트 ID: $EVENT_ID"
echo "- 테스트 사용자: test@example.com"