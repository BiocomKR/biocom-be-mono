# 📝 테라폼 변수 정의 파일 - biocom-bo-api
# biocom-api 대비 경량화된 백오피스 API용 설정

# ===========================================
# 🌏 기본 GCP 설정
# ===========================================

variable "project_id" {
  description = "GCP 프로젝트 ID"
  type        = string
  default     = "biocom-bo-api"

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
  description = "VPC IP 대역 (biocom-api와 다른 대역)"
  type        = string
  default     = "10.10.0.0/16"  # biocom-api는 10.0.0.0/16
}

variable "subnet_cidr" {
  description = "서브넷 IP 대역"
  type        = string
  default     = "10.10.1.0/24"  # biocom-api는 10.0.1.0/24
}

variable "pods_cidr" {
  description = "Pod용 보조 IP 대역 (GKE 전용)"
  type        = string
  default     = "10.11.0.0/16"  # biocom-api는 10.1.0.0/16
}

variable "services_cidr" {
  description = "Service용 보조 IP 대역 (GKE 전용)"
  type        = string
  default     = "10.12.0.0/16"  # biocom-api는 10.2.0.0/16
}

# ===========================================
# 🚢 GKE 클러스터 설정 (경량화)
# ===========================================

variable "cluster_name" {
  description = "GKE 클러스터 이름"
  type        = string
  default     = "biocom-bo-cluster"  # 별도 클러스터
}

variable "kubernetes_version" {
  description = "쿠버네티스 버전 (빈 값이면 GCP 기본값 사용)"
  type        = string
  default     = ""
}

variable "node_pool_name" {
  description = "노드 풀 이름"
  type        = string
  default     = "bo-app-nodes"
}

variable "node_machine_type" {
  description = "노드 머신 타입 (백오피스용 경량 스펙)"
  type        = string
  default     = "e2-small"  # 2 vCPU, 2GB RAM (biocom-api는 n2-standard-2)
}

variable "node_disk_size" {
  description = "노드 디스크 크기 (GB)"
  type        = number
  default     = 20  # biocom-api는 30GB
}

variable "node_disk_type" {
  description = "노드 디스크 타입"
  type        = string
  default     = "pd-standard"
}

variable "node_min_count" {
  description = "노드 최소 개수"
  type        = number
  default     = 1
}

variable "node_max_count" {
  description = "노드 최대 개수"
  type        = number
  default     = 2  # biocom-api는 4
}

variable "node_initial_count" {
  description = "노드 초기 개수"
  type        = number
  default     = 1  # biocom-api는 2
}

variable "use_spot_instances" {
  description = "스팟 인스턴스 사용 여부 (70% 저렴)"
  type        = bool
  default     = true
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
  default     = "bo-api-dev"  # bo-api-dev.biocom.ai.kr
}

# ===========================================
# 🗄️ 데이터베이스 설정
# ===========================================
# 주의: biocom-bo-api는 biocom-api와 동일한 DB를 사용
# 별도 Cloud SQL 생성 없음

variable "shared_db_host" {
  description = "공유 데이터베이스 호스트 (biocom-api와 동일)"
  type        = string
  default     = "34.47.124.132"
}

variable "shared_db_port" {
  description = "공유 데이터베이스 포트"
  type        = string
  default     = "5432"
}

variable "shared_db_name" {
  description = "공유 데이터베이스 이름"
  type        = string
  default     = "biocom"
}

# ===========================================
# 📦 Google Cloud Storage 설정
# ===========================================
# 주의: biocom-bo-api는 biocom-api와 동일한 버킷을 사용

variable "shared_gcs_bucket_name" {
  description = "공유 GCS 버킷 이름 (biocom-api와 동일)"
  type        = string
  default     = "api-dev-biocom-uploads"
}

# ===========================================
# 🏷️ 공통 태그/라벨
# ===========================================

variable "common_labels" {
  description = "모든 리소스에 적용할 공통 라벨"
  type        = map(string)
  default = {
    project     = "biocom-bo-api"
    owner       = "biocom-team"
    managed-by  = "terraform"
    environment = "dev"
  }
}
