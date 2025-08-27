# 📤 테라폼 출력값 정의
# 인프라 구축 후 중요한 정보들을 한눈에 볼 수 있게 정리

# ===========================================
# 🌐 네트워크 정보
# ===========================================

output "vpc_id" {
  description = "VPC 네트워크 ID"
  value       = google_compute_network.main.id
}

output "subnet_id" {
  description = "서브넷 ID"
  value       = google_compute_subnetwork.main.id
}

output "vpc_self_link" {
  description = "VPC 네트워크 Self Link"
  value       = google_compute_network.main.self_link
}

# ===========================================
# 🚢 GKE 클러스터 정보
# ===========================================

output "cluster_name" {
  description = "GKE 클러스터 이름"
  value       = google_container_cluster.main.name
}

output "cluster_endpoint" {
  description = "GKE 클러스터 API 서버 엔드포인트"
  value       = google_container_cluster.main.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "GKE 클러스터 CA 인증서"
  value       = google_container_cluster.main.master_auth.0.cluster_ca_certificate
  sensitive   = true
}

output "cluster_location" {
  description = "GKE 클러스터 위치 (리전)"
  value       = google_container_cluster.main.location
}

# kubectl 접속 명령어
output "kubectl_config_command" {
  description = "kubectl 설정 명령어"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.main.name} --region ${google_container_cluster.main.location} --project ${var.project_id}"
}

# ===========================================
# 🗄️ Cloud SQL 정보
# ===========================================

output "db_instance_name" {
  description = "Cloud SQL 인스턴스 이름"
  value       = google_sql_database_instance.main.name
}

output "db_private_ip" {
  description = "Cloud SQL Private IP 주소"
  value       = google_sql_database_instance.main.private_ip_address
  sensitive   = true
}

output "db_connection_name" {
  description = "Cloud SQL 연결 이름 (Cloud SQL Proxy용)"
  value       = google_sql_database_instance.main.connection_name
}

# Secret Manager에 저장된 DB 연결 정보 (주석 처리 - Secret Manager 리소스가 비활성화됨)
# output "db_secret_name" {
#   description = "데이터베이스 연결 정보가 저장된 Secret Manager 이름"
#   value       = google_secret_manager_secret.db_connection_string.secret_id
# }

# DBeaver/pgAdmin 접속 정보 (Cloud SQL Proxy 사용)
output "cloud_sql_proxy_command" {
  description = "Cloud SQL Proxy 실행 명령어 (DBeaver 접속용)"
  value       = "./cloud-sql-proxy ${google_sql_database_instance.main.connection_name}"
}

# ===========================================
# 🔐 SSL 인증서 정보
# ===========================================

output "certificate_id" {
  description = "SSL 인증서 ID"
  value       = google_certificate_manager_certificate.api_certificate.id
}

output "certificate_map_id" {
  description = "인증서 맵 ID"
  value       = google_certificate_manager_certificate_map.wildcard_certificate_map.id
}

# 가비아 DNS에 추가할 검증 레코드
output "dns_verification_record" {
  description = "⚠️ 가비아 DNS에 추가해야 할 인증서 검증 레코드"
  value = {
    name = google_certificate_manager_dns_authorization.api_dns_auth.dns_resource_record[0].name
    type = google_certificate_manager_dns_authorization.api_dns_auth.dns_resource_record[0].type
    data = google_certificate_manager_dns_authorization.api_dns_auth.dns_resource_record[0].data
  }
}

# ===========================================
# 🌍 로드 밸런서 정보
# ===========================================

# output "load_balancer_ip" {
#   description = "⚠️ 가비아 DNS A 레코드에 설정할 외부 IP 주소"
#   value       = "Ingress가 생성한 IP 주소를 kubectl get ingress로 확인"
# }

output "api_endpoint" {
  description = "🚀 API 접속 주소 (최종 결과)"
  value       = "https://${var.api_subdomain}.${var.domain_name}"
}

# ===========================================
# 📦 Artifact Registry 정보
# ===========================================

output "docker_registry_url" {
  description = "Docker 이미지 푸시할 레지스트리 URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
}

output "docker_push_command_example" {
  description = "Docker 이미지 푸시 예시 명령어"
  value       = "docker push ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}/biocom-api:latest"
}

# ===========================================
# 💾 스토리지 정보
# ===========================================

output "terraform_state_bucket" {
  description = "테라폼 상태 파일이 저장된 GCS 버킷"
  value       = google_storage_bucket.terraform_state.name
}

# ===========================================
# 🏷️ 환경 정보
# ===========================================

output "project_id" {
  description = "GCP 프로젝트 ID"
  value       = var.project_id
}

output "region" {
  description = "배포된 리전"
  value       = var.region
}

output "environment" {
  description = "배포 환경"
  value       = var.environment
}

# ===========================================
# 📋 배포 완료 후 할 일 요약
# ===========================================

output "next_steps" {
  description = "🎯 배포 완료 후 수행해야 할 작업들"
  value = <<-EOT
  
  ✅ 인프라 배포 완료! 다음 단계를 진행하세요:
  
  🔧 1. kubectl 설정:
  ${google_container_cluster.main.name != "" ? "gcloud container clusters get-credentials ${google_container_cluster.main.name} --region ${google_container_cluster.main.location} --project ${var.project_id}" : ""}
  
  🌐 2. 가비아 DNS 설정:
  - A 레코드: ${var.api_subdomain} → kubectl get ingress -n biocom-api로 확인
  - TXT 레코드 (인증서 검증): 위의 dns_verification_record 참조
  
  🔐 3. SSL 인증서 상태 확인:
  gcloud certificate-manager certificates describe ${google_certificate_manager_certificate.api_certificate.name} --global
  
  🗄️ 4. 데이터베이스 접속 (Cloud SQL Proxy):
  ${google_sql_database_instance.main.connection_name != "" ? "./cloud-sql-proxy ${google_sql_database_instance.main.connection_name}" : ""}
  
  🐳 5. Docker 이미지 푸시:
  docker push ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}/biocom-api:latest
  
  🚀 6. 애플리케이션 배포:
  kubectl apply -f k8s/
  
  📊 7. 최종 API 접속:
  ${var.api_subdomain}.${var.domain_name}
  
  EOT
}

# ===========================================
# 🆘 문제 해결 정보
# ===========================================

output "troubleshooting_commands" {
  description = "문제 발생 시 사용할 디버깅 명령어들"
  value = <<-EOT
  
  🔍 문제 해결 명령어들:
  
  📊 리소스 상태 확인:
  gcloud compute instances list
  gcloud container clusters list
  gcloud sql instances list
  
  🔐 인증서 상태 확인:
  gcloud certificate-manager certificates list --global
  
  🌐 로드 밸런서 상태 확인:
  gcloud compute backend-services list
  gcloud compute forwarding-rules list --global
  
  🗄️ 데이터베이스 연결 테스트:
  gcloud sql connect ${google_sql_database_instance.main.name}
  
  📦 컨테이너 이미지 확인:
  gcloud artifacts repositories list
  
  🚢 쿠버네티스 상태 확인:
  kubectl get nodes
  kubectl get pods --all-namespaces
  kubectl get services --all-namespaces
  
  EOT
}