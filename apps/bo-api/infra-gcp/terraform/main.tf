# 🏗️ BIOCOM BO-API - GCP 메인 인프라 설정
# biocom-api와 별도 클러스터, DB/Storage는 공유

# ===========================================
# 🌐 네트워킹 (VPC, 서브넷, 방화벽)
# ===========================================

# VPC 네트워크 생성 (biocom-api와 별도)
resource "google_compute_network" "main" {
  name                    = "${var.cluster_name}-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id

  description = "BIOCOM BO-API 메인 VPC - ${var.environment} 환경"
}

# 서브넷 생성
resource "google_compute_subnetwork" "main" {
  name          = "${var.cluster_name}-subnet"
  ip_cidr_range = var.subnet_cidr  # 10.10.1.0/24
  region        = var.region
  network       = google_compute_network.main.id
  project       = var.project_id

  # GKE 전용 보조 IP 대역 설정
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = var.pods_cidr  # 10.11.0.0/16
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = var.services_cidr  # 10.12.0.0/16
  }

  # Private Google Access 활성화
  private_ip_google_access = true

  description = "BIOCOM BO-API 메인 서브넷 - ${var.environment} 환경"

  lifecycle {
    ignore_changes = [secondary_ip_range]
  }
}

# Cloud Router 생성 (NAT Gateway용)
resource "google_compute_router" "main" {
  name    = "${var.cluster_name}-router"
  region  = var.region
  network = google_compute_network.main.id
  project = var.project_id

  description = "BIOCOM BO-API Cloud Router - NAT Gateway용"
}

# Cloud NAT 생성
resource "google_compute_router_nat" "main" {
  name                               = "${var.cluster_name}-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  project                            = var.project_id

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# 방화벽 규칙 - 내부 통신 허용
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.cluster_name}-allow-internal"
  network = google_compute_network.main.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [var.vpc_cidr]
  description   = "VPC 내부 통신 허용"
}

# 방화벽 규칙 - SSH 접근 허용
resource "google_compute_firewall" "allow_ssh" {
  name    = "${var.cluster_name}-allow-ssh"
  network = google_compute_network.main.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]  # 운영환경에서는 제한 필요
  target_tags   = ["ssh-allowed"]
  description   = "SSH 접근 허용 (관리용)"
}

# 방화벽 규칙 - HTTP/HTTPS 접근 허용
resource "google_compute_firewall" "allow_http_https" {
  name    = "${var.cluster_name}-allow-http-https"
  network = google_compute_network.main.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["http-server", "https-server"]
  description   = "HTTP/HTTPS 접근 허용 (웹 서비스용)"
}

# ===========================================
# 📦 Artifact Registry (Docker 이미지 저장소)
# ===========================================

resource "google_artifact_registry_repository" "main" {
  location      = var.region
  repository_id = "biocom-bo-api"
  description   = "BIOCOM BO-API Docker 이미지 저장소"
  format        = "DOCKER"
  project       = var.project_id

  cleanup_policies {
    id     = "delete-old-images"
    action = "DELETE"

    condition {
      tag_state  = "UNTAGGED"
      older_than = "2592000s"  # 30일
    }
  }

  cleanup_policies {
    id     = "keep-minimum-versions"
    action = "KEEP"

    most_recent_versions {
      keep_count = 10
    }
  }
}

# ===========================================
# 💾 GCS 버킷 (테라폼 상태 파일용)
# ===========================================

resource "google_storage_bucket" "terraform_state" {
  name          = "${var.project_id}-terraform-state-bucket"
  location      = var.region
  project       = var.project_id
  force_destroy = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }

  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true
}

# ===========================================
# 🔗 외부 IP 주소 (Ingress용)
# ===========================================

resource "google_compute_global_address" "ingress_ip" {
  name        = "${var.cluster_name}-external-ip"
  project     = var.project_id
  description = "BIOCOM BO-API Ingress 외부 IP"
}

# ===========================================
# 🔐 SSL 정책
# ===========================================

resource "google_compute_ssl_policy" "main" {
  name            = "${var.cluster_name}-ssl-policy"
  project         = var.project_id
  profile         = "MODERN"
  min_tls_version = "TLS_1_2"
}

# ===========================================
# 🏷️ 공통 라벨 설정
# ===========================================

locals {
  common_labels = merge(var.common_labels, {
    environment = var.environment
    region      = var.region
    created-by  = "terraform"
    timestamp   = formatdate("YYYY-MM-DD", timestamp())
  })
}
