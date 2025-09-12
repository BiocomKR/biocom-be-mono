# 🔧 테라폼 프로바이더 설정
# 프로바이더란? 테라폼이 특정 클라우드(여기서는 GCP)와 통신하기 위한 플러그인

terraform {
  # 테라폼 최소 버전 요구사항
  required_version = ">= 1.0"
  
  # 사용할 프로바이더들과 버전 지정
  required_providers {
    google = {
      source  = "hashicorp/google"     # 구글 클라우드 프로바이더
      version = "~> 5.0"               # 5.x 버전 사용 (최신 안정 버전)
    }
    google-beta = {
      source  = "hashicorp/google-beta" # 베타 기능용 프로바이더
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"  # 쿠버네티스 리소스 관리용
      version = "~> 2.25"
    }
  }
}

# GCP 메인 프로바이더 설정
provider "google" {
  project = var.project_id              # GCP 프로젝트 ID (변수로 받음)
  region  = var.region                  # 기본 리전 (asia-northeast3)
  zone    = var.zone                    # 기본 존 (asia-northeast3-a)
}

# GCP 베타 기능 프로바이더 설정
# Certificate Manager 같은 최신 기능 사용시 필요
provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# 쿠버네티스 프로바이더 설정
# GKE 클러스터가 생성된 후에 Pod, Service 등을 관리하기 위함
provider "kubernetes" {
  # GKE 클러스터 정보를 동적으로 가져와서 연결
  host                   = "https://${google_container_cluster.main.endpoint}"
  token                  = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(google_container_cluster.main.master_auth.0.cluster_ca_certificate)
}


# 현재 GCP 클라이언트 설정 정보를 가져옴 (토큰 등)
data "google_client_config" "default" {}

# 현재 GCP 프로젝트 정보를 가져옴 (인증 문제로 일시적 주석)
# data "google_project" "project" {
#   project_id = var.project_id
# }