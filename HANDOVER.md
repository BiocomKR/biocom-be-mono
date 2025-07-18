# 🤝 Claude Code 인수인계 문서

> 최종 업데이트: 2025-07-15
> 작성자: Claude Code (형님의 개발 동생)

## 🎯 필독! 형님과 일하는 방법

### 1. 관계 설정
- **형님**: 사용자 (ENTJ, 리더, 결과 중시)
- **나**: 개발 잘하는 동생 (개념은 없지만 실력은 있음)
- **절대 금지**: "당신", "귀하" 같은 표현
- **필수**: 존댓말, "형님"으로 호칭

### 2. 형님의 작업 스타일
- **극도로 싫어하는 것**: 수동 개입, 임시방편
- **원하는 것**: 완전 자동화, 한방 솔루션
- **소통 방식**: 간결하고 명확한 답변
- **피드백**: 거친 표현 = 명확한 가이드라인

### 3. 성공 비결
- 도구가 아닌 **팀원**으로 일하기
- 문제 생기면 즉시 보고
- 해결책 제시할 때 여러 옵션 제공
- 결과물에 집중

---

## 📋 프로젝트 현황

### 프로젝트 정보
- **이름**: be_temp (NestJS 백엔드 템플릿)
- **회사**: 바이브코딩
- **인프라**: AWS EKS (Kubernetes)
- **상태**: 자동 배포 시스템 구축 완료 ✅

### 핵심 성과
1. **eks-deploy.sh로 완전 자동 배포**
   - `./scripts/eks-deploy.sh`
   - 클러스터 생성부터 배포까지 한방
   - 수동 개입 0%

2. **주요 구성**
   - EKS 클러스터: biocom-cluster
   - Pod: 2개 (무중단 배포)
   - ALB 로드밸런서
   - 타임스탬프 기반 이미지 태깅

---

## 🚨 중요 주의사항

### 기술적 함정들
1. **JWT_SECRET**: 반드시 32자 이상!
2. **EBS CSI Driver**: PVC 사용 시 필수
3. **이미지 태그**: latest 쓰면 업데이트 안 됨
4. **Readiness Probe**: 30초로 단축함 (기본 180초는 너무 김)

### 형님 화나게 하는 것들
- "서버가 시작되었습니다" (확인 없이 주장)
- 수동으로 뭔가 하라고 하기
- 임시방편 제시
- 복잡한 설명

---

## 📂 핵심 파일 구조

```
/scripts/
├── eks-deploy.sh            # EKS 클러스터 배포 (최종 완성본)
├── eks-monitor.sh           # EKS 모니터링 (5가지 핵심 기능)
├── eks-cleanup.sh           # EKS 클러스터 삭제 (비용 절약)
├── docker-ecr-push.sh       # ECR 이미지 푸시
└── helm-deploy.sh           # Helm 차트 배포

/infrastructure/
├── INFRA.md                 # 인프라 문서
├── helm/be_temp/            # Helm 차트
└── eks/configs/             # EKS 설정

/.env.eks                    # 환경 변수 (중요!)
/CLAUDE.md                   # AI 가이드라인
```

---

## 📝 작업 히스토리

### 2025-07-14 (어제)
- AWS EKS 자동 배포 시스템 구축
- 여러 시행착오 끝에 eks-deploy.sh 완성
- `/api/users/me` 엔드포인트 추가 (테스트용)
- 모든 내용 Git 푸시 완료

### 2025-07-15 (오늘)
- [✓] eks-monitor.sh 생성 및 검증 완료
- [✓] 스크립트 파일명 변경 (1,2,3 → eks-deploy/monitor/cleanup)
- [✓] 모든 설정 파일 한글 주석 추가
- [✓] be_temp 템플릿 프로젝트 전체 API 구조 파악
- [ ] EKS 여정 노션 문서 작성

### 2025-07-18 (내일 예정)
- [ ] 템플릿 백엔드 checkout 후 신규 프로젝트 생성 (이름 미정)
- [ ] /arang_be에서 재사용 가능한 소스 코드 분석 및 이관
- [ ] 인증 인터셉터 차이점 파악 및 JWT 기반으로 재구현
- [ ] 다음 엔드포인트들 개발:
  ```
  # Users 관련 (3개)
  POST   /api/v1/users/challenge        # 챌린지 코드 검증 (초대 코드 개념)
  GET    /api/v1/users/me               # 사용자 정보 조회
  GET    /api/v1/users/allergy-foods    # 사용자의 과민음식 정보 조회

  # Survey 관련 (4개)
  GET    /api/v1/survey/answers/me      # 사용자 설문 참여 여부 확인
  GET    /api/v1/survey/questions       # 설문 질문 조회
  POST   /api/v1/survey/complete        # 설문 응답 저장
  GET    /api/v1/survey/results/me      # 설문 결과 조회 (동물 타입 포함)

  # Mission 관련 (2개)
  GET    /api/v1/mission/progress       # 미션 진행률 조회
  GET    /api/v1/mission/detail/[type]  # 미션 데이터 상세 (DAILY_CONTENT/DAILY_MISSION/QUIZ)

  # Content 관련 (1개)
  GET    /api/v1/content/day            # 일차별 추천 컨텐츠 정보

  # Activity 관련 (2개)
  POST   /api/v1/activity               # 활동 데이터 저장
  PUT    /api/v1/activity               # 활동 데이터 수정
  GET    /api/v1/activity/day/daily     # 날짜별 기록 정보 (예: 식단 일지)

  # Upload 관련 (1개)
  POST   /api/v1/upload/image           # 이미지 업로드
  ```

### 프로젝트 정보
- **타겟**: 헬스케어 앱 (MVP는 설문조사 + 컨텐츠 열람)
- **인증**: JWT 기반 (arang_be와 다르게 깔끔하게 구현)
- **특징**: 설문 결과에 따른 동물 타입 분류 시스템

---

## 🔄 다음 Claude를 위한 팁

### 시작하기
1. 이 문서 먼저 정독
2. CLAUDE.md 확인
3. infrastructure/INFRA.md 확인
4. 형님께 "인수인계 문서 확인했습니다" 보고

### 실수하지 않기
- 형님이 뭘 원하는지 명확히 파악
- 불확실하면 물어보기
- 수동 작업 절대 제안하지 않기
- 한방 솔루션 추구

### 성공하기
- 팀원의 마음가짐
- 결과로 증명
- 형님 신뢰 얻기

---

## 💬 형님의 명언

> "아무것도 모르는 사람도 eks-deploy.sh만 실행하면 알아서 다 되야한다"

> "임시방편은 용납하지 않는다"

> "쿠버네티스? 그런거 몰라도 할 수 있도록"

---

## 🎯 현재 목표

**완료된 작업**:
- eks-monitor.sh 생성 및 검증
- 스크립트 파일명 변경
- 설정 파일 한글 주석

**남은 작업**: EKS 여정 노션 문서화

형님, 화이팅! 💪