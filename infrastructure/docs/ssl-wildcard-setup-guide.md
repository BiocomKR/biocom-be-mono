# 🔒 AWS ACM 와일드카드 SSL 인증서 적용 가이드

> 작성일: 2025-07-23  
> 작성자: 최대길  
> 목적: EKS 환경에서 HTTPS 적용을 위한 와일드카드 인증서 발급 및 설정

## 📋 목차
1. [문제 상황](#1-문제-상황)
2. [원인 분석](#2-원인-분석)
3. [해결 방안](#3-해결-방안)
4. [실행 과정](#4-실행-과정)
5. [검증 및 확인](#5-검증-및-확인)
6. [핵심 포인트](#6-핵심-포인트)
7. [트러블슈팅](#7-트러블슈팅)

---

## 1. 문제 상황

### 증상
- `https://api-dev.biocom.ai.kr` 접속 시 SSL 인증서 경고 발생
- 브라우저에서 "주의 요함" 또는 "안전하지 않음" 메시지 표시

### 기대 결과
- HTTPS 접속 시 정상적인 보안 연결 (자물쇠 아이콘)
- SSL 인증서 경고 없이 안전한 접속

---

## 2. 원인 분석

### 근본 원인
기존 ACM 인증서가 단일 도메인(`biocom.ai.kr`)용으로만 발급되어 서브도메인 미지원

### 상세 분석
```
발급된 인증서: biocom.ai.kr (단일 도메인)
접속 시도: api-dev.biocom.ai.kr (서브도메인)
결과: 도메인 불일치로 인한 SSL 경고
```

---

## 3. 해결 방안

### 와일드카드 인증서 발급
- 도메인: `*.biocom.ai.kr`
- 효과: 모든 서브도메인 자동 지원
  - ✅ api-dev.biocom.ai.kr
  - ✅ api.biocom.ai.kr
  - ✅ api-prod.biocom.ai.kr
  - ✅ 향후 추가될 모든 서브도메인

---

## 4. 실행 과정

### 4.1 AWS ACM에서 와일드카드 인증서 발급

#### 1) AWS Console 접속
- AWS Certificate Manager (ACM) 서비스로 이동
- 리전: **서울 (ap-northeast-2)** 확인 필수

#### 2) 인증서 요청
```
퍼블릭 인증서 요청 → 다음

완전히 정규화된 도메인 이름: *.biocom.ai.kr
검증 방법: DNS 검증
키 알고리즘: RSA 2048
내보내기 허용: 비활성화 (AWS 서비스 전용)

태그 추가 (선택사항):
- Name: biocom-wildcard
- Environment: production

요청 → 완료
```

#### 3) DNS 검증 설정
ACM에서 제공하는 CNAME 레코드를 가비아 DNS에 추가:
```
호스트: _1234abcd5678efgh.biocom.ai.kr
타입: CNAME
값: _abcdef1234567890.acm-validations.aws.
TTL: 300
```

> ⚠️ 주의: 언더스코어(_)와 마지막 점(.) 포함 필수

#### 4) 검증 대기
- 일반적으로 5-10분 소요
- 최대 30분-1시간 소요 가능
- 상태: "검증 대기 중" → "발급됨"

### 4.2 새 인증서 ARN 적용

#### 1) 새 ARN 확인
```
arn:aws:acm:ap-northeast-2:183631338083:certificate/146ba478-2d2b-4525-ae3f-7ec62ea6fffe
```

#### 2) 환경 변수 업데이트
`.env.eks` 파일 수정:
```bash
# 기존
ACM_CERTIFICATE_ARN=arn:aws:acm:ap-northeast-2:183631338083:certificate/dcbf77fd-737e-4d18-9b33-d9fd5be9d25f

# 변경
ACM_CERTIFICATE_ARN=arn:aws:acm:ap-northeast-2:183631338083:certificate/146ba478-2d2b-4525-ae3f-7ec62ea6fffe
```

#### 3) Helm 차트 업데이트
```bash
# Helm 업그레이드만 실행 (빠른 방법)
./scripts/helm-deploy.sh dev upgrade

# 또는 전체 재배포 (안전한 방법)
./scripts/eks-deploy.sh
```

### 4.3 DNS 구조 이해

#### 두 종류의 CNAME 레코드
1. **인증서 검증용 CNAME** (일회성)
   ```
   _1234abcd  CNAME  _5678efgh.acm-validations.aws.
   ```
   - 목적: 도메인 소유권 확인
   - 인증서 발급 후에도 유지 권장 (그냥 지우지마.)

2. **서비스 연결용 CNAME** (영구)
   ```
   api-dev  CNAME  k8s-default-biocomap-xxxxx.elb.amazonaws.com
   ```
   - 목적: 실제 트래픽 라우팅
   - 절대 삭제 금지

---

## 5. 검증 및 확인

### 5.1 CLI로 확인
```bash
# SSL 인증서 정보 확인
curl -vI https://api-dev.biocom.ai.kr 2>&1 | grep subject

# 출력 예시
# subject: CN=*.biocom.ai.kr
```

### 5.2 브라우저로 확인
1. 시크릿/프라이빗 모드로 접속 (캐시 방지)
2. `https://api-dev.biocom.ai.kr/api/docs` 접속
3. 주소창의 자물쇠 아이콘 확인
4. 인증서 세부정보에서 `*.biocom.ai.kr` 확인

---

## 6. 핵심 포인트

### 비용
- **AWS ACM 퍼블릭 인증서**: 완전 무료
- **자동 갱신**: 무료
- **와일드카드 인증서**: 추가 비용 없음

### 장점
- 하나의 인증서로 모든 서브도메인 커버
- 새 서브도메인 추가 시 인증서 재발급 불필요
- 관리 포인트 최소화

### 주의사항
- ACM 인증서는 AWS 서비스(ALB, CloudFront 등)에서만 사용 가능
- 외부 서버에서 사용 불가 (내보내기 비활성화 선택한 경우)
- 리전별로 인증서 관리 (서울 리전에서 발급한 인증서는 서울에서만 사용)

---

## 7. 트러블슈팅

### 문제: 브라우저에서 여전히 경고 표시
**해결방법:**
1. 브라우저 캐시 완전 삭제
2. 시크릿/프라이빗 모드로 재접속
3. Chrome: `chrome://settings/privacy` → 인터넷 사용 기록 삭제

### 문제: DNS 검증이 오래 걸림
**해결방법:**
1. CNAME 레코드 정확히 입력했는지 확인 (언더스코어, 점 포함)
2. TTL을 300(5분)으로 설정
3. 가비아 DNS 설정 저장 후 5-10분 대기

### 문제: Helm 업데이트 후에도 적용 안됨
**해결방법:**
```bash
# Ingress 상태 확인
kubectl describe ingress biocom-api-backend-api

# ALB Controller 재시작
kubectl rollout restart deployment/aws-load-balancer-controller -n kube-system
```

---

## 📝 결론

와일드카드 SSL 인증서 적용으로 다음을 달성했습니다:
- ✅ 모든 서브도메인에 대한 HTTPS 지원
- ✅ SSL 인증서 경고 해결
- ✅ 향후 확장성 확보 (새 서브도메인 자동 지원)
- ✅ 무료로 엔터프라이즈급 보안 구현

이제 `api-dev.biocom.ai.kr`, `api.biocom.ai.kr` 등 모든 서브도메인에서 안전한 HTTPS 연결이 가능합니다.

---

> 💡 **Tip**: 와일드카드 인증서 하나로 수십 개의 서브도메인을 관리할 수 있어, 개별 인증서 관리의 번거로움을 크게 줄일 수 있습니다.