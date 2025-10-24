# AI 페르소나 도메인 API 감사

> 작성일: 2025-10-24
> 분석자: Claude
> 상태: ✅ 완료

---

## 📍 AI 페르소나 도메인 구조

**컨트롤러**: AiPersona (5개 엔드포인트)

**주요 기능**:
- AI 캐릭터 관리 (CRUD)
- 밸런스게임 및 사용자 프로필에서 사용
- 페르소나 정렬 순서 관리
- 소프트 삭제 및 사용 중 검증

---

## 🎯 비즈니스 플로우

```
관리자가 AI 페르소나 생성
  ↓
POST /ai-personas (철민님, 유진님, 뽑이 등)
  ↓
사용자 앱에서 페르소나 목록 조회
  ↓
GET /ai-personas (활성화된 것만)
  ↓
밸런스게임 단계에서 페르소나 배정
  ↓
사용자 프로필에 페르소나 저장 (User.characterId)
  ↓
페르소나 수정/삭제 (관리자)
  ↓
PUT/DELETE /ai-personas/:id
```

---

## 1️⃣ AiPersona 컨트롤러

**Base Path**: `/api/ai-personas`

### 엔드포인트 목록

#### A. 관리자 API (인증 필요)
- POST `/` - AI 페르소나 생성
- PUT `/:id` - AI 페르소나 수정
- DELETE `/:id` - AI 페르소나 삭제 (소프트 삭제)

#### B. 공개 API (인증 불필요)
- GET `/` - AI 페르소나 목록 조회
- GET `/:id` - AI 페르소나 단일 조회

---

### 주요 엔드포인트 상세

#### POST `/ai-personas`
**목적**: 새로운 AI 페르소나 생성

**권한**: 관리자 (`@UseGuards(JwtAuthGuard)`)

**Request**:
```json
{
  "name": "철민님",
  "description": "친절하고 따뜻한 멘토",
  "personality": "격려와 응원을 아끼지 않는 스타일",
  "personaUrl": "https://cdn.biocom.com/personas/chulmin.png",
  "sortOrder": 1
}
```

**응답**:
```json
{
  "id": 1,
  "name": "철민님",
  "description": "친절하고 따뜻한 멘토",
  "personality": "격려와 응원을 아끼지 않는 스타일",
  "personaUrl": "https://cdn.biocom.com/personas/chulmin.png",
  "isActive": true,
  "sortOrder": 1,
  "createdAt": "2025-10-24T10:00:00Z",
  "updatedAt": null
}
```

**상태**: ✅ 정상

**특징**:
- 이름 중복 검사 (ConflictException)
- `isActive` 기본값: `true`
- `sortOrder` 기본값: `0`
- KST 시간 적용

---

#### GET `/ai-personas`
**목적**: AI 페르소나 목록 조회

**권한**: 없음 (공개 API)

**쿼리 파라미터**:
- `admin` (optional): `true`인 경우 비활성화된 페르소나도 포함

**응답 (일반 사용자)**:
```json
{
  "personas": [
    {
      "id": 1,
      "name": "철민님",
      "description": "친절하고 따뜻한 멘토",
      "personality": "격려와 응원을 아끼지 않는 스타일",
      "personaUrl": "https://cdn.biocom.com/personas/chulmin.png",
      "isActive": true,
      "sortOrder": 1,
      "createdAt": "2025-10-24T10:00:00Z",
      "updatedAt": null
    }
  ],
  "total": 3
}
```

**응답 (관리자, admin=true)**:
```json
{
  "personas": [
    // 활성화된 페르소나들 (isActive: true)
    // + 비활성화된 페르소나들 (isActive: false)
  ],
  "total": 5
}
```

**상태**: ✅ 정상

**정렬 순서**:
- **일반 사용자**: `sortOrder ASC`, `createdAt ASC` (활성화된 것만)
- **관리자**: `isActive DESC`, `sortOrder ASC`, `createdAt ASC` (모두 포함)

**특징**:
- 일반 사용자는 활성화된 페르소나만 조회
- 관리자는 비활성화된 페르소나도 조회 가능
- 정렬 순서 명확 (sortOrder 우선)

---

#### GET `/ai-personas/:id`
**목적**: AI 페르소나 단일 조회

**권한**: 없음 (공개 API)

**응답**:
```json
{
  "id": 1,
  "name": "철민님",
  "description": "친절하고 따뜻한 멘토",
  "personality": "격려와 응원을 아끼지 않는 스타일",
  "personaUrl": "https://cdn.biocom.com/personas/chulmin.png",
  "isActive": true,
  "sortOrder": 1,
  "createdAt": "2025-10-24T10:00:00Z",
  "updatedAt": null
}
```

**상태**: ✅ 정상

**특징**:
- 비활성화된 페르소나도 조회 가능 (ID만 알면)
- NotFoundException 발생 시 명확한 메시지

---

#### PUT `/ai-personas/:id`
**목적**: AI 페르소나 정보 수정

**권한**: 관리자 (`@UseGuards(JwtAuthGuard)`)

**Request**:
```json
{
  "name": "철민님 (업데이트)",
  "description": "더욱 친절한 멘토",
  "personality": "격려와 응원을 아끼지 않는 스타일",
  "personaUrl": "https://cdn.biocom.com/personas/chulmin-v2.png",
  "isActive": true,
  "sortOrder": 2
}
```

**응답**:
```json
{
  "id": 1,
  "name": "철민님 (업데이트)",
  "description": "더욱 친절한 멘토",
  "personality": "격려와 응원을 아끼지 않는 스타일",
  "personaUrl": "https://cdn.biocom.com/personas/chulmin-v2.png",
  "isActive": true,
  "sortOrder": 2,
  "createdAt": "2025-10-24T10:00:00Z",
  "updatedAt": "2025-10-24T15:30:00Z"
}
```

**상태**: ✅ 정상

**특징**:
- 이름 변경 시 중복 검사 (다른 페르소나와 이름 충돌 방지)
- 부분 업데이트 지원 (undefined 필드는 업데이트 안 함)
- NotFoundException 발생 시 명확한 메시지

---

#### DELETE `/ai-personas/:id`
**목적**: AI 페르소나 삭제 (소프트 삭제)

**권한**: 관리자 (`@UseGuards(JwtAuthGuard)`)

**응답**:
```json
{
  "success": true,
  "message": "페르소나 '철민님'이 성공적으로 삭제되었습니다"
}
```

**상태**: ✅ 정상

**삭제 전 검증**:
1. **사용 중인 사용자 확인**
   ```sql
   SELECT COUNT(*) FROM users WHERE character_id = :id
   ```
   - 사용자가 있으면 `BadRequestException`: "N명의 사용자가 이 페르소나를 사용 중입니다"

2. **밸런스게임 단계 확인**
   ```sql
   SELECT COUNT(*) FROM balance_game_steps WHERE character_id = :id
   ```
   - 밸런스게임에서 사용 중이면 `BadRequestException`: "N개의 밸런스게임에서 이 페르소나를 사용 중입니다"

3. **소프트 삭제**
   ```sql
   UPDATE ai_personas SET is_active = false WHERE id = :id
   ```

**특징**:
- 하드 삭제 없음 (데이터 보존)
- 사용 중 검증으로 데이터 무결성 보장
- 명확한 에러 메시지

---

## 📊 데이터베이스 스키마

### AiPersona 테이블
```prisma
model AiPersona {
  id               Int      @id @default(autoincrement())
  name             String   @db.VarChar(50)
  description      String?
  personality      String?
  personaUrl       String?  @map("persona_url") @db.VarChar(500)
  isActive         Boolean  @default(true) @map("is_active")
  sortOrder        Int      @default(0) @map("sort_order")
  createdAt        DateTime @map("created_at")
  updatedAt        DateTime? @updatedAt @map("updated_at")

  balanceGameSteps BalanceGameStep[]
  users            User[]

  @@index([isActive, sortOrder])
  @@map("ai_personas")
}
```

**관계**:
- `User.characterId` → `AiPersona.id` (1:N)
- `BalanceGameStep.characterId` → `AiPersona.id` (1:N)

---

## 🔍 AI 페르소나 도메인 정리

### ✅ 잘된 점
1. **체계적인 CRUD 구현**
   - 생성/조회/수정/삭제 모두 구현
   - DTO 기반 타입 안전성

2. **소프트 삭제 및 안전 검증**
   - 하드 삭제 없음 (데이터 보존)
   - 사용 중인 페르소나 삭제 방지
   - 밸런스게임 의존성 체크

3. **정렬 및 필터링**
   - sortOrder로 표시 순서 제어
   - 활성화/비활성화 필터링
   - 관리자/일반 사용자 구분

4. **중복 방지**
   - 이름 중복 검사
   - 수정 시에도 중복 검사

5. **공개 API 설계**
   - 페르소나 목록은 인증 불필요
   - 일반 사용자도 조회 가능
   - 관리 작업만 인증 필요

### 🤔 검토 필요사항

#### 1. 관리자 권한 검증 없음 ⚠️
**위치**: [ai-persona.controller.ts:40-62](src/ai-persona/ai-persona.controller.ts#L40-L62)

**문제**:
- `@UseGuards(JwtAuthGuard)` 사용
- 관리자 권한 검증 없음
- 일반 사용자도 생성/수정/삭제 가능

**현재**:
```typescript
@Post()
@UseGuards(JwtAuthGuard)  // ❌ 인증만 체크
async createPersona(@Body() dto: CreateAiPersonaDto) {
  return this.aiPersonaService.createPersona(dto);
}
```

**권장**:
```typescript
@Post()
@UseGuards(JwtAuthGuard, ManagerGuard)  // ✅ 관리자 권한 체크
async createPersona(@Body() dto: CreateAiPersonaDto) {
  return this.aiPersonaService.createPersona(dto);
}
```

**영향**:
- 보안 취약점 (일반 사용자가 페르소나 생성/수정/삭제 가능)
- User.role이 'ADMIN' 또는 'MANAGER'인 경우에만 허용해야 함

**확인 필요**:
- ManagerGuard 또는 AdminGuard가 존재하는가?
- 없다면 생성 필요

---

#### 2. admin 쿼리 파라미터 검증 없음 ⚠️
**위치**: [ai-persona.controller.ts:84-89](src/ai-persona/ai-persona.controller.ts#L84-L89)

**문제**:
```typescript
async getPersonas(@Query('admin') isAdmin?: string) {
  if (isAdmin === 'true') {
    return this.aiPersonaService.getAllPersonasForAdmin();  // ❌ 누구나 호출 가능
  }
  return this.aiPersonaService.getAllPersonas();
}
```

**현재**:
- 인증 없이 `admin=true` 파라미터만 추가하면 비활성화된 페르소나도 조회 가능
- 보안 문제

**권장**:
```typescript
async getPersonas(
  @Query('admin') isAdmin?: string,
  @Req() req?: any
) {
  if (isAdmin === 'true') {
    // 관리자 권한 확인
    if (!req?.user || req.user.role !== 'ADMIN') {
      throw new ForbiddenException('관리자 권한이 필요합니다');
    }
    return this.aiPersonaService.getAllPersonasForAdmin();
  }
  return this.aiPersonaService.getAllPersonas();
}
```

또는:
```typescript
// 관리자용 엔드포인트 분리
@Get('admin/all')
@UseGuards(JwtAuthGuard, AdminGuard)
async getAllPersonasForAdmin() {
  return this.aiPersonaService.getAllPersonasForAdmin();
}
```

---

#### 3. 페르소나 활성화/비활성화 API 없음
**현재 상황**:
- 삭제는 소프트 삭제 (`isActive = false`)
- 재활성화 API 없음

**시나리오**:
- 관리자가 실수로 페르소나 삭제
- 다시 활성화하려면 PUT API로 `isActive: true` 업데이트 필요
- 직관적이지 않음

**권장**:
```typescript
@Patch(':id/activate')
@UseGuards(JwtAuthGuard, AdminGuard)
async activatePersona(@Param('id', ParseIntPipe) id: number) {
  return this.aiPersonaService.activatePersona(id);
}

@Patch(':id/deactivate')
@UseGuards(JwtAuthGuard, AdminGuard)
async deactivatePersona(@Param('id', ParseIntPipe) id: number) {
  return this.aiPersonaService.deactivatePersona(id);
}
```

---

#### 4. 페르소나 사용 통계 API 없음
**추가하면 유용할 기능**:
```typescript
@Get(':id/stats')
async getPersonaStats(@Param('id', ParseIntPipe) id: number) {
  return {
    totalUsers: 123,        // 이 페르소나 사용 중인 사용자 수
    balanceGames: 5,        // 밸런스게임에서 사용 횟수
    lastUsed: "2025-10-24"  // 마지막 사용 일시
  };
}
```

---

## 🎯 AI 페르소나 도메인 결론

**전반적 평가**: ⚠️ **구현은 잘 되어 있으나 보안 취약점 존재**

- CRUD 로직 완벽
- 소프트 삭제 및 의존성 체크 우수
- 정렬 및 필터링 잘 구현

**필수 개선사항**:
1. **관리자 권한 검증** 추가 (생성/수정/삭제)
2. **admin 쿼리 파라미터 권한 검증** (getAllPersonasForAdmin)

**선택 개선사항**:
1. 활성화/비활성화 전용 API 추가
2. 페르소나 사용 통계 API 추가

---

**AI 페르소나 도메인 감사 완료** ✅
