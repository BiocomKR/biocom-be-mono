# 🏠 테라폼 백엔드 설정 
# 백엔드란? 테라폼의 상태 파일(.tfstate)을 어디에 저장할지 정하는 설정
# 
# ⚠️ 중요: 이 파일은 처음 실행할 때는 주석 처리해야 합니다!
# 이유: GCS 버킷이 먼저 생성되어야 하기 때문입니다.
#
# 실행 순서:
# 1. 이 파일을 모두 주석 처리
# 2. terraform init && terraform apply (GCS 버킷 생성)
# 3. 이 파일 주석 해제
# 4. terraform init (백엔드 마이그레이션)

# terraform {
#   backend "gcs" {
#     bucket = "biocom-terraform-state"        # GCS 버킷 이름
#     prefix = "terraform/state"               # 상태 파일이 저장될 경로
#     
#     # 추가 보안 설정 (선택사항)
#     # encryption_key = ""                    # 고객 관리 암호화 키
#   }
# }

# 📚 백엔드를 사용하는 이유:
# 
# 1. 팀 협업: 여러 사람이 같은 인프라를 관리할 수 있음
# 2. 안전성: 로컬 PC에서 실수로 삭제될 위험 없음
# 3. 상태 잠금: 동시에 terraform apply 실행하는 것을 방지
# 4. 백업: GCS는 자동으로 버전 관리 및 백업 제공
#
# 🔄 백엔드 마이그레이션 과정:
# 
# 1. 처음에는 로컬 백엔드로 시작 (terraform.tfstate 파일이 로컬에 생성)
# 2. GCS 버킷 생성 후 원격 백엔드로 마이그레이션
# 3. terraform init 실행시 "기존 상태를 새 백엔드로 복사하시겠습니까?" 물어봄
# 4. "yes" 입력하면 로컬 상태 파일이 GCS로 업로드됨
#
# 💡 백엔드 설정 후 확인 방법:
# gsutil ls gs://biocom-terraform-state/terraform/state/
#
# 🚨 주의사항:
# - 백엔드 설정을 변경하면 기존 상태 파일에 접근할 수 없게 될 수 있음
# - 운영환경에서는 별도의 GCS 버킷을 사용하는 것을 권장
# - 상태 파일에는 민감한 정보(패스워드 등)가 포함될 수 있으므로 접근 권한 관리 필수