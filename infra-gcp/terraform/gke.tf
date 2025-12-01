# 🚢 GKE (Google Kubernetes Engine) 클러스터 설정
# biocom-bo-api용 경량 클러스터

# ===========================================
# 🏗️ GKE 클러스터 생성
# ===========================================

resource "google_container_cluster" "main" {
  name     = var.cluster_name
  location = var.zone  # 단일 존 클러스터
  project  = var.project_id

  # 네트워크 설정
  network    = google_compute_network.main.self_link
  subnetwork = google_compute_subnetwork.main.self_link

  # 기본 노드 풀 사용
  initial_node_count = var.node_initial_count  # 1개

  # 노드 설정 (경량 스펙)
  node_config {
    machine_type = var.node_machine_type  # e2-small (2vCPU, 2GB)
    disk_size_gb = var.node_disk_size     # 20GB
    disk_type    = var.node_disk_type     # pd-standard
    preemptible  = var.use_spot_instances # spot 인스턴스

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    # 노드 라벨
    labels = {
      environment = var.environment
      role        = "bo-apps"
    }

    # 노드 태그 (방화벽용)
    tags = [
      "gke-node",
      "${var.cluster_name}-node",
      "http-server",
      "https-server"
    ]
  }

  # Addon 설정
  addons_config {
    http_load_balancing {
      disabled = false  # Ingress를 위해 필수
    }
  }

  # 삭제 보호 (운영환경에서 활성화)
  deletion_protection = false  # dev 환경에서는 비활성화
}

# ===========================================
# 📋 주요 스펙 비교 (biocom-api vs biocom-bo-api)
# ===========================================

# | 항목               | biocom-api      | biocom-bo-api   |
# |--------------------|-----------------|-----------------|
# | 머신 타입          | n2-standard-2   | e2-small        |
# | vCPU / Memory      | 2 / 8GB         | 2 / 2GB         |
# | 노드 수            | 2               | 1               |
# | 디스크             | 30GB            | 20GB            |
# | Spot 인스턴스      | O               | O               |
# | 예상 비용          | ~$50/월         | ~$15/월         |
