# 파일 업로드 도메인 API 감사

> 작성일: 2025-10-24
> 분석자: Claude
> 상태: ✅ 완료

---

## 📍 파일 업로드 도메인 구조

**컨트롤러**: Upload (7개 엔드포인트)

**주요 기능**:
- 이미지 파일 업로드 (Google Cloud Storage)
- 음식 이미지 AI 분석 (GPT-4 Vision)
- 얼굴 슬리밍 이미지 생성 (Google Gemini)
- 파일 정보 조회 및 삭제

---

## 🎯 비즈니스 플로우

```
사용자가 활동 기록 작성
  ↓
이미지 업로드 (식단, 운동, 영양제 등)
  ↓
POST /upload/image?relatedType=DIET
  ↓
Google Cloud Storage 저장
  ↓
FileUpload 테이블에 기록
  ↓
MissionAttempt와 연결

---

음식 사진 촬영
  ↓
POST /upload/food-analysis
  ↓
GPT-4 Vision API 호출
  ↓
칼로리 및 영양 정보 반환

---

얼굴 사진 촬영
  ↓
POST /upload/face-slimming
  ↓
Google Gemini AI 호출
  ↓
5kg 슬리밍 효과 이미지 생성
```

---

## 1️⃣ Upload 컨트롤러

**Base Path**: `/api/upload`

### 엔드포인트 목록

#### A. 파일 업로드
- POST `/image` - 이미지 파일 업로드

#### B. 파일 조회
- GET `/` - 사용자 파일 목록 조회
- GET `/:id` - 파일 정보 조회

#### C. 파일 삭제
- DELETE `/:id` - 파일 삭제

#### D. AI 분석 (헬스케어)
- POST `/food-analysis` - 음식 이미지 AI 분석 (GPT-4 Vision)
- POST `/face-slimming` - 얼굴 슬리밍 이미지 생성 (Gemini)

---

### 주요 엔드포인트 상세

#### POST `/upload/image`
**목적**: 활동 기록 이미지 업로드

**권한**: `@UseGuards(JwtAuthGuard)`

**파라미터**:
- `relatedType` (query, required): 연관 활동 타입
  - 예: `DIET`, `DAILY_MISSION`, `SUPPLEMENT`

**Request**:
```
Content-Type: multipart/form-data

file: [이미지 파일]
```

**응답**:
```json
{
  "success": true,
  "message": "이미지가 성공적으로 업로드되었습니다.",
  "data": {
    "id": 123,
    "filename": "a1b2c3d4e5f6.jpg",
    "originalName": "food.jpg",
    "mimeType": "image/jpeg",
    "size": 524288,
    "path": "https://storage.googleapis.com/api-dev-biocom-uploads/a1b2c3d4e5f6.jpg",
    "uploadedAt": "2025-10-24T10:00:00Z"
  },
  "timestamp": "2025-10-24T10:00:00Z"
}
```

**상태**: ✅ 정상

**보안 검증**:
1. **파일 크기 제한**: 최대 10MB, 최소 1KB
2. **MIME 타입 화이트리스트**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
3. **확장자 검증**: MIME 타입과 확장자 일치 여부
4. **매직 바이트 검증**: 실제 파일 내용이 이미지인지 확인
5. **안전한 파일명**: crypto.randomBytes(16)로 랜덤 생성

**특징**:
- Google Cloud Storage 사용
- 공개 URL 반환 (public: true)
- DB에 파일 정보 저장
- 업로드 카테고리별 분류

---

#### GET `/upload`
**목적**: 사용자 업로드 파일 목록 조회

**권한**: `@UseGuards(JwtAuthGuard)`

**파라미터**:
- `relatedType` (query, optional): 활동 타입 필터

**응답**:
```json
{
  "success": true,
  "message": "파일 목록이 성공적으로 조회되었습니다.",
  "data": [
    {
      "id": 123,
      "filename": "a1b2c3d4e5f6.jpg",
      "originalName": "food.jpg",
      "mimeType": "image/jpeg",
      "size": 524288,
      "path": "https://storage.googleapis.com/.../a1b2c3d4e5f6.jpg",
      "uploadedAt": "2025-10-24T10:00:00Z"
    }
  ],
  "timestamp": "2025-10-24T10:00:00Z"
}
```

**상태**: ✅ 정상

**정렬**: `uploadedAt DESC` (최신순)

---

#### GET `/upload/:id`
**목적**: 특정 파일 정보 조회

**권한**: `@UseGuards(JwtAuthGuard)`

**응답**:
```json
{
  "success": true,
  "message": "파일 정보가 성공적으로 조회되었습니다.",
  "data": {
    "id": 123,
    "filename": "a1b2c3d4e5f6.jpg",
    "originalName": "food.jpg",
    "mimeType": "image/jpeg",
    "size": 524288,
    "path": "https://storage.googleapis.com/.../a1b2c3d4e5f6.jpg",
    "uploadedAt": "2025-10-24T10:00:00Z"
  },
  "timestamp": "2025-10-24T10:00:00Z"
}
```

**상태**: ✅ 정상

---

#### DELETE `/upload/:id`
**목적**: 파일 삭제

**권한**: `@UseGuards(JwtAuthGuard)`

**응답**:
```json
{
  "success": true,
  "message": "파일이 성공적으로 삭제되었습니다.",
  "timestamp": "2025-10-24T10:00:00Z"
}
```

**상태**: ✅ 정상

**삭제 프로세스**:
1. 사용자 소유권 확인 (`userId` 일치)
2. Google Cloud Storage에서 파일 삭제
3. DB에서 파일 기록 삭제

**특징**:
- 스토리지 삭제 실패 시에도 DB 기록은 삭제 (에러 무시)
- 다른 사용자의 파일은 삭제 불가

---

#### POST `/upload/food-analysis`
**목적**: 음식 이미지 AI 분석 (칼로리, 영양소)

**권한**: ⚠️ **현재 비활성화** (테스트용)
```typescript
// @UseGuards(JwtAuthGuard)  // 테스트를 위해 임시 제거
// @ApiBearerAuth()
```

**Request**:
```
Content-Type: multipart/form-data

file: [음식 이미지 파일]
```

**응답 (성공)**:
```json
{
  "success": true,
  "message": "김치찌개, 밥 분석이 완료되었습니다.",
  "data": {
    "food_items": [
      {
        "name": "김치찌개",
        "calories": 350,
        "protein": 15,
        "carbs": 25,
        "fat": 18
      },
      {
        "name": "밥",
        "calories": 200,
        "protein": 4,
        "carbs": 45,
        "fat": 0.5
      }
    ],
    "total": {
      "calories": 550,
      "protein": 19,
      "carbs": 70,
      "fat": 18.5
    }
  },
  "timestamp": "2025-10-24T10:00:00Z"
}
```

**응답 (음식 없음)**:
```json
{
  "success": true,
  "message": "음식이 감지되지 않았습니다.",
  "data": {
    "food_items": [],
    "total": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }
  },
  "timestamp": "2025-10-24T10:00:00Z"
}
```

**응답 (실패)**:
```json
{
  "success": false,
  "message": "AI 분석에 실패했습니다.",
  "data": {
    "food_items": [],
    "total": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
    "errorMessage": "AI 분석 중 오류가 발생했습니다: ..."
  },
  "timestamp": "2025-10-24T10:00:00Z"
}
```

**상태**: ✅ 정상

**AI 모델**: GPT-4 Vision (OpenAI)

**프로세스**:
1. 이미지 리사이징 (성능 최적화)
2. Google Cloud Storage에 업로드
3. GPT-4 Vision API 호출
4. 칼로리 및 영양 정보 파싱
5. 임시 파일 삭제 (1초 후)

**특징**:
- `isReady()` 체크로 AI 모델 준비 상태 확인
- 분석 실패 시에도 구조화된 응답 반환
- diskStorage 사용 시 임시 파일 자동 삭제

---

#### POST `/upload/face-slimming`
**목적**: 얼굴 슬리밍 이미지 생성 (5kg 감량 효과)

**권한**: ⚠️ **현재 비활성화** (테스트용)
```typescript
// @UseGuards(JwtAuthGuard)  // 테스트를 위해 임시 제거
// @ApiBearerAuth()
```

**Request**:
```
Content-Type: multipart/form-data

file: [얼굴 이미지 파일]
```

**응답 (성공)**:
```json
{
  "success": true,
  "message": "5kg 체중 감량 효과의 얼굴 슬리밍 이미지가 생성되었습니다.",
  "data": {
    "beforeImageUrl": "https://storage.googleapis.com/.../before.jpg",
    "afterImageUrl": "https://storage.googleapis.com/.../after.jpg",
    "weightLoss": 5,
    "processingTime": 12.5,
    "originalFileName": "face.jpg",
    "success": true,
    "retryCount": 0
  },
  "timestamp": "2025-10-24T10:00:00Z"
}
```

**응답 (실패)**:
```json
{
  "success": false,
  "message": "얼굴 슬리밍 처리에 실패했습니다.",
  "data": {
    "beforeImageUrl": "",
    "afterImageUrl": "",
    "weightLoss": 5,
    "processingTime": 0,
    "originalFileName": "face.jpg",
    "success": false,
    "errorMessage": "얼굴 슬리밍 처리 중 오류가 발생했습니다: ...",
    "retryCount": 0
  },
  "timestamp": "2025-10-24T10:00:00Z"
}
```

**상태**: ✅ 정상

**AI 모델**: Google Gemini

**파라미터**:
- `weightLoss`: 고정 5kg (스웨거에서 제거됨)
- 검증 범위: 1-30kg

**프로세스**:
1. 체중 감량 값 검증 (1-30kg)
2. AI 모델 준비 상태 확인
3. 얼굴 슬리밍 처리 (재시도 로직 포함)
4. Google Cloud Storage에 원본/결과 업로드
5. 임시 파일 삭제 (1초 후)

**특징**:
- 재시도 로직 포함
- 처리 시간 측정
- 원본/결과 이미지 모두 저장
- FastAPI 포팅 버전

---

## 📊 데이터베이스 스키마

### FileUpload 테이블
```prisma
model FileUpload {
  id              Int      @id @default(autoincrement())
  userId          Int      @map("user_id")
  originalName    String   @map("original_name")
  filename        String
  mimetype        String
  size            Int
  path            String
  uploadedAt      DateTime @map("uploaded_at")
  fileType        String   @map("file_type")
  uploadCategory  String   @map("upload_category")

  user            User             @relation(fields: [userId], references: [id])
  missionAttempts MissionAttempt[]

  @@map("file_uploads")
}
```

**uploadCategory 예시**:
- `DIET` - 식단 기록
- `DAILY_MISSION` - 일일 미션
- `SUPPLEMENT` - 영양제
- `general` - 기타

---

## 🔍 파일 업로드 도메인 정리

### ✅ 잘된 점

1. **강력한 보안 검증**
   - 파일 크기 제한 (10MB)
   - MIME 타입 화이트리스트
   - 매직 바이트 검증
   - 안전한 파일명 생성

2. **Google Cloud Storage 통합**
   - 확장 가능한 스토리지
   - 공개 URL 자동 생성
   - 파일 삭제 처리

3. **AI 기능 통합**
   - GPT-4 Vision으로 음식 분석
   - Google Gemini로 얼굴 슬리밍
   - 재시도 로직 포함

4. **에러 처리**
   - 분석 실패 시에도 구조화된 응답
   - 임시 파일 자동 삭제
   - 로깅 상세

5. **사용자 권한 검증**
   - 본인 파일만 삭제 가능
   - userId로 파일 필터링

### 🤔 검토 필요사항

#### 1. AI API 인증 비활성화 ⚠️
**위치**: [upload.controller.ts:246-247](src/upload/upload.controller.ts#L246-L247), [upload.controller.ts:366-367](src/upload/upload.controller.ts#L366-L367)

**문제**:
```typescript
// @UseGuards(JwtAuthGuard)  // 테스트를 위해 임시 제거
// @ApiBearerAuth()
```

**현재 상태**:
- 음식 분석 API: 인증 없음
- 얼굴 슬리밍 API: 인증 없음

**위험**:
- 누구나 무료로 AI API 호출 가능
- 비용 폭탄 가능성
- 악용 가능

**권장 조치**:
```typescript
@UseGuards(JwtAuthGuard)  // ✅ 인증 활성화
@ApiBearerAuth()
```

또는:
```typescript
@UseGuards(JwtAuthGuard, RateLimitGuard)  // ✅ 인증 + 요청 제한
@ApiBearerAuth()
```

---

#### 2. userId 추출 불일치 ⚠️
**위치**: [upload.controller.ts:108](src/upload/upload.controller.ts#L108)

**문제**:
```typescript
// 현재 (upload.controller.ts)
const userId = req.user.sub;  // ❌ 다른 도메인과 불일치

// 다른 도메인 표준
const userId = req.user.userId || req.user.sub;  // ✅
```

**영향**:
- JWT payload 구조에 따라 userId 추출 실패 가능
- 인증 실패 가능성

**권장 조치**:
```typescript
const userId = req.user.userId || req.user.sub || req.user.id;
```

---

#### 3. relatedType 필수 검증 부족
**위치**: [upload.controller.ts:104-106](src/upload/upload.controller.ts#L104-L106)

**문제**:
```typescript
if (!relatedType) {
  throw new BadRequestException('연관된 활동 타입(relatedType)을 지정해주세요.');
}
```

**현재**:
- 존재 여부만 확인
- 유효한 값인지 검증 안 함

**권장**:
```typescript
const VALID_TYPES = ['DIET', 'DAILY_MISSION', 'SUPPLEMENT', 'EXERCISE'];

if (!relatedType) {
  throw new BadRequestException('연관된 활동 타입(relatedType)을 지정해주세요.');
}

if (!VALID_TYPES.includes(relatedType)) {
  throw new BadRequestException(`유효하지 않은 활동 타입입니다. 허용: ${VALID_TYPES.join(', ')}`);
}
```

---

#### 4. 파일 조회 권한 검증 없음 ⚠️
**위치**: [upload.service.ts:240-260](src/upload/upload.service.ts#L240-L260)

**문제**:
```typescript
async getFileInfo(fileId: number): Promise<FileUploadResponseDto> {
  const file = await this.prisma.fileUpload.findUnique({
    where: { id: fileId },
  });
  // ❌ userId 검증 없음 - 다른 사용자 파일도 조회 가능
}
```

**현재**:
- 파일 ID만 알면 누구나 조회 가능
- 개인정보 유출 가능

**권장**:
```typescript
async getFileInfo(fileId: number, userId: number): Promise<FileUploadResponseDto> {
  const file = await this.prisma.fileUpload.findFirst({
    where: {
      id: fileId,
      userId  // ✅ 본인 파일만 조회
    },
  });

  if (!file) {
    throw new NotFoundException('파일을 찾을 수 없거나 조회 권한이 없습니다.');
  }
  // ...
}
```

---

#### 5. AI 분석 결과 저장 안 됨
**현재 상황**:
- 음식 분석 결과: API 응답만, DB 저장 안 함
- 얼굴 슬리밍 결과: 이미지만 저장, 메타데이터 저장 안 함

**추천**:
```prisma
model FoodAnalysisHistory {
  id          Int      @id @default(autoincrement())
  userId      Int
  imageUrl    String
  foodItems   Json
  totalCalories Int
  analyzedAt  DateTime
  @@map("food_analysis_history")
}

model FaceSlimmingHistory {
  id              Int      @id @default(autoincrement())
  userId          Int
  beforeImageUrl  String
  afterImageUrl   String
  weightLoss      Int
  processingTime  Float
  createdAt       DateTime
  @@map("face_slimming_history")
}
```

---

#### 6. 임시 파일 삭제 타이밍
**위치**: [upload.controller.ts:310-317](src/upload/upload.controller.ts#L310-L317)

**문제**:
```typescript
setTimeout(() => {
  try {
    fs.unlinkSync(file.path);
  } catch (error) {
    this.logger.warn(`임시 파일 삭제 실패: ${file.path}`);
  }
}, 1000);  // ❌ 하드코딩된 1초
```

**현재**:
- AI 처리가 1초 이내에 완료되면 파일이 없어질 수 있음
- 처리 시간이 긴 경우 임시 파일이 남을 수 있음

**권장**:
```typescript
// AI 처리 완료 후 즉시 삭제
const result = await this.foodCalorieService.analyzeFoodImage(...);

// 처리 완료 후 삭제
if (file.path) {
  try {
    fs.unlinkSync(file.path);
  } catch (error) {
    this.logger.warn(`임시 파일 삭제 실패: ${file.path}`);
  }
}

return result;
```

---

## 🎯 파일 업로드 도메인 결론

**전반적 평가**: ⚠️ **보안 취약점 존재하나 기능은 우수**

- 파일 업로드 및 보안 검증 우수
- AI 통합 기능 혁신적
- Google Cloud Storage 잘 활용

**필수 개선사항**:
1. **AI API 인증 활성화** (비용 폭탄 방지)
2. **파일 조회 권한 검증** (개인정보 유출 방지)
3. **userId 추출 로직 표준화**

**선택 개선사항**:
1. relatedType 값 검증
2. AI 분석 결과 DB 저장
3. 임시 파일 삭제 타이밍 개선
4. Rate Limiting 추가 (AI API 남용 방지)

---

**파일 업로드 도메인 감사 완료** ✅
