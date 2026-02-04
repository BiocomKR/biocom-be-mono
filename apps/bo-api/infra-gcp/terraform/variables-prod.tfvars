# 📝 BIOCOM BO-API 운영 환경 변수 파일
# dev 스펙의 2배 적용

# ===========================================
# 🌏 기본 GCP 설정
# ===========================================

project_id  = "api-prod-biocom"  # 운영 프로젝트
region      = "asia-northeast3"
zone        = "asia-northeast3-a"
environment = "prod"

# ===========================================
# 🌐 네트워킹 설정
# ===========================================

vpc_cidr      = "10.20.0.0/16"   # 운영 전용 대역
subnet_cidr   = "10.20.1.0/24"
pods_cidr     = "10.21.0.0/16"
services_cidr = "10.22.0.0/16"

# ===========================================
# 🚢 GKE 클러스터 설정 (dev의 2배)
# ===========================================

cluster_name      = "biocom-bo-cluster-prod"
node_pool_name    = "bo-app-nodes-prod"
node_machine_type = "e2-medium"    # dev: e2-small (2vCPU/2GB) → prod: e2-medium (2vCPU/4GB)
node_disk_size    = 40             # dev: 20GB → prod: 40GB
node_disk_type    = "pd-ssd"       # dev: pd-standard → prod: pd-ssd (성능)
node_min_count    = 2              # dev: 1 → prod: 2
node_max_count    = 4              # dev: 2 → prod: 4
node_initial_count = 2             # dev: 1 → prod: 2
use_spot_instances = false         # dev: true → prod: false (안정성)

# ===========================================
# 🔐 SSL 인증서 설정
# ===========================================

domain_name   = "biocom.ai.kr"
api_subdomain = "bo-api"  # bo-api.biocom.ai.kr (운영)

# ===========================================
# 🗄️ 데이터베이스 설정 (운영 DB)
# ===========================================

shared_db_host = "10.10.0.3"  # 운영 DB (Private IP)
shared_db_port = "5432"
shared_db_name = "biocom"

# ===========================================
# 📦 Google Cloud Storage 설정 (운영 버킷)
# ===========================================

shared_gcs_bucket_name = "api-prod-biocom-uploads"

# ===========================================
# 🏷️ 공통 태그/라벨
# ===========================================

common_labels = {
  project     = "biocom-backoffice"
  owner       = "biocom-team"
  managed-by  = "terraform"
  environment = "prod"
}
