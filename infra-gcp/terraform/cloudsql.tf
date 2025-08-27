# 🗄️ Cloud SQL PostgreSQL 설정
# AWS RDS PostgreSQL과 완전히 동일한 기능

# ===========================================
# 🔐 랜덤 패스워드 생성
# ===========================================

# 데이터베이스 관리자 패스워드 랜덤 생성
resource "random_password" "db_password" {
  length  = 16
  special = true
  
  # 특수문자 제한 (SQL에서 문제될 수 있는 문자 제외)
  override_special = "!@#$%^&*()-_=+[]{}|;:,.<>?"
}

# ===========================================
# 🗃️ Cloud SQL 인스턴스 생성
# ===========================================

# Cloud SQL 인스턴스 (AWS RDS 인스턴스와 동일)
resource "google_sql_database_instance" "main" {
  name             = var.db_instance_name
  database_version = var.db_version  # POSTGRES_15
  region           = var.region
  project          = var.project_id
  
  # 삭제 보호 (실수로 삭제 방지)
  deletion_protection = false  # 개발환경이므로 false (운영환경에서는 true)
  
  settings {
    # 인스턴스 크기 (AWS RDS 인스턴스 클래스와 동일)
    tier = var.db_tier  # db-f1-micro (개발용)
    
    # 가용성 설정
    availability_type = "ZONAL"  # 단일 존 (개발용), 운영환경에서는 "REGIONAL"
    
    # 디스크 설정
    disk_type       = "PD_SSD"     # SSD 디스크 (성능 향상)
    disk_size       = var.db_disk_size  # 20GB
    disk_autoresize = true         # 디스크 자동 확장
    
    # 백업 설정 (AWS RDS 자동 백업과 동일)
    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"  # 새벽 2시 백업 (한국 시간 기준)
      point_in_time_recovery_enabled = true     # 특정 시점 복구 활성화
      backup_retention_settings {
        retained_backups = 7  # 7일간 백업 보관
      }
      
      # 트랜잭션 로그 백업 (AWS RDS WAL과 동일)
      transaction_log_retention_days = 7
    }
    
    # 유지 관리 설정
    maintenance_window {
      day          = 7    # 일요일
      hour         = 3    # 새벽 3시 (한국 시간)
      update_track = "stable"  # 안정 버전만 업데이트
    }
    
    # IP 설정 (단순한 Public IP 설정)
    ip_configuration {
      # Public IP 활성화 (더 단순)
      ipv4_enabled = true
      
      # 모든 IP 허용 (개발환경)
      authorized_networks {
        name  = "all"
        value = "0.0.0.0/0"
      }
      
      # SSL 필수 설정
      require_ssl = true
      
      # 승인된 네트워크 (Public IP 사용시에만 의미있음)
      # 현재는 Private IP만 사용하므로 불필요
    }
    
    # 데이터베이스 플래그 (PostgreSQL 설정)
    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }
    
    database_flags {
      name  = "log_connections"
      value = "on"
    }
    
    database_flags {
      name  = "log_disconnections"
      value = "on"
    }
    
    database_flags {
      name  = "log_lock_waits"
      value = "on"
    }
    
    # 인사이트 설정 (성능 모니터링)
    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }
    
    # 인스턴스 라벨
    user_labels = local.common_labels
  }
  
  # 단순한 설정으로 의존성 제거
}

# ===========================================
# 🔗 Private Service Connection 설정 (제거됨)
# ===========================================

# Private Services Access 제거 (Public IP 사용으로 단순화)
# # resource "google_compute_global_address" "private_ip_address" {
#   name          = "${var.cluster_name}-private-ip-address"
#   purpose       = "VPC_PEERING"
#   address_type  = "INTERNAL"
#   prefix_length = 16
#   network       = google_compute_network.main.id
#   project       = var.project_id
#   
#   description = "Cloud SQL Private IP 주소 범위"
# }
# 
# # Private Service Connection 생성 (Cloud SQL과 VPC 연결)
# resource "google_service_networking_connection" "private_vpc_connection" {
#   network                 = google_compute_network.main.id
#   service                 = "servicenetworking.googleapis.com"
#   reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
# }
# 
# # ===========================================
# # 🗂️ 데이터베이스 및 사용자 생성
# # ===========================================
# 
# # 애플리케이션용 데이터베이스 생성
# resource "google_sql_database" "main" {
#   name     = var.db_name  # "biocom"
#   instance = google_sql_database_instance.main.name
#   project  = var.project_id
#   
#   # 문자 집합 설정
#   charset   = "UTF8"
#   collation = "en_US.UTF8"
# }
# 
# # 애플리케이션용 사용자 생성
# resource "google_sql_user" "main" {
#   name     = var.db_username  # "postgres"
#   instance = google_sql_database_instance.main.name
#   password = random_password.db_password.result
#   project  = var.project_id
# }
# 
# # ===========================================
# # 🔐 Secret Manager에 DB 정보 저장
# # ===========================================
# 
# # 데이터베이스 연결 정보를 Secret Manager에 저장 (AWS Secrets Manager와 동일)
# resource "google_secret_manager_secret" "db_connection_string" {
#   secret_id = "biocom-db-connection-string"
#   project   = var.project_id
#   
#   labels = local.common_labels
#   
#   replication {
#     auto {}  # 모든 리전에 자동 복제
#   }
# }
# 
# # 실제 연결 문자열 저장
# resource "google_secret_manager_secret_version" "db_connection_string" {
#   secret = google_secret_manager_secret.db_connection_string.id
#   
#   # PostgreSQL 연결 문자열 생성
#   secret_data = "postgresql://${google_sql_user.main.name}:${random_password.db_password.result}@${google_sql_database_instance.main.private_ip_address}:5432/${google_sql_database.main.name}?sslmode=require"
# }
# 
# # 개별 DB 정보들도 Secret Manager에 저장
# resource "google_secret_manager_secret" "db_password" {
#   secret_id = "biocom-db-password"
#   project   = var.project_id
#   
#   labels = local.common_labels
#   
#   replication {
#     auto {}
#   }
# }
# 
# resource "google_secret_manager_secret_version" "db_password" {
#   secret      = google_secret_manager_secret.db_password.id
#   secret_data = random_password.db_password.result
# }
# 
# # ===========================================
# # 📋 설명 및 비교
# # ===========================================
# 
# # 📚 Cloud SQL vs AWS RDS 비교:
# #
# # 1. 기본 기능:
# #    - 완전 관리형 PostgreSQL 서비스
# #    - 자동 백업, 패치, 모니터링
# #    - 고가용성 및 읽기 전용 복제본 지원
# #
# # 2. 네트워크 설정:
# #    - Cloud SQL: Private Service Connection
# #    - AWS RDS: VPC Security Group
# #    - 둘 다 VPC 내부 접근만 허용 가능
# #
# # 3. 백업 및 복구:
# #    - Cloud SQL: 자동 백업 + 특정 시점 복구
# #    - AWS RDS: 자동 백업 + Point-in-Time Recovery
# #    - 기능 거의 동일
# #
# # 4. 모니터링:
# #    - Cloud SQL: Cloud Monitoring + Query Insights
# #    - AWS RDS: CloudWatch + Performance Insights
# #    - 유사한 기능 제공
# #
# # 5. 보안:
# #    - Cloud SQL: IAM + Secret Manager
# #    - AWS RDS: IAM + Secrets Manager
# #    - 보안 모델 거의 동일
# #
# # 🔧 DBeaver 접속 방법:
# #
# # 1. Cloud SQL Proxy 사용 (권장):
# #    ./cloud-sql-proxy biocom-api:asia-northeast3:biocom-postgres
# #    Host: 127.0.0.1, Port: 5432
# #
# # 2. Private IP 직접 접속:
# #    Host: [private_ip_address]
# #    Port: 5432
# #    SSL Mode: Require
# #
# # 🚀 이관 시 고려사항:
# # - AWS RDS 스냅샷 → Cloud SQL로 가져오기 가능
# # - pg_dump/pg_restore 사용한 논리적 마이그레이션
# # - Database Migration Service 사용 가능