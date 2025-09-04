# 🔐 Certificate Manager 설정
# AWS ACM(AWS Certificate Manager)과 완전히 동일한 기능
# SSL 인증서 자동 발급, 갱신, 관리

# ===========================================
# 📋 Certificate Manager 활성화 확인
# ===========================================

# Certificate Manager API가 활성화되어 있는지 확인
# 이 리소스는 API를 활성화하고, 비활성화되어 있다면 자동으로 활성화

# ===========================================
# 🔒 SSL 인증서 생성
# ===========================================

# 와일드카드 SSL 인증서 (*.biocom.ai.kr)
resource "google_certificate_manager_certificate" "wildcard_certificate" {
  name     = "${var.cluster_name}-wildcard-cert"
  project  = var.project_id
  location = "global"  # Certificate Manager는 글로벌 리소스
  
  # 관리형 인증서 사용 (Google이 자동으로 발급 및 갱신)
  managed {
    domains = [
      var.domain_name,           # biocom.ai.kr
      "*.${var.domain_name}"     # *.biocom.ai.kr (와일드카드)
    ]
    
    # DNS 검증 방식 사용 (와일드카드는 DNS 검증만 가능)
    # 와일드카드 *.biocom.ai.kr도 루트 도메인 DNS Authorization으로 처리됨
    dns_authorizations = [
      google_certificate_manager_dns_authorization.root_dns_auth.id
    ]
  }
  
  labels = local.common_labels
  
  description = "BIOCOM 와일드카드 SSL 인증서 - ${var.environment} 환경"
}

# ===========================================
# 🌐 DNS 검증 설정
# ===========================================

# 와일드카드 도메인용 DNS Authorization은 루트 도메인 authorization으로 처리됨
# Google Certificate Manager에서는 *.example.com을 위해서는 example.com으로 DNS Authorization 생성 필요

# 루트 도메인용 DNS Authorization 추가
resource "google_certificate_manager_dns_authorization" "root_dns_auth" {
  name   = "${var.cluster_name}-root-dns-auth"
  domain = var.domain_name
  project = var.project_id
  location = "global"
  
  labels = local.common_labels
  
  description = "루트 도메인 DNS 검증을 위한 인증서 권한 부여"
}

# ===========================================
# 📍 Certificate Map 생성
# ===========================================

# Certificate Map (인증서와 도메인을 매핑)
resource "google_certificate_manager_certificate_map" "wildcard_certificate_map" {
  name    = "biocom-cert-map"  # 고정 이름 사용 (K8s Ingress에서 참조)
  project = var.project_id
  
  labels = local.common_labels
  
  description = "BIOCOM 와일드카드 인증서 맵"
}

# 와일드카드 엔트리 (*.biocom.ai.kr)
resource "google_certificate_manager_certificate_map_entry" "wildcard_certificate_entry" {
  name         = "biocom-wildcard-entry"
  map          = google_certificate_manager_certificate_map.wildcard_certificate_map.name
  project      = var.project_id
  
  certificates = [google_certificate_manager_certificate.wildcard_certificate.id]
  hostname     = "*.${var.domain_name}"  # *.biocom.ai.kr
  
  description = "와일드카드 도메인 인증서 매핑"
}

# 루트 도메인 엔트리 (biocom.ai.kr)
resource "google_certificate_manager_certificate_map_entry" "root_certificate_entry" {
  name         = "biocom-root-entry"
  map          = google_certificate_manager_certificate_map.wildcard_certificate_map.name
  project      = var.project_id
  
  certificates = [google_certificate_manager_certificate.wildcard_certificate.id]
  hostname     = var.domain_name  # biocom.ai.kr
  
  description = "루트 도메인 인증서 매핑"
}

# ===========================================
# 🔒 SSL Policy 생성 (보안 강화)
# ===========================================

# SSL 정책 생성 - TLS 버전 및 암호화 방식 제어
resource "google_compute_ssl_policy" "biocom_ssl_policy" {
  name    = "biocom-ssl-policy"
  project = var.project_id
  
  # 최신 TLS 버전만 허용 (보안 강화) - GCP는 현재 TLS 1.2까지 지원
  profile         = "MODERN"  
  min_tls_version = "TLS_1_2"
  
  description = "BIOCOM API SSL 보안 정책 - 현대적 암호화 방식만 허용"
}

# ===========================================
# 📤 출력값 (다른 리소스에서 참조용)
# ===========================================

# 인증서 ID 출력 (Load Balancer에서 참조)
output "ssl_certificate_id" {
  description = "SSL 인증서 ID"
  value       = google_certificate_manager_certificate.wildcard_certificate.id
}

# SSL Policy 이름 출력 (FrontendConfig에서 참조)
output "ssl_policy_name" {
  description = "SSL Policy 이름"
  value       = google_compute_ssl_policy.biocom_ssl_policy.name
}

# 인증서 맵 ID 출력은 outputs.tf에서 관리

# DNS 검증 레코드 정보 출력 (가비아 DNS 설정용)
output "dns_authorization_record" {
  description = "가비아 DNS에 추가해야 할 CNAME 검증 레코드"
  value = {
    name  = google_certificate_manager_dns_authorization.root_dns_auth.dns_resource_record[0].name
    type  = google_certificate_manager_dns_authorization.root_dns_auth.dns_resource_record[0].type
    data  = google_certificate_manager_dns_authorization.root_dns_auth.dns_resource_record[0].data
    info  = "호스트: _acme-challenge, 타입: CNAME"
  }
  sensitive = false
}

# ===========================================
# 📋 설명 및 비교
# ===========================================

# 📚 Certificate Manager vs AWS ACM 비교:
#
# 1. 기본 기능:
#    - 둘 다 SSL 인증서 자동 발급/갱신
#    - 둘 다 Let's Encrypt 기반
#    - 둘 다 무료 사용
#
# 2. 검증 방식:
#    - Certificate Manager: DNS 검증만 지원
#    - AWS ACM: DNS 검증 + 이메일 검증
#
# 3. 도메인 관리:
#    - Certificate Manager: Certificate Map으로 도메인별 매핑
#    - AWS ACM: ALB/CloudFront에서 직접 인증서 선택
#
# 4. 자동화:
#    - Certificate Manager: 완전 자동 갱신 (90일마다)
#    - AWS ACM: 완전 자동 갱신 (90일마다)
#
# 🔧 가비아 DNS 설정 방법:
#
# 1. terraform apply 실행 후 아래 명령어로 DNS 레코드 확인:
#    terraform output dns_authorization_record
#
# 2. 가비아 DNS 관리 페이지에서 다음 레코드 추가:
#    - 타입: TXT (또는 CNAME)
#    - 이름: [output에서 확인한 name]
#    - 값: [output에서 확인한 data]
#
# 3. 인증서 상태 확인:
#    gcloud certificate-manager certificates describe [certificate-name] --global
#
# 4. 인증서 발급 완료 시 상태가 "ACTIVE"로 변경됨
#
# 🚀 이관 시 고려사항:
# - AWS Route53 → 가비아 DNS로 DNS 레코드 이전
# - ALB SSL 리스너 → GCP Load Balancer SSL 설정으로 변경
# - 인증서 발급에 최대 24시간 소요 가능 (DNS 전파 시간)
#
# 💡 인증서 문제 해결:
# - DNS 레코드 확인: dig TXT [dns-name]
# - 인증서 상태 확인: gcloud CLI 사용
# - 만료 전 자동 갱신됨 (수동 개입 불필요)