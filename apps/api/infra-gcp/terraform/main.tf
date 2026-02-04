# 🏗️ BIOCOM API - GCP 메인 인프라 설정
# 이 파일에서 모든 GCP 리소스를 정의합니다

# ===========================================
# 🌐 네트워킹 (VPC, 서브넷, 방화벽)
# ===========================================

# VPC 네트워크 생성 (AWS VPC와 동일한 개념)
resource "google_compute_network" "main" {
  name                    = "${var.cluster_name}-vpc"
  auto_create_subnetworks = false  # 서브넷을 수동으로 생성하겠다는 의미
  project                 = var.project_id
  
  # VPC 생성 로그 (디버깅용)
  description = "BIOCOM API 메인 VPC - ${var.environment} 환경"
}

# 서브넷 생성 (AWS의 서브넷과 동일)
resource "google_compute_subnetwork" "main" {
  name          = "${var.cluster_name}-subnet"
  ip_cidr_range = var.subnet_cidr  # 10.0.1.0/24
  region        = var.region
  network       = google_compute_network.main.id
  project       = var.project_id
  
  # GKE 전용 보조 IP 대역 설정 (AWS에는 없는 GCP 특수 기능)
  secondary_ip_range {
    range_name    = "pods"     # Pod들이 사용할 IP 대역
    ip_cidr_range = var.pods_cidr  # 10.1.0.0/16
  }
  
  secondary_ip_range {
    range_name    = "services"  # Service들이 사용할 IP 대역
    ip_cidr_range = var.services_cidr  # 10.2.0.0/16
  }
  
  # Private Google Access 활성화 (VM이 외부 IP 없이도 Google API 사용 가능)
  private_ip_google_access = true
  
  description = "BIOCOM API 메인 서브넷 - ${var.environment} 환경"
  
  # GKE가 사용 중일 때 서브넷 수정 방지
  lifecycle {
    ignore_changes = [secondary_ip_range]
  }
}

# Cloud Router 생성 (NAT Gateway 사용을 위해 필요)
resource "google_compute_router" "main" {
  name    = "${var.cluster_name}-router"
  region  = var.region
  network = google_compute_network.main.id
  project = var.project_id
  
  description = "BIOCOM API Cloud Router - NAT Gateway용"
}

# Cloud NAT 생성 (AWS NAT Gateway와 동일한 기능)
# Private 인스턴스들이 인터넷에 아웃바운드 연결을 하기 위해 필요
resource "google_compute_router_nat" "main" {
  name                               = "${var.cluster_name}-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"  # IP 자동 할당
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  project                            = var.project_id
  
  # 로그 설정 (디버깅용)
  log_config {
    enable = true
    filter = "ERRORS_ONLY"  # 에러만 로깅 (비용 절약)
  }
}

# 방화벽 규칙 - 내부 통신 허용 (AWS Security Group과 유사)
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.cluster_name}-allow-internal"
  network = google_compute_network.main.name
  project = var.project_id
  
  # 내부 VPC 간 모든 통신 허용
  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }
  
  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }
  
  allow {
    protocol = "icmp"  # ping 허용
  }
  
  source_ranges = [var.vpc_cidr]  # 같은 VPC 내에서만 허용
  description   = "VPC 내부 통신 허용"
}

# 방화벽 규칙 - SSH 접근 허용 (관리용)
resource "google_compute_firewall" "allow_ssh" {
  name    = "${var.cluster_name}-allow-ssh"
  network = google_compute_network.main.name
  project = var.project_id
  
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
  
  source_ranges = ["0.0.0.0/0"]  # 모든 IP에서 SSH 허용 (운영환경에서는 제한 필요)
  target_tags   = ["ssh-allowed"]
  description   = "SSH 접근 허용 (관리용)"
}

# 방화벽 규칙 - HTTP/HTTPS 접근 허용 (웹 서비스용)
resource "google_compute_firewall" "allow_http_https" {
  name    = "${var.cluster_name}-allow-http-https"
  network = google_compute_network.main.name
  project = var.project_id
  
  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
  
  source_ranges = ["0.0.0.0/0"]  # 모든 IP에서 웹 접근 허용
  target_tags   = ["http-server", "https-server"]
  description   = "HTTP/HTTPS 접근 허용 (웹 서비스용)"
}

# ===========================================
# 📦 Artifact Registry (Docker 이미지 저장소)
# ===========================================

# Artifact Registry 리포지토리 생성 (AWS ECR과 동일한 기능)
resource "google_artifact_registry_repository" "main" {
  location      = var.region
  repository_id = "biocom-api"
  description   = "BIOCOM API Docker 이미지 저장소"
  format        = "DOCKER"
  project       = var.project_id
  
  # 정리 정책 (오래된 이미지 자동 삭제)
  cleanup_policies {
    id     = "delete-old-images"
    action = "DELETE"
    
    condition {
      tag_state  = "UNTAGGED"
      older_than = "2592000s"  # 30일 (seconds)
    }
  }
  
  cleanup_policies {
    id     = "keep-minimum-versions"
    action = "KEEP"
    
    most_recent_versions {
      keep_count = 10  # 최신 10개 버전은 유지
    }
  }
}

# ===========================================
# 💾 GCS 버킷 (테라폼 상태 파일 저장용)
# ===========================================

# GCS 버킷 생성 (AWS S3와 동일한 기능)
resource "google_storage_bucket" "terraform_state" {
  name          = "${var.project_id}-terraform-state-bucket"
  location      = var.region
  project       = var.project_id
  force_destroy = false  # 실수로 삭제되는 것을 방지
  
  # 버전 관리 활성화 (상태 파일 변경 이력 추적)
  versioning {
    enabled = true
  }
  
  # 라이프사이클 규칙 (오래된 버전 자동 삭제)
  lifecycle_rule {
    condition {
      age = 30  # 30일 이상된 버전 삭제
    }
    action {
      type = "Delete"
    }
  }
  
  # 퍼블릭 액세스 차단 (보안)
  public_access_prevention = "enforced"
  
  # 균등 액세스 제어 활성화
  uniform_bucket_level_access = true
}

# ===========================================
# 🏷️ 공통 라벨 설정
# ===========================================

# 모든 리소스에 적용할 라벨 (태그)
locals {
  common_labels = merge(var.common_labels, {
    environment = var.environment
    region      = var.region
    created-by  = "terraform"
    timestamp   = formatdate("YYYY-MM-DD", timestamp())
  })
}

# 📚 주요 설명:
#
# 1. VPC vs AWS VPC:
#    - 기본적으로 동일한 개념
#    - GCP는 전역 VPC (모든 리전에서 사용 가능)
#    - AWS는 리전별 VPC
#
# 2. 서브넷 vs AWS 서브넷:
#    - 기본 개념은 동일
#    - GCP는 보조 IP 대역 기능 추가 (GKE용)
#
# 3. Cloud NAT vs AWS NAT Gateway:
#    - 완전히 동일한 기능
#    - Private 인스턴스의 아웃바운드 인터넷 접근
#
# 4. 방화벽 vs AWS Security Group:
#    - 방화벽: 네트워크 레벨 (VPC 전체 적용)
#    - Security Group: 인스턴스 레벨 (EC2별 적용)
#    - GCP도 인스턴스별 방화벽 태그 지원
#
# 5. Artifact Registry vs AWS ECR:
#    - 동일한 Docker 이미지 저장소 기능
#    - GCP는 Maven, npm 등 다양한 포맷 지원