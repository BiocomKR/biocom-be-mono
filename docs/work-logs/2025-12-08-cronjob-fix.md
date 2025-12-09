# CronJob 배치 작업 긴급 수정 및 재발 방지 시스템 구축

**작업 날짜**: 2025-12-08 (일요일)
**작업자**: Claude Code
**중요도**: 🔴 긴급 (서비스 영향도 높음)

---

## 📋 작업 요약

### 1️⃣ 문제 발견
- GKE CronJob 5개 전체가 2주간 실패 상태
- 배포 시 Deployment만 업데이트되고 CronJob은 방치됨
- 사용자 영양제 생성, 챌린지 활성화/만료 등 주요 기능 미작동

### 2️⃣ 근본 원인
```
❌ Docker 이미지: 2주 전 버전 (20251124182224)
❌ 실행 경로: dist/main.js (잘못된 경로)
❌ 볼륨 누락: logs, kcp-cert-files, firebase-service-account-key
❌ 환경변수 누락: biocom-api-secrets
❌ Deployment와 설정 불일치
```

### 3️⃣ 해결 내용

#### 즉시 수정
- ✅ Docker 이미지: `latest` 태그 사용으로 자동 동기화
- ✅ 실행 경로: `dist/src/main.js` 수정
- ✅ 필수 볼륨 추가: logs, kcp-cert-files, firebase-service-account-key
- ✅ 필수 환경변수 추가: biocom-api-secrets

#### 재발 방지 시스템
- ✅ CI/CD 스크립트 개선 (`02-deploy-app.sh`)
  - 모든 CronJob YAML 자동 감지 및 배포
  - 배포 전 검증 단계 추가
- ✅ 검증 스크립트 추가 (`validate-cronjobs.sh`)
  - 이미지 태그 검증 (latest 사용 필수)
  - 실행 경로 검증 (dist/src/main.js)
  - 필수 볼륨 검증 (logs, kcp-cert-files, firebase-service-account-key)
  - 필수 Secret 검증 (biocom-api-secrets, biocom-api-config)

---

## 🔧 수정된 파일

### CronJob YAML (5개)
1. `cronjob-check-push-schedules.yaml` (매분 실행 - 푸시 알림)
2. `cronjob-activate-challenges.yaml` (월요일 00:05 KST)
3. `cronjob-create-supplements.yaml` (월요일 00:10 KST)
4. `cronjob-expire-challenges.yaml` (매일 자정 KST)
5. `cronjob-iap-acknowledge-retry.yaml` (매시간 정각)

### 배포 스크립트
- `infra-gcp/scripts/02-deploy-app.sh`
  - CronJob 자동 배포 로직 추가
  - 검증 단계 추가

### 검증 스크립트 (신규)
- `infra-gcp/scripts/validate-cronjobs.sh`
  - 배포 전 자동 검증
  - 설정 불일치 사전 차단

---

## 🎯 누락 배치 수동 실행

### 실행 내역 (2025-12-08 12:43 KST)
```bash
# 챌린지 활성화
kubectl create job --from=cronjob/activate-challenges manual-activate-20251208
✅ 완료: 활성화 대상 0건 (정상)

# 영양제 주간 생성
kubectl create job --from=cronjob/create-weekly-supplements manual-supplements-20251208
✅ 완료: 사용자 1명, 영양제 35건 생성 (7일 × 5개)

# 챌린지 만료
kubectl create job --from=cronjob/expire-challenges manual-expire-20251208
✅ 완료: 만료 대상 0건 (정상)
```

---

## 📊 재발 방지 효과

| 항목 | 이전 | 이후 |
|------|------|------|
| Docker 이미지 동기화 | ❌ 수동 (2주간 미업데이트) | ✅ 자동 (latest 태그) |
| CronJob 배포 | ❌ 누락 위험 | ✅ 자동 감지 배포 |
| 설정 검증 | ❌ 없음 | ✅ 배포 전 자동 검증 |
| 문제 감지 시간 | ❌ 2주 (사용자 제보) | ✅ 배포 시점 즉시 |

---

## 🚀 배포 프로세스 개선

### Before (문제 발생)
```bash
# Deployment만 업데이트
kubectl apply -f deployment.yaml
# CronJob은 수동 관리 → 누락 발생!
```

### After (자동화)
```bash
# 1. 검증 (새로 추가!)
bash validate-cronjobs.sh

# 2. 모든 리소스 자동 배포
for cronjob_file in cronjob-*.yaml; do
    kubectl apply -f "$cronjob_file"
done
```

---

## 📝 교훈

### 근본 원인
> **Deployment와 CronJob의 설정 동기화 메커니즘이 없었음**

### 핵심 개선사항
1. **자동화**: 수동 관리 → 자동 감지 배포
2. **검증**: 배포 전 설정 검증으로 사전 차단
3. **표준화**: `latest` 태그 사용으로 버전 관리 단순화

### 향후 과제
- [ ] Prometheus Alert 설정 (CronJob 실패 알림)
- [ ] 주간 헬스체크 자동화
- [ ] Kustomize/Helm 도입 검토

---

## ✅ 체크리스트

- [x] 모든 CronJob 정상 작동 확인
- [x] 누락된 배치 수동 실행 완료
- [x] 검증 스크립트 테스트 통과
- [x] CI/CD 스크립트 개선 완료
- [x] Git 커밋 & Push 완료
- [x] 작업 내역 문서화

---

**작업 완료 시각**: 2025-12-08 12:47 KST
**Git Commit**: af117c5, 534408b
**영향 범위**: 전체 사용자 (영양제 생성, 챌린지 활성화/만료)
