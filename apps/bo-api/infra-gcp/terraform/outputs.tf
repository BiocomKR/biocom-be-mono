# 📤 Terraform Outputs - biocom-bo-api
# 배포 후 필요한 정보들을 출력

# ===========================================
# 🚢 GKE 클러스터 정보
# ===========================================

output "cluster_name" {
  description = "GKE 클러스터 이름"
  value       = google_container_cluster.main.name
}

output "cluster_endpoint" {
  description = "GKE 클러스터 엔드포인트"
  value       = google_container_cluster.main.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "클러스터 CA 인증서"
  value       = google_container_cluster.main.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

# ===========================================
# 🌐 네트워크 정보
# ===========================================

output "vpc_name" {
  description = "VPC 이름"
  value       = google_compute_network.main.name
}

output "subnet_name" {
  description = "서브넷 이름"
  value       = google_compute_subnetwork.main.name
}

output "ingress_ip" {
  description = "Ingress 외부 IP 주소"
  value       = google_compute_global_address.ingress_ip.address
}

# ===========================================
# 📦 Artifact Registry 정보
# ===========================================

output "artifact_registry_url" {
  description = "Docker 이미지 레지스트리 URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
}

# ===========================================
# 🔧 유용한 명령어
# ===========================================

output "kubectl_config_command" {
  description = "kubectl 설정 명령어"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.main.name} --zone ${var.zone} --project ${var.project_id}"
}

output "docker_push_command" {
  description = "Docker 이미지 푸시 명령어"
  value       = "docker push ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}/biocom-bo-api:TAG"
}

# ===========================================
# 📊 공유 리소스 정보 (biocom-api와 공유)
# ===========================================

output "shared_db_host" {
  description = "공유 데이터베이스 호스트"
  value       = var.shared_db_host
}

output "shared_gcs_bucket" {
  description = "공유 GCS 버킷"
  value       = var.shared_gcs_bucket_name
}

# ===========================================
# 📋 DNS 설정 안내
# ===========================================

output "dns_setup_instructions" {
  description = "DNS 설정 안내 (가비아)"
  value       = <<-EOT

    📋 DNS 설정 (가비아)
    ========================
    1. 가비아 DNS 관리 페이지 접속
    2. biocom.ai.kr 도메인 선택
    3. 다음 레코드 추가:

       타입: A
       호스트: bo-api-dev
       값: ${google_compute_global_address.ingress_ip.address}
       TTL: 300

    4. SSL 인증서 발급까지 최대 24시간 소요

  EOT
}
