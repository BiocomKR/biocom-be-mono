# Google Service Account Key 생성 가이드

## 🎯 목적
Google Cloud Storage 인증을 영구적으로 해결하기 위해 Service Account Key 파일 방식 사용

## 📋 단계별 설정 방법

### 1. Google Cloud Console에서 Service Account 생성

1. **Google Cloud Console** 접속: https://console.cloud.google.com
2. 프로젝트 선택: `api-dev-biocom`
3. **IAM 및 관리자** > **Service Account** 메뉴로 이동
4. **"Service Account 만들기"** 클릭

### 2. Service Account 정보 입력

```
서비스 계정 이름: biocom-storage-service
서비스 계정 ID: biocom-storage-service
설명: Biocom API Google Storage 접근을 위한 서비스 계정
```

### 3. 권한 부여 (중요!)

다음 역할들을 추가해야 합니다:
- `Storage Admin` (전체 스토리지 관리)
- `Storage Object Admin` (객체 읽기/쓰기/삭제)
- 또는 최소 권한: `Storage Object Creator` + `Storage Object Viewer`

### 4. Service Account Key 파일 다운로드

1. 생성된 Service Account 클릭
2. **"키"** 탭으로 이동
3. **"키 추가"** > **"새 키 만들기"**
4. **JSON 형식** 선택
5. **다운로드된 JSON 파일**을 다음 위치에 저장:

```bash
/Users/daegilchoi/biocom/biocom-api/google-service-account-key.json
```

### 5. 파일 권한 설정 (보안)

```bash
chmod 600 /Users/daegilchoi/biocom/biocom-api/google-service-account-key.json
```

### 6. .gitignore에 추가 (중요!)

```gitignore
# Google Service Account Key (보안)
google-service-account-key.json
*.json
!package*.json
```

## 🔧 운영 환경 배포 시 설정

### 1. 운영 서버에 Key 파일 배포
```bash
# 안전한 위치에 저장
/opt/biocom-api/google-service-account-key.json
```

### 2. 환경변수 수정 (.env.production)
```env
GOOGLE_SERVICE_ACCOUNT_KEY_FILE="/opt/biocom-api/google-service-account-key.json"
```

### 3. 파일 권한 설정
```bash
sudo chown biocom-api:biocom-api /opt/biocom-api/google-service-account-key.json
sudo chmod 600 /opt/biocom-api/google-service-account-key.json
```

## ✅ 테스트 방법

Service Account Key 파일이 제대로 설정되었는지 확인:

1. **서버 재시작**
2. **로그 확인**: `Google Storage 서비스 초기화 완료! (Service Account Key 방식)` 메시지 확인
3. **API 테스트**: 얼굴슬리밍 API 호출하여 `"storageLocation": "google-storage"` 확인

## 🚨 보안 주의사항

1. **Service Account Key 파일 절대 공개 금지**
2. **Git에 커밋 금지** (.gitignore 필수)
3. **정기적인 키 로테이션** (6개월마다)
4. **최소 권한 원칙** 적용

## 💡 장점

- ✅ **영구적 인증**: 토큰 만료 없음
- ✅ **운영 환경 안정성**: 매일 로그인할 필요 없음
- ✅ **자동 배포 지원**: CI/CD 파이프라인에서 안정적 작동
- ✅ **Fallback 지원**: Service Account Key 실패 시 ADC 자동 사용

형님! Service Account Key를 생성하시면 완전히 해결됩니다! 🚀