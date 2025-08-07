# 🎮 자주 쓰는 Kubernetes 명령어 모음
# EKS 클러스터 운영에 필요한 핵심 명령어들

## 기본 확인 명령어
```bash
# 전체 리소스 확인
kubectl get all

# Pod 상태 확인
kubectl get pods
kubectl get pods -w  # 실시간 모니터링

# 서비스 확인
kubectl get svc

# Ingress 확인 (ALB 주소 확인)
kubectl get ingress
```

## 로그 확인
```bash
# 특정 Pod 로그 확인 (Pod 이름으로)
kubectl logs -f $(kubectl get pods -l app=backend-api -o jsonpath='{.items[0].metadata.name}')

# 이전 컨테이너 로그 확인 (재시작된 경우)
kubectl logs $(kubectl get pods -l app=backend-api -o jsonpath='{.items[0].metadata.name}') --previous

# 모든 Pod 로그 확인 (라벨 기반)
kubectl logs -l app=backend-api --all-containers=true
```

## 디버깅
```bash
# Pod 상세 정보 (첫 번째 Pod)
kubectl describe pod $(kubectl get pods -l app=backend-api -o jsonpath='{.items[0].metadata.name}')

# Pod에 직접 접속 (대화형 쉘)
kubectl exec -it $(kubectl get pods -l app=backend-api -o jsonpath='{.items[0].metadata.name}') -- /bin/sh

# 서비스 엔드포인트 확인
kubectl get endpoints

# HPA 상태 확인
kubectl get hpa
kubectl describe hpa backend-hpa
```

## 업데이트 및 롤백
```bash
# 이미지 업데이트 (ECR 사용)
kubectl set image deployment/backend-api backend-api=183631338083.dkr.ecr.ap-northeast-2.amazonaws.com/backend-v2:새버전태그

# 롤아웃 상태 확인
kubectl rollout status deployment/backend-api

# 롤백
kubectl rollout undo deployment/backend-api

# 특정 버전으로 롤백
kubectl rollout undo deployment/backend-api --to-revision=2
```

## 스케일링
```bash
# 수동 스케일링
kubectl scale deployment backend-api --replicas=5

# HPA 임계값 변경
kubectl edit hpa backend-hpa
```

## 문제 해결
```bash
# Pod가 시작되지 않을 때
kubectl describe pod $(kubectl get pods -l app=backend-api | grep -v Running | tail -1 | awk '{print $1}')
kubectl logs $(kubectl get pods -l app=backend-api | grep -v Running | tail -1 | awk '{print $1}')

# 이미지 pull 실패 시
kubectl get events --sort-by=.metadata.creationTimestamp

# 네트워크 문제 디버깅
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- /bin/bash
```

## 클러스터 관리
```bash
# 노드 확인
kubectl get nodes
kubectl describe node $(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')

# 클러스터 정보
kubectl cluster-info

# 리소스 사용량 확인
kubectl top nodes
kubectl top pods
```

## 🚀 바이브코딩 프로젝트 전용 명령어
```bash
# ALB 주소 빠르게 확인
kubectl get ingress backend-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# 현재 실행 중인 Pod 개수
kubectl get deployment backend-api -o jsonpath='{.status.replicas}'

# Pod 분포 확인 (어느 노드에 떠있는지)
kubectl get pods -l app=backend-api -o wide

# Secret 확인 (값은 보이지 않음)
kubectl get secret backend-secrets -o yaml

# ConfigMap 내용 확인
kubectl get configmap backend-config -o yaml

# 메트릭 서버 설치 확인 (top 명령어용)
kubectl get deployment metrics-server -n kube-system
```

## 🔧 Helm 관련 명령어
```bash
# 현재 설치된 릴리즈 확인
helm list

# 릴리즈 상태 확인
helm status biocom-api

# 릴리즈 히스토리
helm history biocom-api

# values 확인
helm get values biocom-api

# 업그레이드 (개발환경)
helm upgrade biocom-api ./infrastructure/helm/biocom-api -f ./infrastructure/helm/biocom-api/values-dev.yaml
```

## 🚀 바이브코딩 EKS 스크립트
```bash
# 전체 배포 (클러스터 생성 + 애플리케이션 배포)
./scripts/eks-deploy.sh

# 모니터링 도구 실행
./scripts/eks-monitor.sh

# 전체 삭제 (비용 절약)
./scripts/eks-cleanup.sh

# 이미지 빌드 및 ECR 푸시
./scripts/docker-ecr-push.sh

# Helm 차트 배포/업데이트
./scripts/helm-deploy.sh
```