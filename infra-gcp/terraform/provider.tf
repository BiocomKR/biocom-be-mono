# 🔧 Terraform Provider 설정 - biocom-bo-api

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # 상태 파일 원격 저장 (선택적)
  # backend "gcs" {
  #   bucket = "biocom-bo-api-terraform-state-bucket"
  #   prefix = "terraform/state"
  # }
}

# Google Cloud Provider 설정
provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}
