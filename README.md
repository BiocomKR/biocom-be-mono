# 🚀 바이브코딩 백엔드 템플릿 (EKS 버전)

> NestJS + AWS EKS 기반의 확장 가능한 백엔드 템플릿

## 📋 개요

이 프로젝트는 AWS EKS(Elastic Kubernetes Service)에서 실행되는 NestJS 백엔드 템플릿입니다.
**완전 자동화된 배포 시스템**으로 인프라 지식 없이도 쉽게 사용할 수 있습니다.

## 🌟 핵심 특징

### 인프라
- **AWS EKS** - 관리형 Kubernetes 서비스
- **완전 자동화** - 단일 스크립트로 전체 인프라 구축
- **Auto Scaling** - 부하에 따른 자동 확장 (HPA)
- **Load Balancing** - AWS ALB를 통한 트래픽 분산
- **무중단 배포** - Rolling Update 지원

### 애플리케이션
- **NestJS** - 엔터프라이즈급 Node.js 프레임워크
- **Prisma ORM** - 타입 안전한 데이터베이스 접근
- **JWT 인증** - 토큰 기반 인증 시스템
- **Swagger** - 자동 API 문서화
- **Health Check** - 상태 모니터링

## 🚀 빠른 시작

### 사전 요구사항
- AWS 계정 및 CLI 설정
- Docker Desktop 설치

### 1. 환경 설정
```bash
# 환경 변수 파일 생성
cp .env.eks.example .env.eks

# .env.eks 파일 편집하여 필요한 값 설정
# 특히 DATABASE_URL, JWT_SECRET 등 중요 값 확인
```

### 2. EKS 클러스터 배포
```bash
# 전체 인프라 구축 및 애플리케이션 배포 (약 20분 소요)
./scripts/eks-deploy.sh
```

이 스크립트 하나로:
- ✅ EKS 클러스터 생성
- ✅ 노드 그룹 구성
- ✅ 로드 밸런서 설정
- ✅ 애플리케이션 배포
- ✅ 모니터링 설정

### 3. 배포 확인
```bash
# 모니터링 도구 실행
./scripts/eks-monitor.sh

# 옵션 1 선택하면 전체 상태 확인 가능
```

## 📁 프로젝트 구조

```
.
├── src/                        # NestJS 소스 코드
│   ├── auth/                  # 인증 모듈
│   ├── users/                 # 사용자 모듈
│   └── common/                # 공통 모듈
├── infrastructure/            # 인프라 설정
│   ├── helm/be_temp/         # Helm 차트
│   └── docs/                 # 인프라 문서
├── scripts/                   # 자동화 스크립트
│   ├── eks-deploy.sh         # EKS 배포
│   ├── eks-monitor.sh        # 모니터링
│   └── eks-cleanup.sh        # 리소스 정리
├── prisma/                    # Prisma 스키마
├── .env.eks                   # EKS 환경 변수
└── Dockerfile                 # 컨테이너 이미지
```

## 🛠️ 주요 스크립트

### eks-deploy.sh
전체 배포를 자동으로 처리합니다.
- 클러스터가 없으면 생성
- 이미 있으면 애플리케이션만 업데이트
- 타임스탬프 기반 이미지 태깅으로 항상 최신 버전 배포

### eks-monitor.sh
심플한 모니터링 인터페이스를 제공합니다.
1. **전체 상태 보기** - 클러스터, Pod, 서비스 상태
2. **실시간 로그** - Pod 로그 스트리밍
3. **Pod 쉘 접속** - 디버깅용 직접 접속
4. **앱 재시작** - Rolling restart
5. **부하 테스트** - Artillery 기반 성능 테스트

### eks-cleanup.sh
개발 환경 정리용 (비용 절약).
- 모든 리소스 삭제
- ALB, EC2, NAT Gateway 등 과금 요소 제거

## 📊 모니터링 및 디버깅

### 기본 명령어
```bash
# Pod 상태 확인
kubectl get pods -l app.kubernetes.io/name=backend-api

# 로그 확인
kubectl logs -f $(kubectl get pods -l app.kubernetes.io/name=backend-api -o jsonpath='{.items[0].metadata.name}')

# ALB 주소 확인
kubectl get ingress -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}'
```

### 접속 정보
배포 완료 후 ALB 주소로 접속:
- API 문서: `http://ALB주소/api/docs`
- 헬스체크: `http://ALB주소/api/health`

## 🔧 개발 워크플로우

### 1. 로컬 개발
```bash
# 의존성 설치
npm install

# Prisma 설정
npm run prisma:generate
npm run prisma:migrate

# 개발 서버 실행
npm run start:dev
```

### 2. 배포
```bash
# 코드 수정 후 자동 배포
./scripts/eks-deploy.sh
```

### 3. 모니터링
```bash
# 배포 상태 확인
./scripts/eks-monitor.sh
```

## 🔐 환경 변수

### 필수 설정 (.env.eks)
```bash
# AWS 설정
AWS_ACCOUNT_ID=your-account-id
AWS_REGION=ap-northeast-2
CLUSTER_NAME=biocom-cluster

# 애플리케이션 설정
DATABASE_URL=postgresql://...
JWT_SECRET=최소32자이상필수
SESSION_SECRET=your-session-secret
```

## 💰 비용 관리

### 개발 환경 사용 후
```bash
# 모든 리소스 삭제 (중요!)
./scripts/eks-cleanup.sh
```

### 예상 비용
- EKS 클러스터: $0.10/시간
- EC2 노드 (t3.medium x2): ~$0.08/시간
- ALB: ~$0.025/시간 + 트래픽
- **일일 약 $5-10 (24시간 운영 시)**

## 📚 추가 문서

- [인프라 상세 가이드](./infrastructure/INFRA.md)
- [Kubernetes 명령어 모음](./infrastructure/docs/k8s-commands.md)
- [인수인계 문서](./HANDOVER.md)

## 🤝 기여 방법

1. 이 저장소를 Fork
2. Feature 브랜치 생성 (`git checkout -b feature/AmazingFeature`)
3. 변경사항 커밋 (`git commit -m 'Add: 놀라운 기능'`)
4. 브랜치에 Push (`git push origin feature/AmazingFeature`)
5. Pull Request 생성

## 📞 지원

문제가 있으신가요?
- 이슈 등록: [GitHub Issues](https://github.com/your-repo/issues)
- 내부 문서: Notion의 EKS 가이드 참조

## 📄 라이센스

ISC License - 자세한 내용은 [LICENSE](LICENSE) 파일 참조

---

**"쿠버네티스? 몰라도 됩니다. eks-deploy.sh 하나면 끝!"** 🚀