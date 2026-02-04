# Prisma Schema 관리 가이드라인

## 🚨 절대 규칙

### ❌ 절대 금지
1. **schema.prisma 파일 직접 덮어쓰기**
   - Git에서 오래된 버전 복원 금지
   - 다른 브랜치에서 무작정 복사 금지
   - 수동으로 전체 내용 교체 금지

2. **필수 모델 삭제**
   - User, UserConsent, RefreshToken 등 핵심 모델 절대 삭제 금지
   - 모델 이름 변경 시 반드시 migration 사용

3. **검증 없는 커밋**
   - `npx prisma validate` 실행 없이 커밋 금지
   - Pre-commit hook 우회(--no-verify) 금지

### ✅ 필수 수행
1. **변경 전 백업**
   ```bash
   cp prisma/schema.prisma prisma/schema.prisma.manual.bak
   ```

2. **변경 후 검증**
   ```bash
   npx prisma validate
   npx prisma format
   npx prisma generate
   ```

3. **테스트 실행**
   ```bash
   npm run test
   ```

## 🛡️ 자동 보호 장치

### Pre-commit Hook
- schema.prisma 변경 시 자동 실행
- 필수 모델 10개 존재 여부 확인:
  - User
  - UserConsent
  - RefreshToken
  - Product
  - Order
  - ChallengeTicket
  - UserChallenge
  - AiPersona
  - PhoneVerificationLog
  - Subscription
- Prisma schema 문법 검증
- 자동 백업 생성

### Post-commit Hook
- 커밋 후 자동 백업 생성
- 타임스탬프 형식: `schema.prisma.YYYYMMDD_HHMMSS.bak`
- 최근 10개 백업만 유지

## 📝 Schema 변경 절차

### 1. 새 모델 추가
```bash
# 1. schema.prisma 수정
# 2. 검증
npx prisma validate

# 3. migration 생성
npx prisma migrate dev --name add_new_model

# 4. Prisma Client 재생성
npx prisma generate

# 5. 커밋 (자동 검증 실행됨)
git add prisma/schema.prisma
git commit -m "feat: 새 모델 추가"
```

### 2. 기존 모델 수정
```bash
# 1. 백업
cp prisma/schema.prisma prisma/schema.prisma.manual.bak

# 2. schema.prisma 수정
# 3. 검증
npx prisma validate

# 4. migration 생성
npx prisma migrate dev --name update_model

# 5. Prisma Client 재생성
npx prisma generate

# 6. 커밋
git add prisma/schema.prisma
git commit -m "refactor: 모델 수정"
```

### 3. 긴급 복구
```bash
# 최신 백업에서 복원
cp prisma/schema.prisma.YYYYMMDD_HHMMSS.bak prisma/schema.prisma

# 또는 Git에서 복원
git checkout HEAD~1 prisma/schema.prisma

# 검증
npx prisma validate
npx prisma generate
```

## 🔍 트러블슈팅

### Q: "Cannot read properties of undefined (reading 'create')" 에러 발생
**원인:** DB에는 테이블이 있지만 Prisma schema에 모델 정의 누락

**해결:**
1. 백업 파일 확인: `ls -lt prisma/*.bak`
2. 누락된 모델 복원
3. `npx prisma generate` 실행
4. 배포

### Q: Pre-commit Hook이 작동하지 않음
**원인:** Hook 파일 실행 권한 없음

**해결:**
```bash
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/post-commit
```

### Q: Merge 충돌 발생
**해결:**
1. **절대 "Accept Incoming" 선택하지 말 것**
2. 양쪽 버전 모두 확인
3. 필수 모델 10개가 모두 있는지 수동 확인
4. 충돌 해결 후 `npx prisma validate` 실행

## 📊 필수 모델 체크리스트
커밋 전 수동 확인:

- [ ] User
- [ ] UserConsent
- [ ] RefreshToken
- [ ] Product
- [ ] Order
- [ ] ChallengeTicket
- [ ] UserChallenge
- [ ] AiPersona
- [ ] PhoneVerificationLog
- [ ] Subscription

## 🎯 베스트 프랙티스

1. **작은 단위로 변경**
   - 한 번에 하나의 모델만 수정
   - 대규모 리팩토링 지양

2. **Migration 활용**
   - `prisma migrate dev` 적극 활용
   - 수동 SQL 보다 migration 우선

3. **정기 백업 확인**
   - 주 1회 백업 파일 개수 확인
   - 오래된 백업 정리

4. **팀과 동기화**
   - Schema 변경 시 팀원에게 알림
   - Slack/Discord 공유

---

**마지막 업데이트:** 2025-11-19
**작성자:** Claude Code
**목적:** UserConsent 모델 유실 사건 재발 방지
