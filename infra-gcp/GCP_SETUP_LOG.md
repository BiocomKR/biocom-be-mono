# GCP 인프라 셋업 작업 로그

> **목적**: ai@biocom.kr 계정으로 새로운 GCP 프로젝트 생성 및 인증키 설정  
> **작업일**: 2025-09-02  
> **담당자**: Claude Code + 개발팀

---

## 📋 작업 개요

### 현재 상황
- **기존 프로젝트**: biocom-api-dev (다른 계정으로 생성, 사용 안함)
- **개발팀 계정**: ai@biocom.kr (결제계정 연동 완료)
- **목표**: 새로운 프로젝트 생성 → 서비스 계정 인증키 설정

### 작업 순서
1. ✅ 현재 계정 상태 확인
2. 🔄 새로운 GCP 프로젝트 생성 (프로젝트명 결정 중)
3. ⏳ 서비스 계정 생성
4. ⏳ 인증키 다운로드 및 설정
5. ⏳ 환경변수 설정

---

## 📝 상세 작업 로그

### 1️⃣ 현재 계정 상태 확인 ✅

**실행 명령어**:
```bash
gcloud auth list
```

**결과**:
```
 Credentialed Accounts
ACTIVE  ACCOUNT
*       ai@biocom.kr          ← 활성 계정
        biocom@biocom.kr
        daegil@biocom.kr
```

**현재 프로젝트 확인**:
```bash
gcloud config get-value project
```
**결과**: `biocom-api-dev` (기존 프로젝트, 사용 안함)

---

### 2️⃣ 새로운 GCP 프로젝트 생성 🔄

**결정된 프로젝트 정보**:
- **PROJECT_ID**: `api-dev-biocom`
- **PROJECT_NAME**: `API 개발`

**실행 명령어**:
```bash
gcloud projects create api-dev-biocom --name="Biocom API Development"
```

**1차 시도 결과**: 
```
ERROR: 인증 토큰 만료
```
**해결**: ai@biocom.kr 계정 재인증 완료 ✅

**2차 시도**:
```bash
gcloud projects create api-dev-biocom --name="Biocom API Development"
```
**결과**: 
```
ERROR: (gcloud.projects.create) INVALID_ARGUMENT: field [display_name] has issue [project display name contains invalid characters]
```
**문제**: 한글 프로젝트명 불가

**3차 시도**:
```bash
gcloud projects create api-dev-biocom --name="Biocom API Development"
```
**결과**: 
```
Create in progress for [https://cloudresourcemanager.googleapis.com/v1/projects/api-dev-biocom].
Waiting for [operations/create_project.global.6376314479392726232] to finish...
.done.
Enabling service [cloudapis.googleapis.com] on project [api-dev-biocom]...
Operation "operations/acat.p2-902529540881-de456c28-8126-4579-b9a0-0b00e5712059" finished successfully.
```
**✅ 성공**: 프로젝트 생성 완료!

---

### 3️⃣ 프로젝트 활성화 ✅

**실행 명령어**:
```bash
gcloud config set project api-dev-biocom
```

**결과**: 
```
WARNING: Your active project does not match the quota project in your local Application Default Credentials file. This might result in unexpected quota issues.
To update your Application Default Credentials quota project, use the `gcloud auth application-default set-quota-project` command.
Updated property [core/project].
```
**✅ 성공**: 프로젝트 활성화 완료!

---

### 4️⃣ 서비스 계정 생성 ✅

**실행 명령어**:
```bash
gcloud iam service-accounts create biocom-api-service \
  --display-name="Biocom API Service Account" \
  --description="Service account for Biocom API development and deployment"
```

**결과**: 
```
Created service account [biocom-api-service].
```
**✅ 성공**: 서비스 계정 생성 완료!

**생성된 서비스 계정**:
- **이름**: `biocom-api-service`
- **이메일**: `biocom-api-service@api-dev-biocom.iam.gserviceaccount.com`

---

### 5️⃣ 인증키 생성 ❌

**실행 명령어**:
```bash
gcloud iam service-accounts keys create ./biocom-api-key.json \
  --iam-account=biocom-api-service@api-dev-biocom.iam.gserviceaccount.com
```

**결과**: 
```
ERROR: (gcloud.iam.service-accounts.keys.create) FAILED_PRECONDITION: Key creation is not allowed on this service account.
- '@type': type.googleapis.com/google.rpc.PreconditionFailure
  violations:
  - description: Key creation is not allowed on this service account.
    subject: projects/api-dev-biocom/serviceAccounts/biocom-api-service@api-dev-biocom.iam.gserviceaccount.com?configvalue=biocom-api-service%40api-dev-biocom.iam.gserviceaccount.com
    type: constraints/iam.disableServiceAccountKeyCreation
```

**❌ 문제**: 조직 정책에서 서비스 계정 키 생성이 제한됨
**원인**: `constraints/iam.disableServiceAccountKeyCreation` 정책 활성화

---

### 6️⃣ 토큰 만료 시간 확인 ✅

**실행 명령어**:
```bash
gcloud auth describe ai@biocom.kr
```

**결과**: 
- **토큰 만료시간**: `09-03-2025 03:24:32` (약 24시간 후)
- **상태**: `expired: false`, `valid: true`
- **리프레시 토큰**: 존재 (자동 갱신 가능)

**📊 gcloud 인증 지속 시간**:
- **액세스 토큰**: 약 1시간 (자동 갱신)
- **리프레시 토큰**: 약 7일~90일 (사용 빈도에 따라 연장)
- **최대 지속**: 정기적 사용시 거의 무제한 (자동 갱신)

---

## ✅ 최종 결론

### 🎯 인증 방식 결정
- **선택된 방식**: gcloud auth (사용자 인증) 
- **이유**: 
  - 토큰 지속시간이 충분함 (자동 갱신)
  - 매일 개발하므로 재인증 불필요
  - 서비스 계정 키 생성 제한 우회
  - 개발환경에 적합

### 📋 완료된 설정
- ✅ **프로젝트**: `api-dev-biocom` 생성 완료
- ✅ **계정**: `ai@biocom.kr` 인증 완료  
- ✅ **토큰**: 24시간 유효, 자동 갱신
- ✅ **권한**: 클라우드 플랫폼 전체 권한 보유
- ✅ **조직 구조**: biocom.kr 조직 하위에 자동 배치
- ✅ **결제 계정**: 수동으로 Google Console에서 연동 완료

### 🚀 사용 방법
현재 상태에서 바로 GCP API 사용 가능:
```bash
# 현재 프로젝트 확인
gcloud config get-value project  # → api-dev-biocom

# 각종 GCP 서비스 사용 가능
gcloud compute instances list
gcloud storage buckets list
terraform plan  # GCP provider 자동 인증
```

---

### 7️⃣ GCP Console 확인 결과 🔍

**발견사항**: 프로젝트가 **조직 하위**에 생성됨
- **조직 구조**: biocom.kr 조직 → api-dev-biocom 프로젝트
- **이전 경험**: 콘솔에서 직접 생성시 조직과 프로젝트가 동일 레벨

**원인 분석**:
- **CLI 생성**: ai@biocom.kr 계정으로 CLI에서 생성 → biocom.kr 조직 하위 자동 배치
- **콘솔 생성**: 개인 계정으로 콘솔에서 생성 → 조직 없이 독립적으로 생성

**조직 하위 생성의 장점**:
- ✅ 통합된 결제 관리
- ✅ 조직 정책 일괄 적용
- ✅ IAM 권한 상속
- ✅ 리소스 관리 체계화

**조직 하위 생성의 단점**:
- ❌ 조직 정책 제약 (예: 서비스 계정 키 생성 제한)
- ❌ 조직 관리자 권한 필요할 수 있음

**추가 작업**:
- ✅ **결제 계정 연동**: Google Console에서 수동으로 완료
- 🔄 **CLI 검증**: 결제 계정 CLI 명령어 테스트 예정

### 8️⃣ 결제 계정 CLI 명령어 테스트 🧪

**현재 결제 상태 확인**:
```bash
gcloud billing projects describe api-dev-biocom
```
**결과**:
```
billingAccountName: billingAccounts/01786D-B8BF25-BE8767
billingEnabled: true
name: projects/api-dev-biocom/billingInfo
projectId: api-dev-biocom
```

**결제 계정 연결 CLI 명령어 테스트 결과** ✅:

**1단계: 해제 확인**
```bash
gcloud billing projects describe api-dev-biocom
# 결과: billingEnabled: false
```

**2단계: 사용 가능한 결제 계정 목록 확인**
```bash
gcloud billing accounts list
```
**결과**:
```
ACCOUNT_ID            NAME          OPEN   MASTER_ACCOUNT_ID
012C5C-4DD688-AD43FD  내 결제 계정  False
01786D-B8BF25-BE8767  결제계정      True   ← 활성 계정
```

**3단계: CLI로 결제 계정 연결**
```bash
gcloud billing projects link api-dev-biocom \
  --billing-account=01786D-B8BF25-BE8767
```
**결과**: 
```
billingAccountName: billingAccounts/01786D-B8BF25-BE8767
billingEnabled: true  ← 성공적으로 연결됨!
```

**✅ 결론**: CLI로 결제 계정 연동 완벽하게 작동!

---

### 9️⃣ 배포 파일 준비 완료 🚀

**배포 스크립트 확인 결과**:
- ✅ **인프라 배포 스크립트**: `./infra-gcp/scripts/01-deploy-infrastructure.sh`
- ✅ **앱 배포 스크립트**: `./infra-gcp/scripts/02-deploy-app.sh`
- ✅ **Terraform 설정**: `./infra-gcp/terraform/terraform.tfvars`

**수정 완료**:
- ✅ **프로젝트 ID 변경**: `biocom-api-dev` → `api-dev-biocom`

**실행 준비 완료**:
```bash
# 인프라 배포 (GKE, Cloud SQL, VPC, Storage)
./infra-gcp/scripts/01-deploy-infrastructure.sh --project-id api-dev-biocom --yes

# 앱 배포 (Docker 빌드 + Kubernetes 배포)
./infra-gcp/scripts/02-deploy-app.sh --project-id api-dev-biocom --yes
```

---

## 📌 참고사항

- **목적**: 매번 Google 로그인 없이 자동 인증
- **보안**: 인증키 파일은 .gitignore 처리 필수
- **환경**: 개발/운영 환경별 다른 서비스 계정 고려

---

### 🔟 Kubernetes Engine API 활성화 🔧

**날짜**: 2025-09-03  
**상황**: GKE 클러스터 배포 중 API 비활성화 오류 발생

**오류 내용**:
```
ERROR: (gcloud.container.clusters.list) ResponseError: code=403, message=Kubernetes Engine API has not been used in project api-dev-biocom before or it is disabled.
```

**해결 명령어**:
```bash
# Kubernetes Engine API 활성화
gcloud services enable container.googleapis.com --project=api-dev-biocom

# 추가로 필요할 수 있는 API들
gcloud services enable compute.googleapis.com --project=api-dev-biocom
gcloud services enable cloudsql.googleapis.com --project=api-dev-biocom
gcloud services enable storage.googleapis.com --project=api-dev-biocom
gcloud services enable certificatemanager.googleapis.com --project=api-dev-biocom
gcloud services enable dns.googleapis.com --project=api-dev-biocom
```

**API 활성화 상태 확인**:
```bash
# 활성화된 서비스 목록 확인
gcloud services list --enabled --project=api-dev-biocom

# 특정 API 상태 확인
gcloud services list --enabled --filter="name:container.googleapis.com" --project=api-dev-biocom
```

**활성화 후 GKE 클러스터 상태 확인**:
```bash
# GKE 클러스터 목록 확인
gcloud container clusters list --project=api-dev-biocom

# GKE 클러스터가 없는 경우 Terraform으로 생성 예정
```

---

*작업 진행 중... 계속 업데이트 예정*