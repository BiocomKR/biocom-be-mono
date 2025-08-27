# 📝 테라폼 변수 정의 파일
# 변수란? 환경별로 다를 수 있는 값들을 미리 정의해두는 곳
# 예: 개발환경은 작은 인스턴스, 운영환경은 큰 인스턴스

# ===========================================
# 🌏 기본 GCP 설정
# ===========================================

variable "project_id" {
  description = "GCP 프로젝트 ID"
  type        = string
  default     = "biocom-api"
  
  validation {
    condition     = length(var.project_id) > 0
    error_message = "프로젝트 ID는 반드시 입력해야 합니다."
  }
}

variable "region" {
  description = "GCP 리전 (서울)"
  type        = string
  default     = "asia-northeast3"
}

variable "zone" {
  description = "GCP 존 (서울 A존)"
  type        = string
  default     = "asia-northeast3-a"
}

variable "environment" {
  description = "배포 환경 (dev, staging, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "환경은 dev, staging, prod 중 하나여야 합니다."
  }
}

# ===========================================
# 🌐 네트워킹 설정
# ===========================================

variable "vpc_cidr" {
  description = "VPC IP 대역 (AWS의 172.16.0.0/16과 유사)"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_cidr" {
  description = "서브넷 IP 대역"
  type        = string
  default     = "10.0.1.0/24"
}

variable "pods_cidr" {
  description = "Pod용 보조 IP 대역 (GKE 전용)"
  type        = string
  default     = "10.1.0.0/16"
}

variable "services_cidr" {
  description = "Service용 보조 IP 대역 (GKE 전용)"
  type        = string
  default     = "10.2.0.0/16"
}

# ===========================================
# 🚢 GKE 클러스터 설정
# ===========================================

variable "cluster_name" {
  description = "GKE 클러스터 이름"
  type        = string
  default     = "biocom-cluster"
}

variable "kubernetes_version" {
  description = "쿠버네티스 버전 (빈 값이면 GCP 기본값 사용)"
  type        = string
  default     = ""  # GCP가 추천하는 최신 안정 버전 자동 선택
}

variable "node_pool_name" {
  description = "노드 풀 이름"
  type        = string
  default     = "app-nodes"
}

variable "node_machine_type" {
  description = "노드 머신 타입 (AWS t3.medium과 유사)"
  type        = string
  default     = "e2-standard-2"  # 2 vCPU, 8GB RAM (t3.medium과 비슷)
}

variable "node_disk_size" {
  description = "노드 디스크 크기 (GB)"
  type        = number
  default     = 30
}

variable "node_disk_type" {
  description = "노드 디스크 타입"
  type        = string
  default     = "pd-standard"  # 표준 디스크 (비용 효율적)
}

variable "node_min_count" {
  description = "노드 최소 개수"
  type        = number
  default     = 1
}

variable "node_max_count" {
  description = "노드 최대 개수"
  type        = number
  default     = 4
}

variable "node_initial_count" {
  description = "노드 초기 개수"
  type        = number
  default     = 2
}

variable "use_spot_instances" {
  description = "스팟 인스턴스 사용 여부 (AWS Spot과 동일, 70% 저렴)"
  type        = bool
  default     = true
}

# ===========================================
# 🗄️ Cloud SQL 설정
# ===========================================

variable "db_instance_name" {
  description = "Cloud SQL 인스턴스 이름"
  type        = string
  default     = "biocom-postgres"
}

variable "db_version" {
  description = "PostgreSQL 버전"
  type        = string
  default     = "POSTGRES_15"  # 최신 안정 버전
}

variable "db_tier" {
  description = "Cloud SQL 인스턴스 크기"
  type        = string
  default     = "db-f1-micro"  # 개발용 최소 사양 (운영환경에서는 더 큰 것 사용)
}

variable "db_disk_size" {
  description = "데이터베이스 디스크 크기 (GB)"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "데이터베이스 이름"
  type        = string
  default     = "biocom"
}

variable "db_username" {
  description = "데이터베이스 사용자명"
  type        = string
  default     = "postgres"
}

# ===========================================
# 🔐 SSL 인증서 설정
# ===========================================

variable "domain_name" {
  description = "메인 도메인 (가비아에서 관리)"
  type        = string
  default     = "biocom.ai.kr"
}

variable "api_subdomain" {
  description = "API 서브도메인"
  type        = string
  default     = "api-gcp"  # api-gcp.biocom.ai.kr
}

# ===========================================
# 📦 Google Cloud Storage 설정
# ===========================================

variable "gcs_uploads_bucket_name" {
  description = "업로드용 GCS 버킷 이름 (프로젝트 ID가 자동으로 접두사에 붙음)"
  type        = string
  default     = "biocom-uploads"
}

variable "enable_cdn" {
  description = "CDN 활성화 여부 (이미지 캐싱용)"
  type        = bool
  default     = true
}

variable "file_retention_days" {
  description = "파일 보관 기간 (일)"
  type        = number
  default     = 365
}

# ===========================================
# 🏷️ 공통 태그/라벨
# ===========================================

variable "common_labels" {
  description = "모든 리소스에 적용할 공통 라벨"
  type        = map(string)
  default = {
    project     = "biocom-api"
    owner       = "biocom-team"
    managed-by  = "terraform"
    environment = "dev"  # environment 변수로 오버라이드됨
  }
}