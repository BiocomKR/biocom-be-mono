# 📦 Google Cloud Storage 설정
# AWS S3와 완전히 동일한 기능의 파일 저장소

# ===========================================
# 🪣 메인 업로드 버킷 생성
# ===========================================

# 파일 업로드용 GCS 버킷 (AWS S3와 동일한 역할)
resource "google_storage_bucket" "uploads" {
  name          = "${var.project_id}-biocom-uploads"
  location      = var.region
  project       = var.project_id
  force_destroy = true  # 개발환경은 강제 삭제 허용
  
  # 퍼블릭 액세스 차단 (보안)
  public_access_prevention = "enforced"
  
  # 균등 액세스 제어 활성화
  uniform_bucket_level_access = true
  
  # 버전 관리 (파일 덮어쓰기 추적)
  versioning {
    enabled = true
  }
  
  # 라이프사이클 규칙 (비용 최적화)
  lifecycle_rule {
    condition {
      age = 365  # 1년 이상된 파일
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"  # 차가운 스토리지로 이동 (저렴)
    }
  }
  
  lifecycle_rule {
    condition {
      age = 30
      with_state = "ARCHIVED"
    }
    action {
      type = "Delete"  # 아카이브된 파일 30일 후 삭제
    }
  }
  
  # CORS 설정 (웹에서 직접 업로드 가능)
  cors {
    origin          = ["https://${var.api_subdomain}.${var.domain_name}", "https://${var.domain_name}"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
  
  labels = local.common_labels
}

# ===========================================
# 🔒 버킷 IAM 설정
# ===========================================

# 애플리케이션용 서비스 계정에 버킷 접근 권한 부여
resource "google_storage_bucket_iam_member" "uploads_object_admin" {
  bucket = google_storage_bucket.uploads.name
  role   = "roles/storage.objectAdmin"  # 객체 생성/읽기/삭제 권한
  member = "serviceAccount:biocom-api@${var.project_id}.iam.gserviceaccount.com"
  
  depends_on = [google_storage_bucket.uploads]
}

# 퍼블릭 읽기 권한 (필요한 경우에만 활성화)
# resource "google_storage_bucket_iam_member" "uploads_public_read" {
#   bucket = google_storage_bucket.uploads.name
#   role   = "roles/storage.objectViewer"
#   member = "allUsers"
# }

# ===========================================
# 📂 버킷 내 폴더 구조 생성
# ===========================================

# 이미지 업로드용 폴더 (미션 인증샷 등)
resource "google_storage_bucket_object" "images_folder" {
  name   = "images/"
  bucket = google_storage_bucket.uploads.name
  content = " "  # 빈 폴더 생성용
  
  metadata = {
    description = "미션 인증샷 및 이미지 파일"
  }
}

# 문서 업로드용 폴더
resource "google_storage_bucket_object" "documents_folder" {
  name   = "documents/"
  bucket = google_storage_bucket.uploads.name
  content = " "
  
  metadata = {
    description = "PDF, 문서 파일"
  }
}

# 프로필 이미지용 폴더
resource "google_storage_bucket_object" "profiles_folder" {
  name   = "profiles/"
  bucket = google_storage_bucket.uploads.name
  content = " "
  
  metadata = {
    description = "사용자 프로필 이미지"
  }
}

# 임시 파일용 폴더 (24시간 후 자동 삭제)
resource "google_storage_bucket_object" "temp_folder" {
  name   = "temp/"
  bucket = google_storage_bucket.uploads.name
  content = " "
  
  metadata = {
    description = "임시 파일 (24시간 후 자동 삭제)"
  }
}

# 임시 파일 자동 삭제 규칙
resource "google_storage_bucket" "temp_cleanup" {
  name          = "${var.project_id}-biocom-temp"
  location      = var.region
  project       = var.project_id
  force_destroy = true  # 임시 파일이므로 강제 삭제 허용
  
  # Uniform bucket-level access 활성화 (조직 정책 준수)
  uniform_bucket_level_access = true
  
  lifecycle_rule {
    condition {
      age = 1  # 1일 후 삭제
    }
    action {
      type = "Delete"
    }
  }
  
  labels = merge(local.common_labels, {
    purpose = "temporary-storage"
  })
}

# ===========================================
# 🌐 CDN 설정 (향후 구현 예정)
# ===========================================

# CDN 설정은 기본 인프라 구축 후 추가 예정
# resource "google_compute_backend_bucket" "uploads_cdn" {
#   name        = "${var.cluster_name}-uploads-cdn"
#   bucket_name = google_storage_bucket.uploads.name
#   project     = var.project_id
#   
#   description = "업로드된 파일 CDN 배포용"
#   enable_cdn  = true
# }

# ===========================================
# 📤 출력값
# ===========================================

# GCS 버킷 정보
output "gcs_bucket_name" {
  description = "업로드용 GCS 버킷 이름"
  value       = google_storage_bucket.uploads.name
}

output "gcs_bucket_url" {
  description = "GCS 버킷 URL"
  value       = google_storage_bucket.uploads.url
}

output "gcs_temp_bucket_name" {
  description = "임시 파일용 GCS 버킷 이름"
  value       = google_storage_bucket.temp_cleanup.name
}

# CDN 엔드포인트 (이미지 서빙용)
output "cdn_endpoint" {
  description = "CDN을 통한 파일 접근 엔드포인트"
  value       = "https://storage.googleapis.com/${google_storage_bucket.uploads.name}"
}

# ===========================================
# 📋 사용 가이드
# ===========================================

# 📚 GCS vs AWS S3 비교:
#
# 1. 기본 기능:
#    - GCS: google_storage_bucket
#    - S3: aws_s3_bucket
#    - 기능 거의 동일
#
# 2. 권한 관리:
#    - GCS: IAM + 버킷 정책
#    - S3: IAM + 버킷 정책
#    - 개념 완전 동일
#
# 3. 라이프사이클:
#    - GCS: lifecycle_rule
#    - S3: lifecycle_configuration
#    - 기능 동일
#
# 4. 비용:
#    - GCS: 일반적으로 S3보다 약간 저렴
#    - 네트워크 비용도 더 합리적
#
# 🔧 애플리케이션에서 사용법:
#
# 1. 환경 변수 설정:
#    GCS_BUCKET_NAME=PROJECT_ID-biocom-uploads
#    GCS_PROJECT_ID=PROJECT_ID
#
# 2. Node.js 라이브러리:
#    npm install @google-cloud/storage
#
# 3. 업로드 예시:
#    const {Storage} = require('@google-cloud/storage');
#    const storage = new Storage();
#    const bucket = storage.bucket(BUCKET_NAME);
#    const file = bucket.file(fileName);
#    await file.save(buffer);
#
# 🚀 기존 로컬 파일 마이그레이션:
# 1. 기존 upload/ 폴더의 파일들을 GCS로 업로드
# 2. 애플리케이션 코드 수정 (로컬 저장 → GCS 저장)
# 3. 기존 파일 경로를 GCS URL로 업데이트