# 구글 클라우드 스토리지 이관 작업 시나리오

## 📋 작업 개요

**목표**: 음식 칼로리 계산 및 얼굴 슬리밍 서비스의 로컬 파일 저장 → Google Cloud Storage 이관  
**예상 소요 시간**: 4-6시간  
**우선순위**: 높음 (프로덕션 배포 필수 조건)

## 🔍 현재 상태 분석

### 문제 상황
1. **음식 칼로리 서비스**: 로컬 저장만 지원 (`saveToLocal` 방식)
2. **얼굴 슬리밍 서비스**: Google Storage 코드 존재하지만 비활성화 (인증 문제)
3. **공통 이슈**: 로컬 저장으로 인한 서버 디스크 용량 부족 위험

### 영향 범위
- `src/upload/food-calorie.service.ts`: Google Storage 연동 추가 필요
- `src/upload/face-slimming.service.ts`: 기존 Google Storage 인증 문제 해결
- `src/upload/upload.controller.ts`: 응답 로직 수정 필요
- 환경변수 및 인증 설정 추가 필요

## 🚀 작업 시나리오 단계별 계획

### Phase 1: 환경 설정 및 인증 구성 (30분)

#### 1.1 Google Cloud 서비스 계정 키 설정
```bash
# 서비스 계정 키 확인 및 경로 설정
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

#### 1.2 환경변수 설정 (.env)
```bash
# Google Cloud Storage 설정
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_STORAGE_BUCKET=biocom-file-storage
GOOGLE_APPLICATION_CREDENTIALS=./config/service-account-key.json
```

#### 1.3 필요한 패키지 설치 확인
```bash
npm install @google-cloud/storage
```

### Phase 2: 공통 Google Storage 서비스 생성 (45분)

#### 2.1 공통 Storage 서비스 생성
```typescript
// src/common/services/google-storage.service.ts
@Injectable()
export class GoogleStorageService {
  private storage: Storage;
  private bucket: string;
  
  // 파일 업로드, 삭제, URL 생성 등 공통 메서드
}
```

#### 2.2 의존성 주입 설정
- `CommonModule`에 GoogleStorageService 추가
- 각 서비스에서 의존성 주입으로 사용

### Phase 3: 얼굴 슬리밍 서비스 Google Storage 연동 (60분)

#### 3.1 기존 인증 문제 해결
- `invalid_grant, invalid_rapt` 에러 원인 분석
- 서비스 계정 키 재발급 또는 권한 수정
- 인증 흐름 테스트

#### 3.2 saveToLocal → saveToGoogleStorage 전환
```typescript
// Before: saveToLocal(processedBuffer, originalName)
// After: await this.googleStorageService.uploadFile(processedBuffer, fileName)
```

#### 3.3 응답 형태 변경
- 로컬 파일 경로 → Google Storage Public URL
- 프론트엔드에서 바로 접근 가능한 HTTPS URL 제공

### Phase 4: 음식 칼로리 서비스 Google Storage 연동 (60분)

#### 4.1 Google Storage 업로드 로직 추가
```typescript
/**
 * 처리된 이미지를 Google Cloud Storage에 업로드
 * @param imageBuffer 처리된 이미지 버퍼
 * @param originalName 원본 파일명
 * @returns Google Storage Public URL
 */
private async saveToGoogleStorage(imageBuffer: Buffer, originalName: string): Promise<string>
```

#### 4.2 응답 DTO 수정
- `FoodAnalysisResponseDto`에 이미지 URL 필드 추가
- 프론트엔드에서 처리된 이미지 표시 가능하도록 설정

### Phase 5: 컨트롤러 및 응답 로직 개선 (45분)

#### 5.1 Upload Controller 수정
```typescript
// 두 서비스 모두 Google Storage URL 반환하도록 수정
@Post('face-slimming')
async faceSlimming(): Promise<{ imageUrl: string; processingTime: number }>

@Post('food-analysis')  
async analyzeFood(): Promise<FoodAnalysisResponseDto & { imageUrl: string }>
```

#### 5.2 에러 핸들링 강화
- Google Storage 업로드 실패 시 로컬 저장 fallback
- 상세한 에러 로깅 및 사용자 친화적 메시지

### Phase 6: 테스트 및 검증 (90분)

#### 6.1 단위 테스트
```bash
# Google Storage 연동 테스트
npm run test src/upload/face-slimming.service.spec.ts
npm run test src/upload/food-calorie.service.spec.ts
```

#### 6.2 통합 테스트
```bash
# 실제 파일 업로드 테스트
curl -X POST "http://localhost:10804/api/upload/face-slimming?weightLoss=5" \
  -F "image=@test-image.jpg"

curl -X POST "http://localhost:10804/api/upload/food-analysis" \
  -F "image=@food-image.jpg"
```

#### 6.3 성능 테스트
- 업로드 속도 측정 (로컬 vs Google Storage)
- 동시 업로드 처리 능력 테스트
- 메모리 사용량 모니터링

### Phase 7: 마이그레이션 및 정리 (30분)

#### 7.1 기존 로컬 파일 정리
```bash
# 업로드 디렉토리 백업 후 정리
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz ./uploads
rm -rf ./uploads/*
```

#### 7.2 설정 파일 업데이트
- `upload.module.ts`에서 diskStorage 설정 제거
- memoryStorage로 변경 (임시 메모리 사용)

## 🔧 기술적 고려사항

### 보안
- Google Cloud IAM 권한 최소화 원칙
- 서비스 계정 키 안전한 저장 (환경변수, Secret Manager)
- 업로드된 파일의 공개 액세스 권한 관리

### 성능 최적화
- 멀티파트 업로드 활용 (큰 파일)
- 이미지 CDN 연동 고려 (Cloud CDN)
- 압축된 이미지 우선 업로드

### 비용 관리
- Storage Class 최적화 (Standard, Nearline, Coldline)
- 자동 삭제 정책 설정 (Lifecycle management)
- 사용량 모니터링 및 알림 설정

## ⚠️ 위험 요소 및 대응 방안

### 위험 요소
1. **인증 실패**: 서비스 계정 키 문제
2. **네트워크 장애**: Google Storage 접근 불가
3. **용량 초과**: 버킷 용량 한도 도달
4. **성능 저하**: 업로드 시간 증가

### 대응 방안
1. **Fallback 메커니즘**: Google Storage 실패 시 로컬 저장
2. **재시도 로직**: 네트워크 오류 시 3회 재시도
3. **모니터링**: Cloud Monitoring으로 사용량 추적
4. **성능 임계치**: 업로드 시간 10초 초과 시 알림

## 📊 성공 지표

### 기술적 지표
- ✅ Google Storage 업로드 성공률 > 99%
- ✅ 평균 업로드 시간 < 5초
- ✅ 서버 디스크 사용량 90% 감소
- ✅ 모든 기존 API 테스트 통과

### 사용자 경험 지표  
- ✅ 이미지 로딩 속도 개선
- ✅ 서버 응답 시간 유지 (< 15초)
- ✅ 에러율 유지 (< 1%)

## 🎯 완료 후 점검 사항

- [ ] 로컬 파일 저장 코드 제거 완료
- [ ] Google Storage URL 정상 접근 확인  
- [ ] 프론트엔드 연동 테스트 완료
- [ ] 로그 및 모니터링 설정 완료
- [ ] 문서 업데이트 (API 명세, README)

---

**작성일**: 2025-09-10  
**작성자**: Claude Code  
**리뷰 필요**: 형님 승인 후 작업 시작  
**예상 완료일**: 작업 시작 후 1일 이내