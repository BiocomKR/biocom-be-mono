# 🚀 바이브코딩 인프라 자동화 가이드

> 최종 업데이트: 2025-07-15
> 작성자: Claude Code + daegilchoi

## 📋 핵심 원칙 및 목표

### 🎯 절대 원칙
1. **단일 스크립트 실행으로 모든 것 완료**
   - `eks-deploy.sh` 한 번 실행 = 전체 인프라 구축 및 배포 완료
   - 최초 설치든, 소스코드 수정 후 재배포든 모든 경우에 작동
   - **임시방편 절대 금지**
   - **수동 개입 불필요**

2. **쿠버네티스 지식 불필요**
   - "쿠버네티스? 몰라도 할 수 있도록 완전 자동화"
   - 모든 복잡한 작업은 스크립트가 자동 처리

3. **IAM 권한 처리**
   - 권한 부족 시 명확히 알림
   - 임의로 우회하지 않고 필요한 권한 목록 제시

## 🏗️ 현재 인프라 구성

### AWS 리소스
- **EKS 클러스터**: biocom-cluster (ap-northeast-2)
- **노드 그룹**: backend-nodes (t3.medium × 2)
- **ECR 리포지토리**: backend-v2
- **데이터베이스**: PostgreSQL on EC2 (43.200.68.96:5432)

### 주요 구성요소
1. **AWS Load Balancer Controller** - ALB 생성 및 관리
2. **EBS CSI Driver** - 영구 볼륨 지원
3. **OIDC Provider** - IAM 역할 연동
4. **Helm Charts** - 애플리케이션 배포 관리

## 📝 작업 이력 및 개선사항

### 2025-07-14 주요 수정사항

#### 1. AWS Load Balancer Controller 설치 위치 수정
**문제**: 새 클러스터 생성 시 Controller가 설치되지 않음
**해결**: 클러스터 생성 직후 STEP 3.5로 Controller 설치 로직 이동
```bash
# 기존: 기존 클러스터 조건문 내부에만 있었음
# 수정: 신규/기존 클러스터 모두에서 실행되도록 독립 스텝으로 분리
```

#### 2. 삭제 스크립트 개선 (eks-cleanup.sh)
- AWS Load Balancer Controller 삭제 추가
- ALB 삭제 대기 시간 추가 (60초)
- IAM 정책 삭제 부분 제거 (권한 부족 & 재사용 가능)
- 색상 코드로 가독성 개선

#### 3. 설치 스크립트 개선 (eks-deploy.sh)
- 필수 도구 자동 설치 (aws, docker, kubectl, eksctl, helm)
- 진행률 표시 및 로깅 기능
- ECR 리포지토리 자동 생성
- 에러 처리 및 롤백 기능
- ALB 주소 다양한 패턴으로 확인

## 🔧 스크립트 사용법

### 전체 배포 (처음부터 끝까지)
```bash
./scripts/eks-deploy.sh
```

### 모니터링 (심플 인터페이스)
```bash
./scripts/eks-monitor.sh
```

### 전체 삭제 (비용 절약)
```bash
./scripts/eks-cleanup.sh
```

## ⚠️ 알려진 이슈 및 해결방법

### 1. vpc-cni OIDC 경고
```
recommended policies were found for "vpc-cni" addon, but since OIDC is disabled...
```
- **영향**: 치명적이지 않음, 클러스터는 정상 작동
- **원인**: eksctl의 vpc-cni 애드온 설치 시 OIDC 연동 타이밍 이슈
- **상태**: 모니터링 중, 필요시 개선 예정

### 2. IAM 권한 부족
- **필요 권한**: 아래 IAM 정책 JSON 참조
- **2025-07-14 발견된 누락 권한**:
  - `iam:ListOpenIDConnectProviders`
  - `iam:ListPolicies`
### 2025-07-15 개선사항

#### 1. 스크립트 파일명 변경
- `1-all-in-one-final.sh` → `eks-deploy.sh`
- `2-monitor.sh` → `eks-monitor.sh`
- `3-delete-final.sh` → `eks-cleanup.sh`

#### 2. 모니터링 스크립트 대폭 단순화
- 10개 메뉴 → 5개 핵심 기능
- 동적 리소스 탐색 (Helm 릴리즈 이름 자동 인식)
- 하드코딩 제거

#### 3. 모든 설정 파일 한글 주석 추가
- Dockerfile
- values.yaml, values-dev.yaml
- .env.eks

#### 4. EBS CSI Driver 자동 설치 추가
- PVC 사용 시 필수 드라이버
- eks-deploy.sh에 통합

## 🚀 다음 단계

1. **완료**: 자동화 시스템 구축 완료
2. **현재 진행 중**: EKS 여정 노션 문서화
   - 애플리케이션 접근 가능

## 📅 2025-07-14 추가 개선사항

### IAM 정책 자동 업데이트 로직 추가
- AWS Load Balancer Controller v2.9.0 정책으로 업데이트
- 오래된 정책 버전 자동 삭제
- 정책 업데이트 시 Controller 자동 재시작
- `elasticloadbalancing:DescribeListenerAttributes` 권한 문제 해결

### 2025-07-14 최종 수정사항 (1-all-in-one-final.sh)
1. **IAM 권한 사전 검증 추가**
   - 스크립트 시작 시 필요한 IAM 권한 확인
   - 누락된 권한 명확히 안내
   - 권한 부족 시 스크립트 중단

2. **정책 업데이트 에러 처리 개선**
   - `2>/dev/null` 제거하여 에러 메시지 표시
   - 권한 부족 시 명확한 메시지 출력
   - 기존 정책으로 계속 진행 가능

3. **정책 버전 관리 개선**
   - 버전 5개 제한 자동 처리
   - 가장 오래된 비기본 버전 삭제
   - AccessDenied 에러 적절히 처리

4. **완전 자동화 달성**
   - 수동 개입 불필요
   - 모든 에러 상황 자동 처리
   - 권한 부족 시에도 진행 가능

## 📌 중요 명령어

```bash
# Ingress 확인
kubectl get ingress

# AWS LB Controller 확인
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller

# 로그 확인
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller

# IngressClass 확인
kubectl get ingressclass
```

---

**"아무것도 모르는 사람도 1-all-in-one.sh만 실행하면 알아서 다 되야한다"** - 이것이 우리의 목표입니다.