# Cloud SQL Private IP 전환 작업 시나리오

> 작성일: 2026-01-12
> 목적: GKE 오토스케일링 시 DB 연결 문제 방지를 위한 Private IP 전환

---

## 1. 환경별 현황

### 1.1 개발 환경 (api-dev-biocom) - ✅ 완료

| 항목 | 값 |
|------|-----|
| Cloud SQL | `biocom-postgres-dev` |
| DB Public IP | `34.47.124.132` |
| **DB Private IP** | **`10.193.0.3`** ✅ |
| GKE 클러스터 | `biocom-cluster-dev` |
| **GKE VPC** | `biocom-cluster-dev-vpc` |
| Cloud SQL Network | `biocom-cluster-dev-vpc` ✅ |
| Authorized Networks | `0.0.0.0/0` (전체 허용 - 개발용) |

### 1.2 운영 환경 (api-prod-biocom)

| 항목 | 값 |
|------|-----|
| Cloud SQL | `biocom-postgres-prod` |
| DB Public IP | `34.64.51.209` |
| DB Private IP | 없음 |
| GKE 클러스터 | `biocom-cluster-prod` |
| **GKE VPC** | `default` |
| Authorized Networks | 특정 IP 목록 (수동 관리) |

---

## 2. 핵심 고려사항

### 2.1 VPC 일치 필요성

**Private IP 연결의 필수 조건**: Cloud SQL과 GKE가 **동일한 VPC**에 있거나 VPC 피어링이 되어 있어야 함.

| 환경 | GKE VPC | Cloud SQL VPC | 조치 필요 |
|------|---------|---------------|----------|
| 개발 | `biocom-cluster-dev-vpc` | `default` | VPC 피어링 또는 Cloud SQL VPC 변경 |
| 운영 | `default` | `default` | 동일 VPC - 피어링만 설정 |

### 2.2 다운타임 예상

| 작업 | 다운타임 | 비고 |
|------|----------|------|
| VPC 피어링 설정 | 없음 | 네트워크 설정만 |
| Cloud SQL Private IP 추가 | **1~2분** | 인스턴스 재시작 필요 |
| ConfigMap 변경 | 없음 | |
| Pod 재시작 | **10~30초** | Rolling update |

---

## 3. 개발 환경 작업 시나리오

### 3.1 사전 확인

```bash
# 1. Cloud SQL 현재 설정 확인
gcloud sql instances describe biocom-postgres-dev \
  --project=api-dev-biocom \
  --format="yaml(ipAddresses,settings.ipConfiguration)"

# 2. GKE 클러스터 VPC 확인
gcloud container clusters describe biocom-cluster-dev \
  --zone=asia-northeast3-a \
  --project=api-dev-biocom \
  --format="yaml(network,subnetwork)"

# 3. VPC 서브넷 IP 범위 확인
gcloud compute networks subnets describe biocom-cluster-dev-subnet \
  --region=asia-northeast3 \
  --project=api-dev-biocom \
  --format="yaml(ipCidrRange,privateIpGoogleAccess)"
```

### 3.2 Step 1: Service Networking API 활성화

```bash
# 개발 프로젝트에서 Service Networking API 활성화
gcloud services enable servicenetworking.googleapis.com \
  --project=api-dev-biocom
```

### 3.3 Step 2: Private Service Access 설정

개발 환경은 GKE가 `biocom-cluster-dev-vpc`를 사용하므로, 이 VPC에 피어링을 설정해야 합니다.

```bash
# 1. Private Service Access용 IP 범위 할당
gcloud compute addresses create google-managed-services-biocom-dev \
  --global \
  --purpose=VPC_PEERING \
  --prefix-length=16 \
  --network=biocom-cluster-dev-vpc \
  --project=api-dev-biocom

# 2. VPC 피어링 연결
gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges=google-managed-services-biocom-dev \
  --network=biocom-cluster-dev-vpc \
  --project=api-dev-biocom
```

### 3.4 Step 3: Cloud SQL Private IP 활성화

```bash
# Cloud SQL에 Private IP 추가 (GKE와 동일한 VPC 지정)
# ⚠️ 이 작업으로 인스턴스가 재시작됩니다 (1~2분 다운타임)
gcloud sql instances patch biocom-postgres-dev \
  --project=api-dev-biocom \
  --network=projects/api-dev-biocom/global/networks/biocom-cluster-dev-vpc
```

### 3.5 Step 4: Private IP 확인

```bash
# Private IP 할당 확인
gcloud sql instances describe biocom-postgres-dev \
  --project=api-dev-biocom \
  --format="yaml(ipAddresses)"

# 예상 결과:
# ipAddresses:
# - ipAddress: 34.47.124.132
#   type: PRIMARY
# - ipAddress: 10.x.x.x        <-- 새로 할당된 Private IP
#   type: PRIVATE
```

### 3.6 Step 5: Git ConfigMap 파일 수정 (⚠️ 중요!)

> **주의**: ConfigMap이 Git에 하드코딩되어 있어서 kubectl patch만 하면 다음 배포 시 원복됩니다!

```bash
# Git 파일 수정
# 파일: infra-gcp/k8s/overlays/dev/configmap.yaml
# 변경: DB_HOST: "34.47.124.132" → DB_HOST: "10.x.x.x"
```

### 3.7 Step 6: GKE ConfigMap 즉시 업데이트

```bash
# kubectl patch로 현재 클러스터에 즉시 적용
kubectl patch configmap biocom-api-config -n biocom-api \
  --context=gke_api-dev-biocom_asia-northeast3-a_biocom-cluster-dev \
  -p '{"data":{"DB_HOST":"10.x.x.x"}}'  # 실제 Private IP로 교체
```

### 3.8 Step 7: Pod 재시작 (ConfigMap 반영)

```bash
# Deployment 롤링 재시작
kubectl rollout restart deployment/biocom-api-deployment -n biocom-api \
  --context=gke_api-dev-biocom_asia-northeast3-a_biocom-cluster-dev

# 재시작 상태 확인
kubectl rollout status deployment/biocom-api-deployment -n biocom-api \
  --context=gke_api-dev-biocom_asia-northeast3-a_biocom-cluster-dev
```

### 3.9 Step 8: 연결 테스트

```bash
# 1. Pod 로그 확인 (DB 연결 성공 여부)
kubectl logs -l app=biocom-api -n biocom-api --tail=50 \
  --context=gke_api-dev-biocom_asia-northeast3-a_biocom-cluster-dev

# 2. API 헬스체크
curl https://dev-api.biocom.kr/health  # 실제 개발 API 주소로 변경

# 3. CronJob 테스트 실행
kubectl create job test-db-connection-$(date +%H%M%S) \
  --from=cronjob/create-weekly-supplements \
  -n biocom-api \
  --context=gke_api-dev-biocom_asia-northeast3-a_biocom-cluster-dev
```

---

## 4. 운영 환경 작업 시나리오

운영 환경은 GKE와 Cloud SQL이 모두 `default` VPC를 사용하므로 더 간단합니다.

### 4.1 사전 확인

```bash
# 현재 설정 확인
gcloud sql instances describe biocom-postgres-prod \
  --project=api-prod-biocom \
  --format="yaml(ipAddresses,settings.ipConfiguration)"
```

### 4.2 Step 1: Service Networking API 활성화 확인

```bash
gcloud services enable servicenetworking.googleapis.com \
  --project=api-prod-biocom
```

### 4.3 Step 2: Private Service Access 설정

```bash
# 1. Private Service Access용 IP 범위 할당
gcloud compute addresses create google-managed-services-default \
  --global \
  --purpose=VPC_PEERING \
  --prefix-length=16 \
  --network=default \
  --project=api-prod-biocom

# 2. VPC 피어링 연결
gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges=google-managed-services-default \
  --network=default \
  --project=api-prod-biocom
```

### 4.4 Step 3: Cloud SQL Private IP 활성화

```bash
# ⚠️ 이 작업으로 인스턴스가 재시작됩니다 (1~2분 다운타임)
# 사전에 사용자 공지 필요
gcloud sql instances patch biocom-postgres-prod \
  --project=api-prod-biocom \
  --network=projects/api-prod-biocom/global/networks/default
```

### 4.5 Step 4: Private IP 확인 및 ConfigMap 업데이트

```bash
# 1. Private IP 확인
gcloud sql instances describe biocom-postgres-prod \
  --project=api-prod-biocom \
  --format="yaml(ipAddresses)"

# 2. ConfigMap 업데이트
kubectl patch configmap biocom-api-config -n biocom-api \
  -p '{"data":{"DB_HOST":"10.x.x.x"}}'  # 실제 Private IP로 교체

# 3. Pod 롤링 재시작
kubectl rollout restart deployment/biocom-api-deployment -n biocom-api
```

### 4.6 Step 5: 검증

```bash
# API 헬스체크
curl https://api.biocom.kr/health

# Pod 로그 확인
kubectl logs -l app=biocom-api -n biocom-api --tail=100

# CronJob 테스트
kubectl create job test-private-ip-$(date +%H%M%S) \
  --from=cronjob/check-push-schedules -n biocom-api
```

---

## 5. 롤백 계획

Private IP 전환 후 문제 발생 시:

### 5.1 즉시 롤백 (ConfigMap만 변경)

```bash
# DB_HOST를 Public IP로 복원
kubectl patch configmap biocom-api-config -n biocom-api \
  -p '{"data":{"DB_HOST":"34.64.51.209"}}'  # 운영 Public IP

# Pod 재시작
kubectl rollout restart deployment/biocom-api-deployment -n biocom-api
```

### 5.2 완전 롤백 (Private IP 제거)

```bash
# Cloud SQL에서 Private IP 제거는 권장하지 않음
# Public IP도 유지하면서 ConfigMap만 변경하는 것이 안전
```

---

## 6. 작업 후 정리

### 6.1 Public IP Authorized Networks 정리 (선택사항)

Private IP로 완전 전환 후에는 Authorized Networks에서 GKE 노드 IP들을 제거할 수 있습니다.
단, 개발자 로컬 접속용 IP는 유지합니다.

```bash
# 운영 환경: 로컬 개발용 IP만 유지
gcloud sql instances patch biocom-postgres-prod \
  --project=api-prod-biocom \
  --authorized-networks="124.48.244.179/32"  # 사무실 IP만 유지
```

### 6.2 문서 업데이트

- [ ] README.md에 Private IP 사용 명시
- [ ] 운영 가이드에 노드 추가 시 IP 등록 불필요 명시
- [ ] 장애 대응 문서 업데이트

---

## 7. 체크리스트

### 개발 환경

- [ ] Service Networking API 활성화
- [ ] Private Service Access IP 범위 할당
- [ ] VPC 피어링 연결
- [ ] Cloud SQL Private IP 활성화
- [ ] Private IP 확인
- [ ] ConfigMap DB_HOST 변경
- [ ] Pod 재시작
- [ ] API 헬스체크 확인
- [ ] CronJob 테스트

### 운영 환경

- [ ] 작업 시간 공지 (1~2분 다운타임)
- [ ] Service Networking API 활성화
- [ ] Private Service Access IP 범위 할당
- [ ] VPC 피어링 연결
- [ ] Cloud SQL Private IP 활성화
- [ ] Private IP 확인
- [ ] ConfigMap DB_HOST 변경
- [ ] Pod 재시작
- [ ] API 헬스체크 확인
- [ ] CronJob 테스트
- [ ] 장애 보고서 업데이트

---

## 8. 예상 소요 시간

| 단계 | 개발 환경 | 운영 환경 |
|------|----------|----------|
| Service Networking API 활성화 | 1분 | 1분 |
| Private Service Access 설정 | 2~3분 | 2~3분 |
| Cloud SQL Private IP 활성화 | 1~2분 (다운타임) | 1~2분 (다운타임) |
| ConfigMap 변경 + Pod 재시작 | 1분 | 1분 |
| 검증 | 2~3분 | 2~3분 |
| **총 예상 시간** | **약 10분** | **약 10분** |

---

*작성: Claude Code*
