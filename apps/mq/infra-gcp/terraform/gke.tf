# 🚢 GKE (Google Kubernetes Engine) 클러스터 설정
# AWS EKS와 완전히 동일한 기능을 GCP에서 제공

# ===========================================
# 🏗️ GKE 클러스터 생성
# ===========================================

# 단순한 GKE 클러스터
resource "google_container_cluster" "main" {
  name     = var.cluster_name
  location = var.zone  # 단일 존 클러스터 (더 빠르고 단순)
  project  = var.project_id
  
  # 네트워크 설정
  network    = google_compute_network.main.self_link
  subnetwork = google_compute_subnetwork.main.self_link
  
  # 기본 노드 풀 사용 (더 단순)
  initial_node_count = 2
  
  # 기본 노드 설정
  node_config {
    machine_type = var.node_machine_type
    disk_size_gb = var.node_disk_size
    disk_type    = var.node_disk_type
    preemptible  = var.use_spot_instances
    
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
  }
  
  # Addon 설정 - HTTP Load Balancing 필수!
  addons_config {
    http_load_balancing {
      disabled = false
    }
  }
}

# 노드풀은 기본 노드풀 사용 (더 단순)
# 복잡한 별도 노드풀 제거

# # resource "google_container_node_pool" "main" {
#   name       = var.node_pool_name
#   cluster    = google_container_cluster.main.name
#   location   = var.region
#   project    = var.project_id
#   
#   # 노드 개수 (AWS EKS와 동일한 개념)
#   initial_node_count = var.node_initial_count
#   
#   # 오토스케일링 설정
#   autoscaling {
#     min_node_count = var.node_min_count  # 최소 1개
#     max_node_count = var.node_max_count  # 최대 4개
#   }
#   
#   # 노드 설정
#   node_config {
#     # 머신 타입 (AWS 인스턴스 타입과 동일한 개념)
#     machine_type = var.node_machine_type  # e2-standard-2 (2 vCPU, 8GB RAM)
#     
#     # 스팟 인스턴스 사용 (AWS Spot 인스턴스와 동일)
#     spot = var.use_spot_instances
#     
#     # 디스크 설정
#     disk_size_gb = var.node_disk_size
#     disk_type    = var.node_disk_type
#     
#     # 이미지 타입 (Container-Optimized OS)
#     image_type = "COS_CONTAINERD"
#     
#     # OAuth 스코프 (노드가 접근할 수 있는 GCP 서비스)
#     oauth_scopes = [
#       "https://www.googleapis.com/auth/cloud-platform"  # 모든 GCP 서비스 접근
#     ]
#     
#     # 노드 라벨 (AWS EKS 노드 그룹 라벨과 동일)
#     labels = {
#       environment = var.environment
#       node-pool   = var.node_pool_name
#       role        = "apps"  # AWS EKS 설정과 동일
#     }
#     
#     # 노드 태그 (방화벽 규칙 적용용)
#     tags = [
#       "gke-node",
#       "${var.cluster_name}-node",
#       "http-server",   # HTTP 접근 허용
#       "https-server"   # HTTPS 접근 허용
#     ]
#     
#     # 보안 설정
#     shielded_instance_config {
#       enable_secure_boot          = true
#       enable_integrity_monitoring = true
#     }
#     
#     # 워크로드 아이덴티티 설정
#     workload_metadata_config {
#       mode = "GKE_METADATA"
#     }
#     
#     # 메타데이터 (AWS EKS 사용자 데이터와 유사)
#     metadata = {
#       disable-legacy-endpoints = "true"  # 레거시 메타데이터 API 비활성화
#     }
#   }
#   
#   # 노드 관리 설정 (자동 업그레이드, 복구)
#   management {
#     auto_repair  = true   # 장애 노드 자동 복구
#     auto_upgrade = true   # 자동 업그레이드
#   }
#   
#   # 업그레이드 설정
#   upgrade_settings {
#     strategy        = "SURGE"  # 업그레이드 전략
#     max_surge       = 1        # 동시에 추가할 수 있는 노드 수
#     max_unavailable = 0        # 동시에 사용 불가능한 노드 수
#   }
#   
#   # 노드 풀이 클러스터 생성 완료 후에 생성되도록 의존성 설정
#   depends_on = [google_container_cluster.main]
# }
# 
# # ===========================================
# # 📋 설명 및 비교
# # ===========================================
# 
# # 📚 GKE vs EKS 주요 차이점:
# #
# # 1. 네트워크 설정:
# #    - GKE: VPC Native (보조 IP 대역 사용)
# #    - EKS: AWS VPC CNI (ENI 기반)
# #
# # 2. 노드 관리:
# #    - GKE: 노드 풀 (Node Pool)
# #    - EKS: 노드 그룹 (Node Group)
# #    - 기능은 거의 동일
# #
# # 3. 워크로드 아이덴티티:
# #    - GKE: Workload Identity
# #    - EKS: OIDC (Service Account)
# #    - 둘 다 Pod가 클라우드 서비스에 안전하게 접근하는 기능
# #
# # 4. 로드 밸런서:
# #    - GKE: Google Cloud Load Balancer
# #    - EKS: AWS ALB/NLB
# #    - 설정 방법만 다르고 기능은 동일
# #
# # 5. 스팟 인스턴스:
# #    - GKE: Spot VM
# #    - EKS: Spot Instance
# #    - 둘 다 약 70% 비용 절약 가능
# #
# # 🎯 이관 시 주의사항:
# # - 쿠버네티스 매니페스트는 99% 동일
# # - 로드 밸런서 어노테이션만 변경하면 됨
# # - 스토리지 클래스 이름 변경 필요
# # - 서비스 계정 설정 방식 차이