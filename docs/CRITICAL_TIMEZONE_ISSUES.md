# 🚨 중요: 시간대(Timezone) 이슈 체크리스트

## 배경
- Prisma는 **모든 DateTime을 UTC로 저장**
- 한국 시간으로 변환해서 저장해도 Prisma가 자동으로 UTC로 변환
- UTC와 KST는 9시간 차이 (KST = UTC + 9)

## 실제 발생한 이슈
- 2025-07-25 한국 시간 자정이 넘었는데도 UTC 기준으로는 아직 07-24
- 날짜 기반 기능이 작동하지 않음

## 위험 시나리오
1. **이벤트 시작 지연**
   - 한국 시간: 2025-08-01 00:01
   - UTC: 2025-07-31 15:01
   - 결과: 이벤트가 9시간 늦게 시작!

2. **이벤트 조기 종료**
   - 한국 시간: 2025-08-30 23:59
   - UTC: 2025-08-31 14:59
   - 결과: 이벤트가 9시간 일찍 종료!

## 현재 코드 검토 결과

### ✅ 올바르게 처리 중인 부분
- event.controller.ts - `getKoreanTime()` 사용
- event.service.ts - `parseKoreanDate()` 사용
- 대부분의 날짜 계산 로직

### ❌ 수정이 필요한 부분
1. **survey.service.ts:378** - ~~`new Date()` 직접 사용~~ → 수정 완료

### ✅ 자동 시간대 변환 구현 완료 (2025-08-01)
- **Prisma Extension을 통한 자동 변환**
  - 모든 쓰기 작업(create, update 등): KST → UTC 자동 변환
  - 모든 읽기 작업(find 등): UTC → KST 자동 변환
  - 개발자가 별도로 시간대 변환을 신경쓸 필요 없음
- **구현 위치**: `src/common/services/prisma.service.ts`
- **유틸리티**: `src/common/utils/timezone.util.ts`

### ⚠️ 확인이 필요한 부분
1. **이벤트 자동 활성화/비활성화**
   - 현재 `isActive` 플래그로만 관리
   - 날짜 기반 자동 전환 로직 필요할 수 있음

2. **배치 작업이나 스케줄러**
   - 자정 기준 작업들이 KST 기준인지 확인 필요

## 개발 가이드라인

### ✅ 2025-08-01 업데이트: Prisma Extension으로 자동 시간대 변환 구현 완료

이제 개발자는 시간대 변환을 전혀 신경쓰지 않아도 됩니다!

```typescript
// 그냥 JavaScript Date 사용
const today = new Date();
const dateStr = today.toISOString().split('T')[0];

// 날짜 차이 계산도 기본 JavaScript로
const diffTime = date1.getTime() - date2.getTime();
const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
```

**Prisma가 자동으로 처리하는 것들:**
- 쓰기 작업: KST → UTC 자동 변환
- 읽기 작업: UTC → KST 자동 변환
- 모든 모델, 모든 작업에 적용됨

## 테스트 시나리오
1. 서버 시간을 UTC로 설정하고 테스트
2. 자정 전후 (23:50 ~ 00:10) 기능 테스트
3. 이벤트 시작/종료 시점 테스트

---
*마지막 업데이트: 2025-08-01*
*작성자: Claude Code + 형님*

**"이 문서를 무시하면 자정에 장애 전화 받습니다"**