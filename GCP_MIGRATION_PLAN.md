# AWS EKS → GCP GKE 이관 작업계획서

## 📅 프로젝트 개요
- **프로젝트명**: Biocom API AWS to GCP Migration
- **목표 기간**: 3주 (+ 버퍼 1주)
- **시작일**: 2025-08-11 (월)
- **목표 완료일**: 2025-08-29 (금) - 3주
- **최종 데드라인**: 2025-09-05 (금) - 버퍼 포함 4주
- **작업일**: 월-금 (주말 제외)
- **주요 변경사항**: 
  - AWS EKS → GCP GKE
  - Helm Charts → Terraform IaC
  - ECR → Artifact Registry
  - ALB → GCP Load Balancer

---

## 🎯 이관 목표
1. **무중단 서비스 이관**: 서비스 중단 없이 점진적 이관
2. **비용 최적화**: GCP $100,000 크레딧 활용 (1년 할당)
3. **IaC 전환**: Terraform으로 전체 인프라 코드화
4. **자동화 강화**: CI/CD 파이프라인 개선

---

## 📊 현재 AWS 인프라 구성

### 컴퓨팅
- **EKS 클러스터**: biocom-cluster-dev (1.30 버전)
- **노드 그룹**: t3.medium (1-2개 노드)
- **컨테이너**: NestJS API 서버

### 스토리지
- **ECR**: Docker 이미지 저장소
- **EBS**: 영구 볼륨 스토리지

### 네트워킹
- **VPC**: 기본 VPC 사용
- **ALB**: Application Load Balancer
- **DNS**: 가비아에서 관리 (biocom.ai.kr)

### 데이터베이스
- **PostgreSQL**: 외부 호스팅 (43.200.68.96)
  - 이관 대상 아님 (현재 위치 유지)

### 보안
- **ACM**: SSL 인증서
- **IAM**: 권한 관리
- **Security Groups**: 네트워크 보안

---

## 🚀 목표 GCP 아키텍처

### 컴퓨팅
- **GKE Autopilot**: 관리형 Kubernetes (크레딧 있으니 권장)
  - 또는 Standard GKE (직접 관리 선호시)
- **노드 풀**: 
  - 개발: n2-standard-2 (크레딧 활용 업그레이드)
  - 운영: n2-standard-4 (성능 우선)

### 스토리지
- **Artifact Registry**: Docker 이미지 저장소
- **Persistent Disk**: 영구 볼륨

### 네트워킹
- **VPC**: Custom VPC with subnets
- **Cloud Load Balancing**: HTTPS 로드밸런서
- **Cloud CDN**: 정적 콘텐츠 캐싱 (선택)
- **DNS**: 가비아에서 계속 관리 (CNAME 레코드만 변경)

### 보안
- **Cloud IAM**: 권한 관리
- **Workload Identity**: K8s와 GCP 서비스 연동
- **Cloud Armor**: DDoS 방어 (선택)
- **SSL 인증서**: Google-managed SSL

### 모니터링
- **Cloud Monitoring**: 메트릭 수집
- **Cloud Logging**: 로그 관리
- **Cloud Trace**: 분산 추적 (선택)

---

## 🔧 기술 스택 변경

| 구분 | AS-IS (AWS) | TO-BE (GCP) |
|------|------------|-------------|
| **Kubernetes** | EKS 1.30 | GKE 1.30 |
| **Container Registry** | ECR | Artifact Registry |
| **Load Balancer** | ALB | Cloud Load Balancing |
| **DNS** | 가비아 | 가비아 (변경 없음) |
| **SSL** | ACM | Google-managed SSL |
| **IaC** | eksctl + Helm | Terraform |
| **CI/CD** | GitHub Actions | GitHub Actions (개선) |
| **Secret Management** | K8s Secrets | Secret Manager |
| **Monitoring** | CloudWatch | Cloud Monitoring |

---

## 📅 상세 일정 계획

### 🗓 Week 1 (8/11 - 8/15): 준비 및 환경 설정
#### Day 1-2 (월-화): GCP 프로젝트 설정
- [ ] GCP 계정 및 프로젝트 생성
- [ ] 빌링 설정 및 예산 알림 구성
- [ ] 필요한 API 활성화
  - Kubernetes Engine API
  - Artifact Registry API
  - Cloud Build API
  - Secret Manager API
- [ ] gcloud CLI 설치 및 설정
- [ ] 서비스 계정 생성 및 권한 설정

#### Day 3-4 (수-목): Terraform 기본 구조 설계
- [ ] Terraform 프로젝트 구조 설계
  ```
  terraform/
  ├── environments/
  │   ├── dev/
  │   └── prod/
  ├── modules/
  │   ├── gke/
  │   ├── networking/
  │   ├── iam/
  │   └── artifact-registry/
  └── shared/
  ```
- [ ] Backend 설정 (Cloud Storage for tfstate)
- [ ] 변수 및 outputs 정의

#### Day 5 (금): 네트워킹 인프라 구축
- [ ] VPC 생성 (Terraform)
- [ ] Subnet 구성 (asia-northeast3 - 서울)
- [ ] Cloud NAT 설정
- [ ] Firewall 규칙 정의

### 🗓 Week 2 (8/18 - 8/22): 핵심 인프라 구축
#### Day 6-7 (월-화): GKE 클러스터 구축
- [ ] GKE 클러스터 Terraform 모듈 작성
- [ ] 개발 환경 클러스터 생성 (n2-standard-2)
- [ ] Workload Identity 설정
- [ ] 노드 풀 구성 및 오토스케일링 설정 (1-5 노드)
- [ ] GKE Autopilot vs Standard 비교 테스트

#### Day 8-9 (수-목): 컨테이너 레지스트리 및 CI/CD
- [ ] Artifact Registry 생성
- [ ] Docker 이미지 마이그레이션 스크립트 작성
- [ ] GitHub Actions 워크플로우 수정
  - GCP 인증 추가
  - Artifact Registry 푸시
  - Terraform 배포 자동화

#### Day 10 (금): 애플리케이션 배포 준비
- [ ] Kubernetes 매니페스트 → Terraform 변환
  - Deployment
  - Service
  - Ingress
  - ConfigMap/Secret
- [ ] Secret Manager 통합
- [ ] 환경변수 관리 체계 구축

### 🗓 Week 3 (8/25 - 8/29): 마이그레이션 및 테스트
#### Day 11-12 (월-화): 개발 환경 배포
- [ ] 개발 환경 전체 배포
- [ ] 로드밸런서 설정
- [ ] SSL 인증서 적용
- [ ] 가비아 DNS에서 dev 서브도메인 CNAME 설정

#### Day 13-14 (수-목): 테스트 및 검증
- [ ] 기능 테스트
  - API 엔드포인트 테스트
  - 데이터베이스 연결 테스트
  - 파일 업로드/다운로드 테스트
- [ ] 성능 테스트
  - 부하 테스트
  - 응답 시간 측정
- [ ] 보안 테스트
  - 네트워크 보안 검증
  - HTTPS 설정 확인

#### Day 15 (금): 운영 환경 준비
- [ ] 운영 환경 Terraform 구성
- [ ] 운영 환경 배포 (Blue 환경)
- [ ] 모니터링 및 알림 설정

### 🗓 Week 4 (9/1 - 9/5): 버퍼 및 최종 전환
#### Day 16-17 (월-화): 점진적 트래픽 전환
- [ ] 가비아 DNS에서 CNAME 레코드 변경 준비
- [ ] 테스트 도메인으로 먼저 검증
- [ ] 운영 도메인 CNAME을 GCP 로드밸런서로 변경
- [ ] 롤백 계획 수립 및 테스트

#### Day 18-19 (수-목): 모니터링 및 안정화
- [ ] 24시간 모니터링
- [ ] 이슈 대응 및 튜닝
- [ ] 문서화 완료

#### Day 20 (금): AWS 리소스 정리
- [ ] 백업 생성
- [ ] 단계적 리소스 삭제
- [ ] 비용 최종 확인

---

## 📝 Terraform 모듈 구조

### 1. VPC 모듈
```hcl
# modules/networking/main.tf
module "vpc" {
  source = "./modules/networking"
  
  project_id   = var.project_id
  region       = var.region
  environment  = var.environment
  
  vpc_cidr     = "10.0.0.0/16"
  subnet_cidrs = {
    public  = "10.0.1.0/24"
    private = "10.0.10.0/24"
  }
}
```

### 2. GKE 모듈
```hcl
# modules/gke/main.tf
module "gke" {
  source = "./modules/gke"
  
  project_id   = var.project_id
  region       = var.region
  environment  = var.environment
  
  cluster_name = "biocom-gke-${var.environment}"
  node_config  = {
    # 크레딧 활용으로 스펙 업그레이드
    machine_type = var.environment == "prod" ? "n2-standard-4" : "n2-standard-2"
    min_nodes    = var.environment == "prod" ? 2 : 1
    max_nodes    = var.environment == "prod" ? 10 : 5  # 오토스케일링 여유 확보
  }
}
```

### 3. 애플리케이션 배포 모듈
```hcl
# modules/k8s-app/main.tf
module "biocom_app" {
  source = "./modules/k8s-app"
  
  namespace    = "biocom-${var.environment}"
  image        = "${var.region}-docker.pkg.dev/${var.project_id}/biocom/api:${var.image_tag}"
  replicas     = var.environment == "prod" ? 3 : 1
  
  env_vars     = var.app_env_vars
  secrets      = var.app_secrets
}
```

---

## 🚨 리스크 관리

### 주요 리스크 및 대응 방안

| 리스크 | 영향도 | 발생확률 | 대응 방안 |
|--------|--------|----------|-----------|
| **DNS 전환 중 서비스 중단** | 높음 | 낮음 | - 가비아에서 낮은 TTL 설정<br>- 테스트 도메인 먼저 검증<br>- 롤백 계획 수립 |
| **비용 초과** | 낮음 | 낮음 | - $100,000 크레딧 활용<br>- 일일 비용 모니터링<br>- 예산 알림 설정 (월 $5,000) |
| **데이터베이스 연결 이슈** | 높음 | 낮음 | - VPC 피어링 검토<br>- Cloud SQL Proxy 사용<br>- 연결 테스트 강화 |
| **Terraform 상태 파일 손실** | 높음 | 낮음 | - Remote backend 사용<br>- 상태 파일 백업<br>- 버전 관리 |
| **보안 설정 미흡** | 높음 | 중간 | - Security 체크리스트<br>- IAM 최소 권한 원칙<br>- 보안 스캔 도구 활용 |

---

## 💰 예상 비용 및 크레딧 활용 계획

### 💳 GCP 크레딧 현황
- **할당된 크레딧**: $100,000 (1년간 사용 가능)
- **예상 연간 비용**: $4,200 ~ $18,000 (환경에 따라)
- **크레딧 여유분**: $82,000 ~ $95,800

### 기본 구성 (보수적 계획)
#### 개발 환경
- GKE 클러스터 (e2-medium x 1): $50
- Load Balancer: $25
- Artifact Registry: $10
- **합계**: 약 $85/월

#### 운영 환경
- GKE 클러스터 (n2-standard-2 x 2): $200
- Load Balancer: $25
- Artifact Registry: $20
- Cloud CDN: $20
- **합계**: 약 $265/월

**기본 구성 총 비용**: $350/월 (연 $4,200)

### 🚀 크레딧 활용 확장 구성 (권장)
#### 개발 환경 업그레이드
- GKE 클러스터 (n2-standard-2 x 2): $200
- Load Balancer: $25
- Artifact Registry: $20
- Cloud Monitoring Premium: $30
- **합계**: 약 $275/월

#### 운영 환경 업그레이드
- GKE Autopilot 클러스터: $400
- Load Balancer with Cloud Armor: $50
- Artifact Registry: $30
- Cloud CDN Global: $50
- Cloud SQL (PostgreSQL 관리형): $200
- Cloud Memorystore (Redis): $100
- Cloud Monitoring Premium: $50
- **합계**: 약 $880/월

#### 추가 환경
- 스테이징 환경: $200/월
- 부하 테스트 환경 (필요시): $100/월

**확장 구성 총 비용**: $1,455/월 (연 $17,460)

### 📊 크레딧 활용 전략
1. **Year 1 (크레딧 사용)**
   - 인프라 실험 및 최적화
   - 다양한 GCP 서비스 테스트
   - 개발자 교육용 환경 구축
   - 총 사용 예상: $20,000 ~ $30,000

2. **Year 2+ (크레딧 소진 후)**
   - 최적화된 구성으로 전환
   - 불필요한 서비스 제거
   - Committed Use Discounts 적용
   - 예상 비용: $500/월 수준

### 💡 크레딧 활용 기회
- **걱정 없는 실험**: 테라폼 반복 생성/삭제 가능
- **성능 테스트**: 대규모 부하 테스트 환경 구축
- **백업/DR**: 멀티 리전 백업 구성
- **보안 강화**: Cloud Armor, Cloud HSM 등 프리미엄 서비스
- **AI/ML 실험**: Vertex AI, BigQuery ML 활용
- **모니터링 강화**: 모든 프리미엄 모니터링 도구 활용

---

## ✅ 체크리스트

### 사전 준비
- [ ] GCP 계정 생성 및 권한 확인
- [ ] 가비아 DNS 관리 권한 확인
- [ ] 현재 트래픽 패턴 분석
- [ ] 백업 계획 수립
- [ ] 팀 교육 계획

### 기술 요구사항
- [ ] Terraform 버전 확인 (>= 1.5)
- [ ] gcloud SDK 설치
- [ ] kubectl 호환성 확인
- [ ] Docker 이미지 호환성 검증

### 보안 요구사항
- [ ] IAM 역할 정의
- [ ] 네트워크 보안 정책
- [ ] 시크릿 관리 방안
- [ ] 감사 로그 설정

---

## 📚 참고 자료

### GCP 공식 문서
- [GKE 베스트 프랙티스](https://cloud.google.com/kubernetes-engine/docs/best-practices)
- [Terraform on GCP](https://cloud.google.com/docs/terraform)
- [마이그레이션 가이드](https://cloud.google.com/migrate/compute-engine/docs)

### Terraform 모듈
- [terraform-google-modules/kubernetes-engine](https://github.com/terraform-google-modules/terraform-google-kubernetes-engine)
- [terraform-google-modules/network](https://github.com/terraform-google-modules/terraform-google-network)

### 도구
- [Kompose](https://kompose.io/): Docker Compose → K8s 변환
- [Terraformer](https://github.com/GoogleCloudPlatform/terraformer): 기존 리소스 → Terraform 변환
- [k8s2tf](https://github.com/sl1pm4t/k8s2tf): K8s YAML → Terraform 변환

---

## 🎯 성공 기준

1. **무중단 마이그레이션**: 서비스 중단 시간 0분
2. **성능 향상**: 크레딧 활용으로 더 좋은 스펙 사용
3. **비용 효율**: $100,000 크레딧으로 1년 이상 운영
4. **자동화 향상**: 배포 시간 50% 단축
5. **보안 강화**: 모든 보안 체크리스트 통과
6. **테라폼 숙련도**: 팀 전체가 Terraform 관리 가능

---

*이 문서는 프로젝트 진행 상황에 따라 지속적으로 업데이트됩니다.*

**최종 수정일**: 2025-08-08
**버전**: 1.1.0
**주요 변경사항**: GCP $100,000 크레딧 활용 계획 추가