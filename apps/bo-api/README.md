# biocom-bo-api

바이오컴 관리자 백엔드 API (NestJS)

## 프로젝트 구조

```
biocom-bo-api/
├── src/                    # 소스 코드
├── prisma/
│   └── schema.prisma       # Prisma 스키마
├── infra-gcp/              # GCP 인프라 (Terraform, K8s)
├── dist/                   # 빌드 결과물
└── node_modules/           # 의존성
```

## 루트 파일

| 파일 | 용도 |
|-----|------|
| `package.json` | npm 의존성 및 스크립트 |
| `tsconfig.json` | TypeScript 설정 |
| `nest-cli.json` | NestJS CLI 설정 |
| `Dockerfile` | Docker 빌드 설정 |
| `.env.*` | 환경 변수 (local, dev, prod) |
| `HANDOVER.md` | 인수인계 문서 |
| `*-firebase-*.json` | Firebase 푸시 알림용 서비스 계정 |
| `google-service-account-*.json` | GCS 접근용 서비스 계정 |

## 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run start:dev

# 빌드
npm run build

# 프로덕션 실행
npm run start:prod
```

## 배포

GitHub Actions로 자동 배포됨
- `development` push → 개발서버 자동 배포
- `main` push → 운영서버 자동 배포

## 관련 프로젝트

- **biocom-api**: 유저 백엔드
- **biocom-mq**: 메시지 큐 워커
- **biocom-admin**: 관리자 프론트엔드
