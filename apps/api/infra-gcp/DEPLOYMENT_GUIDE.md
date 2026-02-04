# BIOCOM API GKE 배포 가이드

## 디렉토리 구조

```
infra-gcp/
├── k8s/
│   ├── base/                          # 공통 리소스 (환경 무관)
│   │   ├── kustomization.yaml         # Base Kustomize 설정
│   │   ├── namespace.yaml
│   │   ├── deployment.yaml            # 이미지는 Kustomize로 오버라이드
│   │   ├── service.yaml
│   │   ├── backend-config.yaml
│   │   ├── pvc.yaml
│   │   └── cronjob-*.yaml
│   │
│   ├── overlays/
│   │   ├── dev/                       # 개발 환경 전용
│   │   │   ├── kustomization.yaml
│   │   │   ├── configmap.yaml         # 개발 환경 설정
│   │   │   └── ingress.yaml           # api-dev.biocom.ai.kr
│   │   │
│   │   └── prod/                      # 운영 환경 전용
│   │       ├── kustomization.yaml
│   │       ├── configmap.yaml         # 운영 환경 설정
│   │       └── ingress.yaml           # api.biocom.ai.kr
│   │
│   └── *.yaml                         # 레거시 파일 (삭제 예정)
│
├── scripts/
│   ├── 01-deploy-infrastructure.sh    # 인프라 배포
│   └── 02-deploy-app.sh               # 애플리케이션 배포 (Kustomize 기반)
│
└── .env.secrets                       # 민감정보 (Git 제외)
```

## 환경별 설정

| 환경 | 프로젝트 ID | 클러스터 | DB 인스턴스 | 도메인 |
|------|-------------|----------|-------------|--------|
| dev | api-dev-biocom | biocom-cluster-dev | biocom-postgres-dev | api-dev.biocom.ai.kr |
| prod | api-prod-biocom | biocom-cluster-prod | biocom-postgres-prod | api.biocom.ai.kr |

## 배포 명령어

### 개발 환경 배포
```bash
# 전체 배포 (빌드 + 마이그레이션 + 배포)
./infra-gcp/scripts/02-deploy-app.sh -p api-dev-biocom -e dev -y

# 빌드 없이 배포만
./infra-gcp/scripts/02-deploy-app.sh -p api-dev-biocom -e dev -s -y

# 마이그레이션 건너뛰기
./infra-gcp/scripts/02-deploy-app.sh -p api-dev-biocom -e dev -m -y
```

### 운영 환경 배포
```bash
# 전체 배포
./infra-gcp/scripts/02-deploy-app.sh -p api-prod-biocom -e prod -y

# 빌드 없이 배포만
./infra-gcp/scripts/02-deploy-app.sh -p api-prod-biocom -e prod -s -y
```

## 수동 Kustomize 배포

```bash
# 개발 환경
kubectl apply -k infra-gcp/k8s/overlays/dev

# 운영 환경
kubectl apply -k infra-gcp/k8s/overlays/prod

# 배포 미리보기 (dry-run)
kubectl apply -k infra-gcp/k8s/overlays/dev --dry-run=client -o yaml
```

## 주요 변경사항 (v2.0)

### 개선된 점

1. **환경별 파일 분리**
   - 더 이상 sed로 configmap을 동적으로 수정하지 않음
   - 환경별로 완전히 분리된 configmap.yaml, ingress.yaml 사용

2. **환경별 DB 인스턴스 분기**
   - dev: `biocom-postgres-dev`
   - prod: `biocom-postgres-prod`
   - 잘못된 환경의 DB에 접속하는 버그 수정

3. **Kustomize 기반 배포**
   - 이미지 태그 관리가 Kustomize로 통합
   - 환경별 replicas 자동 조정 (prod: 3, dev: 2)

4. **프로젝트 ID 검증**
   - 환경과 프로젝트 ID 불일치 시 경고

## 배포 전 체크리스트

- [ ] `.env.secrets` 파일 존재 확인
- [ ] Google Service Account Key 파일 존재 확인
- [ ] Firebase Service Account Key 파일 존재 확인
- [ ] KCP 인증서 파일 존재 확인
- [ ] gcloud 인증 완료 (`gcloud auth login`)
- [ ] kubectl 컨텍스트 확인 (`kubectl config current-context`)

## 문제 해결

### kustomize 명령어가 없는 경우
```bash
# macOS
brew install kustomize

# 또는 kubectl 내장 kustomize 사용
kubectl kustomize infra-gcp/k8s/overlays/dev | kubectl apply -f -
```

### DB 연결 오류
1. Cloud SQL 인스턴스가 올바른 환경의 것인지 확인
2. IP 화이트리스트 확인
3. 비밀번호 확인

### Pod이 시작되지 않는 경우
```bash
# Pod 로그 확인
kubectl logs -n biocom-api deployment/biocom-api

# Pod 상태 확인
kubectl describe pods -n biocom-api

# Events 확인
kubectl get events -n biocom-api --sort-by='.lastTimestamp'
```

## 롤백

```bash
# 이전 버전으로 롤백
kubectl rollout undo deployment/biocom-api -n biocom-api

# 특정 버전으로 롤백
kubectl rollout undo deployment/biocom-api -n biocom-api --to-revision=2

# 롤백 히스토리 확인
kubectl rollout history deployment/biocom-api -n biocom-api
```
